import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { applyAiDraftToState } from "./aiApply";

describe("applyAiDraftToState", () => {
  it("applies diagnosis drafts only to diagnosis-related plan fields", () => {
    const state = createInitialState();
    state.interview.priorLevel = "기존 면담";

    const next = applyAiDraftToState(
      state,
      {
        diagnosisInsight: "AI 진단 분석",
        strength1: "강점",
        priorLevel: "면담 값이 있더라도 반영되면 안 됨"
      },
      "diagnosis"
    );

    expect(next.plan.editedInsights).toBe("AI 진단 분석");
    expect(next.plan.strength1).toBe("강점");
    expect(next.interview.priorLevel).toBe("기존 면담");
  });

  it("applies interview-core drafts only to interview fields", () => {
    const state = createInitialState();
    state.plan.roadmapDirection = "기존 로드맵";

    const next = applyAiDraftToState(
      state,
      {
        priorLevel: "선행 수준",
        interviewResultSummary: "면담 핵심",
        roadmapDirection: "반영되면 안 됨"
      },
      "interview-plan",
      "interview-core"
    );

    expect(next.interview.priorLevel).toBe("선행 수준");
    expect(next.interview.resultSummary).toBe("면담 핵심");
    expect(next.plan.roadmapDirection).toBe("기존 로드맵");
  });

  it("applies module content without changing module selection fields", () => {
    const state = createInitialState();
    const beforeSelected = state.modules.find((module) => module.id === 4)?.selected;

    const next = applyAiDraftToState(
      state,
      {
        moduleUpdates: [{ id: 4, programName: "프로그램명", editableProgram: "세부 초안" }]
      },
      "module-content"
    );

    const module = next.modules.find((item) => item.id === 4);
    expect(module?.selected).toBe(beforeSelected);
    expect(module?.programName).toBe("프로그램명");
    expect(module?.editableProgram).toBe("세부 초안");
  });
});
