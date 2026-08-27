const crypto = require('crypto');
const keyManagementService = require('./KeyManagementService');

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

function createTask({ case_id, node_id, task_type, idempotency_key, allowed_capability, params, deadlineAt }) {
  const task = {
    protocol_version: 1,
    task_id: crypto.randomUUID(),
    case_id,
    node_id,
    task_type,
    issued_at: new Date().toISOString(),
    deadline_at: deadlineAt.toISOString(),
    idempotency_key,
    authorization: {
      grant_id: crypto.randomUUID(),
      allowed_capability
    },
    params
  };
  return {
    ...task,
    signature: keyManagementService.createSignature(JSON.stringify(canonicalize(task)))
  };
}

module.exports = { canonicalize, createTask };
