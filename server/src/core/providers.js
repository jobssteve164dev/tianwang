const endpoints = Object.freeze({
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions'
});

export const providerNames = Object.keys(endpoints);

export async function requestCompletion(provider, config, prompt, { endpoint, signal } = {}) {
  if (!Object.hasOwn(endpoints, provider) || !config?.api_key || !config.default_model) {
    throw Object.assign(new Error('请填写有效的提供商、密钥和模型'), { code: 'PROVIDER_CONFIG_INVALID' });
  }
  const anthropic = provider === 'claude';
  const headers = { 'Content-Type': 'application/json', ...(anthropic
    ? { 'x-api-key': config.api_key, 'anthropic-version': '2023-06-01' }
    : { Authorization: `Bearer ${config.api_key}` }) };
  const body = { model: config.default_model, messages: [{ role: 'user', content: prompt }], stream: false };
  if (anthropic) body.max_tokens = 4096;
  try {
    const response = await fetch(endpoint || endpoints[provider], {
      method: 'POST', headers, body: JSON.stringify(body), signal, redirect: 'error'
    });
    if (!response.ok) throw new Error('Provider request rejected');
    const data = await response.json();
    const text = anthropic ? data.content?.filter(item => item.type === 'text').map(item => item.text).join('\n') : data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Provider response invalid');
    return { text, provider, model: config.default_model,
      inputTokens: data.usage?.input_tokens ?? data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? data.usage?.completion_tokens ?? null };
  } catch {
    // Provider bodies, headers and request URLs may contain credentials.
    throw Object.assign(new Error('AI 服务暂时不可用，请稍后重试'), { code: 'PROVIDER_UNAVAILABLE' });
  }
}
