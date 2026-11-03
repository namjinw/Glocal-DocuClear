import type { CompoundRiskItem, HighlightItem, RiskCategory } from '../types';
import type { DocumentClause } from './analysis';

export interface AmountComponent {
  label: string;
  amount: number;
  operation: 'ADD' | 'SUBTRACT';
  quote: string;
  start: number;
  end: number;
}

export interface AmountCheck {
  id: string;
  status: 'MATCH' | 'MISMATCH' | 'UNVERIFIED';
  components: AmountComponent[];
  claimedTotal: number;
  expectedTotal: number | null;
  /** Signed difference: claimed total minus the verified component sum, in KRW. */
  difference: number | null;
  quote: string;
  start: number;
  end: number;
  reason: string;
}

export interface PaymentRiskInspection {
  highlights: HighlightItem[];
  compoundRisks: CompoundRiskItem[];
  amountChecks: AmountCheck[];
  isSimulation: boolean;
  paymentContext: boolean;
}

const compact = (value: string) => value.replace(/\s+/g, '');
const won = (amount: number) => `${amount.toLocaleString('en-US')}원`;
const moneyLabels = /((?:최종|총)\s*(?:청구\s*(?:액|금액)|결제\s*(?:액|금액)|납부\s*(?:액|금액))|청구\s*합계|합계\s*금액|공급\s*가액|공급가|(?:서비스\s*)?이용료|서비스\s*요금|기본\s*요금|부가(?:가치)?세|VAT|할인(?:\s*금액|액)?|공제(?:\s*금액|액)?|기납부(?:\s*금액|액)?|선납(?:\s*금액|액)?|배송비|운송비|추가\s*(?:비용|요금|수수료)|수수료)\s*[:：|]?\s*([-+]?\d[\d,]*(?:\.\d+)?)\s*(억|만|천)?\s*원/gi;
const totalLabel = /^(?:최종|총)|^청구합계$|^합계금액$/;
const baseLabel = /공급가|이용료|서비스요금|기본요금/;
const taxLabel = /부가(?:가치)?세|VAT/i;
const subtractLabel = /할인|공제|기납부|선납/;

interface MoneyToken extends AmountComponent { total: boolean }

function moneyTokens(text: string): MoneyToken[] {
  return [...text.matchAll(moneyLabels)].flatMap(match => {
    const multiplier = match[3] === '억' ? 100000000 : match[3] === '만' ? 10000 : match[3] === '천' ? 1000 : 1;
    const rawAmount = Number(match[2].replace(/,/g, '')) * multiplier;
    if (!Number.isSafeInteger(rawAmount)) return [];
    const label = compact(match[1]);
    const operation = subtractLabel.test(label) ? 'SUBTRACT' as const : 'ADD' as const;
    // A minus sign is accepted only on an explicitly subtractive line item.
    if (rawAmount < 0 && operation !== 'SUBTRACT') return [];
    return [{ label, amount: Math.abs(rawAmount), operation, total: totalLabel.test(label), quote: match[0], start: match.index!, end: match.index! + match[0].length }];
  });
}

function inspectAmounts(text: string): AmountCheck[] {
  const tokens = moneyTokens(text);
  const checks: AmountCheck[] = [];
  let previousTotalEnd = 0;
  for (const total of tokens.filter(token => token.total)) {
    // Never combine components from a preceding invoice/total or an unrelated distant table.
    const components = tokens.filter(token => !token.total && token.start >= previousTotalEnd && token.end <= total.start && total.start - token.start <= 1200);
    const scopeStart = components[0]?.start ?? total.start;
    const scopeEnd = Math.min(text.length, total.end + 100);
    const scope = text.slice(scopeStart, scopeEnd);
    const compactScope = compact(scope);
    const afterTotal = text.slice(total.end, scopeEnd);
    const baseCount = components.filter(component => baseLabel.test(component.label)).length;
    const taxes = components.filter(component => taxLabel.test(component.label));
    const knownRanges = [...components, total];
    const unidentifiedMoney = [...scope.matchAll(/[-+]?\d[\d,]*(?:\.\d+)?\s*(?:억|만|천)?\s*원/g)].some(match => {
      const start = scopeStart + match.index!;
      return !knownRanges.some(range => start >= range.start && start < range.end);
    });
    const unexplainedAdjustment = /별도(?:의)?(?:비용|요금|세금|수수료)|(?:추가비용|추가요금|할인|공제|기납부|선납)(?:은|는|금액은)?(?:미정|별도|추후|미기재|포함|있음)|(?:부가세|부가가치세|VAT)(?:를|가|는|:)?(?:포함|면제|면세)/i.test(compactScope);
    const invoiceBoundary = /(?:다음|별도|새로운)\s*청구서|청구서\s*[B-Z가-힣][\s:：]/.test(text.slice(scopeStart, total.start));
    // A total-before-details layout is deliberately left unverified by this conservative checker.
    const lateComponents = moneyTokens(afterTotal).length > 0;
    const canCompute = baseCount === 1 && taxes.length === 1 && !unidentifiedMoney && !unexplainedAdjustment && !invoiceBoundary && !lateComponents;
    const expectedTotal = canCompute ? components.reduce((sum, component) => sum + (component.operation === 'ADD' ? component.amount : -component.amount), 0) : null;
    const validTotal = expectedTotal !== null && Number.isSafeInteger(expectedTotal) && expectedTotal >= 0;
    const difference = validTotal ? total.amount - expectedTotal : null;
    const status = difference === null ? 'UNVERIFIED' : difference === 0 ? 'MATCH' : 'MISMATCH';
    const expression = components.map((component, index) => `${index ? component.operation === 'SUBTRACT' ? ' − ' : ' + ' : ''}${won(component.amount)}`).join('');
    checks.push({
      id: `payment-amount-${total.start}`, status,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `total` is dropped from the public component shape
      components: components.map(({ total: _total, ...component }) => component),
      claimedTotal: total.amount, expectedTotal: validTotal ? expectedTotal : null, difference,
      quote: total.quote, start: total.start, end: total.end,
      reason: status === 'UNVERIFIED'
        ? '금액 구성 또는 조정 항목을 확정할 수 없어 합계 검증을 보류했습니다. 원문에 기재된 할인·추가 비용·세금 포함 여부를 확인해야 합니다.'
        : status === 'MATCH'
          ? `${expression} = ${won(expectedTotal!)}으로 청구액과 일치합니다. 금액 일치는 청구의 진위 확인을 의미하지 않습니다.`
          : `${expression} = ${won(expectedTotal!)}입니다. 청구액 ${won(total.amount)}과 ${won(Math.abs(difference!))} 차이가 납니다. 차액의 청구 근거를 확인해야 합니다.`,
    });
    previousTotalEnd = total.end;
  }
  return checks;
}

