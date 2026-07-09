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
    .replace(/등학교.*$/, "초")
    .replace(/\s+/g, "")
    .replace(/서울고일초초$/, "서울고일초")
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

function parseSectionModuleScores(rows: string[][]) {
  const scores: ModuleScore[] = [];
  for (const row of rows) {
    for (let sectionIndex = 0; sectionIndex < row.length; sectionIndex += 1) {
      if (!/\(SECTION\s+\d+\)/i.test(row[sectionIndex])) continue;

      const sectionMatch = row[sectionIndex].match(/\(SECTION\s+(\d+)\)/i);
      const sectionNumber = Number(sectionMatch?.[1]);
      const moduleId = sectionNumber - 2;
      if (!Number.isInteger(moduleId) || moduleId < 0 || moduleId > 7) continue;
      if (scores.some((score) => score.moduleId === moduleId)) continue;

      const score = findScoreAfter(row, sectionIndex);
      if (score == null) continue;

      const standardName = defaultModules.find((module) => module.id === moduleId)?.name ?? `모듈${moduleId}`;
      const question = row
        .slice(0, sectionIndex)
        .find((cell) => cell.length > 18 && (cell.includes("?") || cell.includes("까") || cell.includes("나요")));

      scores.push({
        moduleId,
        moduleName: standardName,
        question: question ?? `${standardName} 영역의 대표 문항`,
        score,
        stage: scoreStage(score)
      });
    }
  }
  return dedupeByModule(scores);
}

function findScoreAfter(row: string[], startIndex: number) {
  for (const cell of row.slice(startIndex + 1, startIndex + 4)) {
    const value = Number(cell);
    if (Number.isFinite(value) && value >= 0 && value <= 5) return value;
  }
  return null;
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
