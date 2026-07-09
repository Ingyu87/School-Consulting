import Papa from "papaparse";
import type {
  DistributionQuestion,
  ModuleScore,
  OpenEndedQuestion,
  ParsedDiagnosisProject
} from "../../types";
import { defaultModules } from "../../data/modules";
import { scoreStage } from "../diagnosis";

const moduleNamePattern = /^(\d+)\.\s+(.+)$/;

export async function parseDiagnosisCsv(file: File): Promise<ParsedDiagnosisProject> {
  const text = await readCsvText(file);
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false
  });
  const rows = parsed.data.map((row) => row.map((cell) => normalizeCell(cell)));
  const schoolName = detectSchoolName(file.name, rows);
  const moduleScores = parseModuleScores(rows);
  const infrastructureDistributions = parseDistributions(rows);
  const openEndedQuestions = parseOpenEnded(rows);
  const parseWarnings: string[] = [];

  if (moduleScores.length === 0 && !rows.some((row) => row.join(" ").includes("STEP1. 사전 자가진단 종합 분석표"))) {
    parseWarnings.push("STEP1 마커를 찾지 못했습니다. 과정별 점수 추출이 제한될 수 있습니다.");
  }
  if (moduleScores.length === 0) {
    parseWarnings.push("과정별 평균 점수를 찾지 못했습니다. CSV 양식 또는 평균 열 위치를 확인해주세요.");
  }

  return {
    schoolName,
    sourceFileName: file.name,
    rawRows: rows,
    moduleScores,
    infrastructureDistributions,
    openEndedQuestions,
    parseWarnings
  };
}

function readCsvText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let text = new TextDecoder("utf-8").decode(buffer);
      if (hasMojibake(text)) {
        try {
          text = new TextDecoder("euc-kr").decode(buffer);
        } catch {
          text = new TextDecoder("utf-8").decode(buffer);
        }
      }
      resolve(text.replace(/^\uFEFF/, ""));
    };
    reader.readAsArrayBuffer(file);
  });
}

function hasMojibake(text: string) {
  return /�|Ã|ì|ê|í/.test(text.slice(0, 2000));
}

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function detectSchoolName(fileName: string, rows: string[][]) {
  const cleanName = fileName.replace(/\.[^.]+$/, "");
  const directSchoolName = cleanName.match(/서울[가-힣A-Za-z0-9]+초/);
  if (directSchoolName?.[0]) return directSchoolName[0];

  const fileMatch = cleanName.match(/(?:\]\s*)?([^_\-]+?)_사전\s*자가진단\s*분석/);
  if (fileMatch?.[1]) return tidySchoolName(fileMatch[1]);

  const anyCell = rows.flat().find((cell) => cell.includes("찾아가는 학교 컨설팅"));
  const rowMatch = anyCell?.match(/컨설팅\s+(.+?)(?:\s|$)/);
  if (rowMatch?.[1]) return tidySchoolName(rowMatch[1]);

  return "새 학교";
}

