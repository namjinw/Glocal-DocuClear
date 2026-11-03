const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers.cjs');
const { analyzeDocumentOffline } = loadTs('src/utils/analysis.ts');

// Exact risk-bearing excerpts from the synthetic contract used in the conversation.
const contract = `제3조 업무범위
② 갑은 사업상 필요에 따라 제작 수량, 운영 채널 및 업무의 종류를 변경할 수 있다. 변경된 업무가 갑의 홍보 또는 사업 운영과 관련되는 경우 본 계약의 업무범위에 포함된 것으로 본다.
③ 제2항에 따른 업무 증가, 투입 인력 변경 및 일정 단축은 별도 보수 청구의 사유가 되지 않는다.
제6조 납품 및 검수
② 검수는 갑이 해당 결과물에 대하여 명시적으로 최종 승인한 때에 완료된다. 결과물의 게시, 사용 또는 제3자 제공만으로 검수가 완료된 것으로 보지 않는다.
③ 갑은 내부 검토, 사업계획 변경 또는 최종 고객과의 협의를 이유로 검수 결정을 유보할 수 있다. 유보 기간에는 별도의 제한을 두지 않는다.
④ 갑이 검수 완료 후 추가 수정을 요청한 경우 해당 결과물의 최종 승인은 수정본 승인 시까지 효력이 정지된다.
제7조 수정 및 보완
① 을은 갑이 요청하는 수정 및 보완을 추가 비용 없이 수행한다. 수정 횟수에는 제한을 두지 않는다.
② 최초 요청 내용에 포함되지 않은 사항이나 갑의 선호 변경에 따른 수정도 결과물의 완성도를 높이기 위한 보완으로 본다.
제8조 대금 지급
① 갑은 해당 월 결과물의 검수가 완료되고 적법한 세금계산서를 수령한 날부터 30일 이내에 월별 대금을 지급한다.
② 다만 해당 업무가 갑의 최종 고객을 위한 업무인 경우, 갑은 최종 고객으로부터 관련 대금을 실제 수령한 후 지급할 수 있다. 이 경우 제1항의 지급기한은 그 수령일부터 기산한다.
③ 최종 고객의 지급 지연 또는 미지급으로 인한 대금 지급 유보에는 지연이자를 적용하지 않는다.
④ 갑은 을의 다른 계약상 의무 위반이 의심되는 경우에도 확인이 끝날 때까지 본 계약의 미지급 대금 전액을 보류할 수 있다.
제9조 지식재산권
① 본 계약 수행 과정에서 작성되거나 사용된 결과물, 원본 파일, 미채택 시안 및 작업 중간물에 관한 양도 가능한 지식재산권은 생성과 동시에 갑에게 귀속된다.
② 을이 계약 체결 전부터 보유한 서식, 제작 도구, 프로그램 및 제작 방식도 결과물에 사용되거나 포함된 경우 제1항의 권리 이전 대상에 포함한다.
③ 본 조에 따른 권리 이전은 대금 지급 여부와 관계없이 효력이 발생하며, 을은 이에 대한 별도 보상을 청구하지 않는다.
제12조 손해배상
① 을의 손해배상 책임은 원칙적으로 최초 계약기간의 총 계약대금을 한도로 한다.
② 다만 납기 지연, 업무 누락, 품질 미달, 비밀유지 의무 위반, 지식재산권 관련 분쟁 및 그 밖의 계약상 의무 불이행에는 제1항의 한도를 적용하지 않는다.
③ 제2항의 경우 을은 갑의 직접손해 외에 예상 매출 감소, 영업기회 상실, 평판 저하 및 최종 고객에 대한 보상 비용도 배상한다.
⑤ 을은 손해 발생 사실을 안 날부터 7일 이내에 근거 자료를 첨부하여 갑에게 서면 청구하여야 하며, 해당 기간 내 청구하지 않은 손해에 대해서는 배상을 요구할 수 없다.
제13조 계약 해지 및 정산
① 갑은 사업계획 변경 또는 내부 사정으로 계약을 유지하기 어려운 경우 3일 전 통지로 본 계약의 전부 또는 일부를 해지할 수 있다.
④ 을이 계약기간 중 업무를 중단하거나 계약 종료를 요청하는 경우, 을은 이미 수행한 업무의 정산과 별도로 잔여 계약기간에 해당하는 용역대금 전액을 갑에게 지급한다.
제14조 경쟁 업무 제한
① 을은 계약기간 및 계약 종료 후 2년 동안 갑과 동일하거나 유사한 사업을 영위하는 자에게 콘텐츠 제작, 홍보, 운영 또는 자문 서비스를 제공하지 않는다.
제15조 자동 갱신
① 을이 계약기간 만료 90일 전까지 갱신 거절을 통지하지 않으면 본 계약은 동일한 조건으로 2년간 자동 갱신된다. 이후에도 같다.
② 갱신 거절은 갑의 대표이사가 수신 확인한 등기우편으로만 할 수 있으며, 이메일, 업무관리시스템 또는 담당자에 대한 통지는 효력이 없다.
③ 자동 갱신 시 월별 용역대금은 갱신 직전 월별 용역대금의 85%로 조정한다. 업무범위는 갱신 직전의 범위를 유지한다.
제16조 운영정책 및 계약 변경
① 갑이 업무관리시스템에 게시하는 운영정책, 정산기준 및 업무지침은 본 계약의 일부를 구성한다.
② 갑은 운영상 필요에 따라 제1항의 내용을 변경할 수 있다. 변경 내용은 게시한 날부터 적용하며 개별 통지는 생략할 수 있다.
③ 을이 게시일부터 3일 이내에 서면으로 이의를 제기하지 않거나 변경 후 업무를 계속 수행하면 변경에 동의한 것으로 본다.
④ 운영정책, 정산기준 또는 업무지침이 본 계약 본문과 충돌하는 경우 나중에 게시된 내용을 우선 적용한다.`;

