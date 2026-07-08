import type { AiDraftRequest, AiDraftResponse } from "../types";

export async function generateAiDraft(request: AiDraftRequest): Promise<AiDraftResponse> {
  const response = await fetch("/api/generate-ai-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(compactRequest(request))
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "AI 초안 생성에 실패했습니다.");
  }

  return response.json() as Promise<AiDraftResponse>;
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