function tidySchoolName(value: string) {
  return value
    .replace(/^\['?\d+_서울\]?/, "")
    .replace(/[<>]/g, "")
    .replace(/등학교.*$/, "")
    .replace(/\s+/g, "")
    .trim();
}

function parseModuleScores(rows: string[][]) {
  const scores: ModuleScore[] = [];
  for (const row of rows) {
    const moduleCell = row.find((cell) => moduleNamePattern.test(cell));
    if (!moduleCell) continue;
    const match = moduleCell.match(moduleNamePattern);
    const score = findTrailingScore(row);
    if (!match || score == null) continue;
    const moduleId = Number(match[1]);
    if (moduleId < 0 || moduleId > 7) continue;
    const question = row.find((cell) => /귀하|귀교/.test(cell) && cell.includes("?"));
    if (!question) continue;
    const standardName = defaultModules.find((module) => module.id === moduleId)?.name ?? match[2];
    scores.push({
      moduleId,
      moduleName: standardName,
      question,
      score,
      stage: scoreStage(score)
    });
  }
  const standardScores = dedupeByModule(scores);
  return standardScores.length > 0 ? standardScores : parseSectionModuleScores(rows);
}

/**
 * 문항 단위(예: 서울가동초 자가점검표) CSV용 대체 파서.
 * 각 문항 행의 첫 칸에는 그 문항이 속한 섹션 라벨이 새 섹션의 첫 행에만 한 번 적혀 있고
 * ("모듈명\n (SECTION N)"), 이후 같은 섹션에 속한 문항 행들은 첫 칸이 비어 있다.
 * 행 뒤쪽에는 "관련 있는 다른 섹션 이름 + 그 섹션 평균"을 참고용으로 끼워 넣은 셀도 있는데,
 * 이 참고 셀도 (SECTION N) 패턴과 일치하므로 행 전체를 훑으면 엉뚱한 섹션으로 오귀속된다.
 * 그래서 반드시 첫 칸만 섹션 경계로 인정하고, 문항 자체 점수(행의 마지막 0~5 숫자)를
 * 섹션별로 모아 평균을 낸다.
 */
function parseSectionModuleScores(rows: string[][]) {
  const groups = new Map<number, { scores: number[]; firstQuestion: string }>();
  let currentModuleId: number | null = null;

  for (const row of rows) {
    const sectionMatch = (row[0] ?? "").match(/\(SECTION\s+(\d+)\)/i);
    if (sectionMatch) {
      const moduleId = Number(sectionMatch[1]) - 2;
      currentModuleId = Number.isInteger(moduleId) && moduleId >= 0 && moduleId <= 7 ? moduleId : null;
    }
    if (currentModuleId == null) continue;

    const question = row.find((cell) => /귀하|귀교/.test(cell) && cell.includes("?"));
    const score = findTrailingScore(row);
    if (!question || score == null) continue;

    const group = groups.get(currentModuleId);
    if (group) {
      group.scores.push(score);
    } else {
      groups.set(currentModuleId, { scores: [score], firstQuestion: question });
    }
  }

  const scores: ModuleScore[] = [];
  for (const [moduleId, group] of groups) {
    const average = Math.round((group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length) * 100) / 100;
    const standardName = defaultModules.find((module) => module.id === moduleId)?.name ?? `모듈${moduleId}`;
    scores.push({
      moduleId,
      moduleName: standardName,
      question: group.firstQuestion,
      score: average,
      stage: scoreStage(average)
    });
  }
  return dedupeByModule(scores);
}

function findTrailingScore(row: string[]) {
  const numeric = row
    .map((cell) => Number(cell))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 5);
  return numeric.length > 0 ? numeric[numeric.length - 1] : null;
}

function dedupeByModule(scores: ModuleScore[]) {
  const byId = new Map<number, ModuleScore>();
  for (const score of scores) {
    if (!byId.has(score.moduleId)) byId.set(score.moduleId, score);
  }
  return [...byId.values()].sort((a, b) => a.moduleId - b.moduleId);
}

function parseDistributions(rows: string[][]) {
  const distributions: DistributionQuestion[] = [];
  let current: DistributionQuestion | null = null;

  for (const row of rows) {
    const question = row.find((cell) => cell.length > 18 && (cell.includes("?") || cell.includes("작성")));
    const resultIndex = row.findIndex((cell) => cell === "결과");
    const ratioIndex = row.findIndex((cell) => cell === "비율");

    if (question && !question.includes("귀하는")) {
      current = { question, options: [] };
      distributions.push(current);
    }

    if (!current || resultIndex >= 0 || ratioIndex >= 0) continue;

    const label = row.find((cell) => cell && !cell.includes("?") && Number.isNaN(Number(cell)));
    const ratio = row.map(parseRatio).find((value) => value != null);
    if (label && ratio != null && current.options.every((item) => item.label !== label)) {
      current.options.push({ label, ratio });
    }
  }

  return distributions.filter((item) => item.options.length > 0).slice(0, 8);
}

function parseRatio(value: string) {
  const cleaned = value.replace("%", "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  if (value.includes("%")) return parsed;
  if (parsed > 0 && parsed <= 1) return parsed * 100;
  if (parsed > 1 && parsed <= 100) return parsed;
  return null;
}

function parseOpenEnded(rows: string[][]) {
  const openEnded: OpenEndedQuestion[] = [];
  for (const row of rows) {
    const isOpen = row.some((cell) => cell.includes("서술형"));
    if (!isOpen) continue;
    const question = row.find((cell) => cell.length > 18) ?? "서술형 문항";
    const responses = row
      .filter((cell) => cell.length > 0 && !cell.includes("서술형") && cell !== question)
      .slice(-5);
    openEnded.push({ question, responses });
  }
  return openEnded;
}
