const net = require('net');
const models = require('../models');
const WebSocketService = require('./WebSocketService');
const { createTask } = require('./TaskEnvelopeService');
const mcpAuthService = require('./McpAuthService');
const securityEventService = require('./SecurityEventService');
const auditTrailService = require('./AuditTrailService');

const CLASSIFICATIONS = new Set(['no_evidence', 'suspicious', 'probable_compromise', 'confirmed_compromise']);
const IMMUTABLE_PLAN_FIELDS = ['case_id', 'node_id', 'finding_ref', 'evidence_refs', 'actions', 'verification', 'rollback'];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

class ResponsePlanService {
  constructor(options = {}) {
    this.models = options.models || models;
    this.gateway = options.gateway || WebSocketService;
    this.events = options.events || securityEventService;
    this.audit = options.audit || auditTrailService;
  }

  async submitFinding(context, input) {
    mcpAuthService.requireScope(context, 'findings.write');
    mcpAuthService.requireNode(context, input.node_id);
    if (!CLASSIFICATIONS.has(input.classification) || input.confidence < 0 || input.confidence > 1) {
      throw Object.assign(new Error('Finding 分类或置信度不合法'), { code: 'INVALID_FINDING' });
    }
    const investigation = await this.models.Investigation.findOne({
      where: { id: input.investigation_id, case_id: input.case_id, node_id: input.node_id, organization_id: context.organization_id, status: 'succeeded' }
    });
    if (!investigation) throw Object.assign(new Error('Finding 未关联到已完成且授权的调查'), { code: 'INVALID_FINDING_REFERENCE' });
    const artifactIds = new Set(investigation.evidence_manifest?.artifacts?.map(item => item.artifact_id) || []);
    if (!input.evidence_refs?.length || input.evidence_refs.some(ref => !artifactIds.has(ref))) {
      throw Object.assign(new Error('Finding 必须只引用当前调查中的具体证据'), { code: 'INVALID_EVIDENCE_REFERENCE' });
    }
    if ((input.observations || []).some(item => !input.evidence_refs.includes(item.evidence_ref))) {
      throw Object.assign(new Error('Finding 观察项引用了未声明的证据'), { code: 'INVALID_OBSERVATION_REFERENCE' });
    }
    if (input.classification === 'confirmed_compromise' && input.evidence_refs.length < 2) {
      throw Object.assign(new Error('confirmed_compromise 至少需要两项独立证据'), { code: 'EVIDENCE_THRESHOLD_NOT_MET' });
    }

    const finding = await this.models.Finding.create({
      ...input,
      submitted_by: context.subject,
      organization_id: context.organization_id
    });
    if (input.classification !== 'no_evidence') {
      const severity = input.classification === 'confirmed_compromise'
        ? 'critical'
        : (input.classification === 'probable_compromise' ? 'high' : 'medium');
      await this.events.record({
        type: 'mcp_finding',
        alert_type: 'suspicious-connection',
        severity,
        title: '外部智能体提交安全调查结论',
        description: `节点 ${input.node_id} 的调查结论为 ${input.classification}，置信度 ${input.confidence}`,
        agent_id: input.node_id,
        organization_id: context.organization_id,
        source: 'mcp',
        details: { finding_id: finding.id, investigation_id: input.investigation_id, classification: input.classification, confidence: input.confidence },
        evidence: { evidence_refs: input.evidence_refs },
        tags: ['mcp', 'finding', input.classification]
      });
    }
    await this.audit.record('finding.submitted', 'finding', finding.id, context, {
      investigation_id: input.investigation_id,
      classification: input.classification,
      evidence_refs: input.evidence_refs
    });
    return this.plain(finding);
  }

