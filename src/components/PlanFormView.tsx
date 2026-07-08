import { Sparkles } from "lucide-react";
import type { PlanState } from "../types";
import { FormArea, FormInput } from "./fields";

type PlanAiSection = "interview-summary" | "second-interview" | "issue-goals" | "roadmap";

type Props = {
  plan: PlanState;
  onChange: (patch: Partial<PlanState>) => void;
  onAiDraft?: (section: PlanAiSection) => void;
  isAiBusy?: boolean;
};

export function PlanFormView({ plan, onChange, onAiDraft, isAiBusy }: Props) {
  function updateIssueGoal(index: number, patch: Partial<PlanState["issueGoals"][number]>) {
    onChange({
      issueGoals: plan.issueGoals.map((item, i) => (i === index ? { ...item, ...patch } : item))
    });
  }

  function aiButton(section: PlanAiSection) {
    if (!onAiDraft) return null;
    return (
      <button className="button primary compact" onClick={() => onAiDraft(section)} disabled={isAiBusy}>
        {isAiBusy ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={15} />}
        AI 초안
      </button>
    );
  }

  return (
    <>
      <div className="panel formSection">
        <h3>Ⅱ. 우리학교 강점과 디지털 기반 교육 혁신을 위한 도전 과제</h3>
        <p className="formHint">진단 분석 결과에서 자동 반영되며, 필요한 경우 직접 수정합니다.</p>
        <div className="twoColumnFields">
          <FormArea label="우리학교 강점 1" value={plan.strength1} onChange={(strength1) => onChange({ strength1 })} />
          <FormArea label="우리학교 강점 2" value={plan.strength2} onChange={(strength2) => onChange({ strength2 })} />
          <FormArea label="도전 과제 1" value={plan.challenge1} onChange={(challenge1) => onChange({ challenge1 })} />
          <FormArea label="도전 과제 2" value={plan.challenge2} onChange={(challenge2) => onChange({ challenge2 })} />
        </div>
      </div>

      <div className="panel formSection">
        <div className="sectionTitleRow">
          <h3>Ⅲ-1. 심층면담 1차 결과 핵심 요약</h3>
          {aiButton("interview-summary")}
        </div>
        <p className="formHint">전사 내용이 있으면 함께 반영하고, 없으면 진단 결과와 연수 구성 내용을 바탕으로 작성합니다.</p>
        <FormArea label="심층면담 결과 요약" value={plan.interviewSummary} onChange={(interviewSummary) => onChange({ interviewSummary })} />
      </div>

      <div className="panel formSection">
        <div className="sectionTitleRow">
          <h3>Ⅲ-2. 심층면담 2차 이상 결과 핵심 요약</h3>
          {aiButton("second-interview")}
        </div>
        <p className="formHint">후속면담을 진행한 경우 작성합니다. 온라인 진행 시 활동 사진은 별도 첨부합니다.</p>
        <FormInput label="2차 면담 일시" value={plan.secondInterview.dateTime} onChange={(dateTime) => onChange({ secondInterview: { ...plan.secondInterview, dateTime } })} placeholder="예: 2026년 7월 8일(수) 17:00 ~ 18:00" />
        <FormArea label="2차 면담 핵심 결과" value={plan.secondInterview.resultSummary} onChange={(resultSummary) => onChange({ secondInterview: { ...plan.secondInterview, resultSummary } })} compact />
        <FormArea label="향후 예정사항" value={plan.secondInterview.futurePlans} onChange={(futurePlans) => onChange({ secondInterview: { ...plan.secondInterview, futurePlans } })} compact />
      </div>

      <div className="panel formSection">
        <div className="sectionTitleRow">
          <h3>Ⅳ. 심층면담 결과 몰아보기 및 이슈·목표 도출</h3>
          {aiButton("issue-goals")}
        </div>
        <p className="formHint">심층면담, 후속면담, 사전진단 점수, 학교 요구사항을 종합해 이슈와 목표를 도출합니다.</p>
        {plan.issueGoals.map((item, index) => (
          <div className="twoColumnFields issueRow" key={index}>
            <FormArea label={`이슈 0${index + 1}`} value={item.issue} onChange={(issue) => updateIssueGoal(index, { issue })} compact />
            <FormArea label={`목표 0${index + 1}`} value={item.goal} onChange={(goal) => updateIssueGoal(index, { goal })} compact />
          </div>
        ))}
        <FormArea label="우리학교 혁신 로드맵 방향" value={plan.roadmapDirection} onChange={(roadmapDirection) => onChange({ roadmapDirection })} compact />
      </div>

      <div className="panel formSection">
        <div className="sectionTitleRow">
          <h3>Ⅴ. 로드맵 및 기대효과 종합</h3>
          {aiButton("roadmap")}
        </div>
        <p className="formHint">과정별 세부 프로그램과 기대효과를 종합하여 운영계획서 마지막 의견으로 정리합니다.</p>
        <FormArea label="로드맵 및 기대효과 종합 의견" value={plan.roadmapNotes} onChange={(roadmapNotes) => onChange({ roadmapNotes })} />
      </div>
    </>
  );
}
