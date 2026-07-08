import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).send("Method Not Allowed");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return response.status(500).send("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    if (!body?.audioBase64) return response.status(400).send("audioBase64가 없습니다.");

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildPrompt(body.context ?? {}) },
            {
              inlineData: {
                mimeType: body.mimeType || "audio/webm",
                data: body.audioBase64
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.25,
        responseMimeType: "application/json"
      }
    });

    return response.status(200).json(parseJson(result.text ?? "{}"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "심층면담 음성 분석 중 오류가 발생했습니다.";
    return response.status(500).send(message);
  }
}

function buildPrompt(context: any) {
  return `너는 초등학교 찾아가는 학교 컨설팅 심층면담 기록 정리자다.

음성 파일을 전사하고, 아래 학교 컨설팅 맥락과 결합해 심층면담지에 들어갈 내용을 작성한다.

반드시 지킬 원칙:
- 한국어 공식 문서체로 쓴다.
- 면담에서 확인된 내용과 맥락으로 추론 가능한 내용만 쓴다.
- 확인되지 않은 일정, 식사, 다과, 직무이수 가능 여부를 단정하지 않는다.
- 개인정보성 연락처, 계정, 휴대폰 번호는 결과에 쓰지 않는다.
- "고려사항"은 선행 수준, 인프라, 학교 요청사항, 추가 확인 필요사항 중심으로 정리한다.
- "면담 핵심결과"는 학교 목표, 주요 논의사항, 연수 구성과의 연결을 포함한다.

반드시 아래 JSON 객체만 반환한다. 마크다운 코드블록은 쓰지 않는다.
{
  "transcript": "정리된 전사문",
  "considerations": "심층면담지 기타 고려사항에 들어갈 문단",
  "resultSummary": "심층면담지 면담 핵심 결과에 들어갈 문단",
  "planInterviewSummary": "운영계획서 심층면담 결과 요약에 들어갈 문단",
  "followUpQuestions": ["추가 확인 질문"]
}

학교 및 사전 작성 맥락:
${JSON.stringify(context, null, 2)}`;
}

function parseJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed);
}
