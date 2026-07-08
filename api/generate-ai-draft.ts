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
        temperature: 0.25,
        responseMimeType: "application/json"
      }
    });

    const text = result.text ?? "{}";
    return response.status(200).json(parseJsonObject(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 초안 생성 중 오류가 발생했습니다.";
    return response.status(500).send(message);
  }
}

function buildPrompt(body: any) {
  const task = body?.task;
  const moduleId = body?.moduleId;
  const safeBody = {
    task,
    moduleId,
    schoolName: body?.schoolName,
    moduleScores: body?.project?.moduleScores ?? [],
    infrastructureDistributions: body?.project?.infrastructureDistributions ?? [],
    openEndedQuestions: body?.project?.openEndedQuestions ?? [],
    school: body?.school ?? {},
    modules: (body?.modules ?? [])
      .filter((module: any) => task !== "module-content" || moduleId === undefined || module.id === moduleId)
      .map((module: any) => ({
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

  return `You help write Korean elementary-school consulting documents for AI/digital education.

Return exactly one valid JSON object. Do not wrap it in markdown. Do not add explanations before or after JSON.

General rules:
- Write in polished Korean suitable for official school consulting drafts.
- Treat every generated sentence as a draft, not a confirmed fact.
- Do not invent dates, times, places, headcount, contacts, accounts, or personal information.
- Do not change user-entered schedule fields.
- If the school is in Seoul, refer to student digital devices as "디벗" when that wording is relevant.

Task rules:
- task "diagnosis": analyze module scores, stages, infrastructure/open-ended responses, and school needs. Produce:
  diagnosisInsight, diagnosisImplications for modules 0-7, strength1, strength2, challenge1, challenge2, issueGoals, roadmapDirection, roadmapNotes.
  Do not repeat survey questions as analysis. Convert scores and responses into implications.
- task "interview-plan": summarize and refine existing interview/plan content. Do not create new schedules.
- task "module-content": only write programName, schoolVoice, editableProgram, expectedEffect, materials for the provided module(s).
  Do not change hours, method, date, time, place, headcount, topic, selected.
  If moduleId is present, return exactly one moduleUpdates item for that moduleId.

Official operation constraints to respect in wording:
- Total training should be at least 12 hours across 5 courses: required modules 0 and 7 plus 3 selected courses.
- Module 0 and module 7 are required, each 1 hour. Module 0 is first; module 7 is last.
- Selected teacher courses should be at least 2 hours per module.
- Meals/snacks are mentioned only when explicitly allowed by the official guide.

JSON shape:
{
  "diagnosisInsight": "2-4 paragraph analysis draft",
  "diagnosisImplications": {
    "0": "module 0 implication",
    "1": "module 1 implication",
    "2": "module 2 implication",
    "3": "module 3 implication",
    "4": "module 4 implication",
    "5": "module 5 implication",
    "6": "module 6 implication",
    "7": "module 7 implication"
  },
  "strength1": "강점 01 title and 2-3 evidence bullets in prose",
  "strength2": "강점 02 title and 2-3 evidence bullets in prose",
  "challenge1": "과제 01 title and 2-3 evidence bullets in prose",
  "challenge2": "과제 02 title and 2-3 evidence bullets in prose",
  "priorLevel": "existing practice check draft",
  "infraConsiderations": "infrastructure considerations draft",
  "schoolRequests": "school request draft",
  "additionalChecks": "additional checks draft",
  "participationGoal": "participation goal draft",
  "interviewResultSummary": "interview result summary draft",
  "interviewSummary": "plan interview summary draft",
  "issueGoals": [
    { "issue": "issue 01", "goal": "goal 01" },
    { "issue": "issue 02", "goal": "goal 02" },
    { "issue": "issue 03", "goal": "goal 03" }
  ],
  "roadmapDirection": "roadmap direction",
  "roadmapNotes": "roadmap and expected effect summary",
  "moduleUpdates": [
    {
      "id": 0,
      "programName": "program name",
      "schoolVoice": "school voice",
      "editableProgram": "detailed program draft",
      "expectedEffect": "expected effect",
      "materials": "materials/checklist"
    }
  ],
  "warnings": []
}

Input data:
${JSON.stringify(safeBody, null, 2)}`;
}

function parseJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonText = extractFirstJsonObject(trimmed);
    if (!jsonText) {
      throw new Error("AI 응답을 JSON으로 해석하지 못했습니다. 다시 시도해주세요.");
    }
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
