import { capabilityOptions, goalOptions, noticeItems, reactionOptions } from "../data/officialOptions";
import type { InterviewState, ParticipantTeacher } from "../types";
import { CheckGroup, FormArea, FormInput, RadioGroup } from "./fields";

type Props = {
  interview: InterviewState;
  onChange: (patch: Partial<InterviewState>) => void;
};

export function InterviewFormView({ interview, onChange }: Props) {
  function updateTeacher(index: number, patch: Partial<ParticipantTeacher>) {
    onChange({
      teachers: interview.teachers.map((teacher, i) => (i === index ? { ...teacher, ...patch } : teacher))
    });
  }

  function toggleNotice(index: number) {
    onChange({
      noticeChecks: interview.noticeChecks.map((checked, i) => (i === index ? !checked : checked))
    });
  }

  return (
    <>
      <div className="panel formSection">
        <h3>[필수 안내] 학교 연수담당자 역할 사전 안내 / 코디네이터 셀프 점검</h3>
        <p className="formHint">현장에서 안내를 마친 항목에 체크하세요. 체크 상태가 심층면담지에 "안내 완료"로 출력됩니다.</p>
        <div className="noticeList">
          {noticeItems.map((item, index) => (
            <label className={`noticeItem ${interview.noticeChecks[index] ? "checked" : ""}`} key={item.title}>
              <input type="checkbox" checked={interview.noticeChecks[index] ?? false} onChange={() => toggleNotice(index)} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="panel formSection">
        <h3>Ⅰ. 심층면담 운영 개요</h3>
        <FormInput label="심층면담 일시" value={interview.dateTime} onChange={(dateTime) => onChange({ dateTime })} placeholder="예: 2026년 6월 26일 (금) 14:30 – 17:30" />
        <div className="twoColumnFields">
          <FormInput label="리더 코디네이터" value={interview.leadCoordinator} onChange={(leadCoordinator) => onChange({ leadCoordinator })} />
          <FormInput label="코디네이터" value={interview.coordinator2} onChange={(coordinator2) => onChange({ coordinator2 })} />
          <FormInput label="코디네이터" value={interview.coordinator3} onChange={(coordinator3) => onChange({ coordinator3 })} />
          <FormInput label="운영기관 지원 담당자" value={interview.operationManager} onChange={(operationManager) => onChange({ operationManager })} />
        </div>
        <div className="field">
          <span>참여 교원 (* 필수 기재)</span>
          <div className="tableScroller">
            <table className="teacherTable">
              <thead>
                <tr>
                  <th></th>
                  <th>성명 *</th>
                  <th>직책 *</th>
                  <th>담당교과 *</th>
                  <th>교육경력</th>
                  <th>연락처 (이메일/내선 등)</th>
                </tr>
              </thead>
              <tbody>
                {interview.teachers.map((teacher, index) => (
                  <tr key={index}>
                    <td>{["①", "②", "③", "④", "⑤"][index]}</td>
                    <td><input value={teacher.name} onChange={(event) => updateTeacher(index, { name: event.target.value })} /></td>
                    <td><input value={teacher.role} onChange={(event) => updateTeacher(index, { role: event.target.value })} placeholder={["학교 관리자(교감)", "학교 담당자(부장)", "교무 부장", "학년 부장", "일반 교원"][index]} /></td>
                    <td><input value={teacher.subject} onChange={(event) => updateTeacher(index, { subject: event.target.value })} placeholder="초등" /></td>
                    <td><input value={teacher.career} onChange={(event) => updateTeacher(index, { career: event.target.value })} placeholder="○년차" /></td>
                    <td><input value={teacher.contact} onChange={(event) => updateTeacher(index, { contact: event.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel formSection">
        <h3>Ⅲ. 연수 참여 목표 및 학교의 변화 방향</h3>
        <p className="formHint">인터뷰 방향: 사업 종료 후에도 지속해서 이어가고자 하는 학교의 목표를 점검합니다.</p>
        <CheckGroup label="참여 목표 및 변화 희망 방향" options={goalOptions} values={interview.goals} onChange={(goals) => onChange({ goals })} />
        <FormInput label="기타 목표" value={interview.goalEtc} onChange={(goalEtc) => onChange({ goalEtc })} placeholder="예: 디지털 도구 활용 교내 맞춤 교재 개발" />
      </div>

      <div className="panel formSection">
        <h3>Ⅳ. 교직원 디지털 친화도 및 역량 진단</h3>
        <p className="formHint">인터뷰 대상자가 대답할 수 있는 사항 안에서 작성하고, 정확한 정보로 인식하지 않는다고 표현합니다.</p>
        <RadioGroup label="구성원 디지털 활용 역량" options={capabilityOptions} value={interview.digitalCapability} onChange={(digitalCapability) => onChange({ digitalCapability })} />
        <RadioGroup label="디지털 교육 혁신 반응" options={reactionOptions} value={interview.digitalReaction} onChange={(digitalReaction) => onChange({ digitalReaction })} />
        <FormArea label="기타 디지털 친화도 및 개별 역량 관련 의견" value={interview.digitalNotes} onChange={(digitalNotes) => onChange({ digitalNotes })} compact />
      </div>

      <div className="panel formSection">
        <h3>Ⅴ-③. 기타 고려사항</h3>
        <div className="twoColumnFields">
          <FormArea label="선행 수준 확인" value={interview.priorLevel} onChange={(priorLevel) => onChange({ priorLevel })} compact />
          <FormArea label="인프라 환경(인적/물적) 고려사항" value={interview.infraConsiderations} onChange={(infraConsiderations) => onChange({ infraConsiderations })} compact />
          <FormArea label="학교 측 별도 요청사항" value={interview.schoolRequests} onChange={(schoolRequests) => onChange({ schoolRequests })} compact />
          <FormArea label="기타 확인 필요사항" value={interview.additionalChecks} onChange={(additionalChecks) => onChange({ additionalChecks })} compact />
        </div>
      </div>

      <div className="panel formSection">
        <h3>Ⅵ. 심층면담 결과 핵심 요약</h3>
        <p className="formHint">작성 방향: 전체 면담 결과 분석, 논의 주요 사항 및 학교 목표·방향성에 대한 코멘트.</p>
        <FormArea label="면담 대상 학교의 연수 참여 목표" value={interview.participationGoal} onChange={(participationGoal) => onChange({ participationGoal })} compact />
        <FormArea label="면담 핵심 결과" value={interview.resultSummary} onChange={(resultSummary) => onChange({ resultSummary })} />
        <FormArea label="면담 전사 (녹음 시 자동 작성)" value={interview.transcript} onChange={(transcript) => onChange({ transcript })} />
        <p className="formHint">※ 심층면담 운영 시 현장 사진 및 회의 참여자 서명부 수령 필수 (간식 제공 증빙자료)</p>
      </div>
    </>
  );
}
