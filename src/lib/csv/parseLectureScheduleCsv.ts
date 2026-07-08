import Papa from "papaparse";
import type { AiModuleUpdate } from "../../types";

export type LectureScheduleImport = {
  schoolName: string;
  teacher: string;
  coordinators: string[];
  interviewDateTime: string;
  moduleUpdates: AiModuleUpdate[];
  notes: string[];
};

type HeaderColumn = {
  index: number;
  label: string;
  moduleId?: number;
  hours?: number;
};

export async function parseLectureScheduleCsv(file: File, preferredSchoolName?: string): Promise<LectureScheduleImport> {
  const text = await readCsvText(file);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const rows = parsed.data.map((row) => row.map(normalizeCell));
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell === "신청학교"));
  if (headerIndex < 0) throw new Error("강의종합 CSV에서 신청학교 헤더를 찾지 못했습니다.");

  const headers = rows[headerIndex].map((label, index) => parseHeader(label, index));
  const schoolRow = findSchoolRow(rows.slice(headerIndex + 1), preferredSchoolName);
  if (!schoolRow) throw new Error(`${preferredSchoolName ?? "해당 학교"} 행을 강의종합 CSV에서 찾지 못했습니다.`);

  const schoolName = schoolRow[0] || preferredSchoolName || "새 학교";
  const teacher = schoolRow[1] || "";
  const coordinators = [schoolRow[2], schoolRow[3], schoolRow[4]].filter(Boolean);
  const interviewDateTime = schoolRow[5] || "";
  const notes = [schoolRow[15], schoolRow[16], schoolRow[17]].filter(Boolean);
  const moduleUpdates = mergeModuleUpdates(
    headers
      .filter((header) => header.moduleId != null)
      .map((header) => parseModuleCell(header, schoolRow[header.index], schoolName))
      .filter((item): item is AiModuleUpdate => Boolean(item))
  );

  return {
    schoolName,
    teacher,
    coordinators,
    interviewDateTime,
    moduleUpdates,
    notes
  };
}

function parseHeader(label: string, index: number): HeaderColumn {
  const moduleMatch = label.match(/(?:선택|필수)?\(?(\d)\./);
  const hoursMatch = label.match(/(\d+)\s*차시/);
  return {
    index,
    label,
    moduleId: moduleMatch ? Number(moduleMatch[1]) : undefined,
    hours: hoursMatch ? Number(hoursMatch[1]) : undefined
  };
}

function findSchoolRow(rows: string[][], preferredSchoolName?: string) {
  const normalizedPreferred = preferredSchoolName ? normalizeSchool(preferredSchoolName) : "";
  return rows.find((row) => {
    const school = normalizeSchool(row[0] ?? "");
    if (!school) return false;
    if (!normalizedPreferred) return /초$/.test(school);
    return school === normalizedPreferred || school.includes(normalizedPreferred) || normalizedPreferred.includes(school);
  });
}

function parseModuleCell(header: HeaderColumn, value: string, schoolName: string): AiModuleUpdate | null {
  if (header.moduleId == null) return null;

  const normalized = value.trim();
  const isRequired = header.moduleId === 0 || header.moduleId === 7;
  if (!normalized) {
    return isRequired
      ? { id: header.moduleId, selected: true, hours: 1, place: schoolName }
      : null;
  }
  if (/^x$/i.test(normalized)) {
    return { id: header.moduleId, selected: isRequired, hours: isRequired ? 1 : header.hours, place: schoolName };
  }

  const hours = isRequired ? 1 : extractHours(normalized) ?? header.hours;
  const date = extractDate(normalized);
  const time = extractTime(normalized);
  const topic = cleanupTopic(normalized);

  return {
    id: header.moduleId,
    selected: true,
    hours,
    date,
    time,
    place: schoolName,
    method: "오프라인",
    topic: topic || undefined,
    materials: normalized
  };
}

function mergeModuleUpdates(updates: AiModuleUpdate[]) {
  const byId = new Map<number, AiModuleUpdate>();
  for (const update of updates) {
    const current = byId.get(update.id);
    if (!current) {
      byId.set(update.id, update);
      continue;
    }
    byId.set(update.id, {
      ...current,
      selected: current.selected || update.selected,
      hours: Math.max(current.hours ?? 0, update.hours ?? 0) || current.hours || update.hours,
      date: current.date || update.date,
      time: current.time || update.time,
      place: current.place || update.place,
      method: current.method || update.method,
      topic: [current.topic, update.topic].filter(Boolean).join(" / ") || undefined,
      materials: [current.materials, update.materials].filter(Boolean).join(" / ") || undefined
    });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function extractHours(value: string) {
  const match = value.match(/(\d+)\s*차시/);
  return match ? Number(match[1]) : undefined;
}

function extractDate(value: string) {
  const match = value.match(/\d{1,2}\.\s*\d{1,2}\.?\s*\([^)]+\)|\d{1,2}\.\s*\d{1,2}\.?|\d{1,2}\/\d{1,2}/);
  return match?.[0].replace(/\s+/g, " ").trim() ?? "";
}

function extractTime(value: string) {
  const match = value.match(/\d{1,2}:\d{2}(?:\s*~\s*\d{1,2}:\d{2})?/);
  return match?.[0].replace(/\s+/g, "") ?? "";
}

function cleanupTopic(value: string) {
  return value
    .replace(/\d{1,2}\.\s*\d{1,2}\.?\s*\([^)]+\)/g, "")
    .replace(/\d{1,2}\.\s*\d{1,2}\.?/g, "")
    .replace(/\d{1,2}:\d{2}(?:\s*~\s*\d{1,2}:\d{2})?/g, "")
    .replace(/\d+\s*차시/g, "")
    .replace(/^[,\s\-()]+|[,\s\-()]+$/g, "")
    .trim();
}

function readCsvText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let text = new TextDecoder("utf-8").decode(buffer);
      if (/�|Ã|ì|ê|í/.test(text.slice(0, 2000))) {
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

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function normalizeSchool(value: string) {
  return value.replace(/\s+/g, "").replace(/등학교$/, "초").trim();
}