test('original synthetic contract exercises the entire late-document risk pipeline', () => {
  const result = analyzeDocumentOffline(contract);
  const names = result.highlights.filter(h => h.type === 'DANGER').map(h => h.easyText).join('|');
  for (const expected of ['업무범위 확대', '추가 보수', '수정 횟수', '검수 확정', '제3자 입금', '대금 지급 보류', '기존 보유 자산', '대금 지급 전', '배상 한도 예외', '간접손실', '일방적 해지', '잔여기간', '경쟁 업무', '갱신 거절', '보수 감액', '외부 정책', '동의로 간주', '단기 청구']) {
    assert.ok(names.includes(expected), `Missing pattern: ${expected}`);
  }
  for (const expected of ['업무 확대', '무제한 수정', '검수 지연', '배상 한도', '갱신 거절', '보수 감액', '정책 변경']) {
    assert.ok(result.compoundRisks.some(r => r.title.includes(expected)), `Missing relationship: ${expected}`);
  }
  assert.ok(result.highlights.length > 30);
  assert.equal(result.summary.score, '위험');
  assert.equal(result.analysis.unresolvedReferences.length, 0);
  for (const h of result.highlights) assert.equal(contract.slice(h.sourceSpans[0].start, h.sourceSpans[0].end), h.originalText);
  for (const c of result.compoundRisks) assert.ok(c.relatedHighlights.every(id => result.highlights.some(h => h.id === id)));
});

test('contract paragraph formatting changes preserve risk findings', () => {
  const transformed = contract.replace(/\n([①-⑳])/g, ' $1').replace(/, /g, ',\n');
  const riskNames = text => analyzeDocumentOffline(text).highlights.filter(h => h.type === 'DANGER').map(h => h.easyText).sort().join('|');
  assert.equal(riskNames(contract), riskNames(transformed));
});
