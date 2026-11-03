import React, { useEffect, useState } from 'react';
import { Key, ExternalLink, X, ShieldAlert, Cpu, RefreshCw } from 'lucide-react';
import { DEFAULT_MODEL, getGroqConfig } from '../utils/groq';
import './ApiKeyModal.css';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type ConfigState =
  | { status: 'checking' }
  | { status: 'error' }
  | { status: 'ready'; configured: boolean };

const ApiKeyModalDialog: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [config, setConfig] = useState<ConfigState>({ status: 'checking' });

  useEffect(() => {
    let active = true;
    getGroqConfig().then(
      (result) => { if (active) setConfig({ status: 'ready', configured: result.configured }); },
      () => { if (active) setConfig({ status: 'error' }); },
    );
    return () => { active = false; };
  }, []);

  const handleRefresh = async () => {
    if (config.status === 'checking') return;
    setConfig({ status: 'checking' });
    try {
      const result = await getGroqConfig();
      setConfig({ status: 'ready', configured: result.configured });
    } catch {
      setConfig({ status: 'error' });
    } finally {
      onSaved();
    }
  };

  const statusMessage = config.status === 'checking' ? '서버의 Groq 설정을 확인하고 있습니다.'
    : config.status === 'error' ? '설정 상태를 확인하지 못했습니다. 앱 서버가 실행 중인지 확인하고 다시 시도하세요.'
      : config.configured ? '서버에 Groq API 키가 등록되어 있습니다. 키 유효성이나 실제 연결 성공을 확인한 상태는 아닙니다.'
        : '서버에 Groq API 키가 등록되지 않았습니다. 사용 가능한 문서 텍스트는 로컬 규칙으로 분석합니다.';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="groq-config-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="modal-icon-badge"><Key size={20} /></div>
            <div>
              <h3 id="groq-config-title">Groq API 서버 설정</h3>
              <p className="modal-subtitle">키는 프로젝트의 환경변수 파일에 입력하고 서버에서만 사용합니다.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className={`groq-config-status ${config.status === 'error' ? 'config-error' : ''}`} role="status">{statusMessage}</div>

          <div className="api-guide-box">
            <div className="api-guide-title"><Key size={16} /><span>API 키 등록 방법</span></div>
            <ol className="groq-setup-steps">
              <li>프로젝트 폴더의 <code>.env</code> 파일을 엽니다.</li>
              <li><code>GROQ_API_KEY=</code>의 <code>=</code> 뒤에 발급받은 키를 입력하고 저장합니다.</li>
              <li>실행 중인 서버를 종료한 뒤 다시 시작합니다.</li>
              <li>아래 <b>설정 다시 확인</b>을 누릅니다.</li>
            </ol>
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="api-guide-link">
              Groq Console에서 API 키 관리<ExternalLink size={14} />
            </a>
          </div>

          <div className="form-group">
            <label htmlFor="groqModel" className="form-label"><Cpu size={15} /> 고정 분석 모델</label>
            <input id="groqModel" type="text" className="form-input" value={DEFAULT_MODEL} readOnly />
            <p className="input-helper">텍스트 전용 모델입니다. 이미지와 스캔 PDF는 OCR로 추출한 텍스트를 입력하세요.</p>
          </div>

          <div className="input-helper groq-key-note">
            <ShieldAlert size={16} />
            <span>API 키를 이 화면이나 브라우저 저장소에 입력하지 않습니다. <code>.env</code>와 키를 공개하거나 공유하지 마세요.</span>
          </div>

          <div className="modal-footer">
            <div className="modal-footer-right">
              <button type="button" className="btn-ghost" onClick={onClose}>닫기</button>
              <button type="button" className="btn-primary" onClick={handleRefresh} disabled={config.status === 'checking'}>
                <RefreshCw size={16} className={config.status === 'checking' ? 'spinning' : ''} />
                {config.status === 'checking' ? '확인 중...' : '설정 다시 확인'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSaved }) => {
  if (!isOpen) return null;
  return <ApiKeyModalDialog onClose={onClose} onSaved={onSaved} />;
};
