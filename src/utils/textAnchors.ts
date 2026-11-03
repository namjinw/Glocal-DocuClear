import type { HighlightItem, SourceSpan } from '../types';

type AnchorHighlight = Pick<HighlightItem, 'originalText' | 'sourceSpans' | 'clauseId'>;

const withoutWhitespace = (text: string) => text.replace(/\s/g, '');

/** Find complete quotations, allowing whitespace differences only. Offsets refer to the untouched source. */
export function findQuoteSpans(text: string, quote: string): SourceSpan[] {
  const target = withoutWhitespace(quote);
  if (!target) return [];

  const sourceIndices: number[] = [];
  const characters: string[] = [];
  for (let index = 0; index < text.length; index++) {
    if (!/\s/.test(text[index])) {
      sourceIndices.push(index);
      characters.push(text[index]);
    }
  }
  const normalized = characters.join('');
  const spans: SourceSpan[] = [];
  let index = normalized.indexOf(target);
  while (index !== -1) {
    spans.push({ start: sourceIndices[index], end: sourceIndices[index + target.length - 1] + 1 });
    index = normalized.indexOf(target, index + 1);
  }
  return spans;
}

function articleRange(text: string, clauseId?: string): SourceSpan | undefined {
  const articleNumber = clauseId?.match(/^article-(\d+)(?:-|$)/)?.[1]
    ?? clauseId?.match(/^제\s*(\d+)\s*조(?:\s|$)/)?.[1];
  if (!articleNumber) return undefined;

  // A reference inside prose is not an article heading.
  const heading = /^[\t ]*(?:#{1,6}[\t ]*)?(?:\*\*)?제[\t ]*(\d+)[\t ]*조(?=[\t (（[\r\n*]|$)/gm;
  const headings = [...text.matchAll(heading)];
  const matches = headings.filter((match) => Number(match[1]) === Number(articleNumber));
  if (matches.length !== 1) return undefined;
  const index = headings.indexOf(matches[0]);
  return { start: matches[0].index, end: headings[index + 1]?.index ?? text.length };
}

function distinctSpans(spans: SourceSpan[]): SourceSpan[] {
  return spans
    .filter((span, index) => spans.findIndex((other) => other.start === span.start && other.end === span.end) === index)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Never guess from a prefix or clause reference. Ambiguous quotations need an explicit source location. */
export function resolveHighlightSpans(text: string, highlight: AnchorHighlight): SourceSpan[] {
  const target = withoutWhitespace(highlight.originalText);
  if (!target) return [];

  const supplied = highlight.sourceSpans;
  if (supplied?.length && supplied.every((span) => (
    Number.isInteger(span.start) && Number.isInteger(span.end)
    && span.start >= 0 && span.end <= text.length && span.start < span.end
  ))) {
    const ordered = distinctSpans(supplied);
    const quotations = ordered.map((span) => withoutWhitespace(text.slice(span.start, span.end)));
    const eachIsComplete = quotations.every((quotation) => quotation === target);
    const disjoint = ordered.every((span, index) => index === 0 || ordered[index - 1].end <= span.start);
    if (eachIsComplete || (disjoint && quotations.join('') === target)) return ordered;
  }

  const candidates = findQuoteSpans(text, highlight.originalText);
  const scope = articleRange(text, highlight.clauseId);
  const scoped = scope
    ? candidates.filter((span) => span.start >= scope.start && span.end <= scope.end)
    : candidates;
  return scoped.length === 1 ? scoped : [];
}

export interface HighlightSegment extends SourceSpan {
  text: string;
  /** All overlapping findings, strongest first. No finding is discarded. */
  highlights: HighlightItem[];
}

export interface SegmentedHighlights {
  segments: HighlightSegment[];
  unmatchedIds: string[];
}

const typePriority = { DANGER: 3, IMPORTANT: 2, ACTION: 1 };
const severityPriority = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Partition source text at every finding boundary, retaining every overlapping finding. */
export function segmentHighlights(text: string, highlights: HighlightItem[]): SegmentedHighlights {
  const events = new Map<number, { highlight: HighlightItem; delta: number }[]>();
  const addEvent = (offset: number, highlight: HighlightItem, delta: number) => {
    const atOffset = events.get(offset) ?? [];
    atOffset.push({ highlight, delta });
    events.set(offset, atOffset);
  };
  const unmatchedIds: string[] = [];
  for (const highlight of highlights) {
    const spans = resolveHighlightSpans(text, highlight);
    if (!spans.length) unmatchedIds.push(highlight.id);
    for (const span of spans) {
      addEvent(span.start, highlight, 1);
      addEvent(span.end, highlight, -1);
    }
  }

  const boundaries = [...new Set([0, text.length, ...events.keys()])].sort((a, b) => a - b);
  const active = new Map<string, { highlight: HighlightItem; count: number }>();
  const segments: HighlightSegment[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    for (const event of events.get(start) ?? []) {
      const count = (active.get(event.highlight.id)?.count ?? 0) + event.delta;
      if (count <= 0) active.delete(event.highlight.id);
      else active.set(event.highlight.id, { highlight: event.highlight, count });
    }
    const currentHighlights = [...active.values()].map((entry) => entry.highlight).sort((a, b) => (
      typePriority[b.type] - typePriority[a.type]
      || severityPriority[b.severity ?? 'LOW'] - severityPriority[a.severity ?? 'LOW']
      || a.id.localeCompare(b.id)
    ));
    segments.push({ start, end, text: text.slice(start, end), highlights: currentHighlights });
  }
  return { segments, unmatchedIds };
}
