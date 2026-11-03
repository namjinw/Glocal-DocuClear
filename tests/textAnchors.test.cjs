const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTs } = require('./helpers.cjs');

const { findQuoteSpans, resolveHighlightSpans, segmentHighlights } = loadTs('src/utils/textAnchors.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));
const highlight = (id, originalText, extra = {}) => ({
  id, type: 'DANGER', originalText, easyText: id,
  bbox: { x: 0, y: 0, width: 0, height: 0 }, ...extra,
});

test('complete quotations allow whitespace differences and retain original CRLF offsets', () => {
  const text = '앞말\r\n\r\n갑은\t대금을\r\n지급한다.\r\n뒷말';
  const spans = findQuoteSpans(text, '갑은 대금을 지급한다.');
  assert.equal(spans.length, 1);
  assert.equal(text.slice(spans[0].start, spans[0].end), '갑은\t대금을\r\n지급한다.');
  assert.equal(spans[0].start, text.indexOf('갑은'));
});

test('a matching prefix never anchors a different or negated sentence', () => {
  const text = '갑은 계약기간 중 발생하는 모든 추가 비용을 지급하지 않는다.';
  const quote = '갑은 계약기간 중 발생하는 모든 추가 비용을 지급한다.';
  assert.equal(findQuoteSpans(text, quote).length, 0);
  assert.equal(resolveHighlightSpans(text, highlight('negative', quote)).length, 0);
});

test('a clause reference in prose is not used as a substitute quotation', () => {
  const text = '## 제2조 계약기간\n갱신은 제15조를 적용한다.\n\n## 제15조 갱신\n계약은 자동 갱신된다.';
  const missing = highlight('missing', '본 계약은 2년간 자동 갱신된다.', { clauseRef: '제15조', clauseId: 'article-15-p1-s1' });
  assert.equal(resolveHighlightSpans(text, missing).length, 0);
  const spans = resolveHighlightSpans(text, highlight('exact', '계약은 자동 갱신된다.', { clauseId: 'article-15-p1-s1' }));
  assert.equal(spans.length, 1);
  assert.equal(spans[0].start, text.indexOf('계약은 자동'));
});

test('repeated quotations require an article scope or a validated explicit span', () => {
  const quote = '을은 비용을 부담한다.';
  const text = `제1조 비용\n${quote}\n\n제2조 기타\n${quote}`;
  assert.equal(findQuoteSpans(text, quote).length, 2);
  assert.equal(resolveHighlightSpans(text, highlight('ambiguous', quote)).length, 0);
  const start = text.lastIndexOf(quote);
  assert.deepEqual(plain(resolveHighlightSpans(text, highlight('scoped', quote, { clauseId: 'article-2-p1-s1' }))), [{ start, end: start + quote.length }]);
  assert.deepEqual(plain(resolveHighlightSpans(text, highlight('explicit', quote, { sourceSpans: [{ start, end: start + quote.length }] }))), [{ start, end: start + quote.length }]);
});

test('repeated quotations within the same article remain ambiguous', () => {
  const quote = '을은 비용을 부담한다.';
  const text = `제1조 비용\n① ${quote}\n② ${quote}`;
  assert.equal(resolveHighlightSpans(text, highlight('repeat', quote, { clauseId: 'article-1' })).length, 0);
});

test('incorrect supplied offsets are rejected and only a complete quote can recover them', () => {
  const text = '갑은 지급하지 않는다. 을은 비용을 부담한다.';
  const quote = '을은 비용을 부담한다.';
  const spans = resolveHighlightSpans(text, highlight('recover', quote, { sourceSpans: [{ start: 0, end: 12 }] }));
  assert.equal(spans.length, 1);
  assert.equal(text.slice(spans[0].start, spans[0].end), quote);
  assert.equal(resolveHighlightSpans(text, highlight('invalid', '갑은 지급한다.', { sourceSpans: [{ start: 0, end: 12 }] })).length, 0);
});

test('explicit disjoint source spans must together reproduce the full quotation', () => {
  const text = '갑은 [주석] 비용을 부담한다.';
  const start = text.indexOf('비용');
  const spans = [{ start: 0, end: 2 }, { start, end: text.length }];
  assert.deepEqual(plain(resolveHighlightSpans(text, highlight('split', '갑은 비용을 부담한다.', { sourceSpans: spans }))), spans);
  assert.equal(resolveHighlightSpans(text, highlight('split-invalid', '을은 비용을 부담한다.', { sourceSpans: spans })).length, 0);
});

test('overlapping findings retain both IDs while danger takes display priority', () => {
  const text = '계약기간에는 갑이 일방적으로 업무를 늘릴 수 있다.';
  const important = highlight('condition', text, { type: 'IMPORTANT' });
  const danger = highlight('risk', '갑이 일방적으로 업무를 늘릴 수 있다.');
  const result = segmentHighlights(text, [important, danger]);
  const overlap = result.segments.find((segment) => segment.highlights.length === 2);
  assert.ok(overlap);
  assert.deepEqual(Array.from(overlap.highlights, (item) => item.id), ['risk', 'condition']);
  assert.equal(result.segments.map((segment) => segment.text).join(''), text);
  assert.equal(result.unmatchedIds.length, 0);
});

test('unmatched findings are reported without losing or modifying source paragraphs', () => {
  const text = '제1조\r\n\r\n첫 문장.\r\n\r\n제2조\r\n둘째 문장.';
  const result = segmentHighlights(text, [highlight('one', '첫 문장.'), highlight('missing', '없는 문장.')]);
  assert.deepEqual(Array.from(result.unmatchedIds), ['missing']);
  assert.equal(result.segments.map((segment) => segment.text).join(''), text);
  for (const segment of result.segments) assert.equal(segment.text, text.slice(segment.start, segment.end));
});

const { DocumentViewer } = loadTs('src/components/DocumentViewer.tsx', {
  react: { ...React, default: React },
  './DocumentViewer.css': {},
  './EditHighlightModal': { EditHighlightModal: () => null },
});
const renderViewer = (props) => renderToStaticMarkup(React.createElement(DocumentViewer, {
  documentTitle: '테스트', selectedHighlightId: null, onSelectHighlight() {}, activeFilter: 'ALL', ...props,
}));

test('the whole-document text view includes findings on every PDF page', () => {
  const text = '첫 페이지 위험 문장.\n\n둘째 페이지 위험 문장.';
  const html = renderViewer({
    documentText: text,
    pages: [1, 2].map((pageNumber) => ({ id: String(pageNumber), pageNumber, previewUrl: '', title: '', sourceFileName: 'test.pdf', fileType: 'pdf' })),
    highlights: [
      highlight('FIRST_PAGE_FINDING', '첫 페이지 위험 문장.', { page: 1 }),
      highlight('SECOND_PAGE_FINDING', '둘째 페이지 위험 문장.', { page: 2 }),
    ],
  });
  assert.match(html, /FIRST_PAGE_FINDING/);
  assert.match(html, /SECOND_PAGE_FINDING/);
});

test('every overlapping finding has its own accessible button', () => {
  const text = '을은 모든 추가 비용을 부담한다.';
  const html = renderViewer({ documentText: text, highlights: [
    highlight('BROAD_CONDITION', text, { type: 'IMPORTANT' }),
    highlight('INNER_RISK', '모든 추가 비용을 부담한다.'),
  ] });
  assert.match(html, /aria-label="위험\/독소 1: INNER_RISK"/);
  assert.match(html, /aria-label="중요 조건 2: BROAD_CONDITION"/);
  assert.match(html, /underline-danger/);
});

test('an unanchored finding produces a notice, not a fabricated source document', () => {
  const html = renderViewer({ documentText: '원문입니다.', highlights: [highlight('not-in-source', '존재하지 않는 조항.')] });
  assert.match(html, /원문 위치를 확인하지 못한 분석 1건/);
  assert.doesNotMatch(html, /class="pure-underline/);
  assert.doesNotMatch(html, /존재하지 않는 조항/);
});
