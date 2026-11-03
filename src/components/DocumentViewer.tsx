import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  ShieldAlert,
  Award,
  Calendar,
  Image as ImageIcon,
  Highlighter,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Maximize2,
} from 'lucide-react';
import type { HighlightItem, HighlightType, DocumentPage } from '../types';
import { EditHighlightModal } from './EditHighlightModal';
import { segmentHighlights } from '../utils/textAnchors';
import './DocumentViewer.css';

interface DocumentViewerProps {
  documentTitle: string;
  documentText?: string;
  previewUrl?: string;
  pages?: DocumentPage[];
  highlights: HighlightItem[];
  selectedHighlightId: string | null;
  onSelectHighlight: (id: string | null) => void;
  activeFilter: 'ALL' | HighlightType;
  visibleHighlightIds?: string[];
  onUpdateHighlight?: (updated: HighlightItem) => void;
  onDeleteHighlight?: (id: string) => void;
  onAddHighlight?: (newItem: HighlightItem) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentTitle,
  documentText,
  previewUrl,
  pages = [],
  highlights,
  selectedHighlightId,
  onSelectHighlight,
  activeFilter,
  visibleHighlightIds,
  onUpdateHighlight,
  onDeleteHighlight,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showUnderlines, setShowUnderlines] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'text' | 'image'>('text');
  const [hoveredHighlightId, setHoveredHighlightId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Drag Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modal State
  const [editingHighlight, setEditingHighlight] = useState<HighlightItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Determine active preview URL based on multi-page list or single previewUrl
  const currentPageNumber = currentPageIndex + 1;
  const currentImageUrl =
    pages.length > 0 && pages[currentPageIndex]
      ? pages[currentPageIndex].previewUrl
      : previewUrl;

  // Zoom Handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 300));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 40));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setPanOffset({ x: 0, y: 0 });
  };
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 64;
      const targetWidth = viewMode === 'image' ? 760 : 680;
      const calculatedZoom = Math.min(200, Math.max(50, Math.round((containerWidth / targetWidth) * 100)));
      setZoomLevel(calculatedZoom);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Scroll to selected highlight when selected in text view
  useEffect(() => {
    if (selectedHighlightId && viewMode === 'text') {
      const badges = containerRef.current?.querySelectorAll<HTMLElement>('[data-highlight-id]');
      const selectedBadge = badges && [...badges].find((badge) => badge.dataset.highlightId === selectedHighlightId);
      selectedBadge?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedHighlightId, viewMode]);

  // The text view shows the complete document, so findings from every page belong in it.
  const filteredHighlights = useMemo(() => highlights.filter((h) => {
    if (activeFilter !== 'ALL' && h.type !== activeFilter) return false;
    if (visibleHighlightIds && !visibleHighlightIds.includes(h.id)) return false;
    if (viewMode === 'image' && pages.length > 1 && h.page && h.page !== currentPageNumber) return false;
    return true;
  }), [highlights, activeFilter, visibleHighlightIds, viewMode, pages.length, currentPageNumber]);

  const getBadgeIcon = (type: HighlightType) => {
    switch (type) {
      case 'DANGER':
        return <ShieldAlert size={12} />;
      case 'IMPORTANT':
        return <Award size={12} />;
      case 'ACTION':
        return <Calendar size={12} />;
    }
  };

  const getTypeLabel = (type: HighlightType) => {
    switch (type) {
      case 'DANGER':
        return '위험/독소';
      case 'IMPORTANT':
        return '중요 조건';
      case 'ACTION':
        return '필수 행동';
    }
  };

  const activeHoverOrSelect = hoveredHighlightId || selectedHighlightId;
  const activeItem = highlights.find((h) => h.id === activeHoverOrSelect);

  // Effective full text to display
  const effectiveText = documentText ?? '';
  const anchored = useMemo(
    () => segmentHighlights(effectiveText, filteredHighlights),
    [effectiveText, filteredHighlights]
  );

  // ==============================================================
  // MOUSE WHEEL & DRAG INTERACTION (휠 스크롤 & 마우스 드래그 이동)
  // ==============================================================
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 1. Ctrl + 마우스 휠: 줌 확대 / 축소
      e.preventDefault();
      const delta = e.deltaY < 0 ? 12 : -12;
      setZoomLevel((prev) => Math.min(300, Math.max(40, prev + delta)));
    } else {
      // 2. 일반 마우스 휠: 상/하/좌/우 화면 이동 (Shift+휠: 가로 이동)
      const scrollFactor = 0.9;
      const deltaX = e.shiftKey ? e.deltaY * scrollFactor : (e.deltaX ? e.deltaX * scrollFactor : 0);
      const deltaY = e.shiftKey ? 0 : e.deltaY * scrollFactor;

      setPanOffset((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPan({ ...panOffset });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset({
        x: initialPan.x + dx,
        y: initialPan.y + dy,
      });
    },
    [isPanning, dragStart, initialPan]
  );

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleOpenEdit = (item: HighlightItem) => {
    setEditingHighlight(item);
    setIsEditModalOpen(true);
  };

  const renderSourceText = () => anchored.segments.map((segment) => {
    if (!showUnderlines || segment.highlights.length === 0) return segment.text;
    const primary = segment.highlights[0];
    const selected = segment.highlights.some((item) => item.id === selectedHighlightId);
    const hovered = segment.highlights.some((item) => item.id === hoveredHighlightId);
    const selectPrimary = () => onSelectHighlight(selectedHighlightId === primary.id ? null : primary.id);

    return (
      <React.Fragment key={`${segment.start}-${segment.end}`}>
        <u
          role="button"
          tabIndex={0}
          className={`pure-underline underline-${primary.type.toLowerCase()} ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}
          aria-label={`${getTypeLabel(primary.type)}: ${segment.text}`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={selectPrimary}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectPrimary();
            }
          }}
          onMouseEnter={() => setHoveredHighlightId(primary.id)}
          onMouseLeave={() => setHoveredHighlightId(null)}
        >
          {segment.text}
        </u>
        <span className="inline-finding-buttons" aria-label="이 구간의 분석 결과">
          {segment.highlights.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-highlight-id={item.id}
              className={`inline-underline-tag tag-${item.type.toLowerCase()}`}
              aria-label={`${getTypeLabel(item.type)} ${index + 1}: ${item.easyText}`}
              aria-pressed={selectedHighlightId === item.id}
              title={item.easyText}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => onSelectHighlight(selectedHighlightId === item.id ? null : item.id)}
              onMouseEnter={() => setHoveredHighlightId(item.id)}
              onMouseLeave={() => setHoveredHighlightId(null)}
            >
              {item.type === 'DANGER' ? '🔴위험' : item.type === 'IMPORTANT' ? '🟡조건' : '🔵행동'}
              {segment.highlights.length > 1 ? ` ${index + 1}` : ''}
            </button>
          ))}
        </span>
      </React.Fragment>
    );
  });

  return (
    <div className="viewer-wrapper">
      {/* 뷰어 상단 툴바 */}
      <div className="viewer-toolbar">
        <div className="viewer-doc-title">
          <span className="doc-type-icon">📄</span>
          <span className="doc-title-text" title={documentTitle}>
            {documentTitle || '문서 뷰어'}
          </span>
        </div>

        <div className="viewer-controls">
          {/* 다중 페이지 네비게이션 */}
          {viewMode === 'image' && pages.length > 1 && (
            <div className="page-pagination-control">
              <button
                className="page-nav-btn"
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                title="이전 페이지"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="page-nav-indicator">
                {currentPageIndex + 1} / {pages.length}p
              </span>
              <button
                className="page-nav-btn"
                disabled={currentPageIndex === pages.length - 1}
                onClick={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                title="다음 페이지"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* View Mode Switcher (문장 밑줄 뷰 vs 깨끗한 원본 사진/PDF) */}
          {currentImageUrl && (
            <div className="view-mode-toggle">
              <button
                className={`mode-btn ${viewMode === 'text' ? 'active' : ''}`}
                onClick={() => setViewMode('text')}
                title="중요 문장 정밀 밑줄 뷰 (🔴 위험 · 🟡 조건 · 🔵 행동)"
              >
                <Highlighter size={13} />
                <span>문장 밑줄 뷰</span>
              </button>
              <button
                className={`mode-btn ${viewMode === 'image' ? 'active' : ''}`}
                onClick={() => setViewMode('image')}
                title="표시 없는 깨끗한 원본 사진/PDF 보기"
              >
                <ImageIcon size={13} />
                <span>원본 사진/PDF</span>
              </button>
            </div>
          )}

          {viewMode === 'text' && (
            <button
              className={`control-btn ${showUnderlines ? 'active' : ''}`}
              onClick={() => setShowUnderlines(!showUnderlines)}
              title={showUnderlines ? '밑줄 숨기기' : '밑줄 표시하기'}
            >
              {showUnderlines ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showUnderlines ? '밑줄 ON' : '밑줄 OFF'}</span>
            </button>
          )}

          {/* 줌 컨트롤 */}
          <div className="zoom-control-group">
            <button className="control-btn" onClick={handleZoomOut} title="축소 (Ctrl+휠)">
              <ZoomOut size={14} />
            </button>
            <span className="zoom-indicator">{zoomLevel}%</span>
            <button className="control-btn" onClick={handleZoomIn} title="확대 (Ctrl+휠)">
              <ZoomIn size={14} />
            </button>
            <button className="control-btn" onClick={handleFitWidth} title="가로 맞춤">
              <Maximize2 size={13} />
            </button>
            <button className="control-btn" onClick={handleResetZoom} title="원래 크기 및 위치 초기화">
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'text' && anchored.unmatchedIds.length > 0 && (
        <div className="source-anchor-notice" role="status">
          원문 위치를 확인하지 못한 분석 {anchored.unmatchedIds.length}건은 밑줄로 표시하지 않았습니다.
          {' '}상세 해설에서 확인할 수 있습니다.
        </div>
      )}

      {/* 뷰어 본문 컨테이너 (마우스 휠 스크롤 및 마우스 드래그 이동) */}
      <div
        className={`viewer-scroll-area cursor-grab ${isPanning ? 'cursor-grabbing' : ''}`}
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="document-canvas-wrapper"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {viewMode === 'image' && currentImageUrl ? (
            /* 1. 깨끗한 원본 사진/PDF 모드 (어떠한 박스나 표시도 없는 순수 원본 사진 표시) */
            <div className="image-clean-sheet">
              <img
                src={currentImageUrl}
                alt="업로드 원본 문서"
                className="document-source-image"
                draggable={false}
              />
            </div>
          ) : (
            /* 2. 중요 문장 정밀 밑줄 모드 (순수 텍스트 + 정확한 위치 밑줄) */
            <div className="document-sheet">
              <div className="sheet-watermark">DocuClear AI Legal Scan</div>

              <div className="sheet-header">
                <div className="sheet-badge">문서 분석 보기</div>
                <h2 className="sheet-title">{documentTitle}</h2>
                <div className="sheet-meta">
                  <span>전체 본문: 🔴 위험 · 🟡 조건 · 🔵 행동</span>
                </div>
              </div>

              <div className="sheet-body-content">
                <div className="sheet-plain-paragraph">
                  {effectiveText
                    ? renderSourceText()
                    : '표시할 원문 텍스트가 없습니다. 원본 파일과 상세 해설을 확인해 주세요.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 문장 밑줄 뷰에서 호버/선택 시 플로팅 툴팁 안내 */}
      {viewMode === 'text' && activeItem && showUnderlines && (
        <div className={`floating-bbox-tooltip tooltip-${activeItem.type.toLowerCase()}`}>
          <div className="tooltip-header">
            <div className="tooltip-badge-group">
              <span className={`tooltip-badge badge-${activeItem.type.toLowerCase()}`}>
                {getBadgeIcon(activeItem.type)}
                {getTypeLabel(activeItem.type)} ({activeItem.id})
              </span>
              <button
                className="tooltip-edit-trigger"
                onClick={() => handleOpenEdit(activeItem)}
                title="조항 내용 및 설명 수정"
              >
                <Edit2 size={12} />
                <span>조항 수정</span>
              </button>
            </div>
            <span className="tooltip-close" onClick={() => onSelectHighlight(null)}>
              ✕
            </span>
          </div>
          <div className="tooltip-body">
            <div className="tooltip-easy-text">{activeItem.easyText}</div>
            <div className="tooltip-original-text">원문: "{activeItem.originalText}"</div>
          </div>
        </div>
      )}

      {/* 조항 수정 모달 */}
      <EditHighlightModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        highlight={editingHighlight}
        onSave={(updated) => {
          if (onUpdateHighlight) onUpdateHighlight(updated);
        }}
        onDelete={(id) => {
          if (onDeleteHighlight) onDeleteHighlight(id);
        }}
      />
    </div>
  );
};
