const crypto = require('crypto');
const config = require('../config');
const models = require('../models');
const WebSocketService = require('./WebSocketService');
const EvidenceStorageService = require('./EvidenceStorageService');
const { createTask } = require('./TaskEnvelopeService');
const securityEventService = require('./SecurityEventService');
const auditTrailService = require('./AuditTrailService');
const mcpAuthService = require('./McpAuthService');

class InvestigationService {
  constructor(options = {}) {
    this.models = options.models || models;
    this.gateway = options.gateway || WebSocketService;
    this.evidence = options.evidence || new EvidenceStorageService();
    this.events = options.events || securityEventService;
    this.audit = options.audit || auditTrailService;
  }

  async listNodes(context) {
    mcpAuthService.requireScope(context, 'nodes.read');
    const nodes = await this.models.Agent.findAll({
      where: { organization_id: context.organization_id, agent_id: context.node_ids },
      attributes: ['agent_id', 'hostname', 'platform', 'version', 'status', 'capabilities', 'last_seen']
    });
    return nodes.map(node => node.toJSON ? node.toJSON() : node);
  }

  async getNode(context, nodeId) {
    mcpAuthService.requireScope(context, 'nodes.read');
    mcpAuthService.requireNode(context, nodeId);
    const node = await this.models.Agent.findOne({ where: { agent_id: nodeId, organization_id: context.organization_id } });
    if (!node) throw Object.assign(new Error('节点不存在或不属于当前组织'), { code: 'NODE_NOT_FOUND' });
    return node;
  }

  getCapabilities(node) {
    const available = new Set(node.capabilities || []);
    return {
      node_id: node.agent_id,
      collection: {
        network_capture: available.has('network-capture'),
        connection_snapshot: available.has('network-monitoring'),
        process_snapshot: available.has('system-monitoring')
      },
      response: { block_remote_ip: available.has('response-plan-v1') },
      limits: {
        max_capture_seconds: config.mcp.maxCaptureSeconds,
        max_capture_bytes: config.mcp.maxCaptureBytes,
        max_concurrent_investigations: 1
      }
    };
  }

  async captureNetwork(context, input) {
    mcpAuthService.requireScope(context, 'network.capture');
    mcpAuthService.requireNode(context, input.node_id);
    this.validateCaptureInput(input);
    const node = await this.getNode({ ...context, scopes: [...new Set([...context.scopes, 'nodes.read'])] }, input.node_id);
    if (node.status !== 'online') throw Object.assign(new Error('目标节点不在线'), { code: 'NODE_OFFLINE' });
    if (!(node.capabilities || []).includes('network-capture')) {
      throw Object.assign(new Error('目标节点未声明网络抓包能力'), { code: 'CAPABILITY_UNAVAILABLE' });
    }

    const caseId = crypto.randomUUID();
    const deadlineAt = new Date(Date.now() + (input.duration_seconds + 30) * 1000);
    const expiresAt = new Date(Date.now() + config.mcp.evidenceTtlSeconds * 1000);
    const investigation = await this.models.Investigation.create({
      case_id: caseId,
      node_id: input.node_id,
      source: 'mcp',
      requested_by: context.subject,
      authorization_grant_id: context.grant_id,
      organization_id: context.organization_id,
      request_scope: input,
      status: 'authorized',
      deadline_at: deadlineAt,
      expires_at: expiresAt
    });

    const task = createTask({
      case_id: caseId,
      node_id: input.node_id,
      task_type: 'capture-network',
      idempotency_key: `${investigation.id}-capture-1`,
      allowed_capability: 'network.capture',
      deadlineAt,
      params: {
        interface: input.interface || 'auto',
        duration_seconds: input.duration_seconds,
        max_bytes: input.max_bytes,
        filter: input.filter || {},
        include_context: input.include_context || []
      }
    });

    await investigation.update({ status: 'dispatched', task_id: task.task_id, started_at: new Date() });
    await this.audit.record('investigation.dispatched', 'investigation', investigation.id, context, { node_id: input.node_id, task_id: task.task_id });

    try {
      const receipt = await this.gateway.dispatchTask(input.node_id, task, {
        timeoutMs: (input.duration_seconds + 30) * 1000,
        onProgress: progress => investigation.update({ status: progress.phase === 'started' ? 'collecting' : 'collecting' })
      });
      const contextSnapshot = receipt.result?.context || {};
      const storedArtifacts = await this.evidence.storeArtifacts(
        input.node_id,
        investigation.id,
        [...(receipt.result?.artifacts || []), this.createContextArtifact(contextSnapshot, node.platform)]
      );
      const manifest = this.evidence.createManifest({
        nodeId: input.node_id,
        investigationId: investigation.id,
        artifacts: storedArtifacts,
        context: contextSnapshot,
        expiresAt
      });
      const result = {
        context: contextSnapshot,
        artifact_count: storedArtifacts.length,
        manifest_uri: `tianwang://nodes/${input.node_id}/investigations/${investigation.id}/manifest`
      };
      await investigation.update({ status: 'succeeded', evidence_manifest: manifest, result, finished_at: new Date() });
      await this.events.record({
        type: 'mcp_investigation',
        alert_type: 'suspicious-connection',
        severity: 'medium',
        title: '外部智能体网络调查已完成',
        description: `节点 ${input.node_id} 的受限网络调查已生成可验证证据`,
        agent_id: input.node_id,
        device_id: node.device_id,
        organization_id: context.organization_id,
        source: 'mcp',
        details: { case_id: caseId, investigation_id: investigation.id, manifest_sha256: manifest.sha256 },
        evidence: { manifest_uri: result.manifest_uri, artifacts: manifest.artifacts },
        tags: ['mcp', 'investigation']
      });
      await this.audit.record('investigation.succeeded', 'investigation', investigation.id, context, { manifest_sha256: manifest.sha256 });
      return this.serialize(investigation);
    } catch (error) {
      await investigation.update({ status: 'failed', error_code: error.code || 'INVESTIGATION_FAILED', error_message: error.message, finished_at: new Date() });
      throw error;
    }
  }

