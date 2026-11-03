import type { AnalysisResult, CompoundRiskItem, HighlightItem, RiskCategory, SeverityLevel } from '../types';
import { findQuoteSpans, resolveHighlightSpans } from './textAnchors';

export interface DocumentClause {
  id: string;
  articleId?: string;
  articleNumber?: number;
  paragraph?: number;
  text: string;
  start: number;
  end: number;
  references: string[];
}

export interface ParsedDocument {
  clauses: DocumentClause[];
  unresolvedReferences: string[];
}

const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const compact = (text: string) => text.replace(/\s+/g, '');
export const clauseLabel = (clause?: Pick<DocumentClause, 'articleNumber' | 'paragraph'>) => clause?.articleNumber
  ? `제${clause.articleNumber}조${clause.paragraph ? ` ${circled[clause.paragraph - 1] || clause.paragraph}` : ''}` : undefined;

/** Preserve original offsets; physical line wrapping is never a semantic boundary. */
export function parseDocument(text: string): ParsedDocument {
  const clauses: DocumentClause[] = [];
  const articleIds = new Set<string>();
  let articleNumber: number | undefined;
  let paragraph: number | undefined;
  let sequence = 0;
  let blockStart = 0;
  const counters = new Map<string, number>();
  const addBlock = (start: number, end: number) => {
    const block = text.slice(start, end);
    let cursor = 0;
    const emit = (from: number, to: number) => {
      const raw = block.slice(from, to);
      const leading = raw.length - raw.trimStart().length;
      const value = raw.trim();
      if (!value || /^[\s#*\-:]+$/.test(value)) return;
      const clauseStart = start + from + leading;
      const articleId = articleNumber === undefined ? undefined : `article-${articleNumber}`;
      const prefix = `${articleId || 'preamble'}-p${paragraph || 0}`;
      const index = (counters.get(prefix) || 0) + 1;
      counters.set(prefix, index);
      // "민법 제390조" cites an outside statute, not an article of this document.
      const citesStatute = (m: RegExpMatchArray) => /(?:(?<![방수용기산서작])법|법률|시행령|시행규칙|조례)\s*$/.test(value.slice(0, m.index));
      const references = [...value.matchAll(/제\s*(\d+)\s*조/g)].filter(m => !citesStatute(m)).map(m => `article-${Number(m[1])}`);
      if (articleId) {
        for (const match of value.matchAll(/제\s*(\d+)\s*항/g)) references.push(`${articleId}-p${Number(match[1])}`);
      }
      clauses.push({ id: `${prefix}-s${index}`, articleId, articleNumber, paragraph,
        text: value, start: clauseStart, end: clauseStart + value.length, references: [...new Set(references)] });
    };
    for (const match of block.matchAll(/[.!?。](?=\s|$)/g)) {
      // "2024. 1. 1." is a date, not three sentences.
      if (match[0] === '.' && /\d/.test(block[match.index! - 1] ?? '') && /^\s*\d/.test(block.slice(match.index! + 1, match.index! + 4))) continue;
      const endOfSentence = match.index! + match[0].length;
      emit(cursor, endOfSentence);
      cursor = endOfSentence;
    }
    emit(cursor, block.length);
  };

  const boundary = /^[ \t]*(?:#{1,6}[ \t]*)?제[ \t]*(\d+)[ \t]*조([^\r\n]*)|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|^[ \t]*\d+[.)][ \t]+|^[ \t]*\[[^\]\r\n]*(?:p\.|페이지[ \t]*)\d+\][ \t]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text))) {
    addBlock(blockStart, match.index);
    if (match[1]) {
      articleNumber = Number(match[1]);
      articleIds.add(`article-${articleNumber}`);
      paragraph = undefined;
      sequence = 0;
      const tail = match[2] || '';
      // A heading may share a line with the first paragraph. Never discard that body.
      const bodyMark = tail.search(/[①-⑳]/);
      const paren = tail.match(/^[ \t]*\([^)]*\)[ \t]*/);
      const bodyLike = /(?:한다|된다|있다|없다|하여야|해야|한다\.|한다$)/.test(tail);
      if (bodyMark >= 0) {
        blockStart = match.index + match[0].length - tail.length + bodyMark;
        boundary.lastIndex = blockStart;
      } else if (bodyLike) {
        blockStart = match.index + match[0].length - tail.length + (paren?.[0].length || 0);
      } else blockStart = boundary.lastIndex;
    } else if (match[0].trimStart().startsWith('[') && match[0].trimEnd().endsWith(']')) {
      // Page markers added at extraction time are not document clauses.
      blockStart = boundary.lastIndex;
    } else {
      const circleIndex = circled.indexOf(match[0].trim());
      if (circleIndex >= 0) paragraph = circleIndex + 1;
      else if (paragraph === undefined) paragraph = ++sequence;
      blockStart = boundary.lastIndex;
    }
  }
  addBlock(blockStart, text.length);
  const validRefs = new Set([...articleIds, ...clauses.filter(c => c.articleId && c.paragraph).map(c => `${c.articleId}-p${c.paragraph}`)]);
  const unresolvedReferences = [...new Set(clauses.flatMap(c => c.references).filter(ref => !validRefs.has(ref)))];
  return { clauses, unresolvedReferences };
}

type Feature = 'scope' | 'free-work' | 'revisions' | 'acceptance-delay' | 'acceptance-payment' |
  'third-party-payment' | 'withhold' | 'background-ip' | 'rights-transfer' | 'cap' | 'cap-exception' |
  'indirect-loss' | 'termination' | 'exit-charge' | 'noncompete' | 'renewal' | 'renewal-obstacle' |
  'rate-cut' | 'policy' | 'deemed-consent' | 'evidence' | 'penalty' | 'claim-expiry' |
  'restoration' | 'unilateral-method' | 'deferred-terms' | 'post-adjustment' | 'clawback';

interface Fact {
  clause: DocumentClause;
  features: Set<Feature>;
  actor: string;
  affectedParty?: string;
}

function extractFact(clause: DocumentClause, siblings: DocumentClause[]): Fact {
  const s = compact(clause.text);
  const context = compact(siblings.map(c => c.text).join(' '));
  const features = new Set<Feature>();
  const actor = s.match(/(?:^|다만|단,|단)(갑|을|발주자|수급자|회사|채권자|채무자)(?:은|는|이|가)/)?.[1] || '';
  const requiresAgreement = (value: string) => /(?:쌍방|양당사자|상호|당사자간)(?:의)?(?:사전)?(?:서면)?(?:합의|동의)|상대방의(?:사전)?(?:서면)?동의/.test(value)
    && !/(?:동의|합의)(?:를|가)?(?:없이|없어도|필요하지않)|동의여부와(?:무관|관계없이)/.test(value);
  const bilateral = requiresAgreement(s);
  const protectedScope = siblings.some(other => {
    const value = compact(other.text);
    return /업무(?:범위|의종류|내용)?(?:의)?변경|업무범위를변경/.test(value) && requiresAgreement(value)
      && /필요|받아야|있어야|거쳐야|합의로만|동의로만/.test(value);
  });
  const permission = /변경할수있|수정할수있|늘릴수있|확대할수있|바꿀수있|추가할수있|조정할수있/.test(s);
  const noPermission = /변경할수없|수정할수없|바꿀수없|확대할수없/.test(s);
  if (/업무|제작수량|운영채널|용역범위|제작범위/.test(s) && permission && !noPermission && !bilateral && !protectedScope) features.add('scope');
  if (/(?:보수|비용|대금|보상)/.test(s) && /청구(?:할수없|의사유가되지않)|별도(?:의)?(?:보수|보상|비용)(?:를|을)?(?:지급하지않|없)|추가(?:적인)?(?:보수|보상|비용|대금)(?:을|를)?(?:청구하지않|지급하지않|주지않|없이)|별도보상을청구하지않/.test(s)) features.add('free-work');
  if (/수정|보완/.test(s) && /(?:횟수|범위).*(?:제한을두지않|제한없)|무제한|횟수에제한/.test(s) && !/무제한.*(?:요구할수없|허용하지않)/.test(s)) features.add('revisions');
  if (/검수|승인/.test(s) && /유보할수있|기한을두지않|기간.*제한을두지않|언제든.*취소|효력이정지/.test(s)) features.add('acceptance-delay');
  if (/유보기간.*제한을두지않/.test(s) && /검수/.test(context)) features.add('acceptance-delay');
  if (/검수|승인/.test(s) && /대금|지급/.test(s) && /완료|승인.*후/.test(s)) features.add('acceptance-payment');
  if (/최종고객|제3자|고객으로부터/.test(s) && /대금|지급/.test(s) && /실제수령|수령한후|지급받은후/.test(s) && !/무관하게|관계없이/.test(s)) features.add('third-party-payment');
  if (/대금|지급/.test(s) && /보류할수있|지급유보|지급을유보/.test(s) && /의심|전액|제한없|제한을두지않|끝날때까지/.test(s)) features.add('withhold');
  if (/권리|지식재산|저작권|귀속|이전대상/.test(s) && /체결전|기존|전부터보유/.test(s) && /포함|이전|귀속/.test(s) && !/제외|포함하지않|이전하지않/.test(s)) features.add('background-ip');
  if (/권리|지식재산|저작(?:재산|인격)?권/.test(s) && /귀속|이전/.test(s) && /생성과동시|(?:지급|완납|검수)(?:및[^,.]{0,6})?여부와(?:관계없이|무관)|(?:지급|완납|검수)여부와(?:관계없이|무관)|착수즉시/.test(s)) features.add('rights-transfer');
  if (/배상|책임/.test(s) && /한도로|한도를|한도는|상한/.test(s) && !/적용하지않|적용하지아니|제외/.test(s)) features.add('cap');
  if (/한도|상한/.test(s) && /적용하지않|적용하지아니|적용을배제/.test(s) && /그밖|기타|모든|일체|계약상의무|납기|품질/.test(s)) features.add('cap-exception');
  if (/간접손해|영업기회상실|예상매출감소|평판저하/.test(s) && /배상|부담/.test(s) && !/배상하지않|책임을지지않|제외/.test(s)) features.add('indirect-loss');
  if (/해지|종료/.test(s) && /내부사정|사업계획변경|언제든|사유없이|임의로/.test(s) && !bilateral && !/해지할수없/.test(s)) features.add('termination');
  if (/잔여|남은/.test(s) && /전액|100%/.test(s) && /대금|보수|위약금|월세/.test(s) && /해지|중단|종료/.test(s + context)) features.add('exit-charge');
  if (/경쟁|유사한사업|동일.*사업/.test(s + context) && /종료후|종료일로부터|계약후/.test(s) && /제공하지않|할수없|금지|제한/.test(s)) features.add('noncompete');
  if (/자동(?:으로)?(?:갱신|연장)/.test(s) && !/자동(?:으로)?(?:갱신|연장)(?:되지않|하지않|을하지않)/.test(s)) features.add('renewal');
  if (/갱신거절|연장거절/.test(s) && /수신확인|등기우편으로만|효력이없/.test(s)) features.add('renewal-obstacle');
  if (/갱신|연장/.test(s) && /(?:대금|보수|단가).*(?:\d+%|감액|인하)/.test(s)) {
    const rate = s.match(/(\d+(?:\.\d+)?)%/);
    if (!rate || Number(rate[1]) < 100) features.add('rate-cut');
  }
  if (/운영정책|업무지침|정산기준/.test(s + context) && /변경할수있|나중에게시된.*우선|게시한날부터적용/.test(s) && !bilateral) features.add('policy');
  if (/동의한것으로|동의로간주/.test(s) && /이의.*않|업무를계속|침묵|회신.*않/.test(s)) features.add('deemed-consent');
  if (/주관적|진술|구두|확인내용/.test(s) && /우선|증빙없이|증빙보다/.test(s) && !/우선하지않|인정하지않/.test(s)) features.add('evidence');
  if (/위약금|위약벌|지체상금/.test(s) && /전액|무제한|30%|50%|100%|사유불문/.test(s) && !/부과하지않|청구하지않|지급하지않|면제/.test(s)) features.add('penalty');
  const dailyRate = s.match(/(?:1일당|일|매일)[^%\d]{0,12}?(\d+(?:\.\d+)?)%/);
  if (/위약금|위약벌|지체상금|지연배상/.test(s) && dailyRate && Number(dailyRate[1]) >= 1 && !/부과하지않|청구하지않|면제/.test(s)) features.add('penalty');
  if (/위약금|위약벌|지체상금|지연배상/.test(s) && /(?:임대료|월세|차임|대금|보수).{0,10}(?:잔여|남은|전액)|(?:잔여|남은).{0,12}(?:임대료|월세|차임|대금)/.test(s) && /중도해지|해지|퇴실|이탈/.test(s)) features.add('penalty');
  if (/\d+일이내/.test(s) && /청구하지않|청구하지못|기간내/.test(s) && /배상을요구할수없|권리를상실|청구권.*소멸/.test(s + context)) features.add('claim-expiry');
  if (/원상복구|수리비용|수선비|교체비용/.test(s) && /통상적(?:인)?(?:마모|사용)|자연(?:적)?(?:노후|마모)|노후|소모품|신품/.test(s) && /부담|책임|배상/.test(s) && !/부담하지않|책임을지지않|제외한/.test(s)) features.add('restoration');
  if (/(?:채권자|갑|회사|발주자|임대인|운영기관)(?:이|가)(?:일방적으로)?(?:지정|정하는|지시)(?:하는)?(?:방법|방식|계좌|시기|기한|일자|조건)/.test(s) && /변제|상환|지급|납부|이행/.test(s)) features.add('unilateral-method');
  if (/(?:지급|변제|상환|납부|정산|금액|이율|이자|일정|기한|방법)/.test(s) && /별도(?:로)?(?:협의|정|합의)|추후(?:에)?(?:협의|결정|정한|합의)|(?:향후|차후)(?:에)?(?:협의|결정)/.test(s) && !/별도(?:로)?(?:협의|정|합의)(?:하지않|없이)/.test(s) && !/(?:서면|문서)(?:으로)?(?:합의|협의)/.test(s)) features.add('deferred-terms');
  if (/(?:거래|내역|금액|원금|정산|청구).{0,12}(?:차이|불일치|상이)/.test(s) && /수정|변경|정정|조정/.test(s) && /협의|통보|일방|우선/.test(s) && !/상호서면|쌍방서면|양당사자서면/.test(s)) features.add('post-adjustment');
  if (/환수|반환(?:청구)?|회수/.test(s) && /전액|즉시|가산금/.test(s) && /지원금|보조금|지급받은|기지급|교부금|지원비/.test(s) && !/환수하지않|반환하지않|면제/.test(s)) features.add('clawback');
  return { clause, features, actor, affectedParty: /을|수급자/.test(s) ? (/수급자/.test(s) ? '수급자' : '을') : undefined };
}

const rules: Partial<Record<Feature, { title: string; reason: string; categories: RiskCategory[]; severity: SeverityLevel }>> = {
  scope: { title: '일방적인 업무범위 확대', reason: '업무를 변경할 권한은 있으나 상대방 동의나 증가 범위의 제한이 이 문장에서 확인되지 않습니다.', categories: ['UNILATERAL_DISCRETION', 'MODIFICATION_RISK'], severity: 'MEDIUM' },
  'free-work': { title: '추가 보수 또는 보상 청구 제한', reason: '추가 업무나 권리 이전에 따른 별도 보수·보상 청구를 제한합니다. 적용되는 업무범위와 함께 확인해야 합니다.', categories: ['FINANCIAL_RISK'], severity: 'MEDIUM' },
  revisions: { title: '수정 횟수 제한 없음', reason: '수정 요구의 횟수에 상한이 없어 수행 부담을 예측하기 어렵습니다.', categories: ['UNILATERAL_DISCRETION', 'FINANCIAL_RISK'], severity: 'MEDIUM' },
  'acceptance-delay': { title: '검수 확정 지연 가능성', reason: '검수 유보나 승인 효력 정지로 완료 시점이 불확정해질 수 있습니다.', categories: ['AMBIGUITY', 'UNILATERAL_DISCRETION'], severity: 'MEDIUM' },
  'third-party-payment': { title: '제3자 입금에 종속된 대금 지급', reason: '최종 고객의 입금 시점이 지급 조건이 되어 상대방의 자금 회수 지연을 수행자가 부담할 수 있습니다.', categories: ['FINANCIAL_RISK', 'AMBIGUITY'], severity: 'HIGH' },
  withhold: { title: '광범위한 대금 지급 보류', reason: '의심이나 확인 완료까지를 이유로 대금 전액을 보류할 수 있어 지급 범위와 기한이 불확정합니다.', categories: ['FINANCIAL_RISK', 'UNILATERAL_DISCRETION'], severity: 'HIGH' },
  'background-ip': { title: '기존 보유 자산까지 권리 이전', reason: '계약 전부터 보유한 자산도 이전 범위에 포함하여 기존 자산의 재사용이 제한될 수 있습니다.', categories: ['LIABILITY_RISK', 'FINANCIAL_RISK'], severity: 'HIGH' },
  'rights-transfer': { title: '대금 지급 전 권리 이전', reason: '권리 이전 시점이 대금 수령과 연결되지 않아 미지급 상태에서도 권리를 잃을 수 있습니다.', categories: ['FINANCIAL_RISK'], severity: 'HIGH' },
  'cap-exception': { title: '광범위한 배상 한도 예외', reason: '일반적인 계약 의무 위반까지 한도 적용에서 제외하여 책임 제한의 실효성이 약해질 수 있습니다.', categories: ['LIABILITY_RISK'], severity: 'HIGH' },
  'indirect-loss': { title: '간접손실까지 확장된 배상', reason: '예상 매출이나 영업기회 등 산정이 어려운 손실도 배상 범위에 들어갑니다.', categories: ['LIABILITY_RISK', 'FINANCIAL_RISK'], severity: 'HIGH' },
  termination: { title: '내부 사정에 따른 일방적 해지', reason: '상대방의 위반 없이도 해지할 수 있어 완료 전 작업과 투입 비용의 정산 조건을 함께 검토해야 합니다.', categories: ['UNILATERAL_DISCRETION'], severity: 'MEDIUM' },
  'exit-charge': { title: '잔여기간 대금 전액 부담', reason: '중단 또는 종료 시 남은 기간의 대금 전액을 부담하여 종료 비용이 크게 발생할 수 있습니다.', categories: ['FINANCIAL_RISK', 'LIABILITY_RISK'], severity: 'HIGH' },
  noncompete: { title: '계약 종료 후 경쟁 업무 제한', reason: '계약 종료 뒤에도 영업 활동을 제한합니다. 대상 업무·지역·기간과 별도 보상을 함께 확인해야 합니다.', categories: ['LIABILITY_RISK', 'FINANCIAL_RISK'], severity: 'MEDIUM' },
  'renewal-obstacle': { title: '갱신 거절 방식 제한', reason: '수신 확인이나 특정 통지 방식에 갱신 거절 효력이 종속되어 종료 의사를 적시에 전달하기 어려울 수 있습니다.', categories: ['UNILATERAL_DISCRETION'], severity: 'MEDIUM' },
  'rate-cut': { title: '갱신 시 보수 감액', reason: '계약 갱신에 따라 보수가 줄어드는 조건입니다. 업무량 유지 여부와 갱신 거절 조건을 함께 확인해야 합니다.', categories: ['FINANCIAL_RISK'], severity: 'MEDIUM' },
  policy: { title: '외부 정책에 따른 계약 변경', reason: '운영정책의 변경이나 우선 적용으로 합의한 조건이 사후에 바뀔 수 있습니다.', categories: ['MODIFICATION_RISK', 'UNILATERAL_DISCRETION'], severity: 'HIGH' },
  'deemed-consent': { title: '이의 미제기 또는 업무 계속을 동의로 간주', reason: '적극적인 합의 없이 변경에 동의한 것으로 처리될 수 있습니다.', categories: ['MODIFICATION_RISK'], severity: 'MEDIUM' },
  evidence: { title: '주관적 진술의 우선 적용', reason: '객관적 자료보다 진술이나 확인 내용을 우선하면 이행 사실을 다투기 어려워질 수 있습니다.', categories: ['EVIDENCE_RISK'], severity: 'HIGH' },
  penalty: { title: '큰 금액 또는 무제한 위약 부담', reason: '전액·무제한 또는 높은 비율의 위약 부담이 명시되어 손실 규모를 검토해야 합니다.', categories: ['LIABILITY_RISK', 'FINANCIAL_RISK'], severity: 'HIGH' },
  restoration: { title: '통상 마모·노후까지 임차인에게 전가', reason: '정상적인 사용에 따른 마모나 노후, 소모품 교체까지 전액 부담하도록 하여 원상복구 책임이 지나치게 넓어질 수 있습니다.', categories: ['LIABILITY_RISK', 'FINANCIAL_RISK'], severity: 'HIGH' },
  'unilateral-method': { title: '상대방이 정하는 이행 방법', reason: '변제·지급 방법이나 시기를 한쪽이 일방적으로 정할 수 있어 이행 조건이 사후에 바뀔 수 있습니다.', categories: ['UNILATERAL_DISCRETION', 'AMBIGUITY'], severity: 'HIGH' },
  'deferred-terms': { title: '핵심 이행 조건의 사후 협의 유보', reason: '지급 방법·일정 등 핵심 조건이 확정되지 않고 나중에 협의하도록 남겨져 있어 분쟁 시 기준이 불분명합니다.', categories: ['AMBIGUITY'], severity: 'HIGH' },
  'post-adjustment': { title: '거래 내역 사후 수정 가능', reason: '실제 내역과 차이가 있을 때 협의만으로 수정하도록 하여 기록된 금액·조건이 사후에 바뀔 수 있습니다.', categories: ['MODIFICATION_RISK', 'EVIDENCE_RISK'], severity: 'HIGH' },
  clawback: { title: '지원금 환수 및 가산금 부과', reason: '위반 시 지급된 지원금 전액 환수나 가산금·참여 제한이 부과될 수 있어 해당 요건과 예외를 사전에 확인해야 합니다.', categories: ['FINANCIAL_RISK', 'LIABILITY_RISK'], severity: 'MEDIUM' },
  'claim-expiry': { title: '단기 청구기간 경과 시 권리 제한', reason: '짧은 기간 내 청구하지 않으면 배상을 요구할 수 없게 되어 권리 행사 기회를 놓칠 수 있습니다.', categories: ['LIABILITY_RISK'], severity: 'HIGH' },
};

function infoHighlight(clause: DocumentClause): HighlightItem | undefined {
  const s = compact(clause.text);
  const base = { id: `info-${clause.id}`, originalText: clause.text, clauseId: clause.id,
    clauseRef: clause.articleNumber ? `제${clause.articleNumber}조${clause.paragraph ? ` ${circled[clause.paragraph - 1] || clause.paragraph}` : ''}` : undefined,
    sourceSpans: [{ start: clause.start, end: clause.end }], bbox: { x: 0, y: 0, width: 0, height: 0 }, severity: 'LOW' as const };
  if (/제출|신고|통지|통보|보고서/.test(s)) return { ...base, type: 'ACTION', easyText: '계약상 수행 또는 통지 사항입니다. 담당자와 이행 시점을 확인하세요.' };
  if (/금액|대금|지급|계약기간|갱신|한도|원(?:으로|을|이며|이다)|만원/.test(s)) return { ...base, type: 'IMPORTANT', easyText: '금액·기간 또는 적용 조건입니다. 관련 조항과 함께 확인하세요.' };
  return undefined;
}

/** Local structural screening is deliberately labelled limited; it never certifies safety. */
export function analyzeDocumentOffline(text: string): AnalysisResult {
  if (!text.trim()) throw new Error('분석할 문서 내용이 없습니다.');
  const parsed = parseDocument(text);
  const facts = parsed.clauses.map(c => extractFact(c, parsed.clauses.filter(other => other.articleId === c.articleId)));
  const highlights: HighlightItem[] = [];
  const featureIds = new Map<Feature, { fact: Fact; id: string }[]>();
  for (const fact of facts) {
    const c = fact.clause;
    for (const feature of fact.features) {
      const rule = rules[feature];
      const id = `${feature}-${c.id}`;
      if (rule) {
        highlights.push({ id, type: 'DANGER', originalText: c.text, easyText: rule.title, reason: rule.reason,
          observedFact: c.text, riskCategories: rule.categories, severity: rule.severity, confidence: 'MEDIUM',
          clauseId: c.id, clauseRef: c.articleNumber ? `제${c.articleNumber}조${c.paragraph ? ` ${circled[c.paragraph - 1] || c.paragraph}` : ''}` : undefined,
          sourceSpans: [{ start: c.start, end: c.end }], bbox: { x: 0, y: 0, width: 0, height: 0 }, affectedParty: fact.affectedParty,
          verificationMethod: '관련 조항의 적용 범위, 상한, 상대방 동의 및 종료·정산 조건을 함께 확인하세요.' });
      }
      const list = featureIds.get(feature) || [];
      list.push({ fact, id: rule ? id : `info-${c.id}` });
      featureIds.set(feature, list);
    }
    const info = infoHighlight(c);
    if (info && (!highlights.some(h => h.clauseId === c.id) || ['cap', 'acceptance-payment', 'renewal'].some(f => fact.features.has(f as Feature)))) highlights.push(info);
  }
  const compoundRisks: CompoundRiskItem[] = [];
  const compound = (left: Feature, right: Feature, title: string, reason: string, categories: RiskCategory[], linkedOnly = false) => {
    for (const a of featureIds.get(left) || []) {
      const candidates = featureIds.get(right) || [];
      const linked = candidates.filter(b => !linkedOnly ||
        a.fact.clause.id === b.fact.clause.id ||
        (a.fact.clause.articleId && a.fact.clause.articleId === b.fact.clause.articleId) ||
        a.fact.clause.references.some(ref => b.fact.clause.id.startsWith(ref)) || b.fact.clause.references.some(ref => a.fact.clause.id.startsWith(ref)));
      if (!linked.length) continue;
      const relatedHighlights = [...new Set([a.id, ...linked.map(b => b.id)])].filter(id => highlights.some(h => h.id === id));
      if (relatedHighlights.length < 2) continue;
      const existing = compoundRisks.find(r => r.title === title && r.relatedHighlights.some(id => relatedHighlights.includes(id)));
      if (existing) {
        existing.relatedHighlights = [...new Set([...existing.relatedHighlights, ...relatedHighlights])];
        continue;
      }
      compoundRisks.push({ title, reason, severity: 'HIGH', relatedHighlights, riskCategories: categories,
        actionRequired: '연결된 조항을 함께 수정하여 권한의 범위, 지급 기한, 비용 부담 또는 예외 범위를 명확히 하세요.' });
    }
  };
  compound('scope', 'free-work', '업무 확대와 추가 보수 제한의 결합', '업무를 늘릴 수 있는 권한과 추가 보수 청구 제한이 결합하여 증가한 업무를 무상으로 수행하게 될 수 있습니다.', ['UNILATERAL_DISCRETION', 'FINANCIAL_RISK'], true);
  compound('revisions', 'free-work', '무제한 수정과 무상 수행의 결합', '수정 횟수 상한 없이 추가 보수도 제한되어 작업량과 비용을 예측하기 어렵습니다.', ['FINANCIAL_RISK'], true);
  compound('acceptance-delay', 'acceptance-payment', '검수 지연과 지급기한의 종속', '검수 완료가 지급 조건인데 검수 확정 시점을 미룰 수 있어 명시된 지급기한이 실제로 도래하지 않을 수 있습니다.', ['AMBIGUITY', 'FINANCIAL_RISK']);
  compound('cap', 'cap-exception', '배상 한도를 무력화하는 광범위한 예외', '책임 한도를 두면서 일반적인 의무 위반을 예외로 정하여 한도의 실효성이 약해집니다.', ['LIABILITY_RISK'], true);
  compound('renewal', 'renewal-obstacle', '자동 갱신과 갱신 거절의 제약', '자동 갱신 조건과 엄격한 거절 방식이 결합하여 의도하지 않은 계약 연장이 발생할 수 있습니다.', ['UNILATERAL_DISCRETION'], true);
  compound('renewal', 'rate-cut', '자동 갱신에 따른 보수 감액', '계약이 자동 갱신되면서 보수가 낮아질 수 있습니다. 갱신 거절 기한과 업무량을 함께 확인해야 합니다.', ['FINANCIAL_RISK'], true);
  compound('policy', 'deemed-consent', '정책 변경과 묵시적 동의의 결합', '한쪽이 변경한 정책에 이의를 제기하지 않거나 업무를 계속하면 동의로 처리되어 별도 합의 없이 조건이 바뀔 수 있습니다.', ['MODIFICATION_RISK', 'UNILATERAL_DISCRETION'], true);
  compound('restoration', 'penalty', '원상복구 책임 전가와 과다 위약금의 결합', '통상 마모까지 부담시키면서 중도 해지 시 높은 위약금도 부과하여 보증금 반환 전 부담이 크게 늘어날 수 있습니다.', ['LIABILITY_RISK', 'FINANCIAL_RISK'], true);
  compound('restoration', 'exit-charge', '원상복구 책임 전가와 과다 위약금의 결합', '통상 마모까지 부담시키면서 중도 해지 시 잔여 기간 대금도 부과하여 보증금 반환 전 부담이 크게 늘어날 수 있습니다.', ['LIABILITY_RISK', 'FINANCIAL_RISK'], true);
  compound('unilateral-method', 'evidence', '지급 조건 불확정과 주관적 증빙 의존의 결합', '이행 방법을 한쪽이 정하고 증빙이 없으면 당사자 진술을 우선하여 채무 내용을 다투기 어려워질 수 있습니다.', ['UNILATERAL_DISCRETION', 'EVIDENCE_RISK']);
  compound('deferred-terms', 'evidence', '지급 조건 불확정과 주관적 증빙 의존의 결합', '핵심 조건이 확정되지 않았는데 증빙이 없으면 당사자 진술을 우선하여 채무 내용을 다투기 어려워질 수 있습니다.', ['AMBIGUITY', 'EVIDENCE_RISK']);
  compound('evidence', 'post-adjustment', '거래 진위 불확실과 사후 수정의 결합', '주관적 진술을 우선하면서 거래 내역도 사후에 수정할 수 있어 기록의 신뢰성이 흔들릴 수 있습니다.', ['EVIDENCE_RISK', 'MODIFICATION_RISK']);
  compound('rights-transfer', 'penalty', '권리 일방 귀속과 과다 지체상금의 결합', '대금 수령과 무관하게 권리가 넘어가는데 지연 시 높은 지체상금까지 공제될 수 있습니다.', ['FINANCIAL_RISK', 'LIABILITY_RISK']);
  const warnings = ['간이 분석은 조항 구조와 알려진 위험 패턴을 검토합니다. 표현이 다르거나 복잡한 예외가 있으면 위험을 놓칠 수 있어 안전을 확정하지 않습니다.'];
  if (parsed.unresolvedReferences.length) warnings.push('본문에 없는 참조 조항이 있어 관련 내용을 확인하지 못했습니다.');
  return recalculateAnalysis({ summary: { score: '판단 보류', bullets: [] }, highlights, compoundRisks, fullDocumentText: text,
    analysis: { mode: 'local', status: 'limited', warnings, analyzedClauseCount: parsed.clauses.length,
      totalClauseCount: parsed.clauses.length, unresolvedReferences: parsed.unresolvedReferences } });
}

/** The report and edited highlights must always describe the same validated findings. */
export function recalculateAnalysis(result: AnalysisResult): AnalysisResult {
  const highlights = result.highlights.map(h => h.type === 'DANGER' ? h : { ...h, riskCategories: [] });
  const ids = new Set(highlights.map(h => h.id));
  const compoundRisks = (result.compoundRisks || []).filter(r =>
    new Set(r.relatedHighlights).size >= 2 && r.relatedHighlights.every(id => ids.has(id)));
  const dangers = highlights.filter(h => h.type === 'DANGER');
  const limited = !result.analysis || result.analysis.status !== 'complete' || result.analysis.mode !== 'ai';
  const severe = dangers.some(h => h.severity === 'HIGH') || compoundRisks.some(r => r.severity === 'HIGH');
  const score = severe ? '위험' : dangers.length || compoundRisks.length ? '주의' : limited ? '판단 보류' : '안전';
  const categories = [...new Set([...dangers.flatMap(h => h.riskCategories || []), ...compoundRisks.flatMap(r => r.riskCategories || [])])];
  const reasons = [...new Set([...dangers.map(h => h.reason || h.easyText), ...compoundRisks.map(r => r.reason)])];
  const riskCount = dangers.length + compoundRisks.length;
  const bullets = [
    riskCount ? `개별 위험 ${dangers.length}건, 조항 간 결합 위험 ${compoundRisks.length}건을 확인했습니다.` : '현재 분석에서 근거가 확인된 위험 항목은 없습니다.',
    reasons[0] || (limited ? '검토 범위가 제한되어 문서가 안전하다고 확정할 수 없습니다.' : '검토된 조항에서 추가 위험 근거가 확인되지 않았습니다.'),
    limited ? '분석 범위와 미확인 참조를 확인하고 필요한 부분을 추가 검토하세요.' : '표시된 원문과 적용되는 예외·부속 문서를 함께 확인하세요.',
  ];
  return { ...result, highlights, compoundRisks,
    summary: { ...result.summary, score, signalCount: riskCount, signalCategories: categories, riskReasons: reasons, bullets,
      safeVerificationNote: limited ? '간이 분석 또는 불완전한 분석입니다. 탐지되지 않은 위험이 없다는 뜻은 아닙니다.' : '이 결과는 입력된 문서의 검토 결과이며 외부 사실이나 법적 효력을 보증하지 않습니다.' } };
}

/** The clause already carries exact offsets; search only inside it instead of the whole document. */
function anchorInClause(text: string, highlight: HighlightItem, clauses: DocumentClause[]) {
  if (highlight.sourceSpans?.length) return undefined;
  const clause = clauses.find(c => c.id === highlight.clauseId);
  if (!clause) return undefined;
  const [first] = findQuoteSpans(text.slice(clause.start, clause.end), highlight.originalText);
  return first ? [{ start: clause.start + first.start, end: clause.start + first.end }] : undefined;
}

/** Anchor model evidence to the original, not to a regenerated/paraphrased document. */
export function finalizeAnalysis(result: AnalysisResult, text: string): AnalysisResult {
  const parsed = parseDocument(text);
  const warnings = [...(result.analysis?.warnings || [])];
  const modelUncertain = result.summary.score === '판단 보류' ||
    (result.summary.score !== '안전' && !result.highlights.some(h => h.type === 'DANGER') && !result.compoundRisks?.length);
  if (modelUncertain) warnings.push('AI가 판단을 확정하지 못했거나 위험도와 근거 목록이 일치하지 않아 추가 검토가 필요합니다.');
  let ungrounded = 0;
  const highlights = result.highlights.map(h => {
    const sourceSpans = anchorInClause(text, h, parsed.clauses) ?? resolveHighlightSpans(text, h);
    if (!sourceSpans.length) {
      ungrounded++;
      return { ...h, type: 'IMPORTANT' as const, riskCategories: undefined, sourceSpans: [],
        reason: '원문에서 이 인용의 정확한 위치를 확인하지 못했습니다. 재분석이 필요합니다.', confidence: 'LOW' as const };
    }
    const clause = parsed.clauses.find(c => sourceSpans[0].start >= c.start && sourceSpans[0].end <= c.end);
    return { ...h, sourceSpans, clauseId: clause?.id || h.clauseId };
  });
  const groundedIds = new Set(highlights.filter(h => h.sourceSpans?.length).map(h => h.id));
  const compoundRisks = (result.compoundRisks || []).filter(r => r.relatedHighlights.every(id => groundedIds.has(id)));
  if (ungrounded) warnings.push(`원문 근거 위치를 확인하지 못한 항목 ${ungrounded}건은 위험 판정에서 제외하고 확인 대상으로 남겼습니다.`);
  if (parsed.unresolvedReferences.length) warnings.push('입력되지 않은 참조 조항이 있습니다. 관련 위험을 완전히 검토할 수 없습니다.');
  const analysis = { mode: result.analysis?.mode || 'ai' as const, status: result.analysis?.status || 'complete' as const,
    model: result.analysis?.model, warnings: [...new Set(warnings)],
    analyzedClauseCount: result.analysis?.analyzedClauseCount ?? parsed.clauses.length,
    totalClauseCount: parsed.clauses.length, unresolvedReferences: parsed.unresolvedReferences };
  if (ungrounded || parsed.unresolvedReferences.length || modelUncertain) analysis.status = 'limited';
  return recalculateAnalysis({ ...result, highlights, compoundRisks, fullDocumentText: text, analysis });
}
