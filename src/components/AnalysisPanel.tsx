import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Award,
  Calendar,
  Code,
  Copy,
  Check,
  Sparkles,
  ArrowUpRight,
  Filter,
  Eye,
  EyeOff,
  MessageSquare,
  FileText,
  Send,
  Bot,
  User,
  RefreshCw,
  HelpCircle,
  CheckCheck,
  Edit2,
  Layers,
  FileQuestion,
  Receipt,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AnalysisResult,
  HighlightType,
  RiskScore,
  ChatMessage,
  HighlightItem,
  RiskCategory,
  SeverityLevel,
} from '../types';
import { askDocumentQuestion } from '../utils/groq';
import './AnalysisPanel.css';

interface AnalysisPanelProps {
  result: AnalysisResult;
  isSample?: boolean;
  selectedHighlightId: string | null;
  onSelectHighlight: (id: string | null) => void;
  activeFilter: 'ALL' | HighlightType;
  onFilterChange: (filter: 'ALL' | HighlightType) => void;
  onOpenJsonModal: () => void;
  visibleHighlightIds: string[];
  onToggleHighlightVisibility: (id: string) => void;
  onToggleAllHighlights: (showAll: boolean) => void;
  documentTitle: string;
  documentText?: string;
  documentFile?: File;
  documentFiles?: File[];
  previewUrl?: string;
  onOpenEditModal?: (item: HighlightItem) => void;
}

