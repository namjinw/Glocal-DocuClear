import { useRef, useState } from 'react';
import type { AnalysisResult, DocumentInput, HighlightType, HighlightItem } from './types';
import { SAMPLE_DOCUMENTS } from './data/sampleDocuments';
import { analyzeDocumentWithGroq } from './utils/groq';
import { recalculateAnalysis } from './utils/analysis';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { DocumentViewer } from './components/DocumentViewer';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ApiKeyModal } from './components/ApiKeyModal';
import { JsonModal } from './components/JsonModal';
import { EditHighlightModal } from './components/EditHighlightModal';
import { ArrowLeft, RefreshCw, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import './App.css';

const MANUAL_EDIT_WARNING = '표시 항목을 수동으로 변경했습니다. 문맥 요약과 조항 간 연계를 갱신하려면 문서를 다시 분석하세요.';

function applyManualChanges(result: AnalysisResult, highlights: HighlightItem[]): AnalysisResult {
  return recalculateAnalysis({
    ...result,
    highlights,
    compoundRisks: [],
    summary: {
      ...result.summary,
      bullets: [
        '표시 항목을 수동으로 변경한 결과입니다.',
        '변경된 표시 항목을 기준으로 위험 신호 수를 다시 계산했습니다.',
        '문맥 요약과 조항 간 연계를 갱신하려면 문서를 다시 분석하세요.',
      ],
      safeVerificationNote: '표시 항목의 수정은 문서 원문을 변경하지 않습니다. 수정한 인용문이 원문과 일치하는지 확인하세요.',
    },
    analysis: {
      mode: result.analysis?.mode ?? 'local',
      ...result.analysis,
      status: 'limited',
      analyzedClauseCount: result.analysis?.analyzedClauseCount ?? 0,
      totalClauseCount: result.analysis?.totalClauseCount ?? 0,
      unresolvedReferences: result.analysis?.unresolvedReferences ?? [],
      warnings: [...new Set([...(result.analysis?.warnings ?? []), MANUAL_EDIT_WARNING])],
    },
  });
}

export function App() {
  const [currentInput, setCurrentInput] = useState<DocumentInput | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [analysisEstimatedSeconds, setAnalysisEstimatedSeconds] = useState<number>(0);
  const [visibleHighlightIds, setVisibleHighlightIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | HighlightType>('ALL');

  // Modals
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);
  const [editingHighlight, setEditingHighlight] = useState<HighlightItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [apiKeyVersion, setApiKeyVersion] = useState<number>(0);

  const analysisInProgress = useRef(false);

  // Analyze Handler
  const handleAnalyze = async (input: DocumentInput) => {
    if (analysisInProgress.current) return;
    analysisInProgress.current = true;
    setIsLoading(true);
    setAnalysisResult(null);
    setCurrentInput(null);
    setVisibleHighlightIds([]);
    setAnalysisProgress(5);
    setAnalysisStage('문서 분석을 준비하고 있습니다... (5%)');
    setAnalysisEstimatedSeconds(0);
    setError(null);
    setSelectedHighlightId(null);
    setActiveFilter('ALL');
    setIsEditModalOpen(false);
    setEditingHighlight(null);
    setIsJsonModalOpen(false);

    try {
      let analysisInput = input;
      if (input.type === 'sample') {
        const sample = SAMPLE_DOCUMENTS.find((item) => item.id === input.sampleId);
        if (!sample) throw new Error('선택한 샘플 문서를 찾을 수 없습니다. 문서를 다시 선택하세요.');
        analysisInput = { ...input, text: sample.documentText, title: input.title || sample.title };
      }
      setCurrentInput(analysisInput);

      // Samples use the same analyzer as uploaded or pasted documents.
      const result = await analyzeDocumentWithGroq({
        file: analysisInput.file,
        files: analysisInput.files,
        text: analysisInput.text,
        onProgress: (percent, msg, estSec) => {
          setAnalysisProgress(percent);
          setAnalysisStage(msg);
          if (typeof estSec === 'number') setAnalysisEstimatedSeconds(estSec);
        },
      });

      setAnalysisResult(result);
      setVisibleHighlightIds(result.highlights.map((item) => item.id));
    } catch (err: unknown) {
      console.error('Analysis failed:', err);
      setCurrentInput(null);
      setAnalysisResult(null);
      setVisibleHighlightIds([]);
      const message = err instanceof Error ? err.message : '문서 분석 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      analysisInProgress.current = false;
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (analysisInProgress.current) return;
    setIsEditModalOpen(false);
    setEditingHighlight(null);
    setIsJsonModalOpen(false);
    setCurrentInput(null);
    setAnalysisResult(null);
    setSelectedHighlightId(null);
    setVisibleHighlightIds([]);
    setError(null);
    setAnalysisProgress(0);
    setAnalysisStage('');
    setAnalysisEstimatedSeconds(0);
  };

  const handleReanalyze = () => {
    if (currentInput) {
      handleAnalyze(currentInput);
    }
  };

  const handleToggleHighlightVisibility = (id: string) => {
    setVisibleHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleToggleAllHighlights = (showAll: boolean) => {
    if (analysisResult) {
      setVisibleHighlightIds(showAll ? analysisResult.highlights.map((h) => h.id) : []);
    }
  };

  const handleUpdateHighlight = (updated: HighlightItem) => {
    if (analysisInProgress.current) return;
    setAnalysisResult((prev) => {
      if (!prev) return null;
      const previous = prev.highlights.find((item) => item.id === updated.id);
      if (!previous) return prev;
      const originalChanged = previous.originalText !== updated.originalText;
      const nextItem = originalChanged
        ? { ...updated, sourceSpans: undefined, clauseId: undefined, clauseRef: undefined }
        : updated;
      const highlights = prev.highlights.map((item) => item.id === updated.id ? nextItem : item);
      const contentChanged = JSON.stringify({ ...previous, bbox: undefined, page: undefined }) !==
        JSON.stringify({ ...updated, bbox: undefined, page: undefined });
      return contentChanged
        ? applyManualChanges(prev, highlights)
        : recalculateAnalysis({ ...prev, highlights });
    });
  };

  const handleDeleteHighlight = (id: string) => {
    if (analysisInProgress.current) return;
    setAnalysisResult((prev) => {
      if (!prev || !prev.highlights.some((item) => item.id === id)) return prev;
      return applyManualChanges(prev, prev.highlights.filter((item) => item.id !== id));
    });
    setVisibleHighlightIds((prev) => prev.filter((itemId) => itemId !== id));
    if (selectedHighlightId === id) setSelectedHighlightId(null);
  };

  const handleAddHighlight = (newItem: HighlightItem) => {
    if (analysisInProgress.current) return;
    const unanchoredItem = { ...newItem, sourceSpans: undefined, clauseId: undefined, clauseRef: undefined };
    setAnalysisResult((prev) => {
      if (!prev || prev.highlights.some((item) => item.id === newItem.id)) return prev;
      return applyManualChanges(prev, [...prev.highlights, unanchoredItem]);
    });
    setVisibleHighlightIds((prev) => [...new Set([...prev, newItem.id])]);
    setSelectedHighlightId(newItem.id);
  };

  const handleOpenEditModal = (item: HighlightItem) => {
    setEditingHighlight(item);
    setIsEditModalOpen(true);
  };

  return (
    <div className="app-root">
      {/* 글로벌 상단 헤더 */}
      <Header
        key={apiKeyVersion}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onReset={handleReset}
        hasResult={!!analysisResult}
        isBusy={isLoading}
      />

      <main className="app-content">
        {/* 오류 메시지 배너 */}
        {error && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button className="error-close-btn" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}

        {/* 1. 문서가 선택되지 않았거나 분석 전 상태 */}
        {!analysisResult ? (
          <div className="landing-view">
            <section className="hero-section">
              <div className="hero-badge">
                <Sparkles size={15} />
                <span>계약·행정 문서 검토 도구 (텍스트·텍스트 PDF 지원)</span>
              </div>
              <h2 className="hero-title">
                어려운 계약서와 공공문서,<br />
                <span className="gradient-text">문서를 요약하고 검토할 위험 신호를 찾습니다.</span>
              </h2>
              <p className="hero-subtitle">
                문서 텍스트를 입력하거나 텍스트가 포함된 PDF를 업로드하고, <b>🔴 DANGER(위험 조항)</b>, <b>🟡 IMPORTANT(중요 조건)</b>, <b>🔵 ACTION(필수 일정)</b> 구역을 확인하고 수정할 수 있습니다. 스캔 PDF와 이미지는 OCR로 추출한 텍스트를 입력하세요.
              </p>

              <div className="hero-features-row">
                <div className="hero-feature-item">
                  <span className="feature-icon">📚</span>
                  <span>텍스트·텍스트 PDF 분석</span>
                </div>
                <div className="hero-feature-item">
                  <span className="feature-icon">🛡️</span>
                  <span>위험 신호와 검토 근거 표시</span>
                </div>
                <div className="hero-feature-item">
                  <span className="feature-icon">🔍</span>
                  <span>마우스 드래그 확대/이동/영역 수정</span>
                </div>
                <div className="hero-feature-item">
                  <span className="feature-icon">📝</span>
                  <span>3줄 핵심 요약 & 쉬운 해설</span>
                </div>
              </div>
            </section>

            {/* 업로드 / 샘플 선택 섹션 */}
            <UploadSection
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              analysisProgress={analysisProgress}
              analysisStage={analysisStage}
              analysisEstimatedSeconds={analysisEstimatedSeconds}
            />
          </div>
        ) : (
          /* 2. 분석 완료 상태 - 분할 뷰어 */
          <div className="analysis-workspace">
            {/* 상단 액션 바 */}
            <div className="workspace-action-bar">
              <div className="action-bar-left">
                <button className="back-btn" onClick={handleReset} disabled={isLoading}>
                  <ArrowLeft size={16} />
                  <span>문서 선택으로 돌아가기</span>
                </button>
                <div className="doc-breadcrumb">
                  <FileText size={16} />
                  <span className="doc-name">{currentInput?.type === 'sample' ? '[샘플 입력] ' : ''}{currentInput?.title || '분석된 문서'}</span>
                </div>
              </div>

              <div className="action-bar-right">
                <button
                  className="reanalyze-btn"
                  onClick={handleReanalyze}
                  disabled={isLoading}
                >
                  <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
                  <span>{isLoading ? `재분석 중... (${analysisProgress}%)` : '다시 분석하기'}</span>
                </button>
              </div>
            </div>

            {/* 뷰어 & 분석 패널 2단 분할 레이아웃 */}
            <div className="split-view-container">
              {/* 좌측: 원본 문서 및 중요 문장 정밀 밑줄 뷰어 (마우스 팬, 줌, 바운딩 박스 드래그 수정 지원) */}
              <div className="split-left">
                <DocumentViewer
                  documentTitle={currentInput?.title || '문서 뷰어'}
                  documentText={currentInput?.text || analysisResult.fullDocumentText}
                  previewUrl={currentInput?.previewUrl}
                  pages={currentInput?.pages}
                  highlights={analysisResult.highlights}
                  selectedHighlightId={selectedHighlightId}
                  onSelectHighlight={setSelectedHighlightId}
                  activeFilter={activeFilter}
                  visibleHighlightIds={visibleHighlightIds}
                  onUpdateHighlight={handleUpdateHighlight}
                  onDeleteHighlight={handleDeleteHighlight}
                  onAddHighlight={handleAddHighlight}
                />
              </div>

              {/* 우측: 위험도 스코어 & 3줄 요약 & 하이라이트 해설 & AI Q&A 패널 */}
              <div className="split-right">
                <AnalysisPanel
                  result={analysisResult}
                  isSample={currentInput?.type === 'sample'}
                  selectedHighlightId={selectedHighlightId}
                  onSelectHighlight={setSelectedHighlightId}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  onOpenJsonModal={() => setIsJsonModalOpen(true)}
                  visibleHighlightIds={visibleHighlightIds}
                  onToggleHighlightVisibility={handleToggleHighlightVisibility}
                  onToggleAllHighlights={handleToggleAllHighlights}
                  documentTitle={currentInput?.title || '문서'}
                  documentText={currentInput?.text || analysisResult.fullDocumentText}
                  documentFile={currentInput?.file}
                  documentFiles={currentInput?.files}
                  previewUrl={currentInput?.previewUrl}
                  onOpenEditModal={handleOpenEditModal}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* API 키 설정 모달 */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaved={() => setApiKeyVersion((v) => v + 1)}
      />

      {/* JSON 원본 보기 모달 */}
      <JsonModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        result={analysisResult}
      />

      {/* 조항 수정 모달 (패널에서 호출 시) */}
      <EditHighlightModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        highlight={editingHighlight}
        onSave={handleUpdateHighlight}
        onDelete={handleDeleteHighlight}
      />
    </div>
  );
}

export default App;
