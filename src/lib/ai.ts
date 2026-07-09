import type { AiDraftRequest, AiDraftResponse, AiModuleUpdate, IssueGoal } from "../types";
import { postJson } from "./api";

export async function generateAiDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
  const response = await postJson<AiDraftResponse>("/api/generate-ai-draft", compactRequest(request));
  return normalizeAiDraftResponse(response);
}

function compactRequest(request: AiDraftRequest): AiDraftRequest {
  return {
    ...request,
    project: request.project
      ? {
          ...request.project,
          rawRows: [],
          infrastructureDistributions: request.project.infrastructureDistributions.slice(0, 8),
          openEndedQuestions: request.project.openEndedQuestions.map((item) => ({
            ...item,
            responses: item.responses.slice(0, 8)
          }))
        }
      : null
  };
}

function normalizeAiDraftResponse(value: unknown): AiDraftResponse {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const response: AiDraftResponse = {};

  for (const key of [
    "diagnosisInsight",
    "strengths",
    "strength1",
    "strength2",
    "challenges",
    "challenge1",
    "challenge2",
    "priorLevel",
    "infraConsiderations",
    "schoolRequests",
    "additionalChecks",
    "participationGoal",
    "interviewResultSummary",
    "interviewSummary",
    "roadmapDirection",
    "roadmapNotes"
  ] as const) {
    const text = asText(raw[key]);
    if (text) response[key] = text;
  }

  if (raw.diagnosisImplications && typeof raw.diagnosisImplications === "object" && !Array.isArray(raw.diagnosisImplications)) {
    response.diagnosisImplications = Object.fromEntries(
      Object.entries(raw.diagnosisImplications as Record<string, unknown>)
        .map(([key, item]) => [key, asText(item)])
        .filter(([, item]) => item)
    );
  }

  const issueGoals = Array.isArray(raw.issueGoals) ? raw.issueGoals.map(normalizeIssueGoal).filter(Boolean) : [];
  if (issueGoals.length) response.issueGoals = issueGoals as IssueGoal[];

  const moduleUpdates = Array.isArray(raw.moduleUpdates) ? raw.moduleUpdates.map(normalizeModuleUpdate).filter(Boolean) : [];
  if (moduleUpdates.length) response.moduleUpdates = moduleUpdates as AiModuleUpdate[];

  return response;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIssueGoal(value: unknown): IssueGoal | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return { issue: asText(raw.issue), goal: asText(raw.goal) };
}

function normalizeModuleUpdate(value: unknown): AiModuleUpdate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = Number(raw.id);
  if (!Number.isInteger(id)) return null;
  const update: AiModuleUpdate = { id };
  for (const key of ["mainTool", "topic", "programName", "schoolVoice", "editableProgram", "expectedEffect", "materials"] as const) {
    const text = asText(raw[key]);
    if (text) update[key] = text;
  }
  if (raw.method === "온라인" || raw.method === "오프라인") update.method = raw.method;
  return update;
}
