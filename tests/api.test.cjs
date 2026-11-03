const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs } = require('./helpers.cjs');
const MODEL = 'openai/gpt-oss-120b';
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
function emptyResult() {
  return { summary: { score: '안전', bullets: ['모든 조항을 검토했습니다.'], riskReasons: [] }, highlights: [], compoundRisks: [], clauseAssessments: [], missingInformation: [], evidenceChecks: [], verificationGuide: [], warnings: [] };
}
function highlight(id, clauseId, text, type = 'DANGER') {
  return { id, clauseId, type, originalText: text, easyText: '추가 업무에 보수를 받지 못할 수 있습니다.', reason: '추가 업무와 보수 청구 제한이 연결됩니다.', affectedParty: '을', riskCategories: ['FINANCIAL_RISK'], severity: 'HIGH' };
}
function harness(handler = () => null, options = {}) {
  const calls = [];
  const fetchMock = async (url, init = {}) => {
    calls.push({ url, init });
    assert.ok(url === '/api/groq/config' || url === '/api/groq/chat', 'Only the local proxy may be contacted');
    assert.equal(init.credentials, 'same-origin');
    assert.ok(!init.headers?.Authorization && !init.headers?.authorization, 'Browser must not handle an API token');
    if (url === '/api/groq/config') return response({ configured: options.configured !== false, model: MODEL, provider: 'Groq' });
    const body = JSON.parse(init.body);
    const result = await handler(body, calls);
    if (result && result.status) return response(result.data, result.status);
    return response({ content: typeof result === 'string' ? result : JSON.stringify(result), model: options.responseModel || MODEL });
  };
  return { calls, api: loadTs('src/utils/groq.ts', { fetch: fetchMock, globals: options.globals, localStorage: { getItem() { throw new Error('No browser storage access allowed'); }, setItem() { throw new Error('No browser storage access allowed'); } } }) };
}
function inputOf(body) { return JSON.parse(body.messages[1].content); }
function factsResponse(body) {
  const input = inputOf(body);
  return { fullText: input.documentText, facts: input.clauses.map(c => ({ clauseId: c.id, quote: c.text, rights: [], obligations: [c.text], exceptions: [], affectedParties: ['을'], references: c.references })), warnings: [] };
}
function riskResponse(body, danger = false) {
  const input = inputOf(body);
  const result = emptyResult();
  result.clauseAssessments = input.clauses.map((c, index) => {
    if (danger && index === 0) { result.highlights.push(highlight('h1', c.id, c.text)); return { clauseId: c.id, status: 'RISK', highlightIds: ['h1'] }; }
    return { clauseId: c.id, status: 'NONE', highlightIds: [] };
  });
  return result;
}
function isFacts(body) { return body.response_format?.json_schema.name === 'document_facts'; }
const fixtureText = '제1조 업무\n① 을은 매월 보고서를 제출한다.\n제2조 비용\n① 업무 증가에 대한 추가 보수는 청구할 수 없다.';

test('client uses the fixed Groq model without browser credentials or model storage', async () => {
  const { api } = harness();
  const config = await api.getGroqConfig();
  assert.equal(config.model, MODEL);
  assert.equal(api.DEFAULT_MODEL, MODEL);
  assert.equal(config.provider, 'Groq');
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/groq.ts'), 'utf8');
  assert.ok(!/localStorage|sessionStorage|VITE_|GoogleGenerativeAI|generativelanguage/.test(source));
});

test('invalid JSON and missing required fields are not successful analyses', () => {
  const { api } = harness();
  for (const raw of ['{broken', '{}', '[]', 'null', '{"summary":{"score":"안전"},"highlights":[]}']) assert.throws(() => api.cleanAndParseJSON(raw), /검증/);
});

test('duplicate highlight IDs and unresolved compound links are rejected', () => {
  const { api } = harness();
  const result = emptyResult();
  result.highlights = [highlight('h1', 'c1', '조항 하나'), highlight('h1', 'c2', '조항 둘')];
  result.clauseAssessments = [{ clauseId: 'c1', status: 'RISK', highlightIds: ['h1'] }];
  assert.throws(() => api.cleanAndParseJSON(JSON.stringify(result)), /검증/);
  result.highlights = [highlight('h1', 'c1', '조항 하나')];
  result.compoundRisks = [{ title: '잘못된 연결', reason: '근거 없는 ID', relatedHighlights: ['h1', 'missing'], severity: 'HIGH', riskCategories: ['FINANCIAL_RISK'] }];
  const parsed = api.cleanAndParseJSON(JSON.stringify(result));
  assert.equal(parsed.compoundRisks.length, 0);
});

