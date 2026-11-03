import type { SampleDocument } from '../types';

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'sample-debt-implicit',
    title: '차용증 및 금전소비대차 각서 (암묵적 위험 및 일방적 재량)',
    category: '금전 차용 / 각서',
    tag: '암묵적 위험 · 일방적 재량 주의',
    description: '명시적인 위약금 단어가 없어도 일방적 지정, 별도 협의, 주관적 확인 우선 등이 결합되어 분쟁 위험이 높은 샘플입니다.',
    previewNote: '채권자 지정 변제, 별도 협의 유보, 증빙 부재 시 당사자 확인 우선 조항 포함',
    documentText: `[차용증 및 금전소비대차 각서]

채무자 이채무는 채권자 김채권과 아래와 같이 금전소비대차 계약을 체결하고 이를 성실히 이행할 것을 확약한다.

제 1 조 (차용 원금 및 수령 사실)
채무자는 채권자로부터 5,000,000원을 지급받았다.

제 2 조 (변제 방법 및 지정 권한)
채무자는 채권자가 지정하는 방법으로 변제한다.

제 3 조 (구체적 지급 조건의 유보)
구체적인 지급 방법 및 세부 분할 상환 일정은 별도 협의한다.

제 4 조 (증빙 자료 및 사실 확인 기준)
거래 내역 관련 자료가 확인되지 않을 경우 당사자의 확인 내용을 우선한다.

제 5 조 (거래 내역 차이 발생 시 수정)
실제 거래내역과 차이가 있으면 협의하여 수정한다.`,
    defaultResult: {
      summary: {
        score: '위험',
        signalCount: 4,
        signalCategories: ['AMBIGUITY', 'EVIDENCE_RISK', 'UNILATERAL_DISCRETION', 'MODIFICATION_RISK', 'AUTHENTICITY_RISK', 'DISPUTE_RISK'],
        bullets: [
          '변제 방법이 채권자 일방의 지정에 맡겨져 있고 구체적 지급 조건이 사후 협의로 유보되어 있어 분쟁 위험이 큽니다.',
          '객관적 금융 증빙 부재 시 당사자의 주관적 확인을 우선하도록 규정하여 법적 입증 책임이 극히 취약합니다.',
          '실제 송금 증빙, 변제 기한, 이자율 및 당사자 자필 서명/날인 등 필수 핵심 정보가 전반적으로 누락되어 있습니다.',
        ],
        riskReasons: [
          '변제 방식이 특정 당사자의 일방적 지정에 의존하여 권한 불균형 및 자의적 해석 위험이 존재합니다.',
          '객관적 증빙 자료보다 주관적 진술을 우선하는 조항으로 인해 입증 책임 및 진위 분쟁 위험이 큽니다.',
          '불명확한 지급 조건과 주관적 확인 우선 조항이 결합되어 복합적인 분쟁 취약성을 형성하고 있습니다.',
        ],
        safeVerificationNote: '확인된 이상 신호 4건(5개 영역)이 결합되어 있으므로, 사기로 단정하기보다는 서명 전 공식 계좌 명시와 은행 송금증 첨부를 반드시 완료해야 합니다.',
      },
      highlights: [
        {
          id: 'h1',
          type: 'IMPORTANT',
          riskCategories: ['AUTHENTICITY_RISK', 'MISSING_INFORMATION'],
          clauseRef: '제1조',
          originalText: '채무자는 채권자로부터 5,000,000원을 지급받았다.',
          easyText: '⭐ 500만 원을 받았다는 사실만 적혀 있고, 언제 어떤 통장으로 받았는지 금융 증빙이 없어 나중에 이중 청구나 분쟁이 생길 수 있어요.',
          observedFact: '500만 원 수령 사실만 기재되어 있고 금융기관 송금 일시나 계좌번호가 부속되지 않음.',
          riskSignal: 'AUTHENTICITY_RISK 및 MISSING_INFORMATION',
          reason: '본 문서에서 실제 지급 여부를 입증할 수 있는 객관적인 금융 증빙(은행 이체 확인증 등)이 결합되어 있지 않습니다.',
          potentialProblem: '추후 실제 자금 수수 여부나 지급 수령인에 대한 진실 공방 발생 가능성.',
          verificationMethod: '원금 수령 시점의 은행 계좌이체 내역서 사본 또는 금융기관 영수증 첨부.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 22.0,
            width: 89.0,
            height: 5.8,
          },
        },
        {
          id: 'h2',
          type: 'DANGER',
          riskCategories: ['AMBIGUITY', 'UNILATERAL_DISCRETION', 'DISPUTE_RISK'],
          clauseRef: '제2조',
          originalText: '채무자는 채권자가 지정하는 방법으로 변제한다.',
          easyText: '⚠️ 돈을 갚는 방식을 상대방이 마음대로 정할 수 있게 되어 있어, 나중에 부당하거나 불리한 지급 방식을 요구받을 위험이 커요.',
          observedFact: '변제 방법이 사전에 특정되지 않고 채권자의 일방 지정에 의존하도록 기재됨.',
          riskSignal: 'AMBIGUITY 및 UNILATERAL_DISCRETION',
          reason: '이행 방법과 기준이 모호하며 일방 당사자에게 결정 권한이 집중되어 있어 권한 불균형 및 사후 분쟁 발생 위험이 존재합니다.',
          potentialProblem: '사후에 채권자가 이행 곤란한 방식이나 위험한 경로로 변제를 요구하여 분쟁 발생 위험.',
          verificationMethod: '채권자 본인 명의의 지정 은행 계좌번호와 변제 기일을 계약서에 명문화하여 확정.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 35.0,
            width: 89.0,
            height: 6.2,
          },
        },
        {
          id: 'h3',
          type: 'DANGER',
          riskCategories: ['MODIFICATION_RISK', 'AMBIGUITY'],
          clauseRef: '제3조',
          originalText: '구체적인 지급 방법 및 세부 분할 상환 일정은 별도 협의한다.',
          easyText: '⚠️ 돈을 언제 어떻게 나누어 갚을지 확실히 정하지 않고 나중에 정하겠다고 미뤄두어 계약의 구속력이 떨어집니다.',
          observedFact: '핵심 변제 일정 및 분할 방식이 사후 협의로 유보됨.',
          riskSignal: 'MODIFICATION_RISK 및 AMBIGUITY',
          reason: '중요 계약 조건이 사후 협의로 유보되어 있어, 당사자 간 합의 불일치 시 즉시 변제 독촉 분쟁이 발생할 수 있습니다.',
          potentialProblem: '사후 협의 결렬 시 채무 불이행 책임 공방 및 기한의 이익 상실 분쟁 발생.',
          verificationMethod: '구체적인 분할 상환 금액과 매월 변제 일자(예: 매월 25일 50만원)를 사전에 확정 기재.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 48.0,
            width: 89.0,
            height: 6.0,
          },
        },
        {
          id: 'h4',
          type: 'DANGER',
          riskCategories: ['EVIDENCE_RISK', 'DISPUTE_RISK'],
          clauseRef: '제4조',
          originalText: '거래 내역 관련 자료가 확인되지 않을 경우 당사자의 확인 내용을 우선한다.',
          easyText: '⚠️ 통장 거래내역 같은 객관적 서류 대신 상대방의 일방적 말이나 주장을 먼저 인정하겠다는 아주 불리한 조항이에요.',
          observedFact: '자료 부재 시 객관적 금융자료 대신 주관적 확인 내용을 우선/종합하여 인정하도록 기재됨.',
          riskSignal: 'EVIDENCE_RISK 및 DISPUTE_RISK',
          reason: '객관적 금융 증빙보다 주관적 진술을 우선하도록 규정되어 있어 향후 법적 분쟁 시 입증 곤란 및 일방의 자의적 주장에 취약합니다.',
          potentialProblem: '채권자의 구두 주장이나 일방적 장부 기록에 의해 채무액이 부당 산정될 위험.',
          verificationMethod: '금융기관 계좌이체 확인증을 유일한 정식 증빙으로 인정하는 특약 추가.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 61.0,
            width: 89.0,
            height: 6.2,
          },
        },
        {
          id: 'h5',
          type: 'DANGER',
          riskCategories: ['AUTHENTICITY_RISK', 'MODIFICATION_RISK', 'AMBIGUITY'],
          clauseRef: '제5조',
          originalText: '실제 거래내역과 차이가 있으면 협의하여 수정한다.',
          easyText: '⚠️ 문서 내용과 실제 통장 내역이 다를 경우 사후에 임의로 고칠 수 있게 하여 계약의 진위와 원본성이 흔들릴 수 있습니다.',
          observedFact: '실제 거래내역과의 차이 발생 시 협의 수정을 허용함.',
          riskSignal: 'AUTHENTICITY_RISK 및 MODIFICATION_RISK',
          reason: '계약 내용의 사후 임의 수정 가능성을 열어두어 거래의 확정성이 훼손될 수 있으므로 별도 서면 변경 절차가 필요합니다.',
          potentialProblem: '사후 일방적 내용 변경 주장 및 원본 진정성 훼손 분쟁 발생 가능성.',
          verificationMethod: '내용 수정 시 양 당사자가 기명날인한 부속 서면 합의서를 작성하도록 수정 절차 명시.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 74.0,
            width: 89.0,
            height: 6.0,
          },
        },
      ],
      compoundRisks: [
        {
          title: '지급 조건 불확정 및 주관적 증빙 의존 결합 위험',
          relatedHighlights: ['h2', 'h3', 'h4'],
          riskCategories: ['AMBIGUITY', 'EVIDENCE_RISK', 'UNILATERAL_DISCRETION'],
          reason: '변제 방식이 확정되지 않고(제2조, 제3조), 자료 부재 시 주관적 확인에 의존(제4조)하도록 설계되어 있어 채권자의 일방적 주장에 법적으로 방어하기 극히 취약한 구조입니다.',
          severity: 'HIGH',
          actionRequired: '채무 변제용 지정 은행 계좌번호와 변제 기일을 명시하고, 계좌이체 확인증을 유일한 정식 증빙으로 특약에 추가하세요.',
          verificationMethod: '지정 금융기관 계좌 기재 및 은행 송금 확인증 필수 첨부 특약 신설',
        },
        {
          title: '거래 진위 불확실 및 사후 임의 수정 결합 위험',
          relatedHighlights: ['h1', 'h5'],
          riskCategories: ['AUTHENTICITY_RISK', 'MODIFICATION_RISK'],
          reason: '원금 지급에 대한 금융 증빙이 없는 상태에서 사후 차이 발생 시 협의 수정을 허용하면 채무 원금이나 변제액에 대한 진위 공방이 발생할 수 있습니다.',
          severity: 'HIGH',
          actionRequired: '원금 수령 시점의 은행 이체 내역서 사본을 필수 첨부하고 쌍방 서명 날인을 완료하세요.',
          verificationMethod: '원금 수령 시점의 은행 거래내역서 사본 대조 및 쌍방 자필 서명 확인',
        },
      ],
      missingInformation: [
        {
          item: '구체적인 변제 계좌 및 금융거래 이체 증빙',
          importance: 'HIGH',
          whyNeeded: '실제 자금 이동 경로와 변제 사실을 객관적으로 입증하여 이중 청구를 방지하기 위함입니다.',
          potentialDispute: '실제 입금 여부나 변제 수령인에 대해 추후 진실 공방 및 법적 분쟁이 발생할 수 있습니다.',
          verificationMethod: '채권자 명의의 지정 금융기관 계좌번호를 명시하고 계좌이체 영수증을 필수 첨부하도록 보완하세요.',
          actionRequired: '채권자 명의의 지정 금융기관 계좌번호를 명시하고 계좌이체 영수증을 필수 첨부하도록 보완',
        },
        {
          item: '명확한 변제 완료 기한 및 상환 일정',
          importance: 'HIGH',
          whyNeeded: '채무 변제 의무의 도래 시점을 객관적으로 확정하기 위함입니다.',
          potentialDispute: '상환 기한의 부재로 인해 채권자의 즉시 전액 변제 독촉 또는 이행 지체 분쟁이 발생할 수 있습니다.',
          verificationMethod: '변제 완료 기일(연, 월, 일)을 특정하여 문서에 기재하세요.',
          actionRequired: '변제 완료 기일(연, 월, 일)을 특정하여 문서에 기재',
        },
        {
          item: '기한 도과 시 지연손해금 및 연체 이율 기준',
          importance: 'MEDIUM',
          whyNeeded: '변제 기일이 늦어졌을 때의 법적 이자 산정 기준을 명확히 하기 위함입니다.',
          potentialDispute: '연체 발생 시 부당한 과다 이자 청구나 법정 이율 적용을 둘러싼 갈등이 생길 수 있습니다.',
          verificationMethod: '약정 이자율 및 연체 시 적용될 지연손해금율(연 % 기준)을 명시하세요.',
          actionRequired: '약정 이자율 및 연체 시 적용될 지연손해금율 명시',
        },
        {
          item: '당사자 자필 서명/날인 및 신원 확인 정보',
          importance: 'HIGH',
          whyNeeded: '계약 당사자 본인의 진정한 의사에 의해 문서가 작성되었음을 보증하기 위한 기본 요건입니다.',
          potentialDispute: '상대방이 문서 작성 사실을 부인하거나 명의 도용을 주장할 경우 효력 입증이 곤란해집니다.',
          verificationMethod: '양 당사자의 자필 서명 또는 인감 날인 및 신분증 사본 대조를 완료하세요.',
          actionRequired: '양 당사자의 자필 서명 또는 인감 날인 및 신분증 사본 대조',
        },
      ],
      evidenceChecks: [
        {
          claim: '채무자는 채권자로부터 5,000,000원을 지급받았다',
          expectedEvidence: '은행 계좌이체 내역서, 무통장 입금증 또는 공인 금융기관 영수증',
          status: 'MISSING',
          notes: '구체적 송금 일시와 금융기관 거래 기록이 문서에 첨부되어 있지 않으므로 금융거래 내역 대조가 필요합니다.',
        },
      ],
      verificationGuide: [
        {
          risk: '변제 방법 및 지급 계좌 불확정 위험',
          method: '채권자 본인 명의의 금융계좌를 계약서에 특정하고 계좌이체 내역서를 필수 보관',
          expectedEvidence: '은행 계좌이체 확인증 또는 금융기관 송금 원장',
        },
        {
          risk: '주관적 진술 우선에 따른 입증 책임 취약',
          method: '객관적 금융자료 및 공인 전자문서를 유일한 정식 증빙으로 인정하는 특약 추가',
          expectedEvidence: '은행 발급 금융거래 증명서',
        },
        {
          risk: '핵심 조건 사후 협의 유보 및 임의 변경 위험',
          method: '상환 일정 및 변제 기일을 사전에 특정하고, 변경 시 쌍방 기명날인 서면 합의서 작성',
          expectedEvidence: '쌍방 서명 날인된 부속합의서 원본',
        },
      ],
    },
  },
  {
    id: 'sample-lease',
    title: '부동산 원룸 임대차 계약서 및 특약사항',
    category: '부동산 계약서',
    tag: '위험 조항 주의',
    description: '사회초년생이나 청년이 자취방을 구할 때 흔히 접하는 원룸/오피스텔 임대차 계약서 샘플입니다.',
    previewNote: '원상복구 독소조항 및 중도해지 위약금 조항 포함',
    documentText: `[부동산 임대차 표준 계약서]

제 1 조 (목적)
임대인(홍길동)은 자신이 소유한 서울시 마포구 독막로 12길 34, 201호(전용 24.8㎡)를 임차인(김청년)에게 주거용으로 임대하며, 임차인은 이를 임차하기로 합의한다.

제 2 조 (보증금 및 차임)
1. 보증금: 일억 오천만 원 (₩150,000,000)
   - 계약금: 일천오백만 원은 계약 시 지급한다.
   - 잔금: 일억 삼천오백만 원은 2026년 9월 1일 입주일 당일 소유권 확인 후 계좌 이체한다.
2. 월 차임: 삼십만 원 (₩300,000, 매월 25일 후불 지급)

제 3 조 (임대차 기간)
2026년 9월 1일부터 2028년 8월 31일까지 (24개월간)

제 4 조 (특약 사항 - 필독)
[특약 1] 임차인은 계약 만료 또는 퇴실 시 통상적인 마모, 자연 노후화, 소모품 고장 및 노후 보일러 교체를 포함한 모든 시설 파손에 대해 사유 불문 전액 수리비용을 부담하고 신품으로 원상복구한다.
[특약 2] 임대차 계약 기간 중 임차인의 개인 사정으로 중도 해지할 경우, 다음 임차인이 입주할 때까지의 잔여 기간 월 임대료 전액을 위약금으로 일시납부하여야 보증금을 반환한다.
[특약 3] 임대인은 잔금 지급일 익일까지 현재 등기부등본상의 무융자 상태 및 1순위 권리관계를 변동 없이 유지하여야 한다.
[특약 4] 임차인은 잔금 지급 당일(2026년 9월 1일) 즉시 관할 주민센터에 전입신고를 완료하고 확정일자를 부여받아 대항력을 확보하여야 한다.
[특약 5] 관리비(월 7만 원)는 인터넷, 수도세를 포함하며 전기 및 도시가스는 실사용량에 따라 별도 납부한다.`,
    defaultResult: {
      summary: {
        score: '위험',
        signalCount: 3,
        signalCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK', 'COMPLIANCE_RISK'],
        bullets: [
          '노후 시설물 및 보일러 교체 비용까지 임차인에게 무조건 전액 전가하는 심각한 독소조항이 포함되어 있습니다.',
          '중도 해지 시 다음 세입자 유무와 무관하게 남은 개월 수의 모든 월세를 위약금으로 요구하여 세입자에게 매우 불리합니다.',
          '잔금 지급 당일 즉시 전입신고 및 확정일자를 받아야 대항력(보증금 우선변제권)을 안전하게 확보할 수 있습니다.',
        ],
        riskReasons: [
          '통상적 마모 및 자연 노후화에 대한 전액 원상복구 전가 조항(특약 1)은 주택임대차 표준 판례에 반하는 대표적 독소조항입니다.',
          '중도 해지 시 잔여 기간 월세 전액을 일시 위약금으로 강제하는 규정(특약 2)은 과도한 손해배상 예정으로 임차인에게 불리합니다.',
        ],
        safeVerificationNote: '임대차 표준계약서 양식과 비교하여 과도한 배상/원상복구 특약의 삭제 또는 수정을 공식 요구하시기 바랍니다.',
      },
      highlights: [
        {
          id: 'h1',
          type: 'DANGER',
          riskCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK'],
          clauseRef: '특약 1',
          originalText: '통상적인 마모, 자연 노후화, 소모품 고장 및 노후 보일러 교체를 포함한 모든 시설 파손에 대해 사유 불문 전액 수리비용을 부담하고 신품으로 원상복구한다.',
          easyText: '⚠️ 원래 살면서 자연스럽게 낡은 것이나 오래된 보일러 고장까지 세입자가 새것으로 전부 물어내라는 매우 불공정한 조항이에요! 서명 전 삭제를 요구해야 합니다.',
          observedFact: '자연 노후화 및 보일러 교체 비용을 사유 불문 임차인 전액 부담으로 명시함.',
          riskSignal: 'LIABILITY_RISK 및 FINANCIAL_RISK',
          reason: '민법 및 주택임대차보호법상 통상적 감가상각과 대수선 의무는 임대인에게 있으나 이를 임차인에게 전가하고 있습니다.',
          potentialProblem: '퇴거 시 수백만 원 상당의 보일러 교체비 및 수리비를 보증금에서 부당 공제당할 위험.',
          verificationMethod: '임대인의 수선의무를 명시하고 입주 전 시설물 사진 목록표를 계약서에 첨부.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 50.2,
            width: 89.0,
            height: 7.2,
          },
        },
        {
          id: 'h2',
          type: 'DANGER',
          riskCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK'],
          clauseRef: '특약 2',
          originalText: '중도 해지할 경우, 다음 임차인이 입주할 때까지의 잔여 기간 월 임대료 전액을 위약금으로 일시납부하여야 보증금을 반환한다.',
          easyText: '⚠️ 사정이 생겨 이사를 일찍 나가게 되면 남은 계약 기간의 모든 월세를 한꺼번에 다 내야 보증금을 돌려주겠다는 과도한 위약금 조항이에요.',
          observedFact: '중도 해지 시 잔여 기간 월세 전액을 위약금으로 일시 납부하도록 규정함.',
          riskSignal: 'LIABILITY_RISK 및 FINANCIAL_RISK',
          reason: '실제 손해액을 초과하는 과다한 위약벌 약정으로 민법 제398조에 따라 감액 또는 무효를 주장할 수 있는 소지가 있습니다.',
          potentialProblem: '중도 퇴실 시 과도한 위약금으로 인해 보증금을 제때 돌려받지 못할 위험.',
          verificationMethod: '중도해지 3개월 전 통지 및 신규 세입자 중개보수 부담 조건으로 완화 수정 요구.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 58.5,
            width: 89.0,
            height: 6.8,
          },
        },
        {
          id: 'h3',
          type: 'IMPORTANT',
          riskCategories: ['FINANCIAL_RISK'],
          clauseRef: '제2조',
          originalText: '잔금: 일억 삼천오백만 원은 2026년 9월 1일 입주일 당일 소유권 확인 후 계좌 이체한다.',
          easyText: '⭐ 남은 돈 1억 3,500만 원은 이사 들어가는 날(9월 1일)에 집주인 본인이 맞는지 등기부등본을 다시 확인하고 보내야 해요.',
          observedFact: '입주일 당일 소유권 확인 후 잔금 1억 3,500만원 계좌 이체 조건 명시.',
          riskSignal: 'FINANCIAL_RISK',
          reason: '임차보증금 잔금 지급 시 당일 등기부 권리변동 및 소유자 명의 일치 확인이 필수적입니다.',
          potentialProblem: '명의 불일치 또는 미확인 상태 송금 시 보증금 편취 피해 우려.',
          verificationMethod: '잔금 당일 실시간 등기사항전부증명서 및 임대인 신분증 진위 대조.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 29.5,
            width: 89.0,
            height: 4.8,
          },
        },
        {
          id: 'h4',
          type: 'IMPORTANT',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '특약 3',
          originalText: '임대인은 잔금 지급일 익일까지 현재 등기부등본상의 무융자 상태 및 1순위 권리관계를 변동 없이 유지하여야 한다.',
          easyText: '⭐ 집주인이 잔금 치르는 날 몰래 은행 대출(근저당)을 받지 못하도록 약속하는 아주 중요한 보호 조항이에요.',
          observedFact: '잔금 지급일 익일까지 무융자 상태 유지 의무 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '대항력 발생 시점(익일 0시) 이전의 근저당 설정을 차단하기 위한 필수 특약입니다.',
          potentialProblem: '대항력 확보 전 집주인의 당일 근저당 설정 시 경매 배당 순위 후순위 전락.',
          verificationMethod: '잔금일 익일 오전 등기부등본 재열람으로 권리변동 유무 최종 확인.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 66.5,
            width: 89.0,
            height: 5.2,
          },
        },
        {
          id: 'h5',
          type: 'ACTION',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '특약 4',
          originalText: '잔금 지급 당일(2026년 9월 1일) 즉시 관할 주민센터에 전입신고를 완료하고 확정일자를 부여받아 대항력을 확보하여야 한다.',
          easyText: '📝 이사하는 날(9월 1일) 잊지 말고 주민센터에 가서 전입신고를 하고 확정일자 도장을 꼭 받아야 보증금을 안전하게 지킬 수 있어요.',
          observedFact: '잔금 지급 당일 즉시 전입신고 및 확정일자 부여 의무 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '주택임대차보호법상 우선변제권 취득을 위한 법적 대항요건 구비 조항입니다.',
          potentialProblem: '신고 지연 시 대항력 발생이 늦어져 보증금 회수 위험 노출.',
          verificationMethod: '주민센터 방문 또는 정부24 온라인 전입신고증 및 확정일자 부여 확인서 수령.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 73.0,
            width: 89.0,
            height: 6.2,
          },
        },
      ],
      compoundRisks: [
        {
          title: '원상복구 책임 전가 및 과다 위약금 결합 위험',
          relatedHighlights: ['h1', 'h2'],
          riskCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK'],
          reason: '자연 노후화 수리비 전가와 중도해지 시 잔여 월세 전액 몰수가 결합되어 있어, 퇴거 시 임대인이 보증금 반환을 고의로 지연하거나 부당 공제할 위험이 매우 높습니다.',
          severity: 'HIGH',
          actionRequired: '입주 전 시설물 상태 사진을 촬영하여 계약서에 첨부하고, 특약 1과 2의 수정을 공식 요구하세요.',
          verificationMethod: '입주 당일 사진/동영상 첨부 및 특약 수정 서면 합의',
        },
      ],
      missingInformation: [
        {
          item: '입주 전 기존 시설물 상태 사진 및 하자 확인 목록표',
          importance: 'HIGH',
          whyNeeded: '퇴실 시 기존 노후 파손과 거주 중 파손의 경계를 객관적으로 구분하기 위함입니다.',
          potentialDispute: '퇴거 시 기존에 있던 흠집이나 노후 고장을 세입자의 책임으로 몰아 수리비를 공제할 위험이 큽니다.',
          verificationMethod: '입주 당일 방 전체 및 옵션 가전의 사진/동영상을 찍어 임대인에게 문자로 공유해 둘 것.',
          actionRequired: '입주 당일 방 전체 사진 촬영 및 임대인 공유',
        },
      ],
      evidenceChecks: [
        {
          claim: '임대인은 무융자 상태 및 1순위 권리관계를 변동 없이 유지하여야 한다',
          expectedEvidence: '잔금일 당일 발급된 인터넷등기소 부동산 등기사항전부증명서',
          status: 'PRESENT',
          notes: '특약 3에 확인 의무가 규정되어 있으므로 잔금 송금 직전 실시간 등기부를 재열람해야 합니다.',
        },
      ],
      verificationGuide: [
        {
          risk: '통상 마모 수리비 부당 공제 위험',
          method: '입주 당일 모든 벽면, 바닥, 보일러, 가전의 고해상도 사진 촬영 후 임대인에게 전송 기록 보관',
          expectedEvidence: '날짜가 포함된 입주 전 시설물 확인 사진 및 문자/메일 발송 내역',
        },
        {
          risk: '과다 위약금 청구 위험',
          method: '중도해지 시 잔여 월세 전액 대신 통상 관행(새 임차인 중개수수료 부담)으로 특약 변경 합의',
          expectedEvidence: '수정 날인된 임대차 계약서 특약란',
        },
      ],
    },
  },
  {
    id: 'sample-startup',
    title: '2026년 청년 예비창업 패키지 지원사업 모집 공고',
    category: '정부 공공지원 공고',
    tag: '지원 조건 & 환수 주의',
    description: '중소벤처기업부 청년 예비창업자 대상 최대 5,000만원 사업화 자금 지원 공고문 샘플입니다.',
    previewNote: '최대 5,000만원 지원, 신청자격 및 지원금 전액 환수 규정 포함',
    documentText: `[2026년 중소벤처기업부 청년 예비창업 패키지 사업화 지원 공고]

1. 사업 개요 및 지원 규모
- 사업 목적: 혁신적인 기술 및 아이디어를 보유한 청년층의 성공적인 창업 유도 및 사업화 지원
- 지원 대상: 공고일(2026. 08. 01) 기준 만 19세 이상 ~ 만 39세 이하의 청년 예비창업자 (사업자 미등록자)
- 지원 규모: 창업 사업화 자금 바우처 최대 50,000,000원(오천만 원) 무상 지원 및 1:1 전담 멘토링

2. 신청 및 접수 기한
- 접수 기간: 2026년 8월 15일(월) 09:00 ~ 2026년 9월 30일(수) 18:00까지 (마감 시간 엄수)
- 접수 방법: K-Startup(www.k-startup.go.kr) 공식 홈페이지 온라인 접수 (우편 및 방문 접수 불가)
- 필수 제출 서류: 사업계획서(지정 서식), 주민등록등본, 사실증명(사업자등록사실여부), 개인정보동의서 각 1부

3. 의무 사항 및 제재 규정 (환수 기준)
- [의무 규정] 협약 체결 후 3개월 이내에 관할 세무서에 본인 명의 개인/법인 사업자등록을 반드시 완료하여야 함.
- [환수 및 제재 1] 협약 기간 중 타 지역으로 사업장 주소지를 무단 이전하거나 3개월 내 미창업 시, 기지급된 지원금 전액을 즉시 환수하고 20%의 가산금을 부과함.
- [환수 및 제재 2] 허위 사실 기재, 타인 명의 도용, 지원금의 유흥/개인용도 부정 사용 적발 시 지원금 환수 및 향후 5년간 정부지원사업 참여 제한.
- [정산 보고] 지원금 집행 후 매월 10일까지 세금계산서 및 카드영수증 등 증빙자료를 첨부한 월간 집행내역서를 전담기관에 제출하여야 함.`,
    defaultResult: {
      summary: {
        score: '주의',
        signalCount: 2,
        signalCategories: ['COMPLIANCE_RISK', 'FINANCIAL_RISK', 'LIABILITY_RISK'],
        bullets: [
          '만 19~39세 예비창업자에게 최대 5,000만 원의 사업화 자금을 무상 지원하는 정부 지원 공고입니다.',
          '협약 후 3개월 내 미창업 또는 주소지 무단 이전 시 지원금 전액 환수 및 20% 위약 가산금이 부과됩니다.',
          '2026년 9월 30일 18:00까지 K-Startup 온라인으로 필수 서류 4종을 제출해야 하며 마감 후 수정 불가합니다.',
        ],
        riskReasons: [
          '창업 기한(3개월) 미준수 또는 사업장 무단 이전 시 전액 환수와 함께 20% 가산금이 부과되는 엄격한 제재 규정이 있습니다.',
          '매월 정기 증빙 제출 의무가 있어 증빙 누락 시 환수 조치가 내려질 수 있습니다.',
        ],
        safeVerificationNote: '정부 공식 공고이므로 제재 규정과 정산 증빙 제출 일정만 철저히 관리하면 안전하게 혜택을 수령할 수 있습니다.',
      },
      highlights: [
        {
          id: 'h1',
          type: 'IMPORTANT',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제1항',
          originalText: '공고일(2026. 08. 01) 기준 만 19세 이상 ~ 만 39세 이하의 청년 예비창업자 (사업자 미등록자)',
          easyText: '⭐ 나이가 만 19세부터 39세 사이이고, 아직 사업자등록증을 낸 적 없는 사람만 신청할 수 있는 필수 자격 요건이에요.',
          observedFact: '공고일 기준 연령(만 19~39세) 및 사업자 미등록 요건 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '공고일 기준 연령 및 무사업자 자격 요건 미충족 시 서류 평가에서 자동 탈락됩니다.',
          potentialProblem: '과거 폐업 이력이나 연령 기준 초과 시 자동 실격 처리.',
          verificationMethod: '홈택스 사실증명(사업자등록사실여부) 최근 발급본으로 자격 사전 검증.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 16.5,
            width: 89.0,
            height: 5.5,
          },
        },
        {
          id: 'h2',
          type: 'IMPORTANT',
          riskCategories: ['FINANCIAL_RISK'],
          clauseRef: '제1항',
          originalText: '창업 사업화 자금 바우처 최대 50,000,000원(오천만 원) 무상 지원 및 1:1 전담 멘토링',
          easyText: '⭐ 정부에서 갚지 않아도 되는 사업 지원금 최대 5천만 원과 전문가 지도 혜택을 주는 핵심 지원 내용이에요.',
          observedFact: '최대 5,000만원 바우처 지원 및 멘토링 혜택 규정.',
          riskSignal: 'FINANCIAL_RISK',
          reason: '정부 바우처 지원금의 상한 및 지원 형태를 규정하는 핵심 혜택 조항입니다.',
          potentialProblem: '집행 지침 외 사용 시 불인정 및 환수 위험.',
          verificationMethod: '공식 사업비 집행 및 관리 지침서 정독.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 23.5,
            width: 89.0,
            height: 5.2,
          },
        },
        {
          id: 'h3',
          type: 'ACTION',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제2항',
          originalText: '2026년 8월 15일(월) 09:00 ~ 2026년 9월 30일(수) 18:00까지 (마감 시간 엄수) / K-Startup 공식 홈페이지 온라인 접수',
          easyText: '📝 9월 30일 오후 6시 정각에 마감되니, 그전에 꼭 컴퓨터로 케이스타트업 홈페이지에 접속해서 신청해야 해요.',
          observedFact: '접수 기간(9월 30일 18시) 및 온라인 접수 경로 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '마감 시간 도과 시 전산 접수가 자동 마감되어 일체 추가 접수가 불가능합니다.',
          potentialProblem: '마감 직전 트래픽 몰림으로 인한 제출 실패.',
          verificationMethod: '마감 1일 전 K-Startup 전산 접수 및 접수증 출력 완료.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 36.5,
            width: 89.0,
            height: 5.8,
          },
        },
        {
          id: 'h4',
          type: 'ACTION',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제2항',
          originalText: '필수 제출 서류: 사업계획서(지정 서식), 주민등록등본, 사실증명(사업자등록사실여부), 개인정보동의서 각 1부',
          easyText: '📝 사업계획서, 주민등록등본, 사업자등록사실증명서, 동의서 등 서류 4가지를 빠짐없이 준비해 첨부해야 해요.',
          observedFact: '필수 제출 서류 4종 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '필수 제출 서류 누락 시 보완 기회 없이 불합격 처리될 수 있습니다.',
          potentialProblem: '단 1종 서류 누락으로 인한 자동 부적격 탈락.',
          verificationMethod: '지정 서식 일치 여부 및 4종 첨부파일 업로드 상태 최종 체크.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 43.5,
            width: 89.0,
            height: 5.5,
          },
        },
        {
          id: 'h5',
          type: 'DANGER',
          riskCategories: ['FINANCIAL_RISK', 'LIABILITY_RISK'],
          clauseRef: '제3항',
          originalText: '타 지역으로 사업장 주소지를 무단 이전하거나 3개월 내 미창업 시, 기지급된 지원금 전액을 즉시 환수하고 20%의 가산금을 부과함.',
          easyText: '⚠️ 돈을 받은 뒤 3개월 안에 창업을 안 하거나 회사를 다른 지역으로 옮기면 받은 돈을 다 토해내야 하고 20% 벌금까지 물어야 해요!',
          observedFact: '무단 이전 및 3개월 내 미창업 시 전액 환수 및 20% 가산금 부과 규정.',
          riskSignal: 'LIABILITY_RISK 및 FINANCIAL_RISK',
          reason: '지역 협약 의무 불이행 시 전액 환수 및 20% 가산금이 부과되는 강력한 제재 규정입니다.',
          potentialProblem: '협약 기간 중 이전 필요 시 사전 승인 미비로 환수 통보받을 위험.',
          verificationMethod: '소재지 변경 필요 시 전담기관 사전 변경 신청 절차 준수.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 60.5,
            width: 89.0,
            height: 6.8,
          },
        },
      ],
      compoundRisks: [
        {
          title: '주소지 이전 제약 및 즉시 환수/가산금 부과 결합 위험',
          relatedHighlights: ['h5'],
          riskCategories: ['LIABILITY_RISK', 'COMPLIANCE_RISK'],
          reason: '초기 사업장 위치 선정 후 사업 확장이나 이사로 인한 주소 이전 시 전담기관의 사전 승인 절차가 까다로워 무단 이전으로 간주될 위험이 있습니다.',
          severity: 'HIGH',
          actionRequired: '사업장 소재지 변경이 예상되는 경우 사전에 전담기관 변경 승인 절차를 확인하세요.',
          verificationMethod: '전담기관 변경 신청 공문 및 승인 통보서 보관',
        },
      ],
      missingInformation: [
        {
          item: '정산 불인정 시 이의신청 절차 및 구제 기준',
          importance: 'MEDIUM',
          whyNeeded: '월간 집행 증빙 심사에서 부결되었을 때 소명 기회를 보장받기 위함입니다.',
          potentialDispute: '적법하게 집행한 사업비가 형식적 서류 미비로 불인정되어 자부담으로 전가될 수 있습니다.',
          verificationMethod: '세부 관리 지침 상의 이의신청 기간 및 소명 서류 제출 요령을 확인하세요.',
          actionRequired: '세부 관리 지침 상의 이의신청 기간 및 소명 서류 제출 요령 확인',
        },
      ],
      evidenceChecks: [
        {
          claim: '지원 대상: 사업자 미등록 청년 예비창업자',
          expectedEvidence: '국세청 홈택스 발급 사실증명(사업자등록사실여부)',
          status: 'PRESENT',
          notes: '필수 제출 서류 목록에 포함되어 있으므로 최근 1개월 이내 발급본을 제출해야 합니다.',
        },
      ],
      verificationGuide: [
        {
          risk: '사업비 부정 집행 의심 및 환수 위험',
          method: '모든 지출 건마다 세금계산서, 전자영수증, 거래명세서 3종 세트 필수 발급 및 e나라도움 등록',
          expectedEvidence: '국세청 승인 전자세금계산서 및 신용카드 매출전표',
        },
      ],
    },
  },
  {
    id: 'sample-freelance',
    title: '웹 플랫폼 개발 및 UI/UX 용역 표준계약서',
    category: '프리랜서 용역계약',
    tag: '저작권 및 위약금 주의',
    description: '디자이너/개발자/크리에이터가 외주 프로젝트를 수주할 때 사용하는 용역 계약서 샘플입니다.',
    previewNote: '중간 산출물 영구 귀속 독소조항, 과도한 일일 지체상금 조항 포함',
    documentText: `[소프트웨어 개발 및 디자인 용역 표준 계약서]

발주자 주식회사 에이비씨(이하 '갑')와 수급사업자 프리랜서 박개발(이하 '을')은 다음과 같이 계약을 체결한다.

제 1 조 (용역의 범위 및 납품 기한)
1. 용역명: 신규 고객 관리용 웹 대시보드 UI/UX 설계 및 프론트엔드 반응형 웹 개발
2. 계약 기간: 2026년 9월 1일 ~ 2026년 11월 30일 (총 3개월간)

제 2 조 (용역 대금 및 지급 조건)
1. 총 계약금액: 일천이백만 원 (₩12,000,000, 부가세 별도)
2. 지급 방식:
   - 계약 착수금(30%): 계약 체결 후 7일 이내 지급 (₩3,600,000)
   - 1차 중간 산출물 검수 완료(30%): 2026년 10월 15일 검수 통과 후 지급 (₩3,600,000)
   - 최종 잔금(40%): 최종 납품 및 검수 통과 후 14일 이내 세금계산서 발행 시 지급 (₩4,800,000)

제 3 조 (지체상금 및 위약벌 - 주의)
'을'의 귀책사유로 인하여 정해진 기한 내에 납품이 지연되는 경우, '을'은 지연일수 1일당 총 계약금액의 1.5%(일 180,000원)에 해당하는 지체상금을 '갑'에게 배상하거나 최종 대금에서 일괄 공제한다.

제 4 조 (저작재산권 및 2차 저작물 작성권의 일방적 귀속 - 독소조항)
본 계약에 따라 개발된 최종 성과물뿐만 아니라 '을'이 개발 과정에서 제작한 모든 중간 시안, 미채택 아이디어, 소스코드 및 라이브러리에 대한 저작인격권 및 저작재산권 일체는 검수 및 대금 완납 여부와 무관하게 착수 즉시 '갑'에게 무조건 영구 귀속된다.

제 5 조 (검수 및 수정 요구)
'갑'은 '을'로부터 산출물을 수령한 날로부터 7영업일 이내에 검수 결과를 서면 통보하여야 하며, 해당 기간 내에 서면 이의가 없을 경우 정상 검수 완료된 것으로 간주한다.`,
    defaultResult: {
      summary: {
        score: '위험',
        signalCount: 3,
        signalCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK', 'COMPLIANCE_RISK'],
        bullets: [
          '대금을 다 받지도 않았는데 중간 시안과 아이디어까지 발주처에 영구 귀속시키는 심각한 저작권 독소조항이 있습니다.',
          '하루 늦을 때마다 총 계약금의 1.5%(일 18만원)를 깎는 지체상금은 법정 표준(0.05%~0.1%) 대비 15~30배에 달하는 과도한 위약금입니다.',
          '총 대금 1,200만 원은 착수금 30%, 중간 30%, 최종 40%로 나누어 지급되며 검수 후 7영업일 내 서면 통보 기준이 적용됩니다.',
        ],
        riskReasons: [
          '대금 완납 전 미채택 중간 시안까지 영구 귀속시키는 규정(제4조)은 저작권법 및 공정거래 원칙에 위배되는 전형적 불공정 독소조항입니다.',
          '일일 1.5%의 지체상금률(제3조)은 국가계약법 표준(0.075%) 대비 20배 이상 과중하여 대금 전액 공제 위험이 있습니다.',
        ],
        safeVerificationNote: '저작권 귀속 시점을 대금 완납 후로 변경하고, 지체상금률을 1일 0.1% 이하로 수정 계약해야 안전합니다.',
      },
      highlights: [
        {
          id: 'h1',
          type: 'DANGER',
          riskCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK'],
          clauseRef: '제4조',
          originalText: "본 계약에 따라 개발된 최종 성과물뿐만 아니라 '을'이 개발 과정에서 제작한 모든 중간 시안, 미채택 아이디어, 소스코드 및 라이브러리에 대한 저작인격권 및 저작재산권 일체는 검수 및 대금 완납 여부와 무관하게 착수 즉시 '갑'에게 무조건 영구 귀속된다.",
          easyText: '⚠️ 돈을 다 받지도 않았는데 내가 만든 모든 초기 아이디어와 탈락한 디자인 시안까지 전부 상대방 회사가 공짜로 다 가져가겠다는 아주 나쁜 독소조항이에요!',
          observedFact: '대금 완납 여부와 무관하게 모든 중간 시안 및 라이브러리 저작권이 발주처에 영구 귀속되도록 규정함.',
          riskSignal: 'LIABILITY_RISK 및 FINANCIAL_RISK',
          reason: '대금 완납을 저작권 이전의 선이행 조건으로 수정하고, 미채택 시안 및 기보유 라이브러리는 창작자에게 유보시켜야 합니다.',
          potentialProblem: '대금 미지급 상태에서 저작권만 편취당하거나 기존 보유 코드의 재활용이 금지될 위험.',
          verificationMethod: '저작재산권 이전을 잔금 완납 시점으로 수정하고 미채택 시안 권리는 을에게 유보 명시.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 67.5,
            width: 89.0,
            height: 8.5,
          },
        },
        {
          id: 'h2',
          type: 'DANGER',
          riskCategories: ['FINANCIAL_RISK', 'LIABILITY_RISK'],
          clauseRef: '제3조',
          originalText: "지연일수 1일당 총 계약금액의 1.5%(일 180,000원)에 해당하는 지체상금을 '갑'에게 배상하거나 최종 대금에서 일괄 공제한다.",
          easyText: '⚠️ 하루만 늦어도 18만 원씩(보통 기준보다 15배 이상 많은 금액) 깎겠다는 과도한 벌금 조항이니 0.1% 이하로 낮춰달라고 해야 해요.',
          observedFact: '1일당 1.5%(일 18만원)의 지체상금 및 일괄 공제 조항 명시.',
          riskSignal: 'FINANCIAL_RISK 및 LIABILITY_RISK',
          reason: '지체상금률이 비합리적으로 과다하여 경미한 지연에도 용역 대금 전액이 잠식될 위험이 있습니다.',
          potentialProblem: '단 20일 지연 시 총 대금의 30%가 삭감되어 용역비 정산 분쟁 발생.',
          verificationMethod: '국가계약법 기준(1일 0.075%~0.1%)으로 지체상금률 감액 수정 요구.',
          severity: 'HIGH',
          bbox: {
            x: 5.5,
            y: 56.5,
            width: 89.0,
            height: 7.2,
          },
        },
        {
          id: 'h3',
          type: 'IMPORTANT',
          riskCategories: ['FINANCIAL_RISK'],
          clauseRef: '제2조',
          originalText: '총 계약금액: 일천이백만 원 (₩12,000,000, 부가세 별도) / 착수금 30%, 1차 검수 30%, 최종 잔금 40%',
          easyText: '⭐ 전체 작업비는 1,200만 원이며, 시작할 때 30%, 중간 점검 때 30%, 다 끝났을 때 40%로 세 번에 나누어 받는 조건이에요.',
          observedFact: '총 대금 1,200만원에 대해 3단계 분할 지급 조건 명시.',
          riskSignal: 'FINANCIAL_RISK',
          reason: '단계별 기성고 대금 분할 지급 구조를 규정하는 핵심 조항입니다.',
          potentialProblem: '검수 지연 시 단계별 대금 지급 연체 우려.',
          verificationMethod: '단계별 세금계산서 발행 및 입금 계좌 확인.',
          severity: 'MEDIUM',
          bbox: {
            x: 5.5,
            y: 31.0,
            width: 89.0,
            height: 7.8,
          },
        },
        {
          id: 'h4',
          type: 'ACTION',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제5조',
          originalText: "'갑'은 '을'로부터 산출물을 수령한 날로부터 7영업일 이내에 검수 결과를 서면 통보하여야 하며, 해당 기간 내에 서면 이의가 없을 경우 정상 검수 완료된 것으로 간주한다.",
          easyText: '📝 결과물을 보낸 뒤 상대방이 7일 동안 아무 말이 없으면 자동으로 문제없이 통과된 것으로 처리되니 날짜를 꼭 메모해 두세요.',
          observedFact: '산출물 수령 후 7영업일 내 서면 미통보 시 자동 검수 합격 간주 규정.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '검수 지연 방지 및 자동 합격 간주 기간을 명시한 수급인 보호 조항입니다.',
          potentialProblem: '발주처의 구두 이의 제기에 따른 합격 간주 효력 다툼.',
          verificationMethod: '산출물 납품 시 이메일 발송 시간 및 수신확인 기록 보관.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 79.5,
            width: 89.0,
            height: 6.8,
          },
        },
      ],
      compoundRisks: [
        {
          title: '지식재산권 일방적 귀속 및 과도한 지체상금 결합 위험',
          relatedHighlights: ['h1', 'h2'],
          riskCategories: ['LIABILITY_RISK', 'FINANCIAL_RISK'],
          reason: '기한 지연 시 과도한 지체상금으로 대금을 깎이면서도, 제작한 모든 저작권은 상대방에게 무조건 귀속되는 극단적 불균형 구조입니다.',
          severity: 'HIGH',
          actionRequired: '대금 완납 시 저작재산권이 이전되도록 수정하고, 지체상금률을 1일 0.1%(일 12,000원) 이하로 제한하세요.',
          verificationMethod: '대금 완납 조건부 저작권 양도 계약서로 갱신 체결',
        },
      ],
      missingInformation: [
        {
          item: '과업 변경에 따른 추가 개발비 산정 및 수정 횟수 제한 규정',
          importance: 'HIGH',
          whyNeeded: '발주처의 무제한 수정 요구로 인한 업무 과중 및 납기 지연을 방지하기 위함입니다.',
          potentialDispute: '추가 기획 변경 시 추가 대금 지급 없이 무상 수정을 강요받을 위험이 있습니다.',
          verificationMethod: '무상 수정 횟수(예: 3회) 및 범위 외 수정 시 M/M 기준 추가 요율을 특약에 명시하세요.',
          actionRequired: '무상 수정 횟수 및 추가 개발비 단가 명시',
        },
      ],
      evidenceChecks: [
        {
          claim: '총 계약금액: 일천이백만 원 (착수금 30%, 1차 30%, 잔금 40%)',
          expectedEvidence: '전자세금계산서 승인번호 및 사업자 통장 입금 내역서',
          status: 'PRESENT',
          notes: '지급 조건이 명확히 규정되어 있으므로 단계별 검수 통과 즉시 세금계산서를 발행해야 합니다.',
        },
      ],
      verificationGuide: [
        {
          risk: '저작재산권 무상 편취 위험',
          method: '제4조 저작권 귀속 조항에 "잔금 완납 즉시 이전된다"는 단서 조항 삽입 요구',
          expectedEvidence: '수정 날인된 용역계약서 원본',
        },
        {
          risk: '과다 지체상금 대금 공제 위험',
          method: '지체상금 요율을 1일 0.075%로 인하하고 최대 공제 한도(총 계약금의 10% 이내) 설정',
          expectedEvidence: '수정된 표준 지체상금 합의서',
        },
      ],
    },
  },
  {
    id: 'sample-safe-standard',
    title: '표준 IT 소프트웨어 유지보수 및 자문 계약서',
    category: '표준 용역계약',
    tag: '표준 규정 균형 부합',
    description: '과도한 일방적 재량이 없고, 지급 계좌와 변경 절차가 상호 서면 합의로 명확히 확정된 모범 표준 계약서 샘플입니다.',
    previewNote: '명확한 지급 계좌, 객관적 검수 절차, 상호 서면 합의 원칙 준수',
    documentText: `[표준 소프트웨어 유지보수 및 기술자문 계약서]

발주자 주식회사 한국테크(이하 '갑')와 용역제공자 주식회사 클라우드시스(이하 '을')는 신의성실의 원칙에 따라 다음과 같이 계약을 체결한다.

제 1 조 (목적 및 자문 범위)
'을'은 '갑'의 클라우드 서버 인프라에 대한 월간 정기 점검 및 긴급 기술 지원 용역을 수행한다.

제 2 조 (용역 대금 및 지급 계좌)
1. 월 용역 대금: 일백오십만 원 (₩1,500,000, 부가세 별도)
2. '갑'은 매월 말일 '을'이 발행한 전자세금계산서를 확인한 후 익월 10일까지 '을'의 지정 계좌(국민은행 123-456-789012, 예금주: 주식회사 클라우드시스)로 송금한다.

제 3 조 (검수 및 결과 보고)
'을'은 매월 25일까지 정기 점검 보고서를 '갑'에게 서면 또는 전자문서로 제출하며, '갑'은 5영업일 이내에 검수를 완료한다.

제 4 조 (계약의 변경 및 해지)
본 계약의 내용을 변경하거나 수정하고자 할 때에는 양 당사자가 기명날인한 부속 서면 합의서를 작성하여야 한다.

제 5 조 (분쟁의 해결)
본 계약과 관련하여 분쟁이 발생할 경우 양 당사자의 상호 협의를 우선하며, 합의가 이루어지지 않을 경우 관할 법원의 일반 민사소송 절차에 따른다.`,
    defaultResult: {
      summary: {
        score: '안전',
        signalCount: 0,
        signalCategories: [],
        bullets: [
          '용역 범위, 지급 계좌, 대금 지급 일정 및 전자세금계산서 증빙이 명확히 특정되어 있습니다.',
          '일방적 재량이나 사후 임의 수정 조항 없이 양 당사자의 기명날인 서면 합의를 계약 변경 요건으로 규정하고 있습니다.',
          '검수 기간과 이의 절차가 객관적으로 균형 있게 작성된 표준 모범 계약서입니다.',
        ],
        riskReasons: [
          '핵심 조건이 명확하고 과도한 일방적 재량이나 증빙 취약성 없이 권리·의무 관계가 균형 있게 작성된 표준 문서입니다.',
        ],
        safeVerificationNote: '8대 안전 조건을 모두 충족하는 모범 표준 계약서입니다. 지정된 계좌와 일정에 맞춰 정기 점검 보고서를 제출하시면 됩니다.',
      },
      highlights: [
        {
          id: 'h1',
          type: 'IMPORTANT',
          riskCategories: ['FINANCIAL_RISK'],
          clauseRef: '제2조',
          originalText: "'갑'은 매월 말일 '을'이 발행한 전자세금계산서를 확인한 후 익월 10일까지 '을'의 지정 계좌(국민은행 123-456-789012, 예금주: 주식회사 클라우드시스)로 송금한다.",
          easyText: '⭐ 대금 지급일(익월 10일)과 받을 은행 계좌번호가 명확히 지정되어 있어 금융 거래 증빙이 확실해요.',
          observedFact: '지정 은행 계좌(국민은행) 및 전자세금계산서 발행 후 익월 10일 송금 일정 명시.',
          riskSignal: 'FINANCIAL_RISK (표준 조건)',
          reason: '지급 기일 및 지정 금융기관 계좌번호가 사전에 확정되어 있어 미지급이나 송금 분쟁 가능성이 차단되어 있습니다.',
          potentialProblem: '특이 위험 사항 없음.',
          verificationMethod: '매월 전자세금계산서 발행 및 지정 계좌 입금 내역 확인.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 28.0,
            width: 89.0,
            height: 6.2,
          },
        },
        {
          id: 'h2',
          type: 'ACTION',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제3조',
          originalText: "'을'은 매월 25일까지 정기 점검 보고서를 '갑'에게 서면 또는 전자문서로 제출하며, '갑'은 5영업일 이내에 검수를 완료한다.",
          easyText: '📝 매월 25일까지 점검 보고서를 보내야 하고, 상대방도 5일 안에 검수를 끝내야 하는 명확한 일정 규칙이에요.',
          observedFact: '매월 25일 보고서 제출 및 5영업일 내 검수 완료 일정 명시.',
          riskSignal: 'COMPLIANCE_RISK',
          reason: '단계별 업무 보고와 검수 기한이 상호 대등하게 규정되어 있습니다.',
          potentialProblem: '특이 위험 사항 없음.',
          verificationMethod: '매월 25일 정기 점검 보고서 이메일 발송 및 수신 확인.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 46.0,
            width: 89.0,
            height: 5.8,
          },
        },
        {
          id: 'h3',
          type: 'IMPORTANT',
          riskCategories: ['COMPLIANCE_RISK'],
          clauseRef: '제4조',
          originalText: '본 계약의 내용을 변경하거나 수정하고자 할 때에는 양 당사자가 기명날인한 부속 서면 합의서를 작성하여야 한다.',
          easyText: '⭐ 한쪽 마음대로 계약을 바꿀 수 없고, 양쪽이 다 도장을 찍은 종이 합의서가 있어야만 수정할 수 있는 안전한 장치예요.',
          observedFact: '계약 변경 시 양 당사자 기명날인 부속 서면 합의서 작성 의무화.',
          riskSignal: 'COMPLIANCE_RISK (보호 조항)',
          reason: '임의 변경을 금지하고 쌍방 기명날인 서면 합의를 필수 변경 요건으로 두어 계약의 확정성을 확보하고 있습니다.',
          potentialProblem: '특이 위험 사항 없음.',
          verificationMethod: '내용 변경 필요 시 쌍방 기명날인 부속합의서 작성.',
          severity: 'LOW',
          bbox: {
            x: 5.5,
            y: 62.0,
            width: 89.0,
            height: 5.8,
          },
        },
      ],
      compoundRisks: [],
      missingInformation: [],
      evidenceChecks: [
        {
          claim: '용역 대금: 월 1,500,000원 계좌 송금',
          expectedEvidence: '국민은행 계좌이체 확인증 및 전자세금계산서',
          status: 'PRESENT',
          notes: '지정 계좌번호 및 세금계산서 증빙 요건이 완비되어 있습니다.',
        },
      ],
      verificationGuide: [
        {
          risk: '정기 용역 정산 관리',
          method: '매월 말일 전자세금계산서 발행 및 익월 10일 지정 계좌 입금 여부 확인',
          expectedEvidence: '전자세금계산서 승인번호 및 통장 거래내역',
        },
      ],
    },
  },
];
