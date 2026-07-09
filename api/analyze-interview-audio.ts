import { GoogleGenAI } from "@google/genai";
import { DEFAULT_MODEL, generateContentWithFallback } from "./_lib/gemini";
import { checkRateLimit } from "./_lib/rate-limit";

/**
 * 심층면담 녹음 처리 API.
 * - mode: "transcribe" → 오디오 구간 1개를 전사만 한다. (긴 면담은 클라이언트가 구간으로 나눠 보낸다)
 * - mode: "summarize"  → 누적 전사문 텍스트를 받아 심층면담지/운영계획서용 문단을 작성한다.
 */
export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).send("Method Not Allowed");
  }
  if (!checkRateLimit(request, response, "analyze-interview-audio")) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).send("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const mode = body?.mode === "summarize" ? "summarize" : "transcribe";
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (mode === "transcribe") {
      if (!body?.audioBase64) return response.status(400).send("audioBase64가 없습니다.");
      const result = await generateContentWithFallback(
        ai,
        {
          contents: [
            {
              role: "user",
              parts: [
                { text: transcribePrompt(body.segmentIndex) },
                {
                  inlineData: {
                    mimeType: body.mimeType || "audio/webm",
                    data: body.audioBase64
                  }
                }
              ]
            }
          ],
          config: { temperature: 0.1, responseMimeType: "application/json" }
        },
        model
      );
      return response.status(200).json(parseJson(result.text ?? "{}"));
    }

    if (!body?.transcript) return response.status(400).send("transcript가 없습니다.");
    const result = await generateContentWithFallback(
      ai,
      {
        contents: summarizePrompt(String(body.transcript), body.context ?? {}),
        config: { temperature: 0.25, responseMimeType: "application/json" }
      },
      model
    );
    return response.status(200).json(parseJson(result.text ?? "{}"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "심층면담 음성 분석 중 오류가 발생했습니다.";
    return response.status(500).send(message);
  }
}

function transcribePrompt(segmentIndex: unknown) {
  return `너는 초등학교 찾아가는 학교 컨설팅 심층면담 녹음 전사자다.
첨부된 오디오는 긴 면담 중 ${typeof segmentIndex === "number" ? `${segmentIndex + 1}번째` : "한"} 구간이다.

원칙:
- 들리는 내용을 한국어로 정리된 전사문으로 작성한다. 화자가 구분되면 "코디:", "학교:" 정도로만 표기한다.
- 들리지 않는 부분은 (청취 불가)로 표기하고 내용을 지어내지 않는다.
- 개인정보성 연락처, 계정, 휴대폰 번호는 결과에 쓰지 않는다.

반드시 아래 JSON 객체만 반환한다. 마크다운 코드블록은 쓰지 않는다.
{ "transcript": "이 구간의 전사문" }`;
}

function summarizePrompt(transcript: string, context: any) {
  return `너는 초등학교 찾아가는 학교 컨설팅 심층면담 기록 정리자다.
아래 전체 면담 전사문과 학교 컨설팅 맥락을 결합해 심층면담지와 운영계획서에 들어갈 내용을 작성한다.

반드시 지킬 원칙:
- 한국어 공식 문서체로 쓴다.
- 면담에서 확인된 내용과 맥락으로 추론 가능한 내용만 쓴다.
- 확인되지 않은 일정, 식사, 다과, 직무이수 가능 여부를 단정하지 않는다.
- 개인정보성 연락처, 계정, 휴대폰 번호는 결과에 쓰지 않는다.
- 기타 고려사항은 선행 수준 / 인프라 환경(인적·물적) / 학교 측 별도 요청사항 / 기타 확인 필요사항 네 구분으로 나누어 작성한다.
- 면담 핵심 결과는 학교 목표, 주요 논의사항, 연수 구성과의 연결을 포함한다.

반드시 아래 JSON 객체만 반환한다. 마크다운 코드블록은 쓰지 않는다.
{
  "priorLevel": "선행 수준 확인 내용",
  "infraConsiderations": "인프라 환경(인적/물적) 고려사항",
  "schoolRequests": "학교 측 별도 요청사항",
  "additionalChecks": "기타 확인 필요사항",
  "participationGoal": "면담 대상 학교의 연수 참여 목표 요약",
  "resultSummary": "심층면담지 면담 핵심 결과에 들어갈 문단",
  "planInterviewSummary": "운영계획서 심층면담 결과 요약에 들어갈 문단",
  "followUpQuestions": ["추가 확인 질문"]
}

학교 및 사전 작성 맥락:
${JSON.stringify(context, null, 2)}

전체 면담 전사문:
${transcript}`;
}

function parseJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonText = extractFirstJsonObject(trimmed);
    if (!jsonText) throw new Error("AI 응답을 JSON으로 해석하지 못했습니다. 다시 시도해주세요.");
    return JSON.parse(jsonText);
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return "";
}