test('normal ACTION metadata is not counted as risk and all highlights survive parsing', () => {
  const { api } = harness();
  const result = emptyResult();
  result.highlights = Array.from({ length: 20 }, (_, i) => highlight(`h${i}`, `c${i}`, `보고서 ${i}를 제출한다.`, 'ACTION'));
  result.clauseAssessments = result.highlights.map(h => ({ clauseId: h.clauseId, status: 'ACTION', highlightIds: [h.id] }));
  const parsed = api.cleanAndParseJSON(JSON.stringify(result));
  assert.equal(parsed.highlights.length, 20);
  assert.ok(parsed.highlights.every(h => !h.riskCategories?.length));
  assert.equal(parsed.summary.signalCount, 0);
});

function verifyStrictSchema(schema) {
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach(verifyStrictSchema);
  }
  if (schema.items) verifyStrictSchema(schema.items);
  if (schema.anyOf) schema.anyOf.forEach(verifyStrictSchema);
}
test('two distinct structured stages cover every clause and record the actual fixed model', async () => {
  const events = [];
  const { api, calls } = harness(body => isFacts(body) ? factsResponse(body) : riskResponse(body, true));
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText, onProgress: (percent, message) => events.push({ percent, message }) });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, '/api/groq/config');
  assert.equal(result.analysis.mode, 'ai');
  assert.equal(result.analysis.model, MODEL);
  assert.equal(result.analysis.analyzedClauseCount, result.analysis.totalClauseCount);
  assert.ok(result.analysis.totalClauseCount >= 2);
  assert.ok(result.highlights[0].sourceSpans?.length);
  assert.notEqual(result.summary.score, '안전');
  assert.deepEqual(events.map(e => e.percent), [5, 15, 45, 55, 85, 100]);
  for (const call of calls.slice(1)) {
    const body = JSON.parse(call.init.body);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    verifyStrictSchema(body.response_format.json_schema.schema);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].role, 'user');
    assert.ok(body.messages[0].content.includes('신뢰할 수 없는 분석 자료'));
    assert.ok(!Object.hasOwn(body, 'model'));
  }
});

test('risk schema constrains both category lists to the codes accepted by the parser', async () => {
  const { api, calls } = harness(body => isFacts(body) ? factsResponse(body) : riskResponse(body, true));
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'ai');
  const schema = JSON.parse(calls[2].init.body).response_format.json_schema.schema;
  for (const field of ['highlights', 'compoundRisks']) {
    const values = schema.properties[field].items.properties.riskCategories.items.enum;
    assert.deepEqual(values, Array.from(api.ALL_RISK_CATEGORIES));
    assert.ok(!values.includes('Unilateral Change'));
  }
  const invalid = emptyResult();
  invalid.highlights = [highlight('h1', 'c1', '업무 변경')];
  invalid.highlights[0].riskCategories = ['Unilateral Change'];
  invalid.clauseAssessments = [{ clauseId: 'c1', status: 'RISK', highlightIds: ['h1'] }];
  assert.throws(() => api.cleanAndParseJSON(JSON.stringify(invalid)), /검증/);
});

test('401 invalid-key errors stop immediately and never expose upstream text', async () => {
  const { api, calls } = harness(() => ({ status: 401, data: { error: { code: 'GROQ_KEY_INVALID', message: 'provider.invalid?key=secret-test-token' } } }));
  await assert.rejects(api.analyzeDocumentWithGroq({ text: fixtureText }), e => {
    assert.match(e.message, /Groq API 키/);
    assert.ok(!e.message.includes('secret-test-token') && !e.message.includes('provider.invalid'));
    return true;
  });
  assert.equal(calls.length, 2);
});

test('rate limit produces a clearly limited local result with no model substitution', async () => {
  const { api, calls } = harness(() => ({ status: 429, data: { error: { code: 'GROQ_RATE_LIMIT', message: 'secret-test-token' } } }));
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(calls.length, 2);
  assert.equal(result.analysis.mode, 'local');
  assert.equal(result.analysis.status, 'limited');
  assert.ok(result.analysis.warnings.some(w => w.includes('로컬 규칙')));
  assert.ok(result.analysis.warnings.some(w => w.includes('한도')));
  assert.ok(!JSON.stringify(result).includes('secret-test-token'));
});

