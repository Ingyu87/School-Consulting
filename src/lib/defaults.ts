import { defaultModules } from "../data/modules";
import { noticeItems } from "../data/officialOptions";
import type {
  AppState,
  InterviewState,
  ParticipantTeacher,
  PlanState,
  SchoolInfo,
  TrainingModule
} from "../types";

export function createEmptyTeacher(): ParticipantTeacher {
  return { name: "", role: "", subject: "", career: "", contact: "" };
}

export function createInitialSchool(): SchoolInfo {
  return {
    region: "",
    address: "",
    schoolLevel: "초",
    establishment: "",
    schoolCharacter: "",
    leadingSchool: "",
    teacherCount: "",
    staffCount: "",
    classCount: "",
    studentCount: "",
    teacherDeviceTypes: [],
    teacherDeviceEtc: "",
    studentDeviceRatio: "",
    technicalIssues: [],
    technicalIssueEtc: "",
    budgetStatus: "",
    infrastructureNotes: ""
  };
}

export function createInitialInterview(): InterviewState {
  return {
    dateTime: "",
    leadCoordinator: "",
    coordinator2: "",
    coordinator3: "",
    operationManager: "",
    teachers: Array.from({ length: 5 }, createEmptyTeacher),
    noticeChecks: noticeItems.map(() => false),
    goals: [],
    goalEtc: "",
    digitalCapability: "",
    digitalReaction: "",
    digitalNotes: "",
    priorLevel: "",
    infraConsiderations: "",
    schoolRequests: "",
    additionalChecks: "",
    participationGoal: "",
    transcript: "",
    resultSummary: "",
    followUpQuestions: []
  };
}

export function createInitialPlan(): PlanState {
  return {
    strengths: "",
    strength1: "",
    strength2: "",
    challenges: "",
    challenge1: "",
    challenge2: "",
    interviewSummary: "",
    secondInterview: { dateTime: "", resultSummary: "", futurePlans: "" },
    issueGoals: [
      { issue: "", goal: "" },
      { issue: "", goal: "" },
      { issue: "", goal: "" }
    ],
    roadmapDirection: "",
    roadmapNotes: "",
    editedInsights: "",
    diagnosisImplications: {},
    insightSource: "basic"
  };
}

