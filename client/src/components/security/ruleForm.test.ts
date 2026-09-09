import { normalizeRuleForm, previewRule } from './ruleForm';

test('rule conditions entered as YAML become executable fields and preserve arrays', () => {
  const value = { title: '登录: 异常', detection: { selection: 'message|contains:\n  - failed login\n  - denied', condition: 'selection' } };
  expect(normalizeRuleForm(value).detection.selection).toEqual({ 'message|contains': ['failed login', 'denied'] });
  expect(normalizeRuleForm({ ...value, detection: { ...value.detection, selection: { message: 'blocked' } } }).detection.selection).toEqual({ message: 'blocked' });
  expect(previewRule(value)).not.toContain('[object Object]');
  expect(previewRule(value)).toContain("title: '登录: 异常'");
});

test('invalid condition input cannot be submitted as an empty or string rule', () => {
  for (const selection of ['[]', 'message: [', 'null', 'plain text']) {
    expect(() => normalizeRuleForm({ detection: { selection, condition: 'selection' } })).toThrow();
  }
});
