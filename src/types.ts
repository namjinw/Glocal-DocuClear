export type HighlightType = 'DANGER' | 'IMPORTANT' | 'ACTION';

export type RiskScore = '안전' | '주의' | '위험' | '판단 보류';

export interface SourceSpan {
  start: number;
  end: number;
}

export interface AnalysisMetadata {
  mode: 'ai' | 'local' | 'sample';
  status: 'complete' | 'limited';
  model?: string;
  warnings: string[];
  analyzedClauseCount: number;
  totalClauseCount: number;
  unresolvedReferences: string[];
}

export type SeverityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type EvidenceStatus = 'PRESENT' | 'MISSING' | 'UNKNOWN';

export type RiskCategory =
  | 'AMBIGUITY'              // 중요한 조건이 불명확함 (지급 방법/시점/산정 기준 모호)
  | 'MISSING_INFORMATION'    // 판단에 필요한 핵심 정보 누락
  | 'MODIFICATION_RISK'      // 핵심 조건의 사후/임의 변경 가능성 ("별도 협의", "상황에 따라")
  | 'CONTRADICTION'          // 서로 다른 조항 또는 문서 내용 충돌/모순
  | 'DISPUTE_RISK'           // 해석 차이나 사후 분쟁 가능성이 높음
  | 'UNILATERAL_DISCRETION'  // 특정 당사자에게 과도하거나 불명확한 재량이 부여됨
  | 'LIABILITY_RISK'         // 손해배상, 책임 범위, 원상복구, 위약벌 등 불리한 책임
  | 'FINANCIAL_RISK'         // 금전적 손실, 과도한 비용, 불리한 금전 조건
  | 'EVIDENCE_RISK'          // 객관적 증빙 부족 또는 주관적 진술을 우선하도록 규정한 조항
  | 'AUTHENTICITY_RISK'      // 거래 또는 문서의 진위 확인에 필요한 정보가 부족함
  | 'IDENTITY_RISK'          // 당사자 신원/사업자등록정보 교차검증 필요
  | 'FINANCIAL_ACCOUNT_RISK' // 계좌번호 형식, 예금주명 대조 확인 필요
  | 'CONTACT_RISK'           // 전화번호, 이메일 등 연락처 검증 필요
  | 'DATE_CONSISTENCY_RISK'  // 작성일, 계약일, 지급일 등 날짜 선후관계 불일치
  | 'AMOUNT_PATTERN_RISK'    // 금액 불일치, 원금/합계 불일치, 단가×수량 계산 오류
  | 'FORMAT_METADATA_RISK'   // 서명/도장 형태, 글꼴 불일치 등 서식 이상
  | 'COMPLIANCE_RISK';       // 법령/행정절차 위반 또는 필수 제출사항 누락 위험

export interface BoundingBox {
  x: number;      // 0 to 100 percentage from left
  y: number;      // 0 to 100 percentage from top
  width: number;  // 0 to 100 percentage width
  height: number; // 0 to 100 percentage height
  page?: number;  // page number (1-based)
}

export interface HighlightItem {
  id: string;
  type: HighlightType;
  riskCategories?: RiskCategory[];
  originalText: string;
  easyText: string;
  reason?: string;
  severity?: SeverityLevel;
  bbox: BoundingBox;
  page?: number;
  clauseRef?: string;
  observedFact?: string;
  riskSignal?: string;
  potentialProblem?: string;
  verificationMethod?: string;
  sourceSpans?: SourceSpan[];
  clauseId?: string;
  affectedParty?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DocumentSummary {
  score: RiskScore;
  bullets: string[];
  riskReasons?: string[];
  signalCount?: number;
  signalCategories?: RiskCategory[];
  safeVerificationNote?: string;
}

export interface MissingInformationItem {
  item: string;
  whyNeeded: string;
  potentialDispute: string;
  actionRequired: string;
  importance?: SeverityLevel;
  verificationMethod?: string;
}

export interface CompoundRiskItem {
  title: string;
  relatedHighlights: string[];
  reason: string;
  severity: SeverityLevel;
  riskCategories?: RiskCategory[];
  actionRequired?: string;
  verificationMethod?: string;
}

export interface EvidenceCheckItem {
  claim: string;
  expectedEvidence: string;
  status: EvidenceStatus;
  notes?: string;
}

export interface VerificationGuideItem {
  risk: string;
  method: string;
  expectedEvidence: string;
}

export interface DocumentPage {
  id: string;
  pageNumber: number;
  title: string;
  previewUrl: string;
  sourceFileName: string;
  fileType: 'image' | 'pdf';
}

export interface AnalysisResult {
  summary: DocumentSummary;
  highlights: HighlightItem[];
  missingInformation?: MissingInformationItem[];
  compoundRisks?: CompoundRiskItem[];
  evidenceChecks?: EvidenceCheckItem[];
  verificationGuide?: VerificationGuideItem[];
  fullDocumentText?: string;
  pages?: DocumentPage[];
  analysis?: AnalysisMetadata;
}

export interface SampleDocument {
  id: string;
  title: string;
  category: string;
  tag: string;
  description: string;
  previewNote: string;
  documentText: string;
  defaultResult: AnalysisResult;
}

export interface DocumentInput {
  type: 'file' | 'sample' | 'text';
  file?: File;
  files?: File[];
  previewUrl?: string;
  previewUrls?: string[];
  pages?: DocumentPage[];
  title: string;
  text?: string;
  sampleId?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