  async validatePlan(context, input) {
    mcpAuthService.requireScope(context, 'response.validate');
    mcpAuthService.requireNode(context, input.node_id);
    const rejectionReasons = [];
    if (!input.idempotency_key || input.idempotency_key.length > 255) rejectionReasons.push('缺少有效幂等键');
    if (!Array.isArray(input.actions) || input.actions.length !== 1) rejectionReasons.push('首版处置方案必须且只能包含一个动作');
    if (!Array.isArray(input.verification) || input.verification.length !== 1) rejectionReasons.push('首版处置方案必须包含一个验证步骤');
    if (!Array.isArray(input.rollback) || input.rollback.length !== 1) rejectionReasons.push('首版处置方案必须包含一个精确回滚步骤');
    if (this.containsForbiddenKeys(input)) rejectionReasons.push('方案不得包含命令、脚本、原始参数或通配目标');

    const action = input.actions?.[0];
    if (!action || action.type !== 'block_remote_ip' || !net.isIP(action.target)) {
      rejectionReasons.push('首版仅支持精确 IP 的 block_remote_ip 动作');
    }
    if (!Number.isInteger(action?.ttl_seconds) || action.ttl_seconds < 60 || action.ttl_seconds > 3600) {
      rejectionReasons.push('临时阻断 TTL 必须在 60-3600 秒内');
    }
    if (['127.0.0.1', '::1'].includes(action?.target)) rejectionReasons.push('禁止阻断本地回环地址');
    const verification = input.verification?.[0];
    if (verification?.type !== 'connection_absent' || verification?.target !== action?.target) {
      rejectionReasons.push('验证步骤必须确认同一目标 IP 的连接已消失');
    }
    const rollback = input.rollback?.[0];
    if (rollback?.type !== 'remove_created_firewall_rule' || rollback?.action_ref !== action?.id) {
      rejectionReasons.push('回滚步骤必须精确引用该动作创建的防火墙规则');
    }

    const finding = await this.models.Finding.findOne({
      where: { id: input.finding_ref, case_id: input.case_id, node_id: input.node_id, organization_id: context.organization_id }
    });
    if (!finding) rejectionReasons.push('方案未关联当前授权范围内的 Finding');
    else if (input.evidence_refs?.some(ref => !(finding.evidence_refs || []).includes(ref))) {
      rejectionReasons.push('方案引用了 Finding 之外的证据');
    }

    const node = await this.models.Agent.findOne({ where: { agent_id: input.node_id, organization_id: context.organization_id } });
    if (!node || !(node.capabilities || []).includes('response-plan-v1')) rejectionReasons.push('节点不支持首版结构化响应');

    return {
      valid: rejectionReasons.length === 0,
      risk_level: 'R2',
      requires_explicit_execution: true,
      executable: rejectionReasons.length === 0 && context.scopes.includes('response.execute'),
      rejection_reasons: rejectionReasons
    };
  }

  async submitPlan(context, input) {
    mcpAuthService.requireScope(context, 'response.submit');
    const existing = await this.models.ResponsePlan.findOne({
      where: { idempotency_key: input.idempotency_key, organization_id: context.organization_id }
    });
    if (existing) {
      const existingValue = this.plain(existing);
      const existingPayload = Object.fromEntries(IMMUTABLE_PLAN_FIELDS.map(field => [field, existingValue[field]]));
      const requestedPayload = Object.fromEntries(IMMUTABLE_PLAN_FIELDS.map(field => [field, input[field]]));
      if (JSON.stringify(canonicalize(existingPayload)) !== JSON.stringify(canonicalize(requestedPayload))) {
        throw Object.assign(new Error('幂等键已用于另一份不可变处置方案'), { code: 'IDEMPOTENCY_KEY_REUSED' });
      }
      return existingValue;
    }
    const validation = await this.validatePlan({ ...context, scopes: [...new Set([...context.scopes, 'response.validate'])] }, input);
    if (!validation.valid) {
      throw Object.assign(new Error(`处置方案校验失败: ${validation.rejection_reasons.join('；')}`), { code: 'RESPONSE_PLAN_REJECTED', validation });
    }
    const plan = await this.models.ResponsePlan.create({
      ...input,
      version: 1,
      validation,
      status: 'submitted',
      submitted_by: context.subject,
      organization_id: context.organization_id
    });
    await this.audit.record('response_plan.submitted', 'response_plan', plan.id, context, { node_id: input.node_id, risk_level: 'R2' }, 'medium');
    return this.plain(plan);
  }

