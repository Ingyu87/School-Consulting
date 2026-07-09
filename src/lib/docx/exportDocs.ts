import { saveAs } from "file-saver";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from "docx";
import type { AppState, ModuleScore, TrainingModule } from "../../types";
import { buildInsights, stageDescriptions } from "../diagnosis";
import {
  capabilityOptions,
  goalOptions,
  noticeItems,
  reactionOptions,
  submissionEmail
} from "../../data/officialOptions";

const navy = "17296B";
const gray = "F3F5F8";

const circledNumbers = ["①", "②", "③", "④", "⑤"];

// ─────────────────────────────────────────────
// 심층면담지: 심층면담지.pdf 섹션 순서 그대로 생성
// ─────────────────────────────────────────────
export async function downloadInterviewDocx(state: AppState) {
  const schoolName = state.project?.schoolName ?? "새학교";
  const { interview, school, modules } = state;
  const selected = modules.filter((module) => module.selected);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 720, bottom: 900, left: 720 }
          }
        },
        children: [
          title(`${schoolName} 찾아가는 학교 컨설팅 심층면담지`),
          section("[필수 안내] 학교 연수담당자 역할 사전 안내 및 동의 확인 / 코디네이터 셀프 점검"),
          table(
            [["구분", "내용", "안내 확인"]],
            noticeItems.map((item, index) => [item.title, item.detail, interview.noticeChecks[index] ? "안내 완료" : "미확인"]),
            [24, 60, 16]
          ),

          section("Ⅰ. 심층면담 운영 개요"),
          kvTable([
            ["심층면담 일시", interview.dateTime],
            ["리더 코디네이터", interview.leadCoordinator],
            ["코디네이터", interview.coordinator2],
            ["코디네이터", interview.coordinator3],
            ["운영기관 지원 담당자", interview.operationManager]
          ]),
          subLabel("참여 교원 (* 필수 기재)"),
          table(
            [["", "성명 *", "직책 *", "담당교과 *", "교육경력", "연락처 (이메일/내선 등)"]],
            interview.teachers.map((teacher, index) => [
              circledNumbers[index] ?? String(index + 1),
              teacher.name,
              teacher.role,
              teacher.subject,
              teacher.career,
              teacher.contact
            ]),
            [6, 20, 22, 16, 12, 24]
          ),

          section("Ⅱ. 학교 일반사항 및 인프라 현황"),
          kvTable([
            ["학교명", schoolName],
            ["권역", school.region],
            ["소재지", school.address],
            ["학교급", [school.schoolLevel, school.establishment, school.schoolCharacter].filter(Boolean).join(" / ")],
            ["선도학교", school.leadingSchool ? `선도학교 ${school.leadingSchool}` : ""],
            ["교원 수", school.teacherCount],
            ["교직원 수", school.staffCount],
            ["학급 수", school.classCount],
            ["학생 수", school.studentCount],
            ["교사용 기기 유형", [...school.teacherDeviceTypes, school.teacherDeviceEtc && `기타: ${school.teacherDeviceEtc}`].filter(Boolean).join(", ")],
            ["학생 1인당 보급 비율", school.studentDeviceRatio],
            ["기술적 애로사항", [...school.technicalIssues, school.technicalIssueEtc && `기타: ${school.technicalIssueEtc}`].filter(Boolean).join(", ")],
            ["디지털 교육 전환 관련 학교 예산 집행 현황", school.budgetStatus],
            ["기타 시설 및 인프라 관련 학교 특이사항", school.infrastructureNotes]
          ]),

          section("Ⅲ. 연수 참여 목표 및 학교의 변화 방향"),
          note("(인터뷰 방향) 본 사업 종료 후, 지속해서 이어가고자 하는 학교의 목표 점검"),
          kvTable([
            ...goalOptions.map((option): [string, string] => [interview.goals.includes(option) ? "[■]" : "[  ]", option]),
            [interview.goalEtc ? "[■]" : "[  ]", `기타 : ${interview.goalEtc}`]
          ], 10),

          section("Ⅳ. 교직원 디지털 친화도 및 역량 진단"),
          note("(인터뷰 방향) 인터뷰 대상자가 대답할 수 있는 사항 안에서 작성, 정확한 정보로 인식하지 않는다고 표현"),
          kvTable([
            ["구성원 디지털 활용 역량", checkboxLine(capabilityOptions, interview.digitalCapability)],
            ["디지털 교육 혁신 반응", checkboxLine(reactionOptions, interview.digitalReaction)],
            ["기타 디지털 친화도 및 개별 역량 관련 의견", interview.digitalNotes]
          ], 30),

          section("Ⅴ. 희망 연수 일정 및 모듈 구성"),
          note("필수모듈(2차시) 및 선택 모듈(3개 모듈 이상) 총 12차시 이상 구성 필수"),
          subLabel("① 희망 모듈 선정"),
          table(
            [["구분", "모듈", "대상", "선택"]],
            modules.map((module) => [
              module.required ? "필수모듈 (1차시)" : "선택모듈",
              `모듈${module.id} ${module.name}`,
              module.target,
              module.selected ? "선택" : "-"
            ]),
            [18, 46, 18, 18]
          ),
          subLabel("② 맞춤형 연수 기획"),
          ...interviewModulePlanBlocks(selected),
          subLabel("③ 기타 고려사항"),
          table(
            [["구분", "세부내용"]],
            [
              ["선행 수준 확인", interview.priorLevel],
              ["인프라 환경 (인적/물적) 고려사항", interview.infraConsiderations],
              ["학교 측 별도 요청사항", interview.schoolRequests],
              ["기타 확인 필요사항", interview.additionalChecks]
            ],
            [28, 72]
          ),

          section("Ⅵ. 심층면담 결과 핵심 요약"),
          note("(작성 방향) 전체 면담 결과 분석, 논의 주요 사항 및 학교 목표, 방향성에 대한 코멘트"),
          table(
            [["핵심 사항 요약", ""]],
            [
              ["면담 대상 학교의 연수 참여 목표", interview.participationGoal],
              ["면담 핵심 결과", interview.resultSummary]
            ],
            [28, 72]
          ),
          note("※ 심층면담 운영시 현장 사진 및 회의 참여자 서명부 수령 필수 (간식 제공 증빙자료)"),

          ...(interview.transcript
            ? [section("[참고] 면담 전사 기록"), ...bodyParagraphs(interview.transcript)]
            : []),

          note(`서류 제출처 : ${submissionEmail}`)
        ]
      }
    ]
  });
  await saveDocument(doc, `${schoolName}_심층면담지_${today()}.docx`);
}

