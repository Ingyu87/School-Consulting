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
  method: "오프라인" | "온라인";
  topic: string;
  description: string;
  defaultProgram: string;
  editableProgram: string;
  expectedEffect: string;
  materials: string;
};

export type AppTab = "diagnosis" | "plan" | "modules" | "interview" | "export";

export type AppState = {
  activeTab: AppTab;
  project: ParsedDiagnosisProject | null;
  modules: TrainingModule[];
  interview: {
    dateTime: string;
    coordinators: string;
    participants: string;
    transcript?: string;
    notes: string;
    resultSummary: string;
  };
  plan: {
    strengths: string;
    strength1?: string;
    strength2?: string;
    challenges: string;
    challenge1?: string;
    challenge2?: string;
    interviewSummary: string;
    roadmapNotes: string;
    editedInsights: string;
    diagnosisImplications?: Record<string, string>;
    insightSource?: "basic" | "ai" | "edited";
  };
  updatedAt: string;
};

export type AiDraftRequest = {
  task: "diagnosis" | "interview-plan" | "module-content";
  schoolName: string;
  project: ParsedDiagnosisProject | null;
  modules: TrainingModule[];
  interview: AppState["interview"];
  plan: AppState["plan"];
};

export type AiModuleUpdate = {
  id: number;
  selected?: boolean;
  hours?: number;
  date?: string;
  time?: string;
  place?: string;
  method?: TrainingModule["method"];
  topic?: string;
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
  interviewNotes?: string;
  interviewResultSummary?: string;
  interviewSummary?: string;
  roadmapNotes?: string;
  moduleUpdates?: AiModuleUpdate[];
  warnings?: string[];
};

export type InterviewAudioAnalysisResponse = {
  transcript: string;
  considerations: string;
  resultSummary: string;
  planInterviewSummary?: string;
  followUpQuestions?: string[];
};
