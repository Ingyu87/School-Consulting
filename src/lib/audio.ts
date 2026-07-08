import type { AppState, InterviewAudioSummary } from "../types";
import { postJson } from "./api";

/** 녹음 구간 1개를 전사한다. 구간 분할은 Vercel 함수 요청 크기 제한(약 4.5MB) 때문에 필수다. */
export async function transcribeInterviewSegment(audio: Blob, segmentIndex: number): Promise<string> {
  const audioBase64 = await blobToBase64(audio);
  const result = await postJson<{ transcript?: string }>("/api/analyze-interview-audio", {
    mode: "transcribe",
    segmentIndex,
    audioBase64,
    mimeType: audio.type || "audio/webm"
  });
  return result.transcript ?? "";
}

/** 누적 전사문을 받아 심층면담지/운영계획서용 문단을 작성한다. */
export async function summarizeInterviewTranscript(transcript: string, state: AppState): Promise<InterviewAudioSummary> {
  return postJson<InterviewAudioSummary>("/api/analyze-interview-audio", {
    mode: "summarize",
    transcript,
    context: buildContext(state)
  });
}

function buildContext(state: AppState) {
  return {
    schoolName: state.project?.schoolName ?? "새 학교",
    diagnosisSummary: state.plan.editedInsights,
    diagnosisImplications: state.plan.diagnosisImplications ?? {},
    strengths: [state.plan.strength1, state.plan.strength2].filter(Boolean),
    challenges: [state.plan.challenge1, state.plan.challenge2].filter(Boolean),
    goals: [...state.interview.goals, state.interview.goalEtc].filter(Boolean),
    school: state.school,
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
        mainTool: module.mainTool,
        topic: module.topic,
        editableProgram: module.editableProgram,
        expectedEffect: module.expectedEffect
      }))
  };
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
