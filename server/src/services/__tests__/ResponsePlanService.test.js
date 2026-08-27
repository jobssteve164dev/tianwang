const crypto = require('crypto');
const keyManagementService = require('../KeyManagementService');
const ResponsePlanService = require('../ResponsePlanService');

class Record {
  constructor(value) { Object.assign(this, value); }
  async update(value) { Object.assign(this, value); return this; }
  toJSON() { return { ...this }; }
}

describe('ResponsePlanService closed loop', () => {
  const findingId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const evidenceId = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const context = {
    subject: 'external-agent-1',
    organization_id: organizationId,
    node_ids: ['node-1'],
    grant_id: 'grant-1',
    scopes: ['response.validate', 'response.submit', 'response.execute', 'response.rollback']
  };

  beforeAll(() => {
    const keys = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    keyManagementService.publicKey = keys.publicKey;
    keyManagementService.privateKey = keys.privateKey;
  });

  test('submits, executes, verifies, deduplicates and precisely rolls back one R2 plan', async () => {
    let storedPlan;
    const models = {
      Finding: { findOne: jest.fn().mockResolvedValue(new Record({ id: findingId, evidence_refs: [evidenceId] })) },
      Agent: { findOne: jest.fn().mockResolvedValue(new Record({ agent_id: 'node-1', capabilities: ['response-plan-v1'] })) },
      ResponsePlan: {
        findOne: jest.fn(async ({ where }) => {
          if (!storedPlan) return null;
          if (where.idempotency_key) return where.idempotency_key === storedPlan.idempotency_key ? storedPlan : null;
          return where.id === storedPlan.id ? storedPlan : null;
        }),
        create: jest.fn(async value => {
          storedPlan = new Record({ id: crypto.randomUUID(), ...value });
          return storedPlan;
        })
      }
    };
    const gateway = {
      dispatchTask: jest.fn()
        .mockResolvedValueOnce({ result: { execution_id: 'case-plan-1', rule_id: 'rule-1', expires_at: new Date(Date.now() + 900000).toISOString() } })
        .mockResolvedValueOnce({ result: { target: '203.0.113.10', present: false, verification: 'verified' } })
        .mockResolvedValueOnce({ result: { execution_id: 'case-plan-1', status: 'rolled_back' } })
    };
    const service = new ResponsePlanService({
      models,
      gateway,
      events: { record: jest.fn().mockResolvedValue({}) },
      audit: { record: jest.fn().mockResolvedValue({}) }
    });
    const input = {
      case_id: caseId,
      node_id: 'node-1',
      finding_ref: findingId,
      evidence_refs: [evidenceId],
      idempotency_key: 'case-plan-1',
      actions: [{ id: 'action-1', type: 'block_remote_ip', target: '203.0.113.10', ttl_seconds: 900, expected_effect: 'block suspicious egress' }],
      verification: [{ type: 'connection_absent', target: '203.0.113.10' }],
      rollback: [{ type: 'remove_created_firewall_rule', action_ref: 'action-1' }]
    };

    const submitted = await service.submitPlan(context, input);
    expect(submitted.status).toBe('submitted');
    const duplicate = await service.submitPlan(context, input);
    expect(duplicate.id).toBe(submitted.id);
    expect(models.ResponsePlan.create).toHaveBeenCalledTimes(1);
    await expect(service.submitPlan(context, {
      ...input,
      actions: [{ ...input.actions[0], target: '203.0.113.11' }],
      verification: [{ type: 'connection_absent', target: '203.0.113.11' }]
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });

    const executed = await service.executePlan(context, submitted.id);
    expect(executed.status).toBe('verified');
    expect(executed.execution.verification.verification).toBe('verified');
    const rolledBack = await service.rollbackPlan(context, submitted.id);
    expect(rolledBack.status).toBe('rolled_back');
    expect(gateway.dispatchTask).toHaveBeenCalledTimes(3);
    expect(gateway.dispatchTask.mock.calls[2][1]).toMatchObject({
      task_type: 'rollback-firewall',
      params: { execution_id: 'case-plan-1' }
    });
  });

  test('rejects command text and wildcard-bearing plans', async () => {
    const service = new ResponsePlanService({
      models: {
        Finding: { findOne: jest.fn().mockResolvedValue(new Record({ evidence_refs: [evidenceId] })) },
        Agent: { findOne: jest.fn().mockResolvedValue(new Record({ capabilities: ['response-plan-v1'] })) }
      }
    });
    const validation = await service.validatePlan(context, {
      case_id: caseId,
      node_id: 'node-1',
      finding_ref: findingId,
      evidence_refs: [evidenceId],
      idempotency_key: 'unsafe-plan',
      command: 'iptables -F',
      actions: [{ id: 'action-1', type: 'block_remote_ip', target: '*', ttl_seconds: 900 }],
      verification: [{ type: 'connection_absent', target: '*' }],
      rollback: [{ type: 'remove_created_firewall_rule', action_ref: 'action-1' }]
    });
    expect(validation.valid).toBe(false);
    expect(validation.rejection_reasons.join(' ')).toContain('不得包含命令');
  });
});