test('partial per-clause review cannot be reported as complete', async () => {
  const { api } = harness(body => {
    if (isFacts(body)) return factsResponse(body);
    const result = riskResponse(body); result.clauseAssessments.pop(); return result;
  });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'local');
  assert.equal(result.analysis.status, 'limited');
  assert.ok(result.analysis.warnings.some(w => w.includes('검증')));
});

test('a nonliteral source quote is rejected instead of being highlighted elsewhere', async () => {
  const { api } = harness(body => {
    if (isFacts(body)) return factsResponse(body);
    const result = riskResponse(body, true); result.highlights[0].originalText = '원문 어디에도 없는 손해배상 조항'; return result;
  });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'local');
  assert.ok(result.analysis.warnings.some(w => w.includes('검증')));
});

test('a mismatched server model is rejected rather than silently accepted', async () => {
  const { api } = harness(body => factsResponse(body), { responseModel: 'different-model' });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'local');
  assert.equal(result.analysis.status, 'limited');
});

test('unconfigured server invokes no completion and cannot produce a complete safe verdict', async () => {
  const { api, calls } = harness(() => { throw new Error('Unexpected request'); }, { configured: false });
  const result = await api.analyzeDocumentWithGroq({ text: '제1조 보고\n을은 월간 보고서 1건을 제출한다.' });
  assert.equal(calls.length, 1);
  assert.equal(result.analysis.mode, 'local');
  assert.equal(result.analysis.status, 'limited');
  assert.notEqual(result.summary.score, '안전');
});

test('image and scanned PDF inputs with no extracted text are rejected before network requests', async () => {
  const { api, calls } = harness();
  for (const file of [new File(['image'], 'document.png', { type: 'image/png' }), new File(['scan'], 'scan.pdf', { type: 'application/pdf' })]) {
    await assert.rejects(api.analyzeDocumentWithGroq({ file }), /OCR/);
  }
  assert.equal(calls.length, 0);
});

test('Q&A uses only the local proxy with text and the fixed model', async () => {
  const { api, calls } = harness(() => '제2조의 추가 보수 금지 범위를 확인해야 합니다.');
  const answer = await api.askDocumentQuestion({ question: '왜 위험한가요?', documentTitle: '시험 문서', documentText: fixtureText });
  assert.match(answer, /Groq openai\/gpt-oss-120b/);
  assert.equal(calls.length, 2);
  const body = JSON.parse(calls[1].init.body);
  assert.ok(!Object.hasOwn(body, 'response_format'));
  assert.ok(!Object.hasOwn(body, 'files'));
});

test('invalid image positions stay unpositioned rather than receiving fabricated coordinates', () => {
  const { api } = harness();
  for (const box of [undefined, { x: 95, y: 10, width: 20, height: 5 }, { x: 1, y: 2, width: NaN, height: 5 }]) {
    const normalized = api.normalizeBBox(box); assert.equal(normalized.width, 0); assert.equal(normalized.height, 0);
  }
});

test('a structurally invalid AI answer is retried once before falling back', async () => {
  let riskCalls = 0;
  const { api } = harness(body => {
    if (isFacts(body)) return factsResponse(body);
    riskCalls++;
    const result = riskResponse(body, true);
    if (riskCalls === 1) result.clauseAssessments.pop();
    return result;
  });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(riskCalls, 2);
  assert.equal(result.analysis.mode, 'ai');
});

test('fact extraction needs clause ids only and tolerates a missing fact with a warning', async () => {
  const { api } = harness(body => {
    if (isFacts(body)) {
      const schema = body.response_format.json_schema.schema;
      assert.ok(!('fullText' in schema.properties));
      const facts = factsResponse(body);
      facts.facts.pop();
      return { facts: facts.facts.map(({ quote, ...f }) => f), warnings: [] };
    }
    return riskResponse(body, true);
  });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'ai');
  assert.ok(result.analysis.warnings.some(w => w.includes('사실 추출이 누락')));
});

