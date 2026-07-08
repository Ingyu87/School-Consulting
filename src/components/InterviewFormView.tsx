import { Sparkles } from "lucide-react";
import { capabilityOptions, goalOptions, noticeItems, reactionOptions } from "../data/officialOptions";
import type { InterviewState, ParticipantTeacher } from "../types";
import { CheckGroup, FormArea, FormInput, RadioGroup } from "./fields";

type Props = {
  interview: InterviewState;
  onChange: (patch: Partial<InterviewState>) => void;
  onAiDraft?: (section: "interview-core") => void;
  isAiBusy?: boolean;
};

export function InterviewFormView({ interview, onChange, onAiDraft, isAiBusy }: Props) {
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
        <h3>[필수 안내] 학교 연수담당자 사전 안내</h3>
        <p className="formHint">현장에서 안내를 마친 항목을 체크하세요. 체크 상태는 심층면담지에 안내 완료로 출력됩니다.</p>
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
        <FormInput label="심층면담 일시" value={interview.dateTime} onChange={(dateTime) => onChange({ dateTime })} placeholder="예: 2026년 6월 26일(금) 14:30 ~ 17:30" />
        <div className="twoColumnFields">
          <FormInput label="리더 코디네이터" value={interview.leadCoordinator} onChange={(leadCoordinator) => onChange({ leadCoordinator })} />
          <FormInput label="코디네이터 2" value={interview.coordinator2} onChange={(coordinator2) => onChange({ coordinator2 })} />
          <FormInput label="코디네이터 3" value={interview.coordinator3} onChange={(coordinator3) => onChange({ coordinator3 })} />
          <FormInput label="운영기관 지원 담당자" value={interview.operationManager} onChange={(operationManager) => onChange({ operationManager })} />
        </div>
        <div className="field">
          <span>참여 교원</span>
          <div className="tableScroller">
            <table className="teacherTable">
              <thead>
                <tr>
                  <th></th>
                  <th>성명</th>
                  <th>직책</th>
                  <th>담당교과</th>
                  <th>교육경력</th>
                  <th>연락처</th>
                </tr>
              </thead>
              <tbody>
                {interview.teachers.map((teacher, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td><input value={teacher.name} onChange={(event) => updateTeacher(index, { name: event.target.value })} /></td>
                    <td><input value={teacher.role} onChange={(event) => updateTeacher(index, { role: event.target.value })} placeholder={["학교 관리자", "담당 부장", "교무 부장", "학년 부장", "일반 교원"][index]} /></td>
                    <td><input value={teacher.subject} onChange={(event) => updateTeacher(index, { subject: event.target.value })} placeholder="초등" /></td>
                    <td><input value={teacher.career} onChange={(event) => updateTeacher(index, { career: event.target.value })} placeholder="예: 12년차" /></td>
                    <td><input value={teacher.contact} onChange={(event) => updateTeacher(index, { contact: event.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel formSection">
        <h3>Ⅲ. 연수 참여 목표 및 학교 변화 방향</h3>
        <p className="formHint">사업 종료 후에도 이어가고자 하는 학교의 목표를 확인합니다.</p>
        <CheckGroup label="참여 목표 및 변화 희망 방향" options={goalOptions} values={interview.goals} onChange={(goals) => onChange({ goals })} />
        <FormInput label="기타 목표" value={interview.goalEtc} onChange={(goalEtc) => onChange({ goalEtc })} placeholder="예: 디벗 활용 교내 맞춤 교수학습 자료 개발" />
      </div>

      <div className="panel formSection">
        <h3>Ⅳ. 교직원 디지털 친화도 및 역량 진단</h3>
        <RadioGroup label="구성원 디지털 활용 역량" options={capabilityOptions} value={interview.digitalCapability} onChange={(digitalCapability) => onChange({ digitalCapability })} />
        <RadioGroup label="디지털 교육 혁신 반응" options={reactionOptions} value={interview.digitalReaction} onChange={(digitalReaction) => onChange({ digitalReaction })} />
        <FormArea label="기타 디지털 친화도 및 역량 관련 의견" value={interview.digitalNotes} onChange={(digitalNotes) => onChange({ digitalNotes })} compact />
      </div>

      <div className="panel formSection">
        <h3>Ⅴ. 기타 고려사항</h3>
        <div className="twoColumnFields">
          <FormArea label="선행 수준 확인" value={interview.priorLevel} onChange={(priorLevel) => onChange({ priorLevel })} compact />
          <FormArea label="인프라 환경 고려사항" value={interview.infraConsiderations} onChange={(infraConsiderations) => onChange({ infraConsiderations })} compact />
          <FormArea label="학교 측 별도 요청사항" value={interview.schoolRequests} onChange={(schoolRequests) => onChange({ schoolRequests })} compact />
          <FormArea label="기타 확인 필요사항" value={interview.additionalChecks} onChange={(additionalChecks) => onChange({ additionalChecks })} compact />
        </div>
      </div>

      <div className="panel formSection">
        <div className="sectionTitleRow">
          <h3>Ⅵ. 심층면담 결과 핵심 요약</h3>
          {onAiDraft && (
            <button className="button primary compact" onClick={() => onAiDraft("interview-core")} disabled={isAiBusy}>
              {isAiBusy ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={15} />}
              AI 초안
            </button>
          )}
        </div>
        <p className="formHint">전역 녹음 전사 내용이 있으면 함께 참고하고, 없으면 진단 결과와 연수 구성 내용을 바탕으로 작성합니다.</p>
        <FormArea label="면담 대상 학교의 연수 참여 목표" value={interview.participationGoal} onChange={(participationGoal) => onChange({ participationGoal })} compact />
        <FormArea label="면담 핵심 결과" value={interview.resultSummary} onChange={(resultSummary) => onChange({ resultSummary })} />
        <p className="formHint">※ 심층면담 운영 시 현장 사진 및 회의 참여자 서명부 수령 필수</p>
      </div>
    </>
  );
}
