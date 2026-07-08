import { saveAs } from "file-saver";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import type { AppState, TrainingModule } from "../../types";
import { buildInsights } from "../diagnosis";

const navy = "17296B";
const gray = "F3F5F8";

export async function downloadInterviewDocx(state: AppState) {
  const schoolName = state.project?.schoolName ?? "새학교";
  const doc = new Document({
    sections: [
      {
        children: [
          title(`${schoolName} 심층면담지`),
          kvTable([
            ["심층면담 일시", state.interview.dateTime],
            ["참여 코디네이터", state.interview.coordinators],
            ["참여 교원", state.interview.participants],
            ["면담 핵심 결과", state.interview.resultSummary]
          ]),
          section("필수 안내 확인"),
          ...bullets([
            "사전/사후 자가진단 설문조사 운영 지원",
            "연수 대상자 정보 등록 처리 필수",
            "모듈별 참여자 집계 및 전달",
            "참여 후기 수집 지원",
            "연수 후 학교 변화 모니터링 자문"
          ]),
          section("희망 연수 일정 및 모듈 구성"),
          moduleTable(state.modules.filter((module) => module.selected)),
          section("기타 고려사항"),
          body(state.interview.notes || " ")
        ]
      }
    ]
  });
  await saveDocument(doc, `${schoolName}_심층면담지_${today()}.docx`);
}

export async function downloadPlanDocx(state: AppState) {
  const schoolName = state.project?.schoolName ?? "새학교";
  const insights = buildInsights(state.project?.moduleScores ?? []);
  const doc = new Document({
    sections: [
      {
        children: [
          title(`${schoolName} 운영계획서`),
          section("Ⅰ. 우리학교 디지털 기반 교육 현황 알아보기"),
          body(state.plan.editedInsights || insights.draft),
          scoreTable(state.project?.moduleScores ?? []),
          section("Ⅱ. 강점과 도전 과제"),
          kvTable([
            ["강점", state.plan.strengths],
            ["도전 과제", state.plan.challenges]
          ]),
          section("Ⅲ. 심층면담 결과 핵심 요약"),
          body(state.plan.interviewSummary || state.interview.resultSummary || " "),
          section("Ⅳ. 우리학교 디지털 혁신 로드맵"),
          moduleTable(state.modules.filter((module) => module.selected)),
          section("과정별 기대효과"),
          body(state.plan.roadmapNotes || " ")
        ]
      }
    ]
  });
  await saveDocument(doc, `${schoolName}_운영계획서_${today()}.docx`);
}

function title(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [new TextRun({ text, bold: true, size: 34, color: navy })]
  });
}

function section(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: navy })]
  });
}

function body(text: string) {
  return new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text, size: 20 })]
  });
}

function bullets(items: string[]) {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: item, size: 20 })]
      })
  );
}

function kvTable(rows: [string, string][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            cell(label, true, 25),
            cell(value || " ", false, 75)
          ]
        })
    )
  });
}

function moduleTable(modules: TrainingModule[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["과정", "차시", "대상", "일정", "세부 프로그램", "기대효과"].map((label) => cell(label, true))
      }),
      ...modules.map(
        (module) =>
          new TableRow({
            children: [
              cell(`${module.id}. ${module.name}`),
              cell(String(module.hours)),
              cell(module.target),
              cell([module.date, module.time, module.place].filter(Boolean).join(" / ")),
              cell(module.editableProgram || module.defaultProgram || module.topic),
              cell(module.expectedEffect)
            ]
          })
      )
    ]
  });
}

function scoreTable(scores: NonNullable<AppState["project"]>["moduleScores"]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: ["과정", "평균", "단계"].map((label) => cell(label, true)) }),
      ...scores.map(
        (score) =>
          new TableRow({
            children: [cell(`${score.moduleId}. ${score.moduleName}`), cell(score.score.toFixed(2)), cell(score.stage)]
          })
      )
    ]
  });
}

function cell(text: string, header = false, width?: number) {
  return new TableCell({
    shading: header ? { fill: gray } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" }
    },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || " ", bold: header, size: 18, color: header ? navy : "111827" })]
      })
    ]
  });
}

async function saveDocument(doc: Document, fileName: string) {
  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}
