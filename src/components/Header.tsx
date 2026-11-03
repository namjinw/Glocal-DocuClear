import React, { useEffect, useState } from 'react';
import { ShieldAlert, Key, Plus } from 'lucide-react';
import { DEFAULT_MODEL, getGroqConfig } from '../utils/groq';
import './Header.css';

interface HeaderProps {
  onOpenApiKeyModal: () => void;
  onReset: () => void;
  hasResult: boolean;
  isBusy?: boolean;
}

type ConfigState =
  | { status: 'checking' }
  | { status: 'error' }
  | { status: 'ready'; configured: boolean; model: string };

export const Header: React.FC<HeaderProps> = ({ onOpenApiKeyModal, onReset, hasResult, isBusy = false }) => {
  const [config, setConfig] = useState<ConfigState>({ status: 'checking' });

  useEffect(() => {
    let active = true;
    getGroqConfig().then(
      (result) => {
        if (active) setConfig({ status: 'ready', configured: result.configured, model: result.model });
      },
      () => {
        if (active) setConfig({ status: 'error' });
      },
    );
    return () => { active = false; };
  }, []);

  const hasKey = config.status === 'ready' && config.configured;
  const statusLabel = config.status === 'checking' ? 'Groq 설정 확인 중'
    : config.status === 'error' ? 'Groq 설정 확인 실패'
      : config.configured ? 'Groq 키 등록됨' : 'Groq 키 없음 · 로컬 분석';
  const statusClass = config.status !== 'ready' ? 'unknown' : hasKey ? 'configured' : 'demo';
  const model = config.status === 'ready' ? config.model : DEFAULT_MODEL;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo-icon"><ShieldAlert size={26} /></div>
        <div className="header-titles">
          <div className="header-title-row">
            <h1 className="header-main-title">DocuClear AI</h1>
            <span className="header-version-badge">계약·행정 문서 검토</span>
          </div>
          <p className="header-sub-title">복잡한 공공문서·계약서·약관을 요약하고 위험 신호와 검토할 조건을 표시합니다.</p>
        </div>
      </div>
      <div className="header-right">
        <button
          className={`api-status-pill ${statusClass}`}
          onClick={onOpenApiKeyModal}
          disabled={isBusy}
          title={`Groq 서버 설정 · 모델: ${model}. 키 등록 여부는 연결 성공을 의미하지 않습니다.`}
        >
          <span className="status-dot" />
          <Key size={14} />
          <span>{statusLabel}</span>
        </button>
        {hasResult && (
          <button className="new-doc-btn" onClick={onReset} disabled={isBusy}>
            <Plus size={16} /><span>새 문서 분석</span>
          </button>
        )}
      </div>
    </header>
  );
};
