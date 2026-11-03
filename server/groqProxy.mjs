import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

export const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const BODY_LIMIT = 2 * 1024 * 1024;

export function readGroqKey(rootDir) {
  const injected = process.env.GROQ_API_KEY?.trim();
  if (injected) return injected;
  try {
    return parseEnv(readFileSync(join(rootDir, '.env'), 'utf8')).GROQ_API_KEY?.trim() || '';
  } catch {
    return '';
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function error(res, status, code, message) { send(res, status, { error: { code, message } }); }

function isLocalRequest(req) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname; } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return false;
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
  } catch { return false; }
}

async function readJSON(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (body.model !== undefined && body.model !== GROQ_MODEL) return false;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 60) return false;
  if (body.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim())) return false;
  if (body.max_completion_tokens !== undefined && (!Number.isInteger(body.max_completion_tokens) || body.max_completion_tokens < 1 || body.max_completion_tokens > 65536)) return false;
  if (body.reasoning_effort !== undefined && !['low', 'medium', 'high'].includes(body.reasoning_effort)) return false;
  if (body.response_format !== undefined) {
    const format = body.response_format;
    if (!format || format.type !== 'json_schema' || !format.json_schema || format.json_schema.strict !== true) return false;
    if (typeof format.json_schema.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(format.json_schema.name)) return false;
    if (!format.json_schema.schema || format.json_schema.schema.type !== 'object') return false;
  }
  return true;
}

/** Shared by Vite dev, Vite preview and the standalone local server. No credential is returned to the browser. */
export function createGroqMiddleware({ rootDir, fetchImpl = globalThis.fetch, getKey = () => readGroqKey(rootDir), timeoutMs = 120000 }) {
  return async (req, res, next) => {
    const route = (req.url || '').split('?')[0];
    if (!route.startsWith('/api/groq/')) { next(); return; }
    if (!isLocalRequest(req)) {
      error(res, 403, 'ORIGIN_NOT_ALLOWED', '이 API는 같은 로컬 앱에서만 사용할 수 있습니다.');
      return;
    }
    if (route === '/api/groq/config') {
      if (req.method !== 'GET') { error(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 요청 방식입니다.'); return; }
      send(res, 200, { configured: Boolean(getKey()), provider: 'Groq', model: GROQ_MODEL });
      return;
    }
    if (route !== '/api/groq/chat') { error(res, 404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.'); return; }
    if (req.method !== 'POST') { error(res, 405, 'METHOD_NOT_ALLOWED', 'POST 요청이 필요합니다.'); return; }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      error(res, 415, 'JSON_REQUIRED', 'JSON 형식의 텍스트 요청이 필요합니다.'); return;
    }
    const key = getKey();
    if (!key) {
      error(res, 503, 'GROQ_KEY_MISSING', '.env의 GROQ_API_KEY에 키를 입력한 뒤 설정을 다시 확인해주세요.'); return;
    }
    let body;
    try { body = await readJSON(req); } catch (err) {
      const tooLarge = err.message === 'BODY_TOO_LARGE';
      error(res, tooLarge ? 413 : 400, tooLarge ? 'INPUT_TOO_LARGE' : 'INVALID_JSON', tooLarge ? '문서가 너무 큽니다. 문서를 나누어 분석해주세요.' : '요청 형식이 올바르지 않습니다.'); return;
    }
    if (!validPayload(body)) { error(res, 400, 'INVALID_REQUEST', 'Groq 텍스트 분석 요청의 형식 또는 모델이 올바르지 않습니다.'); return; }
    const payload = {
      model: GROQ_MODEL,
      messages: body.messages.map(m => ({ role: m.role, content: m.content })),
      max_completion_tokens: body.max_completion_tokens ?? 32768,
      reasoning_effort: body.reasoning_effort ?? 'medium',
      stream: false,
      ...(body.response_format ? { response_format: body.response_format } : {}),
    };
    try {
      const response = await fetchImpl(GROQ_URL, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        console.warn(`[DocuClear] Groq 응답 상태 ${response.status}`);
        if (response.status === 401 || response.status === 403) error(res, 401, 'GROQ_KEY_INVALID', 'Groq API 키 또는 모델 사용 권한을 확인해주세요.');
        else if (response.status === 429) error(res, 429, 'GROQ_RATE_LIMIT', 'Groq 요청 또는 토큰 사용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
        else if (response.status === 400) error(res, 502, 'GROQ_REQUEST_REJECTED', 'Groq가 분석 요청을 처리하지 못했습니다. 문서 길이 또는 요청 형식을 확인해주세요.');
        else error(res, 502, 'GROQ_UNAVAILABLE', 'Groq 서비스 요청을 완료하지 못했습니다.');
        return;
      }
      const data = await response.json();
      const choice = data?.choices?.[0];
      if (choice && choice.finish_reason !== 'stop') console.warn(`[DocuClear] Groq 응답 중단: finish_reason=${choice.finish_reason}`);
      if (!choice || choice.finish_reason !== 'stop' || typeof choice.message?.content !== 'string' || !choice.message.content.trim() || choice.message.refusal) {
        error(res, 502, 'GROQ_INCOMPLETE_RESPONSE', 'Groq 응답이 중단되었거나 본문이 없습니다. 문서를 나누거나 다시 시도해주세요.'); return;
      }
      send(res, 200, { content: choice.message.content, model: GROQ_MODEL });
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      error(res, timedOut ? 504 : 502, timedOut ? 'GROQ_TIMEOUT' : 'GROQ_UNAVAILABLE', timedOut ? 'Groq 응답 대기 시간이 초과되었습니다. 다시 시도해주세요.' : 'Groq 서비스 연결을 완료하지 못했습니다.');
    }
  };
}
