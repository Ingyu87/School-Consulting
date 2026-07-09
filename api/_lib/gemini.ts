import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";
// 기본 모델 호출이 실패(모델 미존재, 일시적 배포 문제 등)하면 한 번 더 다른 모델로 재시도한다.
// 세 개의 AI API가 모두 같은 모델 하나에 의존하므로, 폴백이 없으면 모델 하나 문제로 전체 AI 기능이 멈춘다.
const FALLBACK_MODEL = "gemini-2.5-flash";

export async function generateContentWithFallback(ai: GoogleGenAI, params: Omit<GenerateContentParameters, "model">, primaryModel: string) {
  try {
    return await ai.models.generateContent({ ...params, model: primaryModel });
  } catch (primaryError) {
    if (primaryModel === FALLBACK_MODEL) throw primaryError;
    try {
      return await ai.models.generateContent({ ...params, model: FALLBACK_MODEL });
    } catch {
      throw primaryError;
    }
  }
}
