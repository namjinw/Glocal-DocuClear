const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers.cjs');
const { parseDocument, analyzeDocumentOffline, recalculateAnalysis, finalizeAnalysis } = loadTs('src/utils/analysis.ts');
const dangers = r => r.highlights.filter(h => h.type === 'DANGER');
const fingerprints = r => [...dangers(r).map(h => h.easyText), ...(r.compoundRisks || []).map(c => c.title)].sort().join('|');

test('clause structure excludes headings, preserves paragraphs and original CRLF ranges', () => {
  const source = '## 제3조 업무범위\r\n① 을은 보고서를\r\n제출한다.\r\n② 갑은 업무의 종류를 변경할 수 있다.\r\n③ 제2항에 따른 업무 증가는 별도 보수 청구의 사유가 되지 않는다.';
  const parsed = parseDocument(source);
  assert.equal(parsed.clauses.length, 3);
  assert.equal(parsed.clauses[1].id, 'article-3-p2-s1');
  assert.equal(parsed.clauses[2].references[0], 'article-3-p2');
  assert.equal(parsed.unresolvedReferences.length, 0);
  for (const c of parsed.clauses) assert.equal(source.slice(c.start, c.end), c.text);
  assert.ok(parsed.clauses.every(c => !c.text.includes('## 제3조')));
});

test('inline article and paragraph bodies are never dropped', () => {
  for (const input of ['제3조 업무범위 ① 갑은 업무의 종류를 변경할 수 있다.', '제3조 (업무범위) 갑은 업무의 종류를 변경할 수 있다.']) {
    assert.equal(dangers(analyzeDocumentOffline(input)).length, 1);
  }
});

test('physical wrapping and sentence line breaks do not change classification', () => {
  const separate = '계약기간은 12개월이다.\n을은 월간 보고서를 제출한다.';
  const combined = separate.replace('\n', ' ');
  const a = analyzeDocumentOffline(separate), b = analyzeDocumentOffline(combined);
  assert.equal(a.highlights.map(h => h.type).join(','), b.highlights.map(h => h.type).join(','));
  assert.equal(a.summary.signalCount, 0);
  assert.equal(b.summary.signalCount, 0);
  assert.equal(a.summary.score, '판단 보류');
});

test('the uploaded screenshot pair is detected individually and in combination', () => {
  const source = '제3조 업무범위\n② 갑은 사업상 필요에 따라 제작 수량, 운영 채널 및 업무의 종류를 변경할 수 있다. 변경된 업무가 갑의 홍보 또는 사업 운영과 관련되는 경우 본 계약의 업무범위에 포함된 것으로 본다.\n③ 제2항에 따른 업무 증가, 투입 인력 변경 및 일정 단축은 별도 보수 청구의 사유가 되지 않는다.';
  const result = analyzeDocumentOffline(source);
  assert.ok(dangers(result).some(h => h.originalText.includes('보수 청구')));
  const relation = result.compoundRisks.find(c => c.title.includes('업무 확대'));
  assert.ok(relation);
  assert.ok(relation.relatedHighlights.every(id => result.highlights.some(h => h.id === id)));
  assert.equal(result.summary.score, '위험');
  const wrapped = source.replace('업무의 종류를 변경할 수 있다', '업무의\n종류를\n변경할 수 있다');
  assert.equal(fingerprints(result), fingerprints(analyzeDocumentOffline(wrapped)));
});

test('no-compensation wording alone is flagged without pretending full safety', () => {
  const result = analyzeDocumentOffline('업무 증가에 대한 추가 보수는 청구할 수 없다.');
  assert.ok(dangers(result).length > 0);
  assert.notEqual(result.summary.score, '안전');
  assert.equal(result.analysis.status, 'limited');
});

test('absence of consent is not misread as a mutual-agreement safeguard', () => {
  const source = '갑은 상대방의 사전 동의 없이 업무의 종류를 변경할 수 있다.';
  assert.ok(dangers(analyzeDocumentOffline(source)).some(h => h.easyText.includes('업무범위')));
});

test('an explicit neighbouring approval requirement constrains a scope permission', () => {
  const source = '제3조 업무\n갑은 업무의 종류를 변경할 수 있다. 업무범위의 변경에는 상대방의 사전 서면 동의가 필요하다.';
  assert.equal(dangers(analyzeDocumentOffline(source)).length, 0);
});

test('multiple risk predicates in one sentence remain independently linked', () => {
  const result = analyzeDocumentOffline('갑은 업무의 종류를 변경할 수 있으며 추가 보수는 청구할 수 없다.');
  assert.equal(dangers(result).length, 2);
  assert.ok(result.compoundRisks.some(c => c.title.includes('업무 확대')));
});

