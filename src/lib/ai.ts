import type { AiDraftRequest, AiDraftResponse } from "../types";
import { postJson } from "./api";

export async function generateAiDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
  return postJson<AiDraftResponse>("/api/generate-ai-draft", compactRequest(request));
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
