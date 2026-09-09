import { dump, load } from 'js-yaml';

export function normalizeRuleForm<T extends Record<string, any>>(value: T) {
  const input = value.detection?.selection;
  let selection: unknown;
  try { selection = typeof input === 'string' ? load(input) : input || {}; }
  catch { throw new Error('选择条件格式有误，请检查缩进、引号和列表'); }
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new Error('请按“字段: 值”填写选择条件');
  }
  return { ...value, detection: { ...value.detection, selection, condition: value.detection?.condition || 'selection' } };
}

export function previewRule(value: Record<string, any>) {
  return dump(normalizeRuleForm(value), { noRefs: true, lineWidth: 100 });
}
