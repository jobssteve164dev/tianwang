const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class EvidenceStorageService {
  constructor(options = {}) {
    this.rootPath = options.rootPath || config.mcp.evidencePath;
    this.fs = options.fs || fs;
  }

  safeSegment(value, name) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
      throw Object.assign(new Error(`${name} 格式不合法`), { code: 'INVALID_EVIDENCE_ID' });
    }
    return value;
  }

  async storeArtifacts(nodeId, investigationId, artifacts) {
    const safeNode = this.safeSegment(nodeId, 'node_id');
    const safeInvestigation = this.safeSegment(investigationId, 'investigation_id');
    const directory = path.join(this.rootPath, safeNode, safeInvestigation);
    await this.fs.mkdir(directory, { recursive: true });

    const stored = [];
    for (const artifact of artifacts || []) {
      const artifactId = this.safeSegment(artifact.artifact_id, 'artifact_id');
      const content = Buffer.from(artifact.content_base64 || '', 'base64');
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (!artifact.content_base64 || actualHash !== artifact.sha256 || content.length !== artifact.size_bytes) {
        throw Object.assign(new Error(`证据完整性校验失败: ${artifactId}`), { code: 'EVIDENCE_INTEGRITY_FAILED' });
      }
      const filePath = path.join(directory, `${artifactId}.bin`);
      await this.fs.writeFile(filePath, content, { flag: 'wx' });
      stored.push({
        ...artifact,
        content_base64: undefined,
        resource_uri: `tianwang://nodes/${safeNode}/investigations/${safeInvestigation}/artifacts/${artifactId}`,
        storage_path: filePath
      });
    }
    return stored;
  }

  createManifest({ nodeId, investigationId, artifacts, context, expiresAt }) {
    const manifest = {
      version: 1,
      node_id: nodeId,
      investigation_id: investigationId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      untrusted_evidence_content: true,
      artifacts: artifacts.map(artifact => {
        const publicArtifact = { ...artifact };
        delete publicArtifact.storage_path;
        return publicArtifact;
      }),
      context
    };
    return {
      ...manifest,
      sha256: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
    };
  }

  async readArtifact(metadata) {
    const content = await this.fs.readFile(metadata.storage_path);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    if (actualHash !== metadata.sha256 || content.length !== metadata.size_bytes) {
      throw Object.assign(new Error('证据文件完整性校验失败'), { code: 'EVIDENCE_INTEGRITY_FAILED' });
    }
    return content;
  }

  artifactPath(nodeId, investigationId, artifactId) {
    return path.join(
      this.rootPath,
      this.safeSegment(nodeId, 'node_id'),
      this.safeSegment(investigationId, 'investigation_id'),
      `${this.safeSegment(artifactId, 'artifact_id')}.bin`
    );
  }
}

module.exports = EvidenceStorageService;
