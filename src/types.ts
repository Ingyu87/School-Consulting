export type ScoreStage = "도약" | "만족" | "추월";

export type ModuleScore = {
  moduleId: number;
  moduleName: string;
  question?: string;
  score: number;
  stage: ScoreStage;
};

export type DistributionOption = {
  label: string;
  ratio: number;
  count?: number;
};

export type DistributionQuestion = {
  question: string;
  options: DistributionOption[];
};

export type OpenEndedQuestion = {
  question: string;
  responses: string[];
};

export type ParsedDiagnosisProject = {
  schoolName: string;
  sourceFileName: string;
  rawRows: string[][];
  moduleScores: ModuleScore[];
  infrastructureDistributions: DistributionQuestion[];
  openEndedQuestions: OpenEndedQuestion[];
  parseWarnings: string[];
};

export type TrainingModule = {
  id: number;
  name: string;
  required: boolean;
  selected: boolean;
  target: "교직원" | "학교 관리자" | "학부모" | "학생" | "교원";
  hours: number;
  date: string;
  time: string;
  place: string;
  headcount: string;
  sessionRound: string;
  method: "오프라인" | "온라인";
  mainTool: string;
  topic: string;
  note: string;
  programName: string;
  schoolVoice: string;
  description: string;
  defaultProgram: string;
  editableProgram: string;
  expectedEffect: string;
  materials: string;
};

export type SchoolInfo = {
  region: string;
  address: string;
  schoolLevel: string;
  establishment: string;
  schoolCharacter: string;
  leadingSchool: string;
  teacherCount: string;
  staffCount: string;
  classCount: string;
  studentCount: string;
  teacherDeviceTypes: string[];
  teacherDeviceEtc: string;
  studentDeviceRatio: string;
  technicalIssues: string[];
  technicalIssueEtc: string;
  budgetStatus: string;
  infrastructureNotes: string;
};

export type ParticipantTeacher = {
  name: string;
  role: string;
  subject: string;
  career: string;
  contact: string;
};

export type InterviewState = {
  dateTime: string;
  leadCoordinator: string;
  coordinator2: string;
  coordinator3: string;
  operationManager: string;
  teachers: ParticipantTeacher[];
  noticeChecks: boolean[];
  goals: string[];
  goalEtc: string;
  digitalCapability: string;
  digitalReaction: string;
  digitalNotes: string;
  priorLevel: string;
  infraConsiderations: string;
  schoolRequests: string;
  additionalChecks: string;
  participationGoal: string;
  transcript: string;
  resultSummary: string;
};

export type IssueGoal = {
  issue: string;
  goal: string;
};

export type SecondInterview = {
  dateTime: string;
  resultSummary: string;
  futurePlans: string;
};

export type PlanState = {
  strengths: string;
  strength1: string;
  strength2: string;
  challenges: string;
  challenge1: string;
  challenge2: string;
  interviewSummary: string;
  secondInterview: SecondInterview;
  issueGoals: IssueGoal[];
  roadmapDirection: string;
  roadmapNotes: string;
  editedInsights: string;
  diagnosisImplications: Record<string, string>;
  insightSource: "basic" | "ai" | "edited";
};

export type AppTab = "diagnosis" | "school" | "interview" | "modules" | "plan" | "export";

export type AppState = {
  activeTab: AppTab;
  project: ParsedDiagnosisProject | null;
  school: SchoolInfo;
  modules: TrainingModule[];
  interview: InterviewState;
  plan: PlanState;
  updatedAt: string;
};

export type AiDraftRequest = {
  task: "diagnosis" | "interview-plan" | "module-content";
  schoolName: string;
  project: ParsedDiagnosisProject | null;
  school: SchoolInfo;
  modules: TrainingModule[];
  interview: InterviewState;
  plan: PlanState;
};

export type AiModuleUpdate = {
  id: number;
  selected?: boolean;
  hours?: number;
  date?: string;
  time?: string;
  place?: string;
  method?: TrainingModule["method"];
  mainTool?: string;
  topic?: string;
  programName?: string;
  schoolVoice?: string;
  editableProgram?: string;
  expectedEffect?: string;
  materials?: string;
};

export type AiDraftResponse = {
  diagnosisInsight?: string;
  diagnosisImplications?: Record<string, string>;
  strengths?: string;
  strength1?: string;
  strength2?: string;
  challenges?: string;
  challenge1?: string;
  challenge2?: string;
  priorLevel?: string;
  infraConsiderations?: string;
  schoolRequests?: string;
  additionalChecks?: string;
  participationGoal?: string;
  interviewResultSummary?: string;
  interviewSummary?: string;
  issueGoals?: IssueGoal[];
  roadmapDirection?: string;
  roadmapNotes?: string;
  moduleUpdates?: AiModuleUpdate[];
  warnings?: string[];
};

export type InterviewAudioSummary = {
  priorLevel?: string;
  infraConsiderations?: string;
  schoolRequests?: string;
  additionalChecks?: string;
  participationGoal?: string;
  resultSummary?: string;
  planInterviewSummary?: string;
  followUpQuestions?: string[];
};