  async collectHostSnapshot(context, input) {
    mcpAuthService.requireScope(context, 'host.snapshot');
    mcpAuthService.requireNode(context, input.node_id);
    if (!Array.isArray(input.include_context) || input.include_context.length === 0) {
      throw Object.assign(new Error('主机快照必须明确选择采集范围'), { code: 'SNAPSHOT_SCOPE_REQUIRED' });
    }
    const node = await this.getNode({ ...context, scopes: [...new Set([...context.scopes, 'nodes.read'])] }, input.node_id);
    if (node.status !== 'online') throw Object.assign(new Error('目标节点不在线'), { code: 'NODE_OFFLINE' });
    if (!(node.capabilities || []).includes('host-snapshot')) {
      throw Object.assign(new Error('目标节点未声明主机快照能力'), { code: 'CAPABILITY_UNAVAILABLE' });
    }

    const caseId = crypto.randomUUID();
    const deadlineAt = new Date(Date.now() + 30000);
    const expiresAt = new Date(Date.now() + config.mcp.evidenceTtlSeconds * 1000);
    const investigation = await this.models.Investigation.create({
      case_id: caseId,
      node_id: input.node_id,
      source: 'mcp',
      requested_by: context.subject,
      authorization_grant_id: context.grant_id,
      organization_id: context.organization_id,
      request_scope: input,
      status: 'authorized',
      deadline_at: deadlineAt,
      expires_at: expiresAt
    });
    const task = createTask({
      case_id: caseId,
      node_id: input.node_id,
      task_type: 'collect-host-snapshot',
      idempotency_key: `${investigation.id}-snapshot-1`,
      allowed_capability: 'host.snapshot',
      deadlineAt,
      params: { include_context: input.include_context }
    });
    await investigation.update({ status: 'dispatched', task_id: task.task_id, started_at: new Date() });
    try {
      const receipt = await this.gateway.dispatchTask(input.node_id, task, { timeoutMs: 30000 });
      const contextSnapshot = receipt.result?.context || {};
      const storedArtifacts = await this.evidence.storeArtifacts(
        input.node_id,
        investigation.id,
        [this.createContextArtifact(contextSnapshot, node.platform)]
      );
      const manifest = this.evidence.createManifest({
        nodeId: input.node_id,
        investigationId: investigation.id,
        artifacts: storedArtifacts,
        context: contextSnapshot,
        expiresAt
      });
      const result = {
        context: contextSnapshot,
        artifact_count: storedArtifacts.length,
        manifest_uri: `tianwang://nodes/${input.node_id}/investigations/${investigation.id}/manifest`
      };
      await investigation.update({ status: 'succeeded', evidence_manifest: manifest, result, finished_at: new Date() });
      await this.audit.record('investigation.snapshot_succeeded', 'investigation', investigation.id, context, { node_id: input.node_id, manifest_sha256: manifest.sha256 });
      return this.serialize(investigation);
    } catch (error) {
      await investigation.update({ status: 'failed', error_code: error.code || 'SNAPSHOT_FAILED', error_message: error.message, finished_at: new Date() });
      throw error;
    }
  }