// ─────────────────────────────────────────────
// 운영계획서: 운영계획서.pdf 섹션 순서 그대로 생성
// ─────────────────────────────────────────────
export async function downloadPlanDocx(state: AppState) {
  const schoolName = state.project?.schoolName ?? "새학교";
  const { interview, plan, modules } = state;
  const insights = buildInsights(state.project?.moduleScores ?? []);
  const selected = modules.filter((module) => module.selected);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 720, bottom: 900, left: 720 }
          }
        },
        children: [
          title(`${schoolName} 맞춤형 연수 운영계획서`),

          section("Ⅰ. 우리학교 디지털 기반 교육 현황 알아보기 – 자가진단설문조사 데이터 활용 작성"),
          ...bodyParagraphs(plan.editedInsights || insights.draft),
          ...infrastructureBlocks(state),
          subLabel("사전 진단 – 과정별 진단 분석 결과"),
          table(
            [["구분", "평균 점수", "단계", "자가 진단 분석 결과 및 시사점"]],
            (state.project?.moduleScores ?? []).map((score) => [
              `모듈${score.moduleId} ${score.moduleName}`,
              score.score.toFixed(2),
              score.stage,
              diagnosisDocxText(score, plan.diagnosisImplications?.[String(score.moduleId)] ?? "")
            ]),
            [22, 10, 8, 60]
          ),
          table(
            [["도약 단계", "만족 단계", "추월 단계"]],
            [
              ["3.8점 미만", "3.8점 – 4.6점 구간", "4.6점 이상"],
              [stageDescriptions["도약"], stageDescriptions["만족"], stageDescriptions["추월"]]
            ],
            [34, 33, 33]
          ),

          section("Ⅱ. 우리학교 강점과 디지털 기반 교육 혁신을 위한 도전 과제"),
          table(
            [["구분", "내용"]],
            [
              ["강점 01", plan.strength1 || plan.strengths],
              ["강점 02", plan.strength2],
              ["과제 01", plan.challenge1 || plan.challenges],
              ["과제 02", plan.challenge2]
            ],
            [14, 86]
          ),

          section("Ⅲ-1. 심층면담(1차) 결과 핵심 요약"),
          kvTable([
            ["심층면담 일시", interview.dateTime],
            ["리더 코디네이터", interview.leadCoordinator],
            ["코디네이터", interview.coordinator2],
            ["코디네이터", interview.coordinator3]
          ]),
          subLabel("참여 교원 (* 필수 기재)"),
          table(
            [["", "성명 *", "직책 *", "담당교과 *", "교육경력", "연락처"]],
            interview.teachers.map((teacher, index) => [
              circledNumbers[index] ?? String(index + 1),
              teacher.name,
              teacher.role,
              teacher.subject,
              teacher.career,
              teacher.contact
            ]),
            [6, 20, 22, 16, 12, 24]
          ),
          subLabel("참여 목표 및 변화 희망 방향"),
          kvTable([
            ...goalOptions.map((option): [string, string] => [interview.goals.includes(option) ? "[■]" : "[  ]", option]),
            [interview.goalEtc ? "[■]" : "[  ]", `기타 : ${interview.goalEtc}`]
          ], 10),
          subLabel("연수 구성 계획"),
          table(
            [modules.map((module) => `모듈 ${module.id}`)],
            [modules.map((module) => (module.required ? "필수" : module.selected ? "구성" : "-"))],
            modules.map(() => Math.floor(100 / modules.length))
          ),
          kvTable([
            ["면담 대상 학교의 연수 참여 목표", interview.participationGoal],
            ["면담 핵심 결과", plan.interviewSummary || interview.resultSummary]
          ], 28),

          section("Ⅲ-2. 심층면담(2차 이상) 결과 핵심 요약"),
          note("※ 2차 후속면담을 Zoom(온라인)으로 진행한 경우 활동 사진을 반드시 별도 첨부해 주세요."),
          kvTable([
            ["심층면담 일시", plan.secondInterview.dateTime],
            ["면담 핵심 결과", plan.secondInterview.resultSummary],
            ["향후 예정사항", plan.secondInterview.futurePlans]
          ], 22),

          section("Ⅳ. 심층면담 결과 몰아보기 – 이슈 → 목표 도출"),
          table(
            [["구분", "이슈 (우리학교 목소리)", "목표"]],
            plan.issueGoals.map((item, index) => [`이슈 0${index + 1}`, item.issue, item.goal]),
            [12, 44, 44]
          ),
          kvTable([["우리학교 혁신 로드맵 방향", plan.roadmapDirection]], 28),

          section("Ⅴ-1. 우리학교 디지털 혁신 로드맵 – 과정별 세부 프로그램 계획"),
          ...programPlanBlocks(modules, state.project?.moduleScores ?? []),

          section("Ⅴ-2. 우리학교 디지털 혁신 로드맵 – 우리학교 맞춤형 프로그램 계획(안)"),
          ...customProgramBlocks(selected, schoolName),

          section("과정별 기대효과 및 종합 의견"),
          ...bodyParagraphs(plan.roadmapNotes || " "),

          section("작성 후 제출 방법"),
          note(`서류 제출처 : ${submissionEmail} (리더 코디네이터는 면담일 기준 1차 초안을 운영기관 메일로 제출)`)
        ]
      }
    ]
  });
  await saveDocument(doc, `${schoolName}_운영계획서_${today()}.docx`);
}

