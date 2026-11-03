import React, { useState } from 'react';
import { ShieldAlert, Award, Calendar, Trash2, Check, X } from 'lucide-react';
import type { HighlightItem, HighlightType, RiskCategory, SeverityLevel } from '../types';
import './EditHighlightModal.css';

interface EditHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlight: HighlightItem | null;
  onSave: (updated: HighlightItem) => void;
  onDelete?: (id: string) => void;
}

const ALL_RISK_CATEGORIES: { id: RiskCategory; label: string }[] = [
  { id: 'AMBIGUITY', label: '❓ 불명확성' },
  { id: 'UNILATERAL_DISCRETION', label: '⚖️ 일방적 재량' },
  { id: 'EVIDENCE_RISK', label: '🧾 증빙 취약' },
  { id: 'AUTHENTICITY_RISK', label: '🔍 거래진위 불명' },
  { id: 'MODIFICATION_RISK', label: '🔄 사후 변경 위험' },
  { id: 'MISSING_INFORMATION', label: '📋 정보 누락' },
  { id: 'DISPUTE_RISK', label: '⚠️ 분쟁 위험' },
  { id: 'COMPLIANCE_RISK', label: '📜 규정/절차 준수' },
  { id: 'FINANCIAL_RISK', label: '💸 금전 손실' },
  { id: 'LIABILITY_RISK', label: '🛡️ 과도한 책임' },
];

const EditHighlightModalContent: React.FC<{
  highlight: HighlightItem;
  onClose: () => void;
  onSave: (updated: HighlightItem) => void;
  onDelete?: (id: string) => void;
}> = ({ highlight, onClose, onSave, onDelete }) => {
  const [type, setType] = useState<HighlightType>(highlight.type);
  const [severity, setSeverity] = useState<SeverityLevel>(highlight.severity || (highlight.type === 'DANGER' ? 'HIGH' : highlight.type === 'IMPORTANT' ? 'MEDIUM' : 'LOW'));
  const [categories, setCategories] = useState<RiskCategory[]>(highlight.riskCategories || []);
  const [originalText, setOriginalText] = useState(highlight.originalText);
  const [easyText, setEasyText] = useState(highlight.easyText);
  const [reason, setReason] = useState(highlight.reason || '');

  const toggleCategory = (catId: RiskCategory) => {
    setCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalText.trim()) {
      alert('문서 원문 내용을 입력해주세요.');
      return;
    }

    onSave({
      ...highlight,
      type,
      severity,
      riskCategories: categories.length > 0 ? categories : undefined,
      originalText: originalText.trim(),
      easyText: easyText.trim() || '쉬운 설명이 설정되지 않았습니다.',
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm('이 조항 하이라이트를 삭제하시겠습니까?')) {
      if (onDelete) onDelete(highlight.id);
      onClose();
    }
  };

  return (
    <div className="modal-card edit-highlight-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <div className="modal-title-wrap">
          <span className="edit-icon">✏️</span>
          <h3>조항 영역 및 해설 수정</h3>
          <span className="item-id-pill">{highlight.id}</span>
        </div>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSave} className="modal-body-form">
        {/* 1. 기본 유형 선택 */}
        <div className="form-group">
          <label className="form-label">조항 기본 분류 (UI 유형)</label>
          <div className="type-select-grid">
            <button
              type="button"
              className={`type-select-btn type-danger ${type === 'DANGER' ? 'selected' : ''}`}
              onClick={() => {
                setType('DANGER');
                if (severity === 'LOW') setSeverity('HIGH');
              }}
            >
              <ShieldAlert size={16} />
              <span>🔴 DANGER (위험/독소)</span>
            </button>
            <button
              type="button"
              className={`type-select-btn type-important ${type === 'IMPORTANT' ? 'selected' : ''}`}
              onClick={() => {
                setType('IMPORTANT');
                if (severity === 'HIGH') setSeverity('MEDIUM');
              }}
            >
              <Award size={16} />
              <span>🟡 IMPORTANT (핵심 조건)</span>
            </button>
            <button
              type="button"
              className={`type-select-btn type-action ${type === 'ACTION' ? 'selected' : ''}`}
              onClick={() => {
                setType('ACTION');
                setSeverity('LOW');
              }}
            >
              <Calendar size={16} />
              <span>🔵 ACTION (행동/일정)</span>
            </button>
          </div>
        </div>

        {/* 2. 심각도 선택 */}
        <div className="form-group">
          <label className="form-label">위험 심각도 (Severity)</label>
          <div className="severity-select-grid">
            <button
              type="button"
              className={`sev-select-btn sev-high ${severity === 'HIGH' ? 'selected' : ''}`}
              onClick={() => setSeverity('HIGH')}
            >
              🔴 HIGH (심각)
            </button>
            <button
              type="button"
              className={`sev-select-btn sev-med ${severity === 'MEDIUM' ? 'selected' : ''}`}
              onClick={() => setSeverity('MEDIUM')}
            >
              🟡 MEDIUM (주의)
            </button>
            <button
              type="button"
              className={`sev-select-btn sev-low ${severity === 'LOW' ? 'selected' : ''}`}
              onClick={() => setSeverity('LOW')}
            >
              🔵 LOW (보통)
            </button>
          </div>
        </div>

        {/* 3. 10대 위험 카테고리 태그 선택 */}
        <div className="form-group">
          <label className="form-label">위험 카테고리 태그 (다중 선택 가능)</label>
          <div className="category-select-grid">
            {ALL_RISK_CATEGORIES.map((cat) => {
              const isSelected = categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-toggle-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. 문서 원문 */}
        <div className="form-group">
          <label className="form-label">문서 원문 내용</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="문서의 원본 조항 텍스트를 입력하세요..."
            required
          />
        </div>

        {/* 5. 쉬운 해설 */}
        <div className="form-group">
          <label className="form-label">초등학생도 이해하는 쉬운 해설</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={easyText}
            onChange={(e) => setEasyText(e.target.value)}
            placeholder="일반인이 알기 쉬운 쉬운 해설 문구를 입력하세요..."
          />
        </div>

        {/* 6. 분석 사유 및 위험 신호 */}
        <div className="form-group">
          <label className="form-label">구체적 분석 사유 및 위험 신호</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="이 조항이 위험하거나 검토가 필요한 법률·행정적 맥락 분석을 입력하세요..."
          />
        </div>

        <div className="bbox-info-row">
          <span>
            현재 영역 좌표: X {highlight.bbox.x.toFixed(1)}%, Y {highlight.bbox.y.toFixed(1)}%, 너비 {highlight.bbox.width.toFixed(1)}%, 높이 {highlight.bbox.height.toFixed(1)}%
          </span>
        </div>

        <div className="modal-actions-row">
          {onDelete && (
            <button type="button" className="btn-delete" onClick={handleDelete}>
              <Trash2 size={15} />
              <span>삭제하기</span>
            </button>
          )}
          <div className="right-save-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              <Check size={15} />
              <span>변경사항 저장</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export const EditHighlightModal: React.FC<EditHighlightModalProps> = ({
  isOpen,
  onClose,
  highlight,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !highlight) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <EditHighlightModalContent
        key={highlight.id}
        highlight={highlight}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
};
