import type { AppState, InterviewAudioAnalysisResponse } from "../types";

export async function analyzeInterviewAudio(audio: Blob, state: AppState): Promise<InterviewAudioAnalysisResponse> {
  const audioBase64 = await blobToBase64(audio);
  const response = await fetch("/api/analyze-interview-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType: audio.type || "audio/webm",
      context: {
        schoolName: state.project?.schoolName ?? "새 학교",
        diagnosisSummary: state.plan.editedInsights,
        diagnosisImplications: state.plan.diagnosisImplications ?? {},
        strengths: [state.plan.strength1, state.plan.strength2].filter(Boolean),
        challenges: [state.plan.challenge1, state.plan.challenge2].filter(Boolean),
        modules: state.modules
          .filter((module) => module.selected)
          .map((module) => ({
            id: module.id,
            name: module.name,
            target: module.target,
            hours: module.hours,
            date: module.date,
            time: module.time,
            place: module.place,
            method: module.method,
            topic: module.topic,
            editableProgram: module.editableProgram,
            expectedEffect: module.expectedEffect
          }))
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "심층면담 음성 분석에 실패했습니다.");
  }

  return response.json() as Promise<InterviewAudioAnalysisResponse>;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}