test('validation failures report which check failed', async () => {
  const { api } = harness(body => {
    if (isFacts(body)) return factsResponse(body);
    const result = riskResponse(body, true); result.highlights[0].originalText = '원문 어디에도 없는 손해배상 조항'; return result;
  });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(result.analysis.mode, 'local');
  assert.ok(result.analysis.warnings.some(w => w.includes('인용이 해당 조항 원문과 일치하지 않습니다')));
});

test('model requests carry only what the model needs; positions and labels are rebuilt locally', async () => {
  const { api, calls } = harness(body => isFacts(body) ? factsResponse(body) : riskResponse(body, true));
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  for (const call of calls.slice(1)) {
    const input = JSON.parse(JSON.parse(call.init.body).messages[1].content);
    assert.ok(input.clauses.every(c => Object.keys(c).every(k => ['id', 'text', 'references'].includes(k))));
  }
  const riskSchema = JSON.parse(calls[2].init.body).response_format.json_schema.schema;
  const highlightProps = riskSchema.properties.highlights.items.properties;
  assert.ok(!('bbox' in highlightProps) && !('clauseRef' in highlightProps));
  assert.deepEqual(Object.keys(riskSchema.properties.summary.properties), ['score']);
  assert.equal(result.highlights[0].clauseRef, '제1조 ①');
});

const instantWait = { setTimeout: fn => { fn(); return 0; } };
const rateLimited = seconds => ({ status: 429, data: { error: { code: 'GROQ_RATE_LIMIT', message: 'secret-test-token', ...(seconds ? { retryAfterSeconds: seconds } : {}) } } });

test('a per-minute rate limit is waited out and retried instead of dropping to local analysis', async () => {
  let factCalls = 0;
  const events = [];
  const { api, calls } = harness(body => {
    if (isFacts(body)) return ++factCalls === 1 ? rateLimited(37) : factsResponse(body);
    return riskResponse(body, true);
  }, { globals: instantWait });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText, onProgress: (percent, message) => events.push({ percent, message }) });
  assert.equal(result.analysis.mode, 'ai');
  assert.equal(calls.length, 4); // config, rate-limited facts, facts, risk
  const waits = events.filter(e => e.message.includes('자동으로 다시 시도'));
  assert.equal(waits.length, 38); // 37s reported by the provider + 1s margin
  assert.ok(waits[0].message.includes('38초') && waits.at(-1).message.includes('1초'));
  assert.ok(waits.every(e => e.percent === 15));
});

test('a rate limit that will not reset soon or reports no wait time is not retried', async () => {
  for (const seconds of [3600, undefined]) {
    const { api, calls } = harness(() => rateLimited(seconds), { globals: instantWait });
    const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
    assert.equal(calls.length, 2);
    assert.equal(result.analysis.mode, 'local');
    assert.ok(result.analysis.warnings.some(w => w.includes('한도')));
  }
});

test('rate limit retries are bounded and then fall back with a limited local result', async () => {
  const { api, calls } = harness(() => rateLimited(1), { globals: instantWait });
  const result = await api.analyzeDocumentWithGroq({ text: fixtureText });
  assert.equal(calls.length, 4); // config + first attempt + two retries
  assert.equal(result.analysis.mode, 'local');
  assert.equal(result.analysis.status, 'limited');
  assert.ok(!JSON.stringify(result).includes('secret-test-token'));
});

test('a clean AI verdict is downgraded when local rules still see a danger pattern', async () => {
  const risky = '제1조 지체\n을이 지연하면 지연일수 1일당 총 계약금액의 1.5%에 해당하는 지체상금을 배상한다.';
  const { api } = harness(body => isFacts(body) ? factsResponse(body) : riskResponse(body));
  const result = await api.analyzeDocumentWithGroq({ text: risky });
  assert.equal(result.analysis.mode, 'ai');
  assert.equal(result.analysis.status, 'limited');
  assert.notEqual(result.summary.score, '안전');
  assert.ok(result.analysis.warnings.some(w => w.includes('안전하다고 판단하지 않았습니다')));
});

test('a clean AI verdict stays complete when local rules find nothing', async () => {
  const { api } = harness(body => isFacts(body) ? factsResponse(body) : riskResponse(body));
  const result = await api.analyzeDocumentWithGroq({ text: '제1조 업무\n① 을은 매월 보고서를 제출한다.' });
  assert.equal(result.analysis.status, 'complete');
  assert.equal(result.summary.score, '안전');
});
