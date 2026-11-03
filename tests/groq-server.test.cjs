const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const modulePromise = import(pathToFileURL(path.join(__dirname, '../server/groqProxy.mjs')));
const KEY = 'gsk_test_only_never_a_real_credential';
const MODEL = 'openai/gpt-oss-120b';

async function serverFixture(t, options = {}) {
  const { createGroqMiddleware } = await modulePromise;
  const calls = [];
  const middleware = createGroqMiddleware({ rootDir: __dirname, getKey: () => options.key === undefined ? KEY : options.key,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (options.fetchImpl) return options.fetchImpl(url, init);
      return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }) };
    } });
  const server = http.createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()).catch(() => res.writeHead(500).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const port = server.address().port;
  const request = (route, body, headers = {}, method) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: route, method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers } }, res => {
      let raw = '';
      res.setEncoding('utf8'); res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : undefined, raw, headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
  return { calls, request, port };
}
const payload = { messages: [{ role: 'system', content: '문서를 분석하세요.' }, { role: 'user', content: '가상 테스트 문서' }] };

test('server reads the named .env field without needing a VITE variable', async () => {
  const { readGroqKey } = await modulePromise;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-env-test-'));
  const previous = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY;
    fs.writeFileSync(path.join(temp, '.env'), `GROQ_API_KEY="${KEY}"\n`);
    assert.equal(readGroqKey(temp), KEY);
    process.env.GROQ_API_KEY = 'injected-test-key';
    assert.equal(readGroqKey(temp), 'injected-test-key');
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previous;
    fs.unlinkSync(path.join(temp, '.env')); fs.rmdirSync(temp);
  }
});

test('configuration exposes only provider, model and presence, never the secret', async t => {
  const { request, calls } = await serverFixture(t);
  const response = await request('/api/groq/config');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { configured: true, provider: 'Groq', model: MODEL });
  assert.ok(!response.raw.includes(KEY));
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 0);
});

test('completion uses the fixed Groq endpoint and server-only Authorization', async t => {
  const { request, calls, port } = await serverFixture(t);
  const response = await request('/api/groq/chat', payload, { Origin: `http://127.0.0.1:${port}` });
  assert.equal(response.status, 200);
  assert.equal(response.body.content, '{"ok":true}');
  assert.equal(response.body.model, MODEL);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(JSON.parse(calls[0].init.body).model, MODEL);
  assert.ok(!calls[0].init.body.includes(KEY));
  assert.ok(!response.raw.includes(KEY));
});

test('missing keys do not call a provider or pretend success', async t => {
  const { request, calls } = await serverFixture(t, { key: '' });
  assert.equal((await request('/api/groq/config')).body.configured, false);
  const response = await request('/api/groq/chat', payload);
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'GROQ_KEY_MISSING');
  assert.equal(calls.length, 0);
});

test('cross-origin and nonlocal-host requests cannot use the local credential', async t => {
  const { request, calls } = await serverFixture(t);
  assert.equal((await request('/api/groq/chat', payload, { Origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await request('/api/groq/chat', payload, { Host: 'attacker.invalid' })).status, 403);
  assert.equal(calls.length, 0);
});

test('unsupported modalities, model overrides and malformed formats are rejected', async t => {
  const { request, calls } = await serverFixture(t);
  for (const body of [
    { ...payload, model: 'another/model' },
    { messages: [{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,x'}}]}] },
    { ...payload, max_completion_tokens: 999999 },
    { ...payload, response_format: {type:'json_schema',json_schema:{strict:false,schema:{type:'object'}}} },
  ]) assert.equal((await request('/api/groq/chat', body)).status, 400);
  assert.equal(calls.length, 0);
});

test('provider failures are sanitized and retain actionable HTTP status', async t => {
  for (const [upstreamStatus, expectedStatus] of [[401,401],[403,401],[429,429],[400,502],[500,502]]) {
    const { request } = await serverFixture(t, { fetchImpl: async () => ({ ok:false,status:upstreamStatus, json:async()=>({error:{message:KEY}}) }) });
    const response = await request('/api/groq/chat', payload);
    assert.equal(response.status, expectedStatus);
    assert.ok(!response.raw.includes(KEY));
  }
});

test('truncation and provider network failures never return partial success or secrets', async t => {
  const cases = [
    async () => ({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'partial'}}]})}),
    async () => { throw new Error(`provider url with key=${KEY}`); },
  ];
  for (const fetchImpl of cases) {
    const { request } = await serverFixture(t, {fetchImpl});
    const response = await request('/api/groq/chat', payload);
    assert.equal(response.status, 502);
    assert.ok(!response.raw.includes('partial') && !response.raw.includes(KEY));
  }
});
