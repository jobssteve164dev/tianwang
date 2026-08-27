const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const z = require('zod/v4');
const InvestigationService = require('../services/InvestigationService');
const ResponsePlanService = require('../services/ResponsePlanService');
const mcpAuthService = require('../services/McpAuthService');

const investigationService = new InvestigationService();
const responsePlanService = new ResponsePlanService();

function result(value, resourceLinks = []) {
  return {
    content: [
      { type: 'text', text: JSON.stringify(value) },
      ...resourceLinks
    ],
    structuredContent: value
  };
}

function createMcpServer(context, options = {}) {
  const investigations = options.investigations || investigationService;
  const responses = options.responses || responsePlanService;
  const server = new McpServer({ name: 'tianwang-security', version: '1.0.0' });

  server.registerTool('list_nodes', {
    description: '列出当前访问令牌获授权的天网节点',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async () => result({ nodes: await investigations.listNodes(context) }));

  server.registerTool('get_node_status', {
    description: '读取一个获授权节点的当前状态',
    inputSchema: { node_id: z.string().min(1) },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ node_id }) => {
    const node = await investigations.getNode(context, node_id);
    return result({ node_id: node.agent_id, hostname: node.hostname, platform: node.platform, version: node.version, status: node.status, last_seen: node.last_seen });
  });

  server.registerTool('get_node_capabilities', {
    description: '读取节点真实声明的取证、响应能力与本地上限',
    inputSchema: { node_id: z.string().min(1) },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ node_id }) => result(investigations.getCapabilities(await investigations.getNode(context, node_id))));

  server.registerTool('capture_network', {
    description: '在指定节点发起受限抓包，并同步返回连接与进程等主机上下文的证据引用',
    inputSchema: {
      node_id: z.string().min(1),
      interface: z.string().default('auto'),
      duration_seconds: z.number().int().min(1).max(120),
      filter: z.object({
        peer_ips: z.array(z.string()).max(32).default([]),
        protocols: z.array(z.enum(['tcp', 'udp', 'icmp', 'icmp6'])).max(4).default([]),
        ports: z.array(z.number().int().min(1).max(65535)).max(32).default([])
      }).default({ peer_ips: [], protocols: [], ports: [] }),
      max_bytes: z.number().int().min(1024).max(52428800),
      include_context: z.array(z.enum(['connections', 'processes', 'system', 'firewall'])).max(4).default(['connections', 'processes']),
      reason: z.string().min(1).max(500)
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async input => {
    const investigation = await investigations.captureNetwork(context, input);
    const links = (investigation.evidence_manifest?.artifacts || []).map(artifact => ({
      type: 'resource_link',
      uri: artifact.resource_uri,
      name: artifact.artifact_id,
      mimeType: artifact.type,
      description: `SHA-256 ${artifact.sha256}`
    }));
    links.unshift({
      type: 'resource_link',
      uri: investigation.result.manifest_uri,
      name: 'evidence-manifest',
      mimeType: 'application/json',
      description: '调查证据清单与完整性摘要'
    });
    return result(investigation, links);
  });

  server.registerTool('get_investigation', {
    description: '查询调查状态、证据清单和错误',
    inputSchema: { investigation_id: z.string().uuid() },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ investigation_id }) => result(await investigations.getInvestigation(context, investigation_id)));

  server.registerTool('collect_host_snapshot', {
    description: '按明确范围采集指定节点的连接、进程、系统和防火墙快照',
    inputSchema: {
      node_id: z.string().min(1),
      include_context: z.array(z.enum(['connections', 'processes', 'system', 'firewall'])).min(1).max(4),
      reason: z.string().min(1).max(500)
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async input => result(await investigations.collectHostSnapshot(context, input)));

  const findingSchema = {
    investigation_id: z.string().uuid(),
    case_id: z.string().uuid(),
    node_id: z.string().min(1),
    classification: z.enum(['no_evidence', 'suspicious', 'probable_compromise', 'confirmed_compromise']),
    confidence: z.number().min(0).max(1),
    evidence_refs: z.array(z.string().uuid()).min(1),
    observations: z.array(z.object({ type: z.string().min(1), subject: z.string().min(1), evidence_ref: z.string().uuid() })).default([]),
    limitations: z.array(z.string()).default([])
  };
  server.registerTool('submit_finding', {
    description: '提交引用具体证据的外部智能体判断',
    inputSchema: findingSchema,
    annotations: { readOnlyHint: false, openWorldHint: false }
  }, async input => result(await responses.submitFinding(context, input)));

  const actionSchema = z.object({
    id: z.string().min(1).max(100),
    type: z.literal('block_remote_ip'),
    target: z.string().min(1),
    ttl_seconds: z.number().int().min(60).max(3600),
    expected_effect: z.string().min(1).max(500)
  }).strict();
  const planSchema = {
    case_id: z.string().uuid(),
    node_id: z.string().min(1),
    finding_ref: z.string().uuid(),
    evidence_refs: z.array(z.string().uuid()).min(1),
    idempotency_key: z.string().min(1).max(255),
    actions: z.array(actionSchema).length(1),
    verification: z.array(z.object({ type: z.literal('connection_absent'), target: z.string().min(1) }).strict()).length(1),
    rollback: z.array(z.object({ type: z.literal('remove_created_firewall_rule'), action_ref: z.string().min(1) }).strict()).length(1)
  };

  server.registerTool('validate_response_plan', {
    description: '静态校验处置方案；不会改变节点状态',
    inputSchema: planSchema,
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async input => result(await responses.validatePlan(context, input)));

  server.registerTool('submit_response_plan', {
    description: '提交通过校验的不可变处置方案版本',
    inputSchema: planSchema,
    annotations: { readOnlyHint: false, openWorldHint: false }
  }, async input => result(await responses.submitPlan(context, input)));

  server.registerTool('execute_response_plan', {
    description: '显式执行已提交且当前令牌有执行权限的处置方案，并采集新状态验证效果',
    inputSchema: { plan_id: z.string().uuid() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ plan_id }) => result(await responses.executePlan(context, plan_id)));

  server.registerTool('get_response_execution', {
    description: '查询处置动作、验证状态、到期时间与回滚句柄',
    inputSchema: { plan_id: z.string().uuid() },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ plan_id }) => {
    mcpAuthService.requireScope(context, 'response.validate');
    return result(responses.plain(await responses.getPlan(context, plan_id)));
  });

  server.registerTool('rollback_response_plan', {
    description: '仅撤销指定处置方案创建的防火墙规则',
    inputSchema: { plan_id: z.string().uuid() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
  }, async ({ plan_id }) => result(await responses.rollbackPlan(context, plan_id)));

  server.registerResource(
    'evidence-manifest',
    new ResourceTemplate('tianwang://nodes/{nodeId}/investigations/{investigationId}/manifest', { list: undefined }),
    { description: '调查证据清单、上下文与清单 SHA-256', mimeType: 'application/json' },
    async (uri, variables) => {
      const resource = await investigations.readResource(context, variables);
      return { contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(resource.data) }] };
    }
  );

  server.registerResource(
    'evidence-artifact',
    new ResourceTemplate('tianwang://nodes/{nodeId}/investigations/{investigationId}/artifacts/{artifactId}', { list: undefined }),
    { description: '经过重新授权和哈希校验的调查证据制品' },
    async (uri, variables) => {
      const resource = await investigations.readResource(context, variables);
      return { contents: [{ uri: uri.toString(), mimeType: resource.metadata.type, blob: resource.content.toString('base64') }] };
    }
  );

  return server;
}

module.exports = { createMcpServer };
