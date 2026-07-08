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

export type AppState = {
  activeTab: "diagnosis" | "interview" | "modules" | "plan" | "export";
  project: ParsedDiagnosisProject | null;
  modules: TrainingModule[];
  interview: {
    dateTime: string;
    coordinators: string;
    participants: string;
    notes: string;
    resultSummary: string;
  };
  plan: {
    strengths: string;
    challenges: string;
    interviewSummary: string;
    roadmapNotes: string;
    editedInsights: string;
  };
  updatedAt: string;
};
