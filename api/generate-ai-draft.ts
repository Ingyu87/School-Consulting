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
    school: body?.school ?? {},
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
      headcount: module.headcount,
      method: module.method,
      mainTool: module.mainTool,
      topic: module.topic,
      programName: module.programName,
      schoolVoice: module.schoolVoice,
      description: module.description,
      editableProgram: module.editableProgram,
      expectedEffect: module.expectedEffect,
      materials: module.materials
    })),
    interview: body?.interview ?? {},
    plan: body?.plan ?? {}
  };

  return `너는 초등학교 찾아가는 학교 컨설팅 심층면담지·운영계획서 작성 보조자다.

반드시 지킬 원칙:
- 한국어 공식 문서체로 쓴다.
- 모든 내용은 초안이며, 확정처럼 쓰지 않는다.
- PDF 공식 운영 기준에 없는 운영 가능/불가를 단정하지 않는다.
- CSV 일정은 확정 일정으로 쓰지 않는다.
- 심층면담 장소는 반드시 학교명과 같은 학교로 둔다.
- 식사, 다과, 직무이수, 온라인 가능 여부는 주어진 기준 안에서만 조심스럽게 표현한다.
- 개인정보, 연락처, 계정 ID를 만들거나 추정하지 않는다.
- 진단 분석은 단조로운 점수 나열이 아니라 강점, 보완 영역, 면담 확인 질문, 연수 구성 연결까지 포함한다.
- 요청 작업이 diagnosis인 경우 CSV의 과정별 점수, 단계, 인프라 응답, 서술형 응답을 근거로 모듈별 시사점과 우리학교 강점 1·2, 도전과제 1·2, 이슈→목표 3쌍을 작성한다.
- 모듈별 시사점은 점수만 반복하지 말고 해당 모듈이 연수 구성과 심층면담 확인 질문으로 어떻게 이어지는지 적는다.
- issueGoals는 진단 점수·인프라 응답·학교 요구를 종합해 학교의 이슈 사항 → 연수로 해결할 목표를 도출하고, 연수 기획과 논리적으로 이어지게 한다.
- 요청 작업이 interview-plan인 경우 이미 작성된 운영계획, 선택된 연수 구성, 스케줄, 진단 시사점을 바탕으로 심층면담지의 기타 고려사항(선행 수준/인프라/학교 요청/기타 확인 네 구분)과 면담 핵심 결과, 연수 참여 목표 요약, 이슈→목표, 로드맵 방향을 작성한다.
- 요청 작업이 interview-plan인 경우 새로운 차시, 일정, 장소를 만들지 말고 입력된 연수 구성과 운영계획을 요약·정리한다.
- 요청 작업이 module-content인 경우 차시, 방식, 일정, 시간, 장소, 인원, 희망 주제, 선택 여부는 절대 변경하지 않는다.
- 요청 작업이 module-content인 경우 사람이 입력한 희망 주제와 진단 결과를 바탕으로 프로그램명, 우리학교 목소리(해당 모듈과 관련해 면담·진단에서 확인된 학교의 요구 한두 문장), 세부 프로그램 초안, 기대효과, 준비물/확인사항만 작성한다.
- 날짜와 시간은 어떤 경우에도 임의로 만들지 않는다.

공식 운영 기준:
- 총 5개 과정, 12차시 이상 의무 개설 (필수과정 2개 + 선택과정 3개)
- 필수 과정은 모듈0과 모듈7이며 각 1차시, 모듈0은 최초·모듈7은 마지막 운영
- 필수 제외 최대 15차시, 필수 포함 최대 17차시
- 모듈1, 모듈2, 모듈3 합계는 최대 5차시
- 교원 대상 연수는 모듈 단위로 최소 2차시 이상
- 오프라인 원칙, 부득이한 경우 전체 30% 이내에서 모듈1~6 온라인 가능
- 학부모, 학생, 온라인 연수는 식사/다과 미제공
- 식사 시간은 연수 차시에 포함하지 않음

요청 작업: ${safeBody.task}

반드시 아래 JSON 객체만 반환한다. 요청 작업과 관련 없는 키는 생략해도 된다. 마크다운 코드블록은 쓰지 않는다.
{
  "diagnosisInsight": "운영계획서 Ⅰ장에 들어갈 2~4문단 분석 초안",
  "diagnosisImplications": {
    "0": "모듈0 시사점", "1": "모듈1 시사점", "2": "모듈2 시사점", "3": "모듈3 시사점",
    "4": "모듈4 시사점", "5": "모듈5 시사점", "6": "모듈6 시사점", "7": "모듈7 시사점"
  },
  "strength1": "우리학교 강점 1 (첫 줄은 제목, 이후 · 로 시작하는 근거 2~3줄)",
  "strength2": "우리학교 강점 2",
  "challenge1": "도전 과제 1",
  "challenge2": "도전 과제 2",
  "priorLevel": "기타 고려사항 - 선행 수준 확인",
  "infraConsiderations": "기타 고려사항 - 인프라 환경(인적/물적) 고려사항. 장소는 ${safeBody.schoolName} 기준",
  "schoolRequests": "기타 고려사항 - 학교 측 별도 요청사항",
  "additionalChecks": "기타 고려사항 - 기타 확인 필요사항",
  "participationGoal": "면담 대상 학교의 연수 참여 목표 요약",
  "interviewResultSummary": "심층면담 결과 핵심 요약 초안",
  "interviewSummary": "운영계획서용 심층면담 결과 요약 초안",
  "issueGoals": [
    { "issue": "이슈 01", "goal": "목표 01" },
    { "issue": "이슈 02", "goal": "목표 02" },
    { "issue": "이슈 03", "goal": "목표 03" }
  ],
  "roadmapDirection": "우리학교 혁신 로드맵 방향 1~2문장",
  "roadmapNotes": "로드맵 및 기대효과 종합 초안",
  "moduleUpdates": [
    {
      "id": 0,
      "programName": "프로그램명(주제)",
      "schoolVoice": "우리학교 목소리",
      "editableProgram": "차시별 세부 프로그램 초안",
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