test('negation, reciprocal consent and ordinary liability do not imply danger', () => {
  for (const source of [
    '위약금은 부과하지 않는다.',
    '계약대금 전액에 해당하는 위약금은 부과하지 않는다.',
    '제12조 손해배상\n당사자는 상대방에게 발생시킨 직접손해에 한하여 동일한 기준으로 손해배상 책임을 진다.',
    '업무의 종류는 쌍방의 사전 서면 합의로 변경할 수 있다.',
    '업무의 종류는 상대방의 사전 동의 없이 변경할 수 없다.',
    '기존 자산은 권리 이전 대상에서 제외한다.',
  ]) assert.equal(dangers(analyzeDocumentOffline(source)).length, 0, source);
});

test('danger after twenty ordinary clauses remains visible and counted', () => {
  const source = [...Array.from({ length: 20 }, (_, i) => `제${i + 1}조 기간\n계약기간은 ${i + 1}개월이다.`), '제21조 비용\n추가 보수는 청구할 수 없다.'].join('\n');
  const result = analyzeDocumentOffline(source);
  assert.ok(result.highlights.length > 12);
  assert.ok(dangers(result).some(h => h.clauseRef === '제21조'));
  assert.equal(result.summary.signalCount, 1);
});

test('acceptance dependence and broad liability exceptions link their exact evidence', () => {
  const source = '제6조 검수\n① 갑은 검수 결정을 유보할 수 있다. 유보 기간에는 별도의 제한을 두지 않는다.\n제8조 지급\n① 갑은 결과물의 검수가 완료된 날부터 30일 이내에 대금을 지급한다.\n제12조 손해배상\n① 을의 손해배상 책임은 총 계약대금을 한도로 한다.\n② 다만 납기 지연, 품질 미달 및 그 밖의 계약상 의무 불이행에는 제1항의 한도를 적용하지 않는다.';
  const result = analyzeDocumentOffline(source);
  assert.ok(result.compoundRisks.some(c => c.title.includes('검수 지연')));
  assert.equal(result.compoundRisks.filter(c => c.title.includes('검수 지연')).length, 1);
  assert.ok(result.compoundRisks.some(c => c.title.includes('배상 한도')));
  for (const c of result.compoundRisks) assert.ok(c.relatedHighlights.every(id => result.highlights.some(h => h.id === id)));
});

test('unrelated articles do not create an unpaid scope-expansion link', () => {
  const result = analyzeDocumentOffline('제3조 업무\n갑은 업무의 종류를 변경할 수 있다.\n제9조 자산\n기존 서식의 이전에 대한 별도 보상을 청구하지 않는다.');
  assert.ok(!result.compoundRisks.some(c => c.title.includes('업무 확대')));
});

test('missing references are explicit limitations rather than guessed clauses', () => {
  const result = analyzeDocumentOffline('제2조 기간\n갱신은 제15조를 적용한다.');
  assert.equal(result.analysis.unresolvedReferences[0], 'article-15');
  assert.equal(result.summary.score, '판단 보류');
  assert.equal(result.compoundRisks.length, 0);
});

test('article order does not alter findings or lose cross-clause links', () => {
  const a = '제6조 검수\n갑은 검수 결정을 유보할 수 있다.';
  const b = '제8조 지급\n검수 완료 후 대금을 지급한다.';
  assert.equal(fingerprints(analyzeDocumentOffline(`${a}\n${b}`)), fingerprints(analyzeDocumentOffline(`${b}\n${a}`)));
});

test('editing findings recalculates counts and removes dangling relations', () => {
  const result = analyzeDocumentOffline('제3조 업무\n갑은 업무의 종류를 변경할 수 있다. 추가 보수는 청구할 수 없다.');
  const edited = recalculateAnalysis({ ...result, highlights: [] });
  assert.equal(edited.summary.signalCount, 0);
  assert.equal(edited.summary.riskReasons.length, 0);
  assert.equal(edited.compoundRisks.length, 0);
  assert.equal(edited.summary.score, '판단 보류');
});

test('ungrounded model quotations never receive a safe complete verdict', () => {
  const source = '갑은 월간 보고서를 제출한다.';
  const result = finalizeAnalysis({ summary: { score: '안전', bullets: [] }, highlights: [{ id: 'h1', type: 'DANGER', originalText: '전혀 다른 원문', easyText: '위험', severity: 'HIGH', riskCategories: ['LIABILITY_RISK'], bbox: {x:0,y:0,width:0,height:0} }], analysis: {mode:'ai',status:'complete',warnings:[],analyzedClauseCount:1,totalClauseCount:1,unresolvedReferences:[]} }, source);
  assert.equal(result.analysis.status, 'limited');
  assert.equal(result.summary.score, '판단 보류');
  assert.equal(result.summary.signalCount, 0);
});

test('an explicit uncertain AI verdict is not promoted to safe during normalization', () => {
  const source = '을은 보고서를 제출한다.';
  const result = finalizeAnalysis({ summary: { score: '판단 보류', bullets: ['확인 필요'] }, highlights: [], analysis: {mode:'ai',status:'complete',warnings:[],analyzedClauseCount:1,totalClauseCount:1,unresolvedReferences:[]} }, source);
  assert.equal(result.summary.score, '판단 보류');
  assert.equal(result.analysis.status, 'limited');
});

