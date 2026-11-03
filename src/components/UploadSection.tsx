import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Sparkles,
  Edit3,
  ArrowRight,
  AlertCircle,
  FileSearch,
  Clock,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  FileCheck,
} from 'lucide-react';
import { SAMPLE_DOCUMENTS } from '../data/sampleDocuments';
import type { SampleDocument, DocumentInput, DocumentPage } from '../types';
import { renderPdfToPages, unsupportedPdfFiles } from '../utils/pdf';
import './UploadSection.css';

interface UploadSectionProps {
  onAnalyze: (input: DocumentInput) => void;
  isLoading: boolean;
  analysisProgress?: number;
  analysisStage?: string;
  analysisEstimatedSeconds?: number;
}

interface UploadedFileItem {
  id: string;
  file: File;
  previewUrl: string;
  isPdf: boolean;
  pageCount?: number;
  renderedPages?: { pageNumber: number; dataUrl: string; text: string }[];
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onAnalyze,
  isLoading,
  analysisProgress = 0,
  analysisStage = '',
  analysisEstimatedSeconds = 3,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'upload' | 'text'>('sample');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const processingFiles = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to process added files
  const processFiles = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (!filesArray.length || processingFiles.current || isLoading) return;
    const unsupported = unsupportedPdfFiles(filesArray);
    if (unsupported.length) {
      setFileError(`${unsupported.join(', ')}: GPT-OSS 120B는 이미지를 직접 읽지 못합니다. 텍스트 PDF를 선택하거나 전체 문서를 OCR한 내용을 텍스트 입력에 붙여넣어 주세요. 이번에 선택한 파일은 추가하지 않았습니다.`);
      return;
    }
    processingFiles.current = true;
    setIsProcessingFiles(true);
    setFileError(null);
    setFileNotice(null);
    const newItems: UploadedFileItem[] = [];
    const notices: string[] = [];
    try {
      for (const file of filesArray) {
        try {
          const pdfResult = await renderPdfToPages(file, 1.5);
          if (pdfResult.skippedPages.length) notices.push(`${file.name}: ${pdfResult.skippedPages.join(', ')}페이지는 텍스트가 없어 분석에서 제외했습니다.`);
          newItems.push({
            id: `file-${crypto.randomUUID()}`,
            file,
            previewUrl: pdfResult.pages[0].dataUrl,
            isPdf: true,
            pageCount: pdfResult.pageCount,
            renderedPages: pdfResult.pages,
          });
        } catch (err) {
          throw new Error(`${file.name}: ${err instanceof Error ? err.message : 'PDF 전체를 읽지 못했습니다.'}`, { cause: err });
        }
      }
      setUploadedFiles((prev) => [...prev, ...newItems]);
      if (notices.length) setFileNotice(notices.join(' '));
    } catch (err) {
      setFileError(`${err instanceof Error ? err.message : '파일을 처리하지 못했습니다.'} 이번에 선택한 파일은 모두 추가하지 않았습니다.`);
    } finally {
      processingFiles.current = false;
      setIsProcessingFiles(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same files can be re-selected if deleted
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
  };

  const handleFileSubmit = async () => {
    if (uploadedFiles.length === 0 || isProcessingFiles || isLoading || fileError) return;

    // Collect all pages from images and PDFs
    const allPages: DocumentPage[] = [];
    const textChunks: string[] = [];

    let pageGlobalIndex = 1;
    for (const item of uploadedFiles) {
      if (item.isPdf && item.renderedPages && item.renderedPages.length > 0) {
        for (const p of item.renderedPages) {
          allPages.push({
            id: `p-${pageGlobalIndex}`,
            pageNumber: pageGlobalIndex,
            title: `${item.file.name} (p.${p.pageNumber})`,
            previewUrl: p.dataUrl,
            sourceFileName: item.file.name,
            fileType: 'pdf',
          });
          if (p.text) {
            textChunks.push(`[${item.file.name} p.${p.pageNumber}]\n${p.text}`);
          }
          pageGlobalIndex++;
        }
      } else {
        allPages.push({
          id: `p-${pageGlobalIndex}`,
          pageNumber: pageGlobalIndex,
          title: item.file.name,
          previewUrl: item.previewUrl,
          sourceFileName: item.file.name,
          fileType: item.isPdf ? 'pdf' : 'image',
        });
        pageGlobalIndex++;
      }
    }

    const title =
      uploadedFiles.length === 1
        ? uploadedFiles[0].file.name
        : `${uploadedFiles[0].file.name} 외 ${uploadedFiles.length - 1}건 (총 ${uploadedFiles.length}개 문서)`;

    const rawFiles = uploadedFiles.map((f) => f.file);

    onAnalyze({
      type: 'file',
      file: rawFiles[0],
      files: rawFiles,
      previewUrl: allPages[0]?.previewUrl || uploadedFiles[0].previewUrl,
      previewUrls: allPages.map((p) => p.previewUrl),
      pages: allPages,
      title,
      text: textChunks.length > 0 ? textChunks.join('\n\n') : undefined,
    });
  };

  const handleSampleSelect = (sample: SampleDocument) => {
    onAnalyze({
      type: 'sample',
      sampleId: sample.id,
      title: sample.title,
      text: sample.documentText,
    });
  };

  const handleTextSubmit = () => {
    if (!customText.trim()) {
      alert('분석할 문서 텍스트를 입력해주세요.');
      return;
    }
    onAnalyze({
      type: 'text',
      title: customTitle.trim() || '직접 입력한 문서',
      text: customText.trim(),
    });
  };

  const totalBytes = uploadedFiles.reduce((acc, f) => acc + f.file.size, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const totalPages = uploadedFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0);

  return (
    <div className="upload-container">
      {/* 탭 네비게이션 */}
      <div className="input-tabs">
        <button
          className={`tab-btn ${activeTab === 'sample' ? 'active' : ''}`}
          onClick={() => setActiveTab('sample')}
        >
          <Sparkles size={16} />
          <span>추천 샘플 문서 (원클릭)</span>
          <span className="tab-badge">추천</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <UploadCloud size={16} />
          <span>텍스트 PDF 업로드</span>
          {uploadedFiles.length > 0 && (
            <span className="tab-file-count-badge">{uploadedFiles.length}</span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <Edit3 size={16} />
          <span>직접 텍스트/OCR 입력</span>
        </button>
      </div>

      {/* 탭 내용 영역 */}
      <div className="tab-content">
        {/* 1. 추천 샘플 문서 탭 */}
        {activeTab === 'sample' && (
          <div className="sample-tab-view">
            <div className="tab-intro">
              <h4>테스트용 대표 공공·계약 문서 선택</h4>
              <p>실제 자주 쓰이는 부동산 계약서, 정부 지원 공고, 프리랜서 계약서를 즉시 분석해보세요.</p>
            </div>

            <div className="sample-cards-grid">
              {SAMPLE_DOCUMENTS.map((sample) => (
                <div key={sample.id} className="sample-card">
                  <div className="sample-card-header">
                    <span className="sample-category-badge">{sample.category}</span>
                    <span className="sample-tag-badge">{sample.tag}</span>
                  </div>
                  <h5 className="sample-card-title">{sample.title}</h5>
                  <p className="sample-card-desc">{sample.description}</p>

                  <div className="sample-card-footer">
                    <span className="sample-preview-note">
                      <AlertCircle size={12} />
                      {sample.previewNote}
                    </span>
                    <button
                      className="sample-select-btn"
                      disabled={isLoading}
                      onClick={() => handleSampleSelect(sample)}
                    >
                      <span>문서 분석하기</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. 다중 이미지 & PDF 업로드 탭 */}
        {activeTab === 'upload' && (
          <div className="upload-tab-view">
            {fileNotice && (
              <div className="error-banner" role="status">
                <AlertCircle size={18} />
                <span>{fileNotice}</span>
                <button type="button" onClick={() => setFileNotice(null)}>확인</button>
              </div>
            )}
            {fileError && (
              <div className="error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{fileError}</span>
                <button type="button" onClick={() => setFileError(null)}>오류 확인</button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
            />

            {uploadedFiles.length === 0 ? (
              <div
                className={`dropzone-box ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={44} />
                </div>
                <div className="dropzone-text">
                  <h5>텍스트를 선택할 수 있는 PDF 파일을 드래그하여 놓으세요</h5>
                  <p>
                    또는 <span>여기를 클릭</span>하여 PDF를 선택하세요. 이미지·스캔 문서는 OCR 텍스트 입력을 이용하세요.
                  </p>
                </div>
                <div className="dropzone-badges">
                  <span>📚 여러 PDF 문서 함께 분석</span>
                  <span>📄 PDF 전체 페이지 텍스트 추출</span>
                  <span>⚡ Groq GPT-OSS 120B</span>
                </div>
              </div>
            ) : (
              <div className="multi-files-container">
                {/* 헤더 요약 바 */}
                <div className="multi-files-header">
                  <div className="header-left-summary">
                    <FileCheck size={18} className="text-blue-600" />
                    <div>
                      <span className="summary-main-title">
                        선택된 문서: <b>{uploadedFiles.length}개 파일</b> (총 {totalPages}페이지, {totalMB} MB)
                      </span>
                      <span className="summary-sub-desc">
                        선택한 PDF의 전체 텍스트를 추출하여 하나의 분석 리포트로 생성합니다.
                      </span>
                    </div>
                  </div>

                  <div className="header-right-btns">
                    <button
                      className="btn-add-more"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isProcessingFiles}
                      title="더 많은 문서 추가"
                    >
                      <Plus size={14} />
                      <span>파일 추가하기</span>
                    </button>
                    <button
                      className="btn-clear-all"
                      onClick={handleClearAllFiles}
                      disabled={isLoading || isProcessingFiles}
                      title="모든 파일 삭제"
                    >
                      <Trash2 size={14} />
                      <span>전체 비우기</span>
                    </button>
                  </div>
                </div>

                {isProcessingFiles && (
                  <div className="files-processing-banner">
                    <div className="mini-spinner"></div>
                    <span>PDF 전체 페이지의 텍스트와 미리보기를 준비하고 있습니다...</span>
                  </div>
                )}

                {/* 파일 썸네일 그리드 리스트 */}
                <div className="files-grid-list">
                  {uploadedFiles.map((item, index) => (
                    <div key={item.id} className="file-grid-card">
                      <div className="card-thumb-wrap">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="card-thumb-img"
                          />
                        ) : (
                          <div className="card-thumb-placeholder">
                            {item.isPdf ? <FileText size={32} /> : <ImageIcon size={32} />}
                          </div>
                        )}
                        <span className="file-index-badge">{index + 1}</span>
                        {item.isPdf && (
                          <span className="file-type-chip pdf-chip">
                            PDF ({item.pageCount}p)
                          </span>
                        )}
                        {!item.isPdf && (
                          <span className="file-type-chip img-chip">
                            이미지
                          </span>
                        )}
                        <button
                          className="file-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(item.id);
                          }}
                          disabled={isLoading}
                          title="이 파일 제거"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="card-meta-wrap">
                        <span className="card-file-name" title={item.file.name}>
                          {item.file.name}
                        </span>
                        <span className="card-file-size">
                          {(item.file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* 추가 박스 버튼 */}
                  <div
                    className="add-card-placeholder"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={24} />
                    <span>+ 추가 업로드</span>
                  </div>
                </div>

                {/* 제출 액션 바 */}
                <div className="multi-files-footer">
                  <div className="footer-tip">
                    <Sparkles size={14} />
                    <span>Groq GPT-OSS 120B가 추출된 텍스트를 분석합니다. 스캔 페이지는 OCR이 필요합니다.</span>
                  </div>

                  <button
                    className="btn-primary submit-analysis-btn"
                    onClick={handleFileSubmit}
                    disabled={isLoading || isProcessingFiles || uploadedFiles.length === 0 || Boolean(fileError)}
                  >
                    <Sparkles size={16} />
                    {isLoading
                      ? `AI 문서 분석 진행 중 (${Math.round(analysisProgress)}%)...`
                      : `총 ${uploadedFiles.length}개 문서 AI 분석 시작하기`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 직접 텍스트 입력 탭 */}
        {activeTab === 'text' && (
          <div className="text-tab-view">
            <div className="form-group">
              <label className="form-label">문서 제목 (선택)</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 근로계약서, 개인정보 처리방침, 서비스 이용약관"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">문서 텍스트 또는 OCR 추출 텍스트 붙여넣기</label>
              <textarea
                className="form-textarea"
                rows={7}
                placeholder="분석하고 싶은 계약서 전문, 공공문서 공고문, 약관 조항 등을 여기에 복사하여 붙여넣으세요..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            </div>

            <div className="text-tab-footer">
              <div className="text-char-count">
                <FileSearch size={14} />
                <span>{customText.length} 자 입력됨</span>
              </div>
              <button
                className="btn-primary"
                onClick={handleTextSubmit}
                disabled={isLoading || !customText.trim()}
              >
                <Sparkles size={16} />
                {isLoading ? `AI 분석 진행 중 (${Math.round(analysisProgress)}%)...` : '텍스트 AI 분석 시작'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 실시간 진행률(%) 및 예상 소요 시간 인디케이터 배너 */}
      {isLoading && (
        <div className="loading-progress-container">
          <div className="progress-header">
            <div className="progress-title-wrap">
              <div className="progress-spinner"></div>
              <div>
                <div className="progress-main-title">
                  문서를 분석하고 있습니다
                </div>
                <div className="progress-stage-desc">
                  {analysisStage || '문서 구조 해석 및 핵심 조항을 분석하고 있습니다...'}
                </div>
              </div>
            </div>

            <div className="progress-stats-right">
              <div className="progress-est-badge">
                <Clock size={13} />
                <span>
                  {analysisEstimatedSeconds > 0
                    ? `예상 소요 시간: 약 ${analysisEstimatedSeconds}초`
                    : '현재 단계가 끝나면 진행 상태가 갱신됩니다.'}
                </span>
              </div>
              <div className="progress-percent-badge">
                <span className="percent-number">{Math.round(analysisProgress)}</span>
                <span className="percent-unit">%</span>
              </div>
            </div>
          </div>

          {/* 프로그레스 바 트랙 */}
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.max(6, Math.min(100, analysisProgress))}%` }}
            >
              <div className="progress-bar-shine"></div>
            </div>
          </div>

          {/* 단계별 체크포인트 */}
          <div className="progress-milestones">
            <div
              className={`milestone-item ${analysisProgress >= 5 ? 'active' : ''} ${
                analysisProgress >= 15 ? 'completed' : ''
              }`}
            >
              <span className="milestone-dot"></span>
              <span>1. 문서 준비</span>
            </div>
            <div
              className={`milestone-item ${analysisProgress >= 15 ? 'active' : ''} ${
                analysisProgress >= 45 ? 'completed' : ''
              }`}
            >
              <span className="milestone-dot"></span>
              <span>2. 조항 구조와 사실 정리</span>
            </div>
            <div
              className={`milestone-item ${analysisProgress >= 55 ? 'active' : ''} ${
                analysisProgress >= 85 ? 'completed' : ''
              }`}
            >
              <span className="milestone-dot"></span>
              <span>3. 개별·복합 위험 검토</span>
            </div>
            <div
              className={`milestone-item ${analysisProgress >= 85 ? 'active' : ''} ${
                analysisProgress >= 100 ? 'completed' : ''
              }`}
            >
              <span className="milestone-dot"></span>
              <span>4. 원문 근거와 결과 검증</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
