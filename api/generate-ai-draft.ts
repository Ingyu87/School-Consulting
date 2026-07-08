import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).send("Method Not Allowed");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).send("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const result = await ai.models.generateContent({
      model,
      contents: buildPrompt(body),
      config: {
        temperature: 0.35,
        responseMimeType: "application/json"
      }
    });

    const text = result.text ?? "{}";
    return response.status(200).json(parseJson(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 초안 생성 중 오류가 발생했습니다.";
    return response.status(500).send(message);
  }
}

function buildPrompt(body: any) {
  const safeBody = {
    task: body?.task,
    schoolName: body?.schoolName,
    moduleScores: body?.project?.moduleScores ?? [],
    infrastructureDistributions: body?.project?.infrastructureDistributions ?? [],
    openEndedQuestions: body?.project?.openEndedQuestions ?? [],
    modules: (body?.modules ?? []).map((module: any) => ({
      id: module.id,
      name: module.name,
      required: module.required,
      selected: module.selected,
      target: module.target,
      hours: module.hours,
      date: module.date,
      time: module.time,
      place: module.place,
      method: module.method,
      topic: module.topic,
      description: module.description,
      editableProgram: module.editableProgram,
      expectedEffect: module.expectedEffect,
      materials: module.materials
    })),
    interview: body?.interview ?? {},
    plan: body?.plan ?? {}
  };

  return `너는 초등학교 찾아가는 학교 컨설팅 운영계획서 작성 보조자다.

반드시 지킬 원칙:
- 한국어 공식 문서체로 쓴다.
- 모든 내용은 초안이며, 확정처럼 쓰지 않는다.
- PDF 공식 운영 기준에 없는 운영 가능/불가를 단정하지 않는다.
- CSV 일정은 확정 일정으로 쓰지 않는다.
- 심층면담 장소는 반드시 학교명과 같은 학교로 둔다.
- 식사, 다과, 직무이수, 온라인 가능 여부는 주어진 기준 안에서만 조심스럽게 표현한다.
- 개인정보, 연락처, 계정 ID를 만들거나 추정하지 않는다.
- 진단 분석은 단조로운 점수 나열이 아니라 강점, 보완 영역, 면담 확인 질문, 연수 구성 연결까지 포함한다.
- 최종 학교 스케줄표를 만들 수 있도록 선택 모듈에는 차시, 방식, 장소, 주제, 세부 프로그램, 기대효과를 채운다.
- 날짜와 시간은 입력 데이터에 없으면 임의 날짜를 만들지 말고 빈 문자열로 둔다.

공식 운영 기준:
- 총 5개 과정, 12차시 이상 의무 개설
- 필수 과정은 모듈0과 모듈7이며 각 1차시
- 필수 제외 최대 15차시, 필수 포함 최대 17차시
- 모듈1, 모듈2, 모듈3 합계는 최대 5차시
- 교원 대상 연수는 최소 2차시 이상
- 오프라인 원칙, 부득이한 경우 전체 30% 이내에서 모듈1~6 온라인 가능
- 학부모, 학생, 온라인 연수는 식사/다과 미제공
- 식사 시간은 연수 차시에 포함하지 않음

요청 작업: ${safeBody.task}

반드시 아래 JSON 객체만 반환한다. 마크다운 코드블록은 쓰지 않는다.
{
  "diagnosisInsight": "운영계획서 Ⅰ장에 들어갈 2~4문단 분석 초안",
  "strengths": "학교 강점 초안",
  "challenges": "도전 과제 초안",
  "interviewNotes": "심층면담 기타 고려사항 초안. 장소는 ${safeBody.schoolName}로 명시",
  "interviewResultSummary": "심층면담 결과 핵심 요약 초안",
  "interviewSummary": "운영계획서용 심층면담 결과 요약 초안",
  "roadmapNotes": "로드맵 및 기대효과 초안",
  "moduleUpdates": [
    {
      "id": 0,
      "selected": true,
      "hours": 1,
      "date": "",
      "time": "",
      "place": "${safeBody.schoolName}",
      "method": "오프라인",
      "topic": "희망 주제",
      "editableProgram": "세부 프로그램 초안",
      "expectedEffect": "기대효과",
      "materials": "준비물/확인사항"
    }
  ],
  "warnings": ["확인 필요 사항"]
}

입력 데이터:
${JSON.stringify(safeBody, null, 2)}`;
}

function parseJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(trimmed);
}