/** Find exact source offsets even when a PDF has inserted whitespace inside words. */
function patternRange(clause: DocumentClause, pattern: RegExp): { quote: string; start: number; end: number } | undefined {
  const offsets: number[] = [];
  let flat = '';
  for (let index = 0; index < clause.text.length; index++) {
    if (!/\s/.test(clause.text[index])) { flat += clause.text[index]; offsets.push(index); }
  }
  const match = pattern.exec(flat);
  if (!match) return undefined;
  const localStart = offsets[match.index];
  const matchEnd = offsets[match.index + match[0].length - 1] + 1;
  const trailing = clause.text.slice(matchEnd).search(/[.!?。]/);
  const localEnd = trailing >= 0 ? matchEnd + trailing + 1 : clause.text.length;
  return { quote: clause.text.slice(localStart, localEnd), start: clause.start + localStart, end: clause.start + localEnd };
}

interface Rule {
  id: string;
  pattern: RegExp;
  negated: RegExp;
  title: string;
  reason: string;
  categories: RiskCategory[];
}

const rules: Rule[] = [
  {
    id: 'payment-pressure',
    pattern: /(?:발행당일|당일|금일|오늘|즉시|지금|\d+분(?:이내|내)|\d+시간이내).{0,80}(?:않으면|않을경우|미납|미결제|지연|안하면).{0,45}(?:중단|차단|해지|삭제|압류|법적조치)/,
    negated: /(?:중단|차단|해지|삭제|압류)(?:을|를)?(?:하지않|되지않|할수없)|(?:중단|차단|해지|삭제|압류).{0,8}(?:금지|하지말)|(?:협박|위협|요구|요청|안내).{0,15}(?:따르지말|따르지마|거절|금지|해서는안)/,
    title: '급박한 처리 요구와 불이익 위협',
    reason: '당일·즉시 처리를 요구하면서 서비스 중단 등의 불이익을 예고합니다. 납부 기한 안내와 별도로 검증 시간을 제한하는 청구 위험 신호입니다.',
    categories: ['FINANCIAL_RISK', 'UNILATERAL_DISCRETION'],
  },
  {
    id: 'payment-approval-bypass',
    pattern: /(?:금액확인|내부승인|승인절차|결재|검증|검토).{0,55}(?:납부|입금|송금|지급|결제)(?:를|을)?(?:한)?(?:이후|후|뒤)|(?:납부|입금|송금|지급|결제)(?:한)?(?:이후|후|뒤).{0,30}(?:금액확인|내부승인|승인절차|결재|검증|검토)|(?:승인|결재|검증)(?:절차)?(?:를|을|는|은)?(?:생략|우회|받지않아도|필요없|불필요)/,
    negated: /(?:생략|우회)(?:을|를)?(?:하지말|하지마|하지않|할수없)|(?:납부|입금|송금|지급|결제)(?:를|을)?(?:하지말|하지마|해서는안)|(?:요구|요청|지시|안내).{0,15}(?:따르지말|따르지마|거절|금지|해서는안)/,
    title: '납부 전 확인·승인 절차 우회',
    reason: '금액 확인이나 내부 승인을 납부 뒤로 미루거나 생략하도록 요구합니다. 청구 근거와 승인 여부를 확인하기 전에 돈이 지급될 위험이 있습니다.',
    categories: ['COMPLIANCE_RISK', 'FINANCIAL_RISK', 'EVIDENCE_RISK'],
  },
  {
    id: 'payment-verification-block',
    pattern: /(?:(?:기존|공식|계약상|원래).{0,20}(?:담당자|연락처|번호)(?:에게|로|에)?(?:재)?|재)?(?:확인|문의|연락|검증)(?:을|를|은|는)?(?:하지말|하지마|하지않아도|할필요(?:가)?없|생략|금지|불필요)/,
    negated: /(?:말라는|금지하는|생략하라는|불필요하다는).{0,25}(?:따르지말|따르지마|따르지않|거절|금지|해서는안)|(?:검증차단|확인금지)(?:을|를)?(?:금지|허용하지않)/,
    title: '기존 연락 경로를 통한 재확인 차단',
    reason: '기존 담당자에게 재확인하거나 독립적으로 검증하지 못하도록 요구합니다. 청구서에 적힌 안내만 신뢰하게 하는 사칭·허위 청구의 위험 신호입니다.',
    categories: ['EVIDENCE_RISK', 'AUTHENTICITY_RISK', 'FINANCIAL_RISK'],
  },
];

