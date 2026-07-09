import type { AiDraftRequest, AiDraftResponse, AiModuleUpdate, AppState, TrainingModule } from "../types";

export function applyAiDraftToState(
  current: AppState,
  draft: AiDraftResponse,
  task: AiDraftRequest["task"],
  draftSection?: AiDraftRequest["draftSection"]
): AppState {
  const applyDiagnosis = task === "diagnosis";
  const applyInterviewCore = task === "interview-plan" && draftSection === "interview-core";
  const applyInterviewSummary = task === "interview-plan" && draftSection === "interview-summary";
  const applySecondInterview = task === "interview-plan" && draftSection === "second-interview";
  const applyIssueGoals = task === "interview-plan" && draftSection === "issue-goals";
  const applyRoadmap = task === "interview-plan" && draftSection === "roadmap";

  const nextModules =
    task === "module-content" && draft.moduleUpdates?.length
      ? current.modules.map((module) => {
          const update = draft.moduleUpdates?.find((item) => item.id === module.id);
          return update ? mergeModuleContentUpdate(module, update) : module;
        })
      : current.modules;

  return {
    ...current,
    modules: nextModules,
    interview: {
      ...current.interview,
      priorLevel: applyInterviewCore ? draft.priorLevel ?? current.interview.priorLevel : current.interview.priorLevel,
      infraConsiderations: applyInterviewCore ? draft.infraConsiderations ?? current.interview.infraConsiderations : current.interview.infraConsiderations,
      schoolRequests: applyInterviewCore ? draft.schoolRequests ?? current.interview.schoolRequests : current.interview.schoolRequests,
      additionalChecks: applyInterviewCore ? draft.additionalChecks ?? current.interview.additionalChecks : current.interview.additionalChecks,
      participationGoal: applyInterviewCore ? draft.participationGoal ?? current.interview.participationGoal : current.interview.participationGoal,
      resultSummary: applyInterviewCore ? draft.interviewResultSummary ?? current.interview.resultSummary : current.interview.resultSummary
    },
    plan: {
      ...current.plan,
      editedInsights: applyDiagnosis ? draft.diagnosisInsight ?? current.plan.editedInsights : current.plan.editedInsights,
      diagnosisImplications: applyDiagnosis ? draft.diagnosisImplications ?? current.plan.diagnosisImplications : current.plan.diagnosisImplications,
      insightSource: applyDiagnosis && draft.diagnosisInsight ? "ai" : current.plan.insightSource,
      strengths: applyDiagnosis ? draft.strength1 ?? current.plan.strengths : current.plan.strengths,
      strength1: applyDiagnosis ? draft.strength1 ?? current.plan.strength1 : current.plan.strength1,
      strength2: applyDiagnosis ? draft.strength2 ?? current.plan.strength2 : current.plan.strength2,
      challenges: applyDiagnosis ? draft.challenge1 ?? current.plan.challenges : current.plan.challenges,
      challenge1: applyDiagnosis ? draft.challenge1 ?? current.plan.challenge1 : current.plan.challenge1,
      challenge2: applyDiagnosis ? draft.challenge2 ?? current.plan.challenge2 : current.plan.challenge2,
      interviewSummary: applyInterviewSummary ? draft.interviewSummary ?? current.plan.interviewSummary : current.plan.interviewSummary,
      issueGoals: applyIssueGoals ? normalizeIssueGoals(draft.issueGoals) ?? current.plan.issueGoals : current.plan.issueGoals,
      roadmapDirection: applyIssueGoals || applyRoadmap ? draft.roadmapDirection ?? current.plan.roadmapDirection : current.plan.roadmapDirection,
      roadmapNotes: applyRoadmap ? draft.roadmapNotes ?? current.plan.roadmapNotes : current.plan.roadmapNotes,
      secondInterview: {
        ...current.plan.secondInterview,
        resultSummary: applySecondInterview
          ? draft.interviewSummary ?? draft.interviewResultSummary ?? current.plan.secondInterview.resultSummary
          : current.plan.secondInterview.resultSummary,
        futurePlans: applySecondInterview ? draft.roadmapDirection ?? current.plan.secondInterview.futurePlans : current.plan.secondInterview.futurePlans
      }
    }
  };
}

export function mergeModuleContentUpdate(module: TrainingModule, update: AiModuleUpdate): TrainingModule {
  return {
    ...module,
    programName: update.programName ?? module.programName,
    schoolVoice: update.schoolVoice ?? module.schoolVoice,
    editableProgram: update.editableProgram ?? module.editableProgram,
    expectedEffect: update.expectedEffect ?? module.expectedEffect,
    materials: update.materials ?? module.materials
  };
}

function normalizeIssueGoals(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const issueGoals = [
    { issue: "", goal: "" },
    { issue: "", goal: "" },
    { issue: "", goal: "" }
  ];
  value.slice(0, 3).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    issueGoals[index] = { issue: String((item as any).issue ?? ""), goal: String((item as any).goal ?? "") };
  });
  return issueGoals;
}
