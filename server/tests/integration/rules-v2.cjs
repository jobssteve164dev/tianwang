const { test } = require('node:test');
const assert = require('node:assert/strict');

test('app rules honor all fields, exclusions, list alternatives, and log source', async () => {
  const { compileRule } = await import('../../src/core/rules.js');
  const rule = { title: 'Suspicious command', level: 'high', logsource: { product: 'linux' }, detection: {
    selection: { 'message|contains|all': ['curl', 'sh'], user: ['root', 'admin'] },
    filter: { 'message|contains': 'approved' }, condition: 'selection and not filter'
  } };
  const match = compileRule(rule);
  assert.equal(match({ product: 'linux', message: 'curl example | sh', user: 'root' }), true);
  assert.equal(match({ product: 'linux', message: 'curl example | sh', user: 'guest' }), false);
  assert.equal(match({ product: 'linux', message: 'curl example | sh approved', user: 'root' }), false);
  assert.equal(match({ product: 'windows', message: 'curl example | sh', user: 'root' }), false);
  assert.throws(() => compileRule({ ...rule, detection: { selection: {}, condition: 'missing' } }), { code: 'RULE_INVALID' });
  assert.throws(() => compileRule({ ...rule, detection: { selection: { 'message|unsupported': 'a' }, condition: 'selection' } }), { code: 'RULE_INVALID' });
});
