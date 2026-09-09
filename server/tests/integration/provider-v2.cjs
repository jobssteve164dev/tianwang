const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('app provider adapters send authenticated requests and return normalized analysis', async () => {
  const { requestCompletion } = await import('../../src/core/providers.js');
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ headers: req.headers, body: JSON.parse(body), url: req.url });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/messages' ? { content: [{ type: 'text', text: 'analysis' }], usage: { input_tokens: 2, output_tokens: 3 } } : { choices: [{ message: { content: 'analysis' } }], usage: { prompt_tokens: 2, completion_tokens: 3 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const provider of ['openai', 'claude', 'openrouter', 'deepseek']) {
      const result = await requestCompletion(provider, { api_key: 'fixture-secret', default_model: 'fixture-model' }, 'analyze', { endpoint: `http://127.0.0.1:${server.address().port}/${provider === 'claude' ? 'messages' : 'chat/completions'}` });
      assert.equal(result.text, 'analysis');
      assert.equal(result.inputTokens, 2);
      assert.equal(result.outputTokens, 3);
      assert.equal(requests.at(-1).body.model, 'fixture-model');
      if (provider === 'claude') assert.equal(requests.at(-1).headers['x-api-key'], 'fixture-secret');
      else assert.equal(requests.at(-1).headers.authorization, 'Bearer fixture-secret');
    }
    await assert.rejects(() => requestCompletion('unknown', { api_key: 'fixture' }, 'test'), { code: 'PROVIDER_CONFIG_INVALID' });
    await assert.rejects(() => requestCompletion('openai', { api_key: 'fixture', default_model: 'fixture' }, 'test', { endpoint: 'http://127.0.0.1:1' }), { code: 'PROVIDER_UNAVAILABLE' });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('provider failure bodies never escape and shutdown cancels an unfinished response', async () => {
  const { requestCompletion } = await import('../../src/core/providers.js');
  const server = http.createServer((req, res) => {
    if (req.url === '/fail') { res.writeHead(401); res.end('secret-provider-response'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(() => requestCompletion('openai', { api_key: 'fixture', default_model: 'fixture' }, 'test', { endpoint: `${endpoint}/fail` }), error => error.code === 'PROVIDER_UNAVAILABLE' && !error.message.includes('secret'));
    const abort = new AbortController();
    const pending = requestCompletion('openai', { api_key: 'fixture', default_model: 'fixture' }, 'test', { endpoint: `${endpoint}/wait`, signal: abort.signal });
    abort.abort();
    await assert.rejects(pending, { code: 'PROVIDER_UNAVAILABLE' });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('intelligence adapters distinguish an empty IP lookup from an actual match', async () => {
  const { requestIntelligence } = await import('../../src/core/intelligence.js');
  let incoming;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    incoming = { headers: req.headers, method: req.method, body: body && JSON.parse(body) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/misp' ? { response: { Attribute: [{ value: '198.51.100.1' }] } } : { pulse_info: { count: 0 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const misp = await requestIntelligence('misp', { apiKey: 'fixture' }, '198.51.100.1', { endpoint: `${endpoint}/misp` });
    assert.equal(misp.matches, 1);
    assert.equal(incoming.method, 'POST');
    assert.equal(incoming.body.value, '198.51.100.1');
    assert.equal(incoming.headers.authorization, 'fixture');
    const otx = await requestIntelligence('otx', { apiKey: 'fixture' }, '198.51.100.1', { endpoint: `${endpoint}/otx` });
    assert.equal(otx.matches, 0);
    assert.equal(incoming.headers['x-otx-api-key'], 'fixture');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