export function createInitialState(): AppState {
  return {
    activeTab: "diagnosis",
    project: null,
    school: createInitialSchool(),
    modules: defaultModules.map((module) => ({ ...module })),
    interview: createInitialInterview(),
    plan: createInitialPlan(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 저장본/백업 JSON을 현재 스키마로 복원한다.
 * 구버전 필드(coordinators, participants, notes 등)는 새 구조로 옮긴다.
 */
export function hydrateState(saved: unknown): AppState {
  const base = createInitialState();
  if (!saved || typeof saved !== "object") return base;
  const raw = saved as Record<string, any>;

  const savedModules: any[] = Array.isArray(raw.modules) ? raw.modules : [];
  const savedById = new Map<number, any>(savedModules.map((module) => [module?.id, module]));
  const modules: TrainingModule[] = defaultModules.map((defaults) => {
    const stored = savedById.get(defaults.id) ?? {};
    const merged: TrainingModule = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof TrainingModule)[]) {
      const value = stored[key];
      if (value !== undefined && value !== null && value !== "") {
        (merged as any)[key] = value;
      }
    }
    merged.id = defaults.id;
    merged.name = defaults.name;
    merged.required = defaults.required;
    if (merged.required) merged.selected = true;
    if (typeof stored.selected === "boolean" && !merged.required) merged.selected = stored.selected;
    return merged;
  });

  const rawInterview = raw.interview && typeof raw.interview === "object" ? raw.interview : {};
  const interview = createInitialInterview();
  for (const key of Object.keys(interview) as (keyof InterviewState)[]) {
    const value = rawInterview[key];
    if (value === undefined || value === null) continue;
    (interview as any)[key] = value;
  }
  interview.teachers = normalizeTeachers(rawInterview.teachers);
  interview.noticeChecks = normalizeNoticeChecks(rawInterview.noticeChecks);
  interview.goals = Array.isArray(rawInterview.goals) ? rawInterview.goals.filter((item: unknown) => typeof item === "string") : [];
  interview.followUpQuestions = Array.isArray(rawInterview.followUpQuestions)
    ? rawInterview.followUpQuestions.filter((item: unknown) => typeof item === "string")
    : [];
  // 구버전 마이그레이션
  if (!interview.leadCoordinator && typeof rawInterview.coordinators === "string") {
    const parts = rawInterview.coordinators.split(",").map((item: string) => item.trim()).filter(Boolean);
    interview.leadCoordinator = parts[0] ?? "";
    interview.coordinator2 = interview.coordinator2 || parts[1] || "";
    interview.coordinator3 = interview.coordinator3 || parts[2] || "";
  }
  if (typeof rawInterview.participants === "string" && rawInterview.participants && !interview.teachers.some((teacher) => teacher.name)) {
    const names = rawInterview.participants.split(",").map((item: string) => item.trim()).filter(Boolean);
    names.slice(0, 5).forEach((name: string, index: number) => {
      interview.teachers[index] = { ...interview.teachers[index], name };
    });
  }
  if (!interview.additionalChecks && typeof rawInterview.notes === "string") {
    interview.additionalChecks = rawInterview.notes;
  }

  const rawPlan = raw.plan && typeof raw.plan === "object" ? raw.plan : {};
  const plan = createInitialPlan();
  for (const key of Object.keys(plan) as (keyof PlanState)[]) {
    const value = rawPlan[key];
    if (value === undefined || value === null) continue;
    (plan as any)[key] = value;
  }
  plan.issueGoals = normalizeIssueGoals(rawPlan.issueGoals);
  plan.secondInterview = {
    dateTime: rawPlan.secondInterview?.dateTime ?? "",
    resultSummary: rawPlan.secondInterview?.resultSummary ?? "",
    futurePlans: rawPlan.secondInterview?.futurePlans ?? ""
  };
  plan.diagnosisImplications =
    rawPlan.diagnosisImplications && typeof rawPlan.diagnosisImplications === "object" ? rawPlan.diagnosisImplications : {};
  if (!plan.strength1 && typeof rawPlan.strengths === "string") plan.strength1 = rawPlan.strengths;
  if (!plan.challenge1 && typeof rawPlan.challenges === "string") plan.challenge1 = rawPlan.challenges;

  const school = createInitialSchool();
  if (raw.school && typeof raw.school === "object") {
    for (const key of Object.keys(school) as (keyof SchoolInfo)[]) {
      const value = raw.school[key];
      if (value === undefined || value === null) continue;
      (school as any)[key] = value;
    }
    school.teacherDeviceTypes = Array.isArray(raw.school.teacherDeviceTypes) ? raw.school.teacherDeviceTypes : [];
    school.technicalIssues = Array.isArray(raw.school.technicalIssues) ? raw.school.technicalIssues : [];
  }

  const validTabs = ["diagnosis", "school", "interview", "modules", "plan", "guide", "export"];

  return {
    activeTab: validTabs.includes(raw.activeTab) ? raw.activeTab : "diagnosis",
    project: raw.project && typeof raw.project === "object" ? raw.project : null,
    school,
    modules,
    interview,
    plan,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeTeachers(value: unknown): ParticipantTeacher[] {
  const teachers = Array.from({ length: 5 }, createEmptyTeacher);
  if (!Array.isArray(value)) return teachers;
  value.slice(0, 5).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    teachers[index] = {
      name: String(item.name ?? ""),
      role: String(item.role ?? ""),
      subject: String(item.subject ?? ""),
      career: String(item.career ?? ""),
      contact: String(item.contact ?? "")
    };
  });
  return teachers;
}

function normalizeNoticeChecks(value: unknown): boolean[] {
  const checks = noticeItems.map(() => false);
  if (!Array.isArray(value)) return checks;
  value.slice(0, checks.length).forEach((item, index) => {
    checks[index] = item === true;
  });
  return checks;
}

/**
 * CSV를 처음 업로드할 때도, 이미 학교 정보·심층면담·운영계획에 손으로 입력해 둔 내용이 있으면
 * 덮어쓰기 전에 반드시 확인을 받아야 한다. project가 없다고 해서 입력값이 없다는 뜻은 아니다.
 * 각 영역을 방금 만든 빈 기본값과 비교해서 조금이라도 다르면 "입력값 있음"으로 본다.
 */
export function hasExistingWork(state: AppState): boolean {
  if (state.project) return true;

  const schoolChanged = JSON.stringify(state.school) !== JSON.stringify(createInitialSchool());
  const interviewChanged = JSON.stringify(state.interview) !== JSON.stringify(createInitialInterview());
  const planChanged = JSON.stringify(state.plan) !== JSON.stringify(createInitialPlan());
  const modulesChanged = state.modules.some(
    (module) => module.date || module.time || module.place || module.headcount || module.programName || module.schoolVoice
  );

  return schoolChanged || interviewChanged || planChanged || modulesChanged;
}

function normalizeIssueGoals(value: unknown) {
  const issueGoals = [
    { issue: "", goal: "" },
    { issue: "", goal: "" },
    { issue: "", goal: "" }
  ];
  if (!Array.isArray(value)) return issueGoals;
  value.slice(0, 3).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    issueGoals[index] = { issue: String(item.issue ?? ""), goal: String(item.goal ?? "") };
  });
  return issueGoals;
}