  validateCaptureInput(input) {
    if (!Number.isInteger(input.duration_seconds) || input.duration_seconds < 1 || input.duration_seconds > config.mcp.maxCaptureSeconds) {
      throw Object.assign(new Error(`抓包时长必须在 1-${config.mcp.maxCaptureSeconds} 秒内`), { code: 'INVALID_CAPTURE_DURATION' });
    }
    if (!Number.isInteger(input.max_bytes) || input.max_bytes < 1024 || input.max_bytes > config.mcp.maxCaptureBytes) {
      throw Object.assign(new Error(`抓包上限必须在 1024-${config.mcp.maxCaptureBytes} 字节内`), { code: 'INVALID_CAPTURE_SIZE' });
    }
    const serialized = JSON.stringify(input);
    if (/"(?:command|shell|script|bpf)"\s*:/.test(serialized)) {
      throw Object.assign(new Error('调查请求不接受命令、脚本或原始 BPF'), { code: 'FORBIDDEN_CAPTURE_PARAMETER' });
    }
  }

  createContextArtifact(context, platform) {
    const content = Buffer.from(JSON.stringify({
      untrusted_evidence_content: true,
      collected_at: new Date().toISOString(),
      context
    }));
    return {
      artifact_id: crypto.randomUUID(),
      type: 'application/json',
      size_bytes: content.length,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      content_base64: content.toString('base64'),
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      collector: { name: 'tianwang-host-snapshot', version: 1, platform },
      truncated: false,
      metrics: {}
    };
  }

  async getInvestigation(context, investigationId) {
    mcpAuthService.requireScope(context, 'nodes.read');
    const investigation = await this.models.Investigation.findOne({
      where: { id: investigationId, organization_id: context.organization_id }
    });
    if (!investigation) throw Object.assign(new Error('调查不存在'), { code: 'INVESTIGATION_NOT_FOUND' });
    mcpAuthService.requireNode(context, investigation.node_id);
    return this.serialize(investigation);
  }

  async readResource(context, { nodeId, investigationId, artifactId }) {
    mcpAuthService.requireScope(context, 'evidence.read');
    mcpAuthService.requireNode(context, nodeId);
    const investigation = await this.models.Investigation.findOne({
      where: { id: investigationId, node_id: nodeId, organization_id: context.organization_id, status: 'succeeded' }
    });
    if (!investigation) throw Object.assign(new Error('证据资源不存在或未授权'), { code: 'EVIDENCE_NOT_FOUND' });
    if (new Date(investigation.expires_at).getTime() <= Date.now()) {
      throw Object.assign(new Error('证据资源已到期'), { code: 'EVIDENCE_EXPIRED' });
    }
    if (!artifactId) return { type: 'manifest', data: investigation.evidence_manifest };
    const metadata = investigation.evidence_manifest?.artifacts?.find(item => item.artifact_id === artifactId);
    if (!metadata) throw Object.assign(new Error('证据制品不存在'), { code: 'ARTIFACT_NOT_FOUND' });
    const content = await this.evidence.readArtifact({
      ...metadata,
      storage_path: this.evidence.artifactPath(nodeId, investigationId, artifactId)
    });
    return { type: 'artifact', metadata, content };
  }

  serialize(record) {
    const value = record.toJSON ? record.toJSON() : record;
    return {
      id: value.id,
      case_id: value.case_id,
      node_id: value.node_id,
      status: value.status,
      task_id: value.task_id,
      evidence_manifest: value.evidence_manifest,
      result: value.result,
      error: value.error_code ? { code: value.error_code, message: value.error_message } : null,
      started_at: value.started_at,
      finished_at: value.finished_at,
      expires_at: value.expires_at
    };
  }
}

module.exports = InvestigationService;