  async executePlan(context, planId) {
    mcpAuthService.requireScope(context, 'response.execute');
    const plan = await this.getPlan(context, planId);
    if (plan.status === 'verified' || plan.status === 'not_verified') return this.plain(plan);
    if (plan.status !== 'submitted') throw Object.assign(new Error(`方案当前状态不可执行: ${plan.status}`), { code: 'PLAN_NOT_EXECUTABLE' });

    const action = plan.actions[0];
    const deadlineAt = new Date(Date.now() + 30000);
    const actionTask = createTask({
      case_id: plan.case_id,
      node_id: plan.node_id,
      task_type: 'block-remote-ip',
      idempotency_key: plan.idempotency_key,
      allowed_capability: 'response.block_ip',
      deadlineAt,
      params: { target: action.target, ttl_seconds: action.ttl_seconds, reason: action.expected_effect }
    });
    await plan.update({ status: 'executing' });

    let actionReceipt;
    try {
      actionReceipt = await this.gateway.dispatchTask(plan.node_id, actionTask, { timeoutMs: 30000 });
    } catch (error) {
      await plan.update({ status: 'execution_failed', execution: { error: { code: error.code, message: error.message } } });
      throw error;
    }

    try {
      const verificationTask = createTask({
        case_id: plan.case_id,
        node_id: plan.node_id,
        task_type: 'verify-connection-absent',
        idempotency_key: `${plan.idempotency_key}-verify-1`,
        allowed_capability: 'response.verify',
        deadlineAt: new Date(Date.now() + 30000),
        params: { target: action.target }
      });
      const verificationReceipt = await this.gateway.dispatchTask(plan.node_id, verificationTask, { timeoutMs: 30000 });
      const verificationResult = verificationReceipt.result;
      const status = verificationResult.verification === 'verified' ? 'verified' : 'not_verified';
      const execution = {
        action: actionReceipt.result,
        verification: verificationResult,
        rollback_handle: { plan_id: plan.id, execution_id: plan.idempotency_key }
      };
      await plan.update({
        status,
        execution,
        executed_at: new Date(),
        expires_at: actionReceipt.result?.expires_at || new Date(Date.now() + action.ttl_seconds * 1000)
      });
      await this.events.record({
        type: 'mcp_response',
        alert_type: 'suspicious-connection',
        severity: status === 'verified' ? 'high' : 'critical',
        title: status === 'verified' ? '外部智能体处置已验证' : '外部智能体处置未达到预期',
        description: `节点 ${plan.node_id} 对 ${action.target} 的临时阻断状态为 ${status}`,
        agent_id: plan.node_id,
        organization_id: context.organization_id,
        target_ip: action.target,
        source: 'mcp',
        details: { case_id: plan.case_id, response_plan_id: plan.id, execution },
        evidence: { evidence_refs: plan.evidence_refs },
        tags: ['mcp', 'response', status]
      });
      await this.audit.record('response_plan.executed', 'response_plan', plan.id, context, { status, execution }, 'high');
      return this.plain(plan);
    } catch (error) {
      await plan.update({
        status: 'verification_failed',
        executed_at: new Date(),
        expires_at: actionReceipt.result?.expires_at || new Date(Date.now() + action.ttl_seconds * 1000),
        execution: {
          action: actionReceipt.result,
          verification: { verification: 'verification_failed', error: { code: error.code, message: error.message } },
          rollback_handle: { plan_id: plan.id, execution_id: plan.idempotency_key }
        }
      });
      await this.audit.record('response_plan.verification_failed', 'response_plan', plan.id, context, { error: { code: error.code, message: error.message } }, 'high');
      return this.plain(plan);
    }
  }

  async rollbackPlan(context, planId) {
    mcpAuthService.requireScope(context, 'response.rollback');
    const plan = await this.getPlan(context, planId);
    if (plan.status === 'rolled_back') return this.plain(plan);
    if (!plan.execution?.rollback_handle) throw Object.assign(new Error('该方案没有可用回滚句柄'), { code: 'ROLLBACK_UNAVAILABLE' });
    const task = createTask({
      case_id: plan.case_id,
      node_id: plan.node_id,
      task_type: 'rollback-firewall',
      idempotency_key: `${plan.idempotency_key}-rollback-1`,
      allowed_capability: 'response.rollback',
      deadlineAt: new Date(Date.now() + 30000),
      params: { execution_id: plan.execution.rollback_handle.execution_id }
    });
    const receipt = await this.gateway.dispatchTask(plan.node_id, task, { timeoutMs: 30000 });
    await plan.update({
      status: 'rolled_back',
      rolled_back_at: new Date(),
      execution: { ...plan.execution, rollback: receipt.result }
    });
    await this.audit.record('response_plan.rolled_back', 'response_plan', plan.id, context, { receipt: receipt.result }, 'high');
    return this.plain(plan);
  }

  async getPlan(context, planId) {
    const plan = await this.models.ResponsePlan.findOne({ where: { id: planId, organization_id: context.organization_id } });
    if (!plan) throw Object.assign(new Error('处置方案不存在'), { code: 'PLAN_NOT_FOUND' });
    mcpAuthService.requireNode(context, plan.node_id);
    return plan;
  }

  containsForbiddenKeys(value) {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) =>
      ['command', 'shell', 'script', 'powershell', 'bpf', 'raw_args'].includes(key.toLowerCase()) ||
      (typeof child === 'string' && child.includes('*')) ||
      this.containsForbiddenKeys(child)
    );
  }

  plain(record) {
    return record.toJSON ? record.toJSON() : record;
  }
}

module.exports = ResponsePlanService;