test('dates, page markers and statute citations do not distort clause structure', () => {
  const source = '제1조 기간\n① 계약기간은 2024. 1. 1.부터 2024. 12. 31.까지로 한다.\n[계약서.pdf p.2]\n② 민법 제390조에 따라 책임을 진다. 제5조에 따른다.';
  const parsed = parseDocument(source);
  assert.ok(parsed.clauses.every(c => !c.text.startsWith('[')));
  assert.equal(parsed.clauses[0].text, '계약기간은 2024. 1. 1.부터 2024. 12. 31.까지로 한다.');
  assert.deepEqual([...parsed.unresolvedReferences], ['article-5']);
});

test('a repeated quotation is anchored inside its own clause, not rejected as ambiguous', () => {
  const source = '제1조 보고\n① 을은 월간 보고서를 제출한다.\n제2조 통지\n① 을은 월간 보고서를 제출한다.';
  const clause = parseDocument(source).clauses[1];
  const result = finalizeAnalysis({ summary: { score: '주의', bullets: [] }, highlights: [{ id: 'h1', clauseId: clause.id, type: 'DANGER', originalText: clause.text, easyText: '위험', reason: '근거', affectedParty: '을', severity: 'HIGH', riskCategories: ['LIABILITY_RISK'], bbox: { x: 0, y: 0, width: 0, height: 0 } }], analysis: { mode: 'ai', status: 'complete', warnings: [], analyzedClauseCount: 2, totalClauseCount: 2, unresolvedReferences: [] } }, source);
  assert.equal(result.highlights[0].type, 'DANGER');
  assert.equal(result.highlights[0].sourceSpans[0].start, clause.start);
});

const titles = text => dangers(analyzeDocumentOffline(text)).map(h => h.easyText);

test('local analysis flags one-sided payment terms, deferred terms and after-the-fact edits', () => {
  const found = titles('제1조 변제\n채무자는 채권자가 지정하는 방법으로 변제한다.\n제2조 조건\n구체적인 지급 방법 및 분할 상환 일정은 별도 협의한다.\n제3조 증빙\n거래 내역 관련 자료가 확인되지 않을 경우 당사자의 확인 내용을 우선한다.\n제4조 수정\n실제 거래내역과 차이가 있으면 협의하여 수정한다.');
  for (const title of ['상대방이 정하는 이행 방법', '핵심 이행 조건의 사후 협의 유보', '주관적 진술의 우선 적용', '거래 내역 사후 수정 가능']) assert.ok(found.includes(title), title);
});

test('local analysis flags wear-and-tear transfer, high daily penalties and payment-independent rights transfer', () => {
  assert.ok(titles('제1조 특약\n임차인은 통상적인 마모와 자연 노후화를 포함한 모든 파손에 대해 전액 수리비용을 부담하고 신품으로 원상복구한다.').includes('통상 마모·노후까지 임차인에게 전가'));
  assert.ok(titles('제1조 지체\n을이 지연하면 지연일수 1일당 총 계약금액의 1.5%에 해당하는 지체상금을 배상한다.').includes('큰 금액 또는 무제한 위약 부담'));
  assert.ok(titles('제1조 권리\n저작재산권 일체는 검수 및 대금 완납 여부와 무관하게 착수 즉시 갑에게 귀속된다.').includes('대금 지급 전 권리 이전'));
  assert.ok(titles('제1조 환수\n사업장을 무단 이전하면 기지급된 지원금 전액을 즉시 환수하고 20%의 가산금을 부과한다.').includes('지원금 환수 및 가산금 부과'));
});

test('local analysis stays quiet on ordinary, balanced clauses', () => {
  assert.deepEqual([...titles('제1조 지체\n을이 지연하면 지연일수 1일당 계약금액의 0.1%에 해당하는 지체상금을 부담한다.\n제2조 일정\n세부 일정은 양 당사자가 서면으로 합의하여 정한다.\n제3조 복구\n임차인은 고의 또는 과실로 파손한 시설만 원상복구하며 통상적인 마모는 임차인이 부담하지 않는다.\n제4조 수정\n거래내역에 차이가 있으면 쌍방이 서면으로 합의하여 수정한다.')], []);
});

test('the local result never certifies safety and keeps the reference sample verdicts', () => {
  const { SAMPLE_DOCUMENTS } = loadTs('src/data/sampleDocuments.ts');
  for (const doc of SAMPLE_DOCUMENTS) {
    const local = analyzeDocumentOffline(doc.documentText);
    assert.notEqual(local.summary.score, '안전');
    if (doc.id === 'sample-safe-standard') assert.equal(dangers(local).length, 0);
    else assert.ok(dangers(local).length >= doc.defaultResult.highlights.filter(h => h.type === 'DANGER').length, doc.id);
  }
});
