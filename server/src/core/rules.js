function invalid(message) {
  return Object.assign(new Error(message), { code: 'RULE_INVALID', statusCode: 400 });
}

function fieldValue(data, field) {
  if (Object.hasOwn(data, field)) return data[field];
  return field.split('.').reduce((value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined, data);
}

function selectionPredicate(selection) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) || !Object.keys(selection).length) throw invalid('检测条件不能为空');
  const fields = Object.entries(selection).map(([field, expected]) => {
    const [key, ...modifiers] = field.split('|');
    if (!key || modifiers.some(value => !['contains', 'startswith', 'endswith', 'all', 'gt', 'gte', 'lt', 'lte'].includes(value))) throw invalid(`不支持的匹配方式：${field}`);
    const mode = modifiers.find(value => value !== 'all');
    if (modifiers.filter(value => value !== 'all').length > 1) throw invalid('每个字段只能使用一种匹配方式');
    const values = Array.isArray(expected) ? expected : [expected];
    if (!values.length || values.some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))) throw invalid(`字段值无效：${key}`);
    return data => {
      const actual = fieldValue(data, key);
      const matches = value => {
        if (value === null) return actual === undefined || actual === null;
        if (actual === undefined || actual === null) return false;
        if (['gt', 'gte', 'lt', 'lte'].includes(mode)) {
          const left = Number(actual), right = Number(value);
          if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
          return { gt: left > right, gte: left >= right, lt: left < right, lte: left <= right }[mode];
        }
        const left = String(actual).toLowerCase(), right = String(value).toLowerCase();
        if (mode === 'contains') return left.includes(right);
        if (mode === 'startswith') return left.startsWith(right);
        if (mode === 'endswith') return left.endsWith(right);
        return left === right;
      };
      return modifiers.includes('all') ? values.every(matches) : values.some(matches);
    };
  });
  return data => fields.every(match => match(data));
}

export function compileRule(rule) {
  if (!rule || typeof rule.title !== 'string' || !rule.title.trim() || !['low', 'medium', 'high', 'critical'].includes(rule.level || 'medium')) throw invalid('请填写规则名称和有效的严重级别');
  if (!rule.logsource || typeof rule.logsource !== 'object' || Array.isArray(rule.logsource)) throw invalid('请填写日志来源');
  const detection = rule.detection;
  if (!detection || typeof detection.condition !== 'string') throw invalid('请填写检测表达式');
  const selections = Object.fromEntries(Object.entries(detection).filter(([key]) => key !== 'condition').map(([key, value]) => [key, selectionPredicate(value)]));
  const tokens = detection.condition.match(/[A-Za-z_][A-Za-z_0-9]*|[()]|\S/g) || [];
  let cursor = 0;
  const atom = () => {
    const token = tokens[cursor++];
    if (token === 'not') { const match = atom(); return data => !match(data); }
    if (token === '(') { const match = expression(); if (tokens[cursor++] !== ')') throw invalid('检测表达式缺少右括号'); return match; }
    if (!Object.hasOwn(selections, token)) throw invalid(`未定义的检测条件：${token || ''}`);
    return selections[token];
  };
  const conjunction = () => {
    let match = atom();
    while (tokens[cursor] === 'and') { cursor++; const left = match, right = atom(); match = data => left(data) && right(data); }
    return match;
  };
  const expression = () => {
    let match = conjunction();
    while (tokens[cursor] === 'or') { cursor++; const left = match, right = conjunction(); match = data => left(data) || right(data); }
    return match;
  };
  const match = expression();
  if (cursor !== tokens.length) throw invalid('检测表达式无效，仅支持 and、or、not 与括号');
  return data => data && typeof data === 'object' && Object.entries(rule.logsource).every(([key, value]) => !value || String(data[key] || '').toLowerCase() === String(value).toLowerCase()) && match(data);
}