// ─────────────────────────────────────────────
// 공통 빌더
// ─────────────────────────────────────────────

function infrastructureBlocks(state: AppState) {
  const distributions = state.project?.infrastructureDistributions ?? [];
  const openEnded = state.project?.openEndedQuestions ?? [];
  if (distributions.length === 0 && openEnded.length === 0) return [];

  const blocks: (Paragraph | Table)[] = [];
  if (distributions.length > 0) {
    blocks.push(subLabel("디지털 기반 교육 현황 – 문항별 응답 분포"));
    blocks.push(
      table(
        [["문항", "응답", "비율"]],
        distributions.flatMap((question) =>
          question.options.map((option, index) => [
            index === 0 ? question.question : "",
            option.label,
            `${option.ratio.toFixed(1)}%`
          ])
        ),
        [34, 52, 14]
      )
    );
  }
  for (const question of openEnded) {
    blocks.push(subLabel(question.question));
    blocks.push(...bullets(question.responses.length > 0 ? question.responses : [" "]));
  }
  return blocks;
}

function interviewModulePlanBlocks(modules: TrainingModule[]) {
  if (modules.length === 0) return [note("선택된 연수 과정이 없습니다.")];
  return modules.flatMap((module) => [
    subLabel(`과정 ${module.id}. ${module.name}`),
    kvTable(
      [
        ["차시 구성", `${module.hours}차시`],
        ["연수 일정", [module.date, module.time].filter(Boolean).join(" ")],
        ["연수 방법", module.method === "온라인" ? "온라인" : "강의/토론·실습(오프라인)"],
        ["중점 도구", module.mainTool],
        ["운영 주제", module.topic],
        ["비고", module.note]
      ],
      22
    )
  ]);
}

