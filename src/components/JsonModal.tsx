import React, { useState } from 'react';
import { Code, Copy, Check, X } from 'lucide-react';
import type { AnalysisResult } from '../types';
import './JsonModal.css';

interface JsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
}

export const JsonModal: React.FC<JsonModalProps> = ({ isOpen, onClose, result }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !result) return null;

  const jsonString = JSON.stringify(result, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="json-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="json-icon-badge">
              <Code size={20} />
            </div>
            <div>
              <h3>AI 분석 결과 원본 JSON</h3>
              <p className="modal-subtitle">프롬프트 스펙에 따른 순수 JSON 응답 데이터입니다.</p>
            </div>
          </div>
          <div className="json-header-actions">
            <button className="copy-json-btn" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check size={14} /> 복사 완료!
                </>
              ) : (
                <>
                  <Copy size={14} /> JSON 복사
                </>
              )}
            </button>
            <button className="modal-close-btn" onClick={onClose} aria-label="닫기">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="json-modal-body">
          <pre className="json-code-block">
            <code>{jsonString}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