function finding(id: string, clause: DocumentClause | undefined, range: { quote: string; start: number; end: number }, title: string, reason: string, categories: RiskCategory[]): HighlightItem {
  return { id, type: 'DANGER', originalText: range.quote, easyText: title, reason, observedFact: range.quote,
    severity: 'HIGH', riskCategories: categories, confidence: 'HIGH', clauseId: clause?.id,
    clauseRef: clause?.articleNumber ? `제${clause.articleNumber}조` : undefined,
    sourceSpans: [{ start: range.start, end: range.end }], bbox: { x: 0, y: 0, width: 0, height: 0 },
    affectedParty: '청구를 받은 사람 또는 지급 담당자',
    verificationMethod: '지급 전에 기존에 알고 있던 공식 연락처와 내부 승인 경로로 계약·이용 내역·금액을 대조하세요. 문서가 제공하는 새 연락처만으로 확인하지 마세요.' };
}

/** Grounded signals describe suspicious requests, not a determination of legal fraud. */
export function inspectPaymentRisks(text: string, clauses: DocumentClause[]): PaymentRiskInspection {
  const flat = compact(text);
  const paymentContext = /청구|납부|입금|송금|지급|결제|미납|이용료/.test(flat);
  const isSimulation = /모의문서|AI테스트용|AI평가용|합성(?:샘플|문서)|모든정보는허구|실제거래.{0,25}나타내지않/.test(flat);
  const amountChecks = inspectAmounts(text);
  const highlights: HighlightItem[] = [];
  for (const check of amountChecks) {
    if (check.status !== 'MISMATCH') continue;
    const clause = clauses.find(item => item.start <= check.start && item.end >= check.end);
    highlights.push(finding(check.id, clause, check, '청구액과 구성 금액의 합계 불일치', check.reason, ['AMOUNT_PATTERN_RISK', 'CONTRADICTION', 'FINANCIAL_RISK']));
  }
  if (paymentContext) {
    for (const clause of clauses) {
      for (const rule of rules) {
        const range = patternRange(clause, rule.pattern);
        // Check the actual risky request, never a document-wide simulation disclaimer.
        if (!range || rule.negated.test(compact(range.quote))) continue;
        highlights.push(finding(`${rule.id}-${range.start}`, clause, range, rule.title, rule.reason, rule.categories));
      }
    }
  }
  const compoundRisks: CompoundRiskItem[] = [];
  const groups = new Map<string, HighlightItem[]>();
  for (const item of highlights) {
    const clause = clauses.find(candidate => candidate.id === item.clauseId);
    const scope = clause?.articleId || 'document';
    groups.set(scope, [...(groups.get(scope) || []), item]);
  }
  for (const group of groups.values()) {
    const kinds = new Set(group.map(item => item.id.replace(/-\d+$/, '')));
    if (kinds.size < 2) continue;
    compoundRisks.push({ title: '여러 청구 위험 신호의 결합', relatedHighlights: group.map(item => item.id), severity: 'HIGH',
      riskCategories: [...new Set(group.flatMap(item => item.riskCategories || []))],
      reason: `${group.map(item => item.easyText).join(', ')}이 함께 나타납니다. 지급 전에 독립적인 확인이 필요한 사기성 청구 패턴입니다. 이 신호만으로 실제 사기 여부를 확정하지는 않습니다.`,
      actionRequired: '청구서의 새 연락처 대신 기존 공식 담당자에게 계약·이용 내역·계산 근거를 확인하고 내부 승인 후 처리하세요.' });
  }
  return { highlights, compoundRisks, amountChecks, isSimulation, paymentContext };
}