function programPlanBlocks(modules: TrainingModule[], scores: { moduleId: number; score: number }[]) {
  return modules.flatMap((module) => {
    const score = scores.find((item) => item.moduleId === module.id);
    return [
      subLabel(`모듈 ${module.id}. ${module.name}`),
      kvTable(
        [
          ["진단 점수", score ? score.score.toFixed(2) : ""],
          ["구성 상태", module.required ? "필수 과정" : module.selected ? "선택 구성" : "미구성"],
          ["우리학교 목소리", module.selected ? module.schoolVoice : ""],
          ["프로그램명", module.selected ? module.programName || module.name : "미구성"],
          ["차시", module.selected ? `${module.hours}차시` : "-"],
          ["주요 내용", module.selected ? module.editableProgram || module.defaultProgram : ""]
        ],
        22
      )
    ];
  });
}

function customProgramBlocks(modules: TrainingModule[], schoolName: string) {
  if (modules.length === 0) return [note("선택된 맞춤형 프로그램이 없습니다.")];
  return modules.flatMap((module) => [
    subLabel(`모듈 ${module.id}. ${module.programName || module.name}`),
    kvTable(
      [
        ["일정", module.date],
        ["장소", module.place || schoolName],
        ["방법", module.method === "온라인" ? "온라인" : "강의토론/실습"],
        ["인원", module.headcount],
        ["차시·회차", [module.hours ? `${module.hours}차시` : "", module.sessionRound && `${module.sessionRound}회차`].filter(Boolean).join(" / ")],
        ["기대효과", module.expectedEffect]
      ],
      22
    )
  ]);
}

function checkboxLine(options: readonly string[], value: string) {
  return options.map((option) => `${value === option ? "[■]" : "[  ]"} ${option}`).join("   ");
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
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: navy })]
  });
}

function subLabel(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 90 },
    children: [new TextRun({ text, bold: true, size: 20, color: navy })]
  });
}

function note(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 18, color: "5B6472" })]
  });
}

function bodyParagraphs(text: string) {
  const paragraphs = String(text ?? "").split(/\n+/).filter((line) => line.trim().length > 0);
  if (paragraphs.length === 0) paragraphs.push(" ");
  return paragraphs.map(
    (line) =>
      new Paragraph({
        spacing: { after: 140 },
        children: [new TextRun({ text: line, size: 20 })]
      })
  );
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

function diagnosisDocxText(score: ModuleScore, aiText: string) {
  const cleaned = polishDocxText(aiText);
  if (cleaned) return cleaned;
  if (score.score < 3.8) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 도약 단계입니다. 구성원의 공감대와 실행 기반을 우선 확인하고, 연수에서 기초 개념과 안전한 실습을 충분히 다룰 필요가 있습니다.`;
  }
  if (score.score < 4.6) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 만족 단계입니다. 기본 이해와 실행 의지는 형성되어 있으므로, 학교 상황에 맞는 실습과 공동 설계를 통해 실제 적용력을 높일 필요가 있습니다.`;
  }
  return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 추월 단계입니다. 학교의 강점 사례로 활용하고 다른 과정과 연결해 지속 가능한 운영 모델로 확산하는 방향이 적절합니다.`;
}

function polishDocxText(text: string) {
  return String(text ?? "")
    .replace(/^시사점[:：]?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/단계임을 확인함/g, "단계로 해석됩니다")
    .replace(/것으로 예측됨/g, "것으로 보입니다")
    .replace(/확인함/g, "확인됩니다")
    .replace(/마련함/g, "마련할 필요가 있습니다")
    .replace(/극대화함/g, "높일 필요가 있습니다")
    .replace(/개발함/g, "개발할 필요가 있습니다")
    .replace(/정립함/g, "정립할 필요가 있습니다")
    .replace(/공유함/g, "공유할 필요가 있습니다");
}

function kvTable(rows: [string, string][], labelWidth = 25) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [cell(label, true, labelWidth), cell(value || " ", false, 100 - labelWidth)]
        })
    )
  });
}

function table(headerRows: string[][], bodyRows: string[][], widths?: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    rows: [
      ...headerRows.map(
        (row) =>
          new TableRow({
            children: row.map((label, index) => cell(label, true, widths?.[index]))
          })
      ),
      ...bodyRows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) => cell(value, false, widths?.[index]))
          })
      )
    ]
  });
}

function cell(text: string, header = false, width?: number) {
  return new TableCell({
    shading: header ? { fill: gray } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "C9D0DA" }
    },
    margins: { top: 80, bottom: 80, left: 90, right: 90 },
    children: String(text ?? " ")
      .split(/\n+/)
      .filter((line, index) => index === 0 || line.trim().length > 0)
      .map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line || " ", bold: header, size: header ? 17 : 18, color: header ? navy : "111827" })]
          })
      )
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
