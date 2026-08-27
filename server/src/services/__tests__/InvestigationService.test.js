const crypto = require('crypto');
const InvestigationService = require('../InvestigationService');
const EvidenceStorageService = require('../EvidenceStorageService');
const keyManagementService = require('../KeyManagementService');

class Record {
  constructor(value) { Object.assign(this, value); }
  async update(value) { Object.assign(this, value); return this; }
  toJSON() { return { ...this }; }
}

describe('InvestigationService evidence loop', () => {
  const organizationId = crypto.randomUUID();
  const context = {
    subject: 'external-agent-1',
    organization_id: organizationId,
    node_ids: ['node-1'],
    scopes: ['network.capture', 'nodes.read', 'evidence.read'],
    grant_id: 'grant-1'
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

  test('routes a signed bounded task and persists a hash-addressable manifest', async () => {
    const bytes = Buffer.from('pcap-test-content');
    const artifactId = crypto.randomUUID();
    let investigation;
    const models = {
      Agent: {
        findOne: jest.fn().mockResolvedValue(new Record({
          agent_id: 'node-1',
          status: 'online',
          platform: 'linux',
          capabilities: ['network-capture'],
          organization_id: organizationId,
          device_id: crypto.randomUUID()
        }))
      },
      Investigation: {
        create: jest.fn(async value => {
          investigation = new Record({ id: crypto.randomUUID(), ...value });
          return investigation;
        }),
        findOne: jest.fn(async () => investigation)
      }
    };
    const evidence = {
      storeArtifacts: jest.fn(async (_node, _investigation, artifacts) => artifacts.map(({ content_base64, ...artifact }) => ({
        ...artifact,
        storage_path: '/internal/path',
        resource_uri: `tianwang://evidence/${artifact.artifact_id}`
      }))),
      createManifest: jest.fn(({ nodeId, investigationId, artifacts, context: snapshot, expiresAt }) => ({
        version: 1,
        node_id: nodeId,
        investigation_id: investigationId,
        artifacts: artifacts.map(({ storage_path, ...artifact }) => artifact),
        context: snapshot,
        expires_at: expiresAt.toISOString(),
        sha256: 'manifest-hash'
      }))
    };
    const gateway = {
      dispatchTask: jest.fn().mockResolvedValue({
        status: 'succeeded',
        result: {
          artifacts: [{
            artifact_id: artifactId,
            type: 'application/vnd.tcpdump.pcap',
            size_bytes: bytes.length,
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            content_base64: bytes.toString('base64')
          }],
          context: { connections: { total: 1 }, processes: [] }
        }
      })
    };
    const service = new InvestigationService({
      models,
      gateway,
      evidence,
      events: { record: jest.fn().mockResolvedValue({}) },
      audit: { record: jest.fn().mockResolvedValue({}) }
    });

    const result = await service.captureNetwork(context, {
      node_id: 'node-1',
      interface: 'auto',
      duration_seconds: 1,
      max_bytes: 1024 * 1024,
      filter: { peer_ips: ['203.0.113.10'], protocols: ['tcp'], ports: [443] },
      include_context: ['connections', 'processes'],
      reason: 'investigate suspicious egress'
    });

    expect(result.status).toBe('succeeded');
    expect(result.evidence_manifest.sha256).toBe('manifest-hash');
    expect(gateway.dispatchTask.mock.calls[0][1]).toMatchObject({
      protocol_version: 1,
      node_id: 'node-1',
      task_type: 'capture-network',
      authorization: { allowed_capability: 'network.capture' }
    });
    expect(gateway.dispatchTask.mock.calls[0][1].signature).toBeTruthy();
    expect(evidence.storeArtifacts.mock.calls[0][2][0].content_base64).toBeTruthy();
  });

  test('rejects evidence whose payload does not match declared hash', async () => {
    const files = new Map();
    const memoryFs = {
      mkdir: jest.fn(),
      writeFile: jest.fn(async (filePath, content) => { files.set(filePath, Buffer.from(content)); }),
      readFile: jest.fn(async filePath => files.get(filePath))
    };
    const storage = new EvidenceStorageService({ rootPath: '/evidence', fs: memoryFs });
    await expect(storage.storeArtifacts('node-1', crypto.randomUUID(), [{
      artifact_id: crypto.randomUUID(),
      content_base64: Buffer.from('tampered').toString('base64'),
      sha256: crypto.createHash('sha256').update('original').digest('hex'),
      size_bytes: 8,
      type: 'application/vnd.tcpdump.pcap'
    }])).rejects.toMatchObject({ code: 'EVIDENCE_INTEGRITY_FAILED' });
    expect(memoryFs.writeFile).not.toHaveBeenCalled();
  });
});