const generateId = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
const formatCurrentTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const RISK_CATEGORY_META: Record<RiskCategory, { label: string; icon: string }> = {
  AMBIGUITY: { label: '조건 불명확', icon: '❓' },
  MISSING_INFORMATION: { label: '정보 누락', icon: '📋' },
  MODIFICATION_RISK: { label: '사후 변경 위험', icon: '🔄' },
  CONTRADICTION: { label: '조항 모순', icon: '⚡' },
  DISPUTE_RISK: { label: '분쟁 위험', icon: '⚠️' },
  UNILATERAL_DISCRETION: { label: '일방적 재량', icon: '⚖️' },
  LIABILITY_RISK: { label: '과도한 책임', icon: '🛡️' },
  FINANCIAL_RISK: { label: '금전 손실', icon: '💸' },
  EVIDENCE_RISK: { label: '증빙 취약', icon: '🧾' },
  AUTHENTICITY_RISK: { label: '거래진위 불명', icon: '🔍' },
  IDENTITY_RISK: { label: '신원 검증', icon: '🆔' },
  FINANCIAL_ACCOUNT_RISK: { label: '계좌 검증', icon: '🏦' },
  CONTACT_RISK: { label: '연락처 검증', icon: '📞' },
  DATE_CONSISTENCY_RISK: { label: '날짜 불일치', icon: '📅' },
  AMOUNT_PATTERN_RISK: { label: '금액 계산', icon: '🔢' },
  FORMAT_METADATA_RISK: { label: '서식 이상', icon: '📝' },
  COMPLIANCE_RISK: { label: '규정/절차 준수', icon: '📜' },
};

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  result,
  isSample = false,
  selectedHighlightId,
  onSelectHighlight,
  activeFilter,
  onFilterChange,
  onOpenJsonModal,
  visibleHighlightIds,
  onToggleHighlightVisibility,
  onToggleAllHighlights,
  documentTitle,
  documentText,
  documentFile,
  documentFiles,
  onOpenEditModal,
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'deep' | 'chat'>('report');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [expandedCompound, setExpandedCompound] = useState<{ [key: number]: boolean }>({ 0: true, 1: true });

  // Chat Assistant State
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `안녕하세요! 분석된 **[${documentTitle || '문서'}]**에 대해 무엇이든 질문해주세요.\n\n불명확한 지급 방식, 일방적 재량권, 복합 위험, 누락된 증빙 등 심층 검토 사항을 알기 쉽게 답변해 드립니다.`,
      timestamp: '안내',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    summary,
    highlights = [],
    compoundRisks = [],
    missingInformation = [],
    evidenceChecks = [],
    verificationGuide = [],
  } = result;

  const dangerCount = highlights.filter((h) => h.type === 'DANGER').length;
  const importantCount = highlights.filter((h) => h.type === 'IMPORTANT').length;
  const actionCount = highlights.filter((h) => h.type === 'ACTION').length;

  const filteredHighlights = highlights.filter((h) => {
    if (activeFilter === 'ALL') return true;
    return h.type === activeFilter;
  });

  const allVisible = highlights.length > 0 && highlights.every((h) => visibleHighlightIds.includes(h.id));

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isAsking]);

  const getScoreConfig = (score: RiskScore) => {
    switch (score) {
      case '안전':
        return {
          icon: <ShieldCheck size={28} />,
          badgeClass: 'score-safe',
          label: '확인된 위험 신호 없음',
          desc: '분석한 범위에서 위험 신호가 탐지되지 않았습니다. 문서의 안전성이나 법적 효력을 보증하는 결과는 아닙니다.',
          tag: '분석 범위 내 미탐지',
        };
      case '판단 보류':
        return {
          icon: <HelpCircle size={28} />,
          badgeClass: 'score-unknown',
          label: '판단 보류',
          desc: '현재 분석으로 위험 여부를 충분히 판단할 수 없습니다. 로컬 규칙의 미탐지나 처리 제한을 문서가 안전하다는 뜻으로 해석하지 마세요.',
          tag: '추가 검토 필요',
        };
      case '주의':
        return {
          icon: <AlertTriangle size={28} />,
          badgeClass: 'score-warning',
          label: '주의',
          desc: '추가 확인이 필요한 위험 신호를 탐지했습니다. 조항별 근거와 적용 조건을 검토하세요.',
          tag: '신중한 검토 필요',
        };
      case '위험':
      default:
        return {
          icon: <ShieldAlert size={28} />,
          badgeClass: 'score-danger',
          label: '위험',
          desc: '우선 검토가 필요한 위험 신호를 탐지했습니다. 조항별 근거와 연결된 조건을 확인하세요.',
          tag: '우선 검토 필요',
        };
    }
  };

  const analysis = result.analysis;
  const displayedScore: RiskScore = dangerCount === 0 && compoundRisks.length === 0 &&
    (!analysis || analysis.mode === 'local' || analysis.status === 'limited')
    ? '판단 보류'
    : summary.score;
  const scoreConfig = getScoreConfig(displayedScore);
  const analysisSource = analysis?.mode === 'ai' ? 'AI 분석'
    : analysis?.mode === 'local' ? '로컬 규칙 분석'
      : analysis?.mode === 'sample' ? '사전 작성된 샘플 결과' : '분석 출처 확인 불가';
  const analysisWarnings = [...new Set([
    ...(analysis?.warnings ?? []),
    ...(!analysis ? ['분석 출처와 처리 범위 정보가 없어 완료 여부를 확인할 수 없습니다.'] : []),
  ])];

  const handleCopySummary = () => {
    const reasonsText =
      summary.riskReasons && summary.riskReasons.length > 0
        ? `\n[위험 판정 근거]\n${summary.riskReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        : '';
    const textToCopy = `[DocuClear AI 문서 분석 요약]\n위험도: ${displayedScore}\n분석 출처: ${analysisSource}${analysis?.model ? ` (${analysis.model})` : ''}\n처리 상태: ${analysis?.status === 'complete' ? '분석 처리 완료' : '제한 있음'}\n\n[핵심 3줄 요약]\n1. ${summary.bullets[0] || ''}\n2. ${summary.bullets[1] || ''}\n3. ${summary.bullets[2] || ''}${reasonsText}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const getTypeDetails = (type: HighlightType) => {
    switch (type) {
      case 'DANGER':
        return {
          label: 'DANGER (위험/독소/불확정)',
          colorClass: 'type-danger',
          icon: <ShieldAlert size={14} />,
        };
      case 'IMPORTANT':
        return {
          label: 'IMPORTANT (중요 조건/금액)',
          colorClass: 'type-important',
          icon: <Award size={14} />,
        };
      case 'ACTION':
        return {
          label: 'ACTION (행동/마감)',
          colorClass: 'type-action',
          icon: <Calendar size={14} />,
        };
    }
  };

  const getSeverityBadge = (sev?: SeverityLevel) => {
    if (sev === 'HIGH') return <span className="severity-chip sev-high">🔴 HIGH 심각</span>;
    if (sev === 'MEDIUM') return <span className="severity-chip sev-med">🟡 MEDIUM 주의</span>;
    return <span className="severity-chip sev-low">🔵 LOW 보통</span>;
  };

  // Handle Q&A Question Submit
  const handleSendQuestion = async (presetText?: string) => {
    const questionToSend = (presetText || inputQuestion).trim();
    if (!questionToSend || isAsking) return;

    const userMessage: ChatMessage = {
      id: generateId('user'),
      sender: 'user',
      text: questionToSend,
      timestamp: formatCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setIsAsking(true);

    try {
      const answer = await askDocumentQuestion({
        question: questionToSend,
        documentTitle: documentTitle || '분석 문서',
        documentText,
        file: documentFile,
        files: documentFiles,
        analysisResult: result,
        chatHistory: messages.map((m) => ({ sender: m.sender, text: m.text })),
      });

      const assistantMessage: ChatMessage = {
        id: generateId('ai'),
        sender: 'assistant',
        text: answer,
        timestamp: formatCurrentTime(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error('Chat Q&A error:', err);
      const errorMsg = err instanceof Error ? err.message : '답변을 불러오는 중 오류가 발생했습니다.';
      setMessages((prev) => [
        ...prev,
        {
          id: generateId('ai-err'),
          sender: 'assistant',
          text: `⚠️ 답변 생성 실패: ${errorMsg}\n\n상단 [Groq 설정]에서 서버 설정을 확인하세요. 키를 변경했다면 서버를 다시 시작한 뒤 설정을 다시 확인하세요.`,
          timestamp: formatCurrentTime(),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const quickQuestions = [
    '⚠️ 가장 주의해야 할 독소조항 및 일방적 재량은?',
    '🔗 여러 조항이 결합된 복합 위험(Compound Risk)은?',
    '📋 누락된 핵심 계약 정보 및 증빙은 무엇인가요?',
    '💰 지급/정산 조건 및 사후 변경 가능성은?',
    '✍️ 서명 전 반드시 수정/보완을 요구할 사항은?',
  ];

  const totalDeepRisks =
    compoundRisks.length + missingInformation.length + evidenceChecks.length + verificationGuide.length;

  return (
    <div className="analysis-panel">
      <section className={`analysis-provenance-card ${analysis?.status === 'complete' ? '' : 'is-limited'}`} aria-label="분석 출처와 처리 범위">
        <div className="analysis-provenance-top">
          <strong>{analysisSource}</strong>
          {isSample && <span className="analysis-meta-badge">샘플 입력 · 실제 분석</span>}
          {analysisWarnings.some((warning) => warning.startsWith('표시 항목을 수동')) && <span className="analysis-meta-badge">수동 수정 포함</span>}
          <span className="analysis-meta-badge">{analysis?.status === 'complete' ? '분석 처리 완료' : '제한 있음'}</span>
        </div>
        <p className="analysis-provenance-detail">
          {analysis?.mode === 'ai' && <span>실제 응답 모델: {analysis.model || '확인 불가'} · </span>}
          {analysis && analysis.totalClauseCount > 0
            ? `처리한 텍스트 단위: ${analysis.analyzedClauseCount} / ${analysis.totalClauseCount}`
            : '텍스트 처리 범위 집계 불가'}
        </p>
        {analysis?.mode === 'local' && <p className="analysis-provenance-detail">정의된 규칙으로 위험 신호를 확인한 결과입니다. 문맥과 모든 조항 관계를 검증한 결과는 아닙니다.</p>}
        {(analysisWarnings.length > 0 || (analysis?.unresolvedReferences.length ?? 0) > 0) && (
          <details className="analysis-warning-details" open={analysis?.status === 'limited'}>
            <summary>분석 제한 및 확인 사항 ({analysisWarnings.length + (analysis?.unresolvedReferences.length ?? 0)}건)</summary>
            <ul>
              {analysisWarnings.map((warning, index) => <li key={`warning-${index}`}>{warning}</li>)}
              {analysis?.unresolvedReferences.map((reference, index) => <li key={`reference-${index}`}>연결을 확인하지 못한 참조: {reference.replace(/^article-(\d+)/, '제$1조').replace(/-p(\d+)/, ' 제$1항')}</li>)}
            </ul>
          </details>
        )}
      </section>
      {/* 상단 탭 네비게이션: 종합 리포트 vs 복합 위험 & 증빙 vs AI Q&A */}
      <div className="panel-tab-nav">
        <button
          className={`panel-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={16} />
          <span>종합 분석 리포트</span>
          <span className="tab-count-badge">{highlights.length}</span>
        </button>

        <button
          className={`panel-tab-btn ${activeTab === 'deep' ? 'active' : ''}`}
          onClick={() => setActiveTab('deep')}
        >
          <Layers size={16} />
          <span>복합 위험 & 증빙</span>
          {totalDeepRisks > 0 && <span className="tab-count-badge deep-badge">{totalDeepRisks}</span>}
        </button>

        <button
          className={`panel-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          <span>AI 질의응답 (Q&A)</span>
          <span className="tab-ai-sparkle">
            <Sparkles size={12} />
            <span>AI 상담</span>
          </span>
        </button>
      </div>

      {/* 탭 1: 종합 분석 리포트 & 핵심 조항 */}
      {activeTab === 'report' && (
        <div className="panel-scroll-content">
          {/* 1. 위험도 스코어 헤더 배너 + 위험 판정 근거 */}
          <div className={`risk-score-card ${scoreConfig.badgeClass}`}>
            <div className="risk-score-top">
              <div className="score-icon-wrapper">{scoreConfig.icon}</div>
              <div className="score-text-content">
                <div className="score-badge-row">
                  <span className="score-name">종합 위험도: {scoreConfig.label}</span>
                  <span className="score-tag">{scoreConfig.tag}</span>
                </div>
                <p className="score-desc">{scoreConfig.desc}</p>
              </div>
            </div>

            {/* 위험 판정 근거 목록 (Risk Reasons) */}
            {summary.riskReasons && summary.riskReasons.length > 0 && (
              <div className="risk-reasons-container">
                <div className="risk-reasons-title">
                  <AlertOctagon size={13} />
                  <span>위험 판정 근거 및 핵심 분석 신호:</span>
                </div>
                <ul className="risk-reasons-list">
                  {summary.riskReasons.map((reason, idx) => (
                    <li key={idx} className="risk-reason-item">
                      <span>•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="score-stats-grid">
              <div className="stat-pill stat-danger">
                <span className="stat-label">🔴 위험 신호</span>
                <span className="stat-value">{dangerCount}건</span>
              </div>
              <div className="stat-pill stat-important">
                <span className="stat-label">🟡 일반 조건</span>
                <span className="stat-value">{importantCount}건</span>
              </div>
              <div className="stat-pill stat-action">
                <span className="stat-label">🔵 행동·마감</span>
                <span className="stat-value">{actionCount}건</span>
              </div>
            </div>
          </div>

          {/* 2. 전체 3줄 요약 카드 */}
          <div className="summary-bullets-box">
            <div className="section-header-row">
              <div className="section-title">
                <Sparkles size={16} />
                <span>{analysis?.mode === 'ai' ? 'AI 문서 핵심 요약' : '문서 핵심 요약'}</span>
              </div>
              <button className="copy-btn" onClick={handleCopySummary} title="요약문 복사">
                {copiedSummary ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSummary ? '복사됨' : '요약 복사'}</span>
              </button>
            </div>

            <div className="bullet-items-list">
              {summary.bullets.map((bullet, idx) => (
                <div key={idx} className="bullet-item">
                  <div className="bullet-number">{idx + 1}</div>
                  <p className="bullet-text">{bullet}</p>
                </div>
              ))}
            </div>

            {/* 과탐지 방지 및 균형 검토 안내 (Safe Verification Note) */}
            {summary.safeVerificationNote && (
              <div className="safe-verification-note-box">
                <span className="safe-note-icon">🛡️</span>
                <span className="safe-note-text">{summary.safeVerificationNote}</span>
              </div>
            )}
          </div>

          {/* 3. 복합 위험 미리보기 배너 (있는 경우) */}
          {compoundRisks.length > 0 && (
            <div className="compound-risks-preview-banner" onClick={() => setActiveTab('deep')}>
              <div className="compound-preview-left">
                <Layers size={18} className="text-amber-600" />
                <div>
                  <div className="compound-preview-title">
                    조항 간 결합 복합 위험 <b>{compoundRisks.length}건</b> 발견
                  </div>
                  <div className="compound-preview-sub">
                    단일 조항 외에 조항들이 상호 결합하여 발생하는 구조적 위험을 확인하세요.
                  </div>
                </div>
              </div>
              <button className="compound-preview-btn">
                <span>상세 보기</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          )}

          {/* 4. 핵심 구역 필터 및 개별 조항 리스트 */}
          <div className="highlights-section">
            <div className="highlights-header">
              <div className="section-title">
                <Filter size={16} />
                <span>핵심 구역 상세 해설 ({highlights.length})</span>
              </div>

              {/* 전체 밑줄 켜기/끄기 일괄 버튼 */}
              <button
                className="toggle-all-boxes-btn"
                onClick={() => onToggleAllHighlights(!allVisible)}
                title={allVisible ? '모든 문장 밑줄 숨기기' : '모든 문장 밑줄 표시하기'}
              >
                {allVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{allVisible ? '밑줄 전체 숨김' : '밑줄 전체 켜기'}</span>
              </button>
            </div>

            <div className="filter-button-group">
              <button
                className={`filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => onFilterChange('ALL')}
              >
                전체 ({highlights.length})
              </button>
              <button
                className={`filter-btn filter-btn-danger ${activeFilter === 'DANGER' ? 'active' : ''}`}
                onClick={() => onFilterChange('DANGER')}
              >
                🔴 위험 ({dangerCount})
              </button>
              <button
                className={`filter-btn filter-btn-important ${
                  activeFilter === 'IMPORTANT' ? 'active' : ''
                }`}
                onClick={() => onFilterChange('IMPORTANT')}
              >
                🟡 조건 ({importantCount})
              </button>
              <button
                className={`filter-btn filter-btn-action ${activeFilter === 'ACTION' ? 'active' : ''}`}
                onClick={() => onFilterChange('ACTION')}
              >
                🔵 행동 ({actionCount})
              </button>
            </div>

            {/* 하이라이트 카드 리스트 */}
            <div className="highlights-cards-list">
              {filteredHighlights.length === 0 ? (
                <div className="empty-highlights">현재 분석 결과에 해당 유형의 표시 항목이 없습니다. 미탐지는 문서의 안전성을 보증하지 않습니다.</div>
              ) : (
                filteredHighlights.map((item) => {
                  const typeDetails = getTypeDetails(item.type);
                  const isSelected = selectedHighlightId === item.id;
                  const isBoxVisible = visibleHighlightIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`highlight-card ${typeDetails.colorClass} ${
                        isSelected ? 'selected' : ''
                      } ${!isBoxVisible ? 'box-hidden' : ''}`}
                      onClick={() => onSelectHighlight(isSelected ? null : item.id)}
                    >
                      <div className="card-top">
                        <div className="card-top-left">
                          <span className="card-type-badge">
                            {typeDetails.icon}
                            {typeDetails.label}
                          </span>
                          {item.type === 'DANGER' && getSeverityBadge(item.severity)}
                        </div>

                        <div className="card-top-right">
                          {item.page && <span className="card-page-tag">p.{item.page}</span>}
                          <span className="card-id-tag" title={item.id}>{item.clauseRef || '원문 근거'}</span>

                          {/* 개별 밑줄 표시/숨김 토글 버튼 */}
                          <button
                            className={`individual-box-toggle ${isBoxVisible ? 'active' : 'inactive'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleHighlightVisibility(item.id);
                            }}
                            title={isBoxVisible ? '이 문장 밑줄 숨기기' : '이 문장 밑줄 켜기'}
                          >
                            {isBoxVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>{isBoxVisible ? '밑줄 ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 17대 위험 카테고리 태그 칩스 */}
                      {item.type === 'DANGER' && item.riskCategories && item.riskCategories.length > 0 && (
                        <div className="card-category-chips">
                          {item.riskCategories.map((cat) => {
                            const meta = RISK_CATEGORY_META[cat] || { label: cat, icon: '🏷️' };
                            return (
                              <span key={cat} className={`category-tag-chip cat-${cat.toLowerCase()}`}>
                                <span>{meta.icon}</span>
                                <span>{meta.label}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* 초등학생도 이해하는 쉬운 해설 */}
                      {item.type === 'DANGER' && item.affectedParty && (
                        <div className="reason-label">영향을 받는 당사자: {item.affectedParty}</div>
                      )}
                      <div className="card-easy-box">
                        <div className="easy-label">💡 쉬운 해설</div>
                        <div className="easy-content">{item.easyText}</div>
                      </div>

                      {/* 구체적 맥락 분석 및 사유 (있을 경우) */}
                      {item.reason && (
                        <div className="card-reason-box">
                          <div className="reason-label">🔍 {item.type === 'DANGER' ? '분석 사유 및 위험 신호' : '조건 및 일정 설명'}</div>
                          <div className="reason-content">{item.reason}</div>
                        </div>
                      )}

                      {/* 5단계 상세 분석 (관찰된 사실 / 예상 문제 / 추가 확인 방법) */}
                      {(item.observedFact || item.potentialProblem || item.verificationMethod) && (
                        <div className="card-deep-breakdown">
                          {item.observedFact && (
                            <div className="breakdown-item">
                              <span className="breakdown-tag fact-tag">📋 관찰 사실:</span>
                              <span className="breakdown-text">{item.observedFact}</span>
                            </div>
                          )}
                          {item.potentialProblem && (
                            <div className="breakdown-item">
                              <span className="breakdown-tag prob-tag">⚡ 예상 문제:</span>
                              <span className="breakdown-text">{item.potentialProblem}</span>
                            </div>
                          )}
                          {item.verificationMethod && (
                            <div className="breakdown-item">
                              <span className="breakdown-tag method-tag">🛠️ 확인 방법:</span>
                              <span className="breakdown-text">{item.verificationMethod}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 법률 원문 발췌 */}
                      <div className="card-original-box">
                        <div className="original-label">문서 원문</div>
                        <blockquote className="original-content">"{item.originalText}"</blockquote>
                      </div>

                      <div className="card-footer">
                        <span className="bbox-coords">
                          {item.sourceSpans?.length ? '원문 위치 연결됨' : item.bbox.width > 0 && item.bbox.height > 0 ? '이미지 위치 확인됨' : '원문 위치 확인 필요'}
                        </span>

                        <div className="card-actions-right">
                          {onOpenEditModal && (
                            <button
                              className="card-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditModal(item);
                              }}
                              title="조항 내용 및 설명 수정"
                            >
                              <Edit2 size={12} />
                              <span>수정</span>
                            </button>
                          )}
                          <button
                            className="focus-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isBoxVisible) {
                                onToggleHighlightVisibility(item.id);
                              }
                              onSelectHighlight(item.id);
                            }}
                          >
                            <span>문서에서 보기</span>
                            <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. 하단 도구 모음 */}
          <div className="panel-footer-actions">
            <button className="view-json-btn" onClick={onOpenJsonModal}>
              <Code size={15} />
              <span>정밀 구조화 JSON 데이터 보기</span>
            </button>
          </div>
        </div>
      )}

      {/* 탭 2: 🔗 복합 위험(Compound Risk) & 누락 정보 & 객관적 증빙 */}
      {activeTab === 'deep' && (
        <div className="panel-scroll-content">
          {/* 섹션 A: 조항 간 복합 위험 (Compound Risks) */}
          <div className="deep-section-card">
            <div className="deep-section-header">
              <div className="deep-header-title">
                <Layers size={18} className="text-red-600" />
                <div>
                  <h4 className="deep-title-text">조항 간 연계 복합 위험 ({compoundRisks.length})</h4>
                  <p className="deep-title-desc">개별적으로는 약해 보여도, 상호 결합되었을 때 불리한 구조를 형성하는 복합 위험입니다.</p>
                </div>
              </div>
            </div>

            {compoundRisks.length === 0 ? (
              <div className="deep-empty-state">
                <Check size={24} className="text-green-600" />
                <span>현재 분석 결과에 조항 간 결합 위험이 등록되지 않았습니다. 분석 제한과 확인하지 못한 참조를 함께 확인하세요.</span>
              </div>
            ) : (
              <div className="compound-cards-list">
                {compoundRisks.map((cr, idx) => {
                  const isExp = !!expandedCompound[idx];
                  return (
                    <div key={idx} className={`compound-card severity-${cr.severity.toLowerCase()}`}>
                      <div
                        className="compound-card-header"
                        onClick={() => setExpandedCompound((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      >
                        <div className="compound-header-left">
                          {getSeverityBadge(cr.severity)}
                          <span className="compound-name">{cr.title}</span>
                        </div>
                        <button className="compound-expand-btn">
                          {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {cr.relatedHighlights && cr.relatedHighlights.length > 0 && (
                        <div className="compound-related-pills">
                          <span className="related-label">연계 조항:</span>
                          {cr.relatedHighlights.map((hid, hIdx) => (
                            <span
                              key={hIdx}
                              className="related-hid-pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectHighlight(hid);
                              }}
                            >
                              {hid} ↗
                            </span>
                          ))}
                        </div>
                      )}

                      {isExp && (
                        <div className="compound-body">
                          <div className="compound-reason-block">
                            <span className="reason-tag">위험 구조 분석:</span>
                            <p>{cr.reason}</p>
                          </div>
                          {cr.actionRequired && (
                            <div className="compound-action-block">
                              <span className="action-tag">권장 확인/대응:</span>
                              <p>{cr.actionRequired}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 섹션 B: 누락된 핵심 정보 점검 (Missing Information) */}
          <div className="deep-section-card">
            <div className="deep-section-header">
              <div className="deep-header-title">
                <FileQuestion size={18} className="text-amber-600" />
                <div>
                  <h4 className="deep-title-text">누락된 핵심 계약 정보 ({missingInformation.length})</h4>
                  <p className="deep-title-desc">현재 입력에서 확인되지 않아 추가 확인이 필요한 항목입니다. 문서 밖의 자료가 존재할 수 있습니다.</p>
                </div>
              </div>
            </div>

            {missingInformation.length === 0 ? (
              <div className="deep-empty-state">
                <Check size={24} className="text-green-600" />
                <span>현재 분석 결과에 추가 확인 항목이 등록되지 않았습니다. 필수 정보가 모두 검증되었다는 뜻은 아닙니다.</span>
              </div>
            ) : (
              <div className="missing-info-list">
                {missingInformation.map((item, idx) => (
                  <div key={idx} className="missing-info-item">
                    <div className="missing-item-top">
                      <span className="missing-num">{idx + 1}</span>
                      <span className="missing-title">{item.item}</span>
                    </div>
                    <div className="missing-grid">
                      <div className="missing-col">
                        <span className="missing-col-label">필요한 이유:</span>
                        <span className="missing-col-val">{item.whyNeeded}</span>
                      </div>
                      <div className="missing-col">
                        <span className="missing-col-label">예상 분쟁 위험:</span>
                        <span className="missing-col-val text-red-600">{item.potentialDispute}</span>
                      </div>
                    </div>
                    <div className="missing-action-box">
                      <span className="action-box-label">👉 권장 조치:</span>
                      <span className="action-box-val">{item.actionRequired}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 섹션 C: 객관적 증빙 대조 (Evidence Checks) */}
          <div className="deep-section-card">
            <div className="deep-section-header">
              <div className="deep-header-title">
                <Receipt size={18} className="text-blue-600" />
                <div>
                  <h4 className="deep-title-text">객관적 증빙 대조 검토 ({evidenceChecks.length})</h4>
                  <p className="deep-title-desc">문서의 주장 사실과 이를 입증할 객관적 증빙의 대조 상태입니다.</p>
                </div>
              </div>
            </div>

            {evidenceChecks.length === 0 ? (
              <div className="deep-empty-state">
                <span>현재 분석 결과에 증빙 대조 항목이 등록되지 않았습니다.</span>
              </div>
            ) : (
              <div className="evidence-checks-list">
                {evidenceChecks.map((ec, idx) => (
                  <div key={idx} className="evidence-check-card">
                    <div className="evidence-top-row">
                      <span className="evidence-claim-title">주장 사실: "{ec.claim}"</span>
                      <span className={`evidence-status-pill status-${ec.status.toLowerCase()}`}>
                        {ec.status === 'PRESENT' ? '입력 내 확인' : ec.status === 'MISSING' ? '입력 내 미확인' : '추가 확인 필요'}
                      </span>
                    </div>
                    <div className="evidence-body-row">
                      <span className="evidence-exp-label">필요 증빙:</span>
                      <span className="evidence-exp-val">{ec.expectedEvidence}</span>
                    </div>
                    {ec.notes && <div className="evidence-notes-row">🔍 {ec.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 섹션 D: 실행 가능한 위험 대응 가이드 (Verification Guide) */}
          {verificationGuide.length > 0 && (
            <div className="deep-section-card">
              <div className="deep-section-header">
                <div className="deep-header-title">
                  <CheckCheck size={18} className="text-emerald-600" />
                  <div>
                    <h4 className="deep-title-text">실행 가능한 위험 대응 가이드 ({verificationGuide.length})</h4>
                    <p className="deep-title-desc">무엇을 왜 어떻게 확인해야 하는지에 대한 구체적인 대응 지침입니다.</p>
                  </div>
                </div>
              </div>

              <div className="verification-guide-list">
                {verificationGuide.map((vg, idx) => (
                  <div key={idx} className="verification-guide-card">
                    <div className="vg-risk-top">
                      <span className="vg-index">{idx + 1}</span>
                      <span className="vg-risk-name">{vg.risk}</span>
                    </div>
                    <div className="vg-body-grid">
                      <div className="vg-method-box">
                        <span className="vg-label">🔍 확인 방법:</span>
                        <span className="vg-val">{vg.method}</span>
                      </div>
                      <div className="vg-evidence-box">
                        <span className="vg-label">📄 필요 증빙:</span>
                        <span className="vg-val">{vg.expectedEvidence}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 탭 3: 💬 AI 문서 Q&A 질문하기 */}
      {activeTab === 'chat' && (
        <div className="chat-tab-container">
          <div className="chat-header-info">
            <div className="chat-assistant-badge">
              <Bot size={16} />
              <span>Groq 문서 검토 도우미</span>
            </div>
            <p className="chat-assistant-desc">
              문서와 현재 분석 결과를 바탕으로 답변합니다. API 사용 여부와 답변 범위에 따라 확인할 수 있는 내용이 달라집니다.
            </p>
          </div>

          {/* 빠른 추천 질문 칩 */}
          <div className="quick-questions-tray">
            <div className="quick-title">
              <HelpCircle size={13} />
              <span>추천 질문 클릭:</span>
            </div>
            <div className="quick-chips-list">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  className="quick-chip-btn"
                  onClick={() => handleSendQuestion(q)}
                  disabled={isAsking}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* 대화 메시지 내역 */}
          <div className="chat-messages-area">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isCopied = copiedMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`chat-message-row ${isUser ? 'msg-user' : 'msg-assistant'}`}
                >
                  <div className="msg-avatar">
                    {isUser ? <User size={15} /> : <Bot size={15} />}
                  </div>
                  <div className="msg-bubble-wrap">
                    <div className="msg-bubble">
                      <div className="msg-text">{msg.text}</div>
                      <div className="msg-meta">
                        <span className="msg-time">{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            className="msg-copy-btn"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            title="답변 복사"
                          >
                            {isCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {isAsking && (
              <div className="chat-message-row msg-assistant">
                <div className="msg-avatar">
                  <Bot size={15} />
                </div>
                <div className="msg-bubble-wrap">
                  <div className="msg-bubble thinking-bubble">
                    <RefreshCw size={14} className="spinning" />
                    <span>문서의 조항과 현재 분석 결과를 검토하고 있습니다...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* 질문 입력 창 */}
          <form
            className="chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendQuestion();
            }}
          >
            <input
              type="text"
              className="chat-input"
              placeholder="문서에 대해 궁금한 점을 입력하세요 (예: 채권자 지정 방법 조항의 위험성은?)..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={isAsking}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={isAsking || !inputQuestion.trim()}
              title="질문 전송"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
