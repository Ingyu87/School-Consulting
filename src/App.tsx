import { lazy, Suspense, type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  FolderOpen,
  HelpCircle,
  Mic,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Upload
} from "lucide-react";
import { InterviewFormView } from "./components/InterviewFormView";
import { PlanFormView } from "./components/PlanFormView";
import { SchoolInfoForm } from "./components/SchoolInfoForm";
import { generateAiDraft } from "./lib/ai";
import { applyAiDraftToState } from "./lib/aiApply";
import { summarizeInterviewTranscript, transcribeInterviewSegment } from "./lib/audio";
import { createInitialState, hasExistingWork, hydrateState } from "./lib/defaults";
import { buildInsights, stageDescriptions, stageTone } from "./lib/diagnosis";
import { parseDiagnosisCsv } from "./lib/csv/parseDiagnosisCsv";
import { parseLectureScheduleCsv } from "./lib/csv/parseLectureScheduleCsv";
import { fetchNeisSchoolInfo, mapNeisToSchoolInfo } from "./lib/neis";
import { clearState, compactStoredState, loadState, saveState } from "./lib/storage";
import { validateModules } from "./lib/validation";
import { noticeItems } from "./data/officialOptions";
import type { AiDraftRequest, AiDraftResponse, AiModuleUpdate, AppState, AppTab, InterviewState, ModuleScore, PlanState, SchoolInfo, TrainingModule } from "./types";

// Vercel 함수 요청 크기 제한(약 4.5MB) 때문에 긴 면담 녹음은 구간으로 나눠 전사한다.
const SEGMENT_MS = 180_000;

// lottie-web은 번들이 커서 첫 화면 로딩에 필요하지 않다. 실제로 애니메이션이 뜨는 시점에만 불러온다.
const AiWaitingLottie = lazy(() => import("./components/AiWaitingLottie"));
const CompletionLottie = lazy(() => import("./components/CompletionLottie"));

const tabs = [
  ["diagnosis", "진단 분석"],
  ["school", "학교 정보"],
  ["interview", "심층면담"],
  ["modules", "연수 구성"],
  ["plan", "운영계획"],
  ["export", "다운로드"]
] as const;

const navigationTabs = [...tabs.slice(0, 5), ["guide", "운영 안내"], tabs[5]] as const;

type AiPreviewState = {
  task: AiDraftRequest["task"];
  draftSection?: AiDraftRequest["draftSection"];
  nextTab?: AppTab;
  draft: AiDraftResponse;
  moduleId?: number;
  title: string;
  detail: string;
};

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const [saveStatus, setSaveStatus] = useState("불러오는 중");
  const [uploadStatus, setUploadStatus] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [aiDraftingTask, setAiDraftingTask] = useState<"diagnosis" | "interview-plan" | "module-content" | null>(null);
  const [moduleDraftingId, setModuleDraftingId] = useState<number | null>(null);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [docxGenerating, setDocxGenerating] = useState<"interview" | "plan" | null>(null);
  const [completionNotice, setCompletionNotice] = useState<{ title: string; detail: string } | null>(null);
  const [toastNotice, setToastNotice] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [aiUndo, setAiUndo] = useState<{ state: AppState; label: string } | null>(null);
  const [aiPreview, setAiPreview] = useState<AiPreviewState | null>(null);

  const stateRef = useRef(state);
  // 리셋/새 CSV 업로드마다 증가시켜, 그 이전에 보낸 AI 요청의 응답이 늦게 도착해도 무시하도록 한다.
  const requestEpochRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const segmentIndexRef = useRef(0);
  const finalizingRef = useRef(false);
  const cancelledRef = useRef(false);
  const transcriptPartsRef = useRef<string[]>([]);
  const transcriptBeforeRecordingRef = useRef("");
  const transcribeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    loadState().then((saved) => {
      if (saved) setState(hydrateState(saved));
      setSaveStatus(saved ? "자동저장됨" : "새 프로젝트");
    });
  }, []);

  useEffect(() => {
    if (saveStatus === "불러오는 중") return;
    setSaveStatus("저장 중");
    const id = window.setTimeout(() => {
      saveState({ ...state, updatedAt: new Date().toISOString() })
        .then(() => setSaveStatus("자동저장됨"))
        .catch(() => setSaveStatus("저장 실패"));
    }, 450);
    return () => window.clearTimeout(id);
  }, [state]);

  const insights = useMemo(() => buildInsights(state.project?.moduleScores ?? []), [state.project]);
  const validations = useMemo(() => validateModules(state.modules), [state.modules]);
  const selectedModules = useMemo(() => state.modules.filter((module) => module.selected), [state.modules]);
  const diagnosisSummary = state.plan.editedInsights || insights.draft;
  const insightSourceLabel = state.plan.insightSource === "ai" ? "AI 심층 분석" : state.plan.insightSource === "edited" ? "수정된 분석 초안" : "기본 CSV 분석";
  const selectedHours = selectedModules.reduce((sum, module) => sum + module.hours, 0);
  const errorCount = validations.filter((item) => item.level === "error").length;
  const isAiBusy = aiDraftingTask !== null || moduleDraftingId !== null;
  const help = (text: string) => (showHelp ? { "data-help": text } : {});

  useEffect(() => {
    if (!completionNotice) return;
    const id = window.setTimeout(() => setCompletionNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [completionNotice]);

  useEffect(() => {
    if (!toastNotice) return;
    const id = window.setTimeout(() => setToastNotice(null), 2200);
    return () => window.clearTimeout(id);
  }, [toastNotice]);

  function showCompletion(title: string, detail: string) {
    setCompletionNotice({ title, detail });
  }

  function showToast(message: string, tone: "ok" | "error" = "ok") {
    setToastNotice({ tone, message });
  }

  async function copyTable(event: MouseEvent<HTMLElement>, label = "표") {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, button, select, label")) return;
    const table = target.closest("table");
    if (!table) return;
    const text = Array.from(table.rows)
      .map((row) => Array.from(row.cells).map((cell) => cell.innerText.replace(/\s+/g, " ").trim()).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} 내용을 복사했습니다.`);
    } catch {
      showToast("브라우저 권한 때문에 복사하지 못했습니다.", "error");
    }
  }

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function patchInterview(patch: Partial<InterviewState>) {
    setState((current) => ({ ...current, interview: { ...current.interview, ...patch } }));
  }

  function toggleNotice(index: number) {
    setState((current) => ({
      ...current,
      interview: {
        ...current.interview,
        noticeChecks: current.interview.noticeChecks.map((checked, i) => (i === index ? !checked : checked))
      }
    }));
  }

  function patchPlan(patch: Partial<PlanState>) {
    setState((current) => ({ ...current, plan: { ...current.plan, ...patch } }));
  }

  function patchSchool(patch: Partial<SchoolInfo>) {
    setState((current) => ({ ...current, school: { ...current.school, ...patch } }));
  }

  async function handleCsv(file: File) {
    setUploadStatus("CSV 분석 중");
    try {
      const project = await parseDiagnosisCsv(file);
      if (hasExistingWork(state)) {
        const currentLabel = state.project?.schoolName ?? "현재";
        const confirmed = window.confirm(
          `${currentLabel} 작업(학교 정보·면담·연수 구성·운영계획 입력 포함)을 모두 지우고 ${project.schoolName} 프로젝트를 새로 시작할까요?\n\n기존 작업을 보관하려면 취소 후 다운로드 탭에서 '작업 저장'을 먼저 해주세요.`
        );
        if (!confirmed) {
          setUploadStatus("새 학교 업로드를 취소했습니다.");
          return;
        }
      }
      requestEpochRef.current += 1;
      setAiUndo(null);
      setAiPreview(null);
      const fresh = createInitialState();
      let neisPatch: Partial<SchoolInfo> = {};
      let neisMessage = "";
      try {
        const neisInfo = await fetchNeisSchoolInfo(project.schoolName);
        neisPatch = mapNeisToSchoolInfo(neisInfo);
        neisMessage = " · 나이스 학교정보 자동 반영";
      } catch {
        neisMessage = " · 나이스 자동 조회 건너뜀";
      }
      const freshInsights = buildInsights(project.moduleScores);
      setState({
        ...fresh,
        project,
        school: { ...fresh.school, ...neisPatch },
        activeTab: "diagnosis",
        modules: fresh.modules.map((module) => ({ ...module, place: project.schoolName })),
        plan: {
          ...fresh.plan,
          editedInsights: freshInsights.draft,
          strength1: deriveStrengthText(freshInsights.highs[0]),
          strength2: deriveStrengthText(freshInsights.highs[1]),
          challenge1: deriveChallengeText(freshInsights.lows[0]),
          challenge2: deriveChallengeText(freshInsights.lows[1])
        }
      });
      setAiStatus("");
      setScheduleStatus("");
      setRecordingStatus("");
      setUploadStatus(
        project.parseWarnings.length
          ? `${project.schoolName} 분석 완료 · 확인 필요: ${project.parseWarnings.join(" / ")}`
          : `${project.schoolName} 분석 완료`
      );
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "CSV 분석 실패");
    }
  }

  async function handleLectureScheduleCsv(file: File) {
    setScheduleStatus("강의종합 CSV 반영 중");
    try {
      const imported = await parseLectureScheduleCsv(file, state.project?.schoolName ?? undefined);
      setState((current) => {
        const schoolName = current.project?.schoolName || imported.schoolName;
        const nextModules = current.modules.map((module) => {
          const update = imported.moduleUpdates.find((item) => item.id === module.id);
          if (!update) return { ...module, place: module.place || schoolName };
          return mergeModuleAiUpdate(module, update, schoolName);
        });
        const teachers = [...current.interview.teachers];
        if (imported.teacher && !teachers.some((teacher) => teacher.name)) {
          teachers[0] = { ...teachers[0], name: imported.teacher, role: teachers[0].role || "학교 담당자(부장)" };
        }

        return {
          ...current,
          modules: nextModules,
          interview: {
            ...current.interview,
            dateTime: imported.interviewDateTime || current.interview.dateTime,
            leadCoordinator: current.interview.leadCoordinator || imported.coordinators[0] || "",
            coordinator2: current.interview.coordinator2 || imported.coordinators[1] || "",
            coordinator3: current.interview.coordinator3 || imported.coordinators[2] || "",
            teachers,
            additionalChecks: [current.interview.additionalChecks, ...imported.notes].filter(Boolean).join("\n\n")
          }
        };
      });
      setScheduleStatus(`${imported.schoolName} 강의종합 CSV 반영 완료`);
    } catch (error) {
      setScheduleStatus(error instanceof Error ? error.message : "강의종합 CSV 반영 실패");
    }
  }

  function updateModule(id: number, patch: Partial<TrainingModule>) {
    setState((current) => ({
      ...current,
      modules: current.modules.map((module) => {
        if (module.id !== id) return module;
        if (module.required && patch.selected === false) return module;
        return { ...module, ...patch };
      })
    }));
  }

  async function runAiDraft(
    task: "diagnosis" | "interview-plan" | "module-content",
    nextTab?: AppState["activeTab"],
    draftSection?: "interview-summary" | "second-interview" | "issue-goals" | "roadmap" | "interview-core"
  ) {
    if (!state.project) {
      setAiStatus("진단 CSV를 먼저 업로드해주세요.");
      return;
    }

    const requestEpoch = requestEpochRef.current;
    setAiStatus("AI 초안 생성 중");
    setAiDraftingTask(task);
    try {
      const draft = await generateAiDraft({
        task,
        draftSection,
        schoolName: state.project.schoolName,
        project: state.project,
        school: state.school,
        modules: state.modules,
        interview: state.interview,
        plan: state.plan
      });

      if (requestEpoch !== requestEpochRef.current) {
        setAiStatus("이전 학교 세션의 응답이라 반영하지 않았습니다.");
        return;
      }

      setAiPreview({
        task,
        draftSection,
        nextTab: nextTab ?? (task === "diagnosis" ? "diagnosis" : task === "interview-plan" ? "interview" : "modules"),
        draft,
        title: task === "diagnosis" ? "AI 심층 분석 미리보기" : "AI 초안 미리보기",
        detail: task === "diagnosis" ? "진단 분석, 강점·과제, 시사점 초안을 확인한 뒤 적용합니다." : sectionPreviewText(draftSection)
      });
      setAiStatus("AI 초안 미리보기 생성 완료");
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : "AI 초안 생성 실패");
    } finally {
      setAiDraftingTask(null);
    }
  }

  async function runModuleDraft(moduleId: number) {
    if (!state.project) {
      setAiStatus("진단 CSV를 먼저 업로드해주세요.");
      return;
    }

    const targetModule = state.modules.find((module) => module.id === moduleId);
    if (!targetModule) return;

    const requestEpoch = requestEpochRef.current;
    setModuleDraftingId(moduleId);
    setAiStatus(`${targetModule.id}. ${targetModule.name} AI 초안 생성 중`);
    try {
      const draft = await generateAiDraft({
        task: "module-content",
        moduleId,
        schoolName: state.project.schoolName,
        project: state.project,
        school: state.school,
        modules: state.modules,
        interview: state.interview,
        plan: state.plan
      });

      if (requestEpoch !== requestEpochRef.current) {
        setAiStatus("이전 학교 세션의 응답이라 반영하지 않았습니다.");
        return;
      }

      const update = draft.moduleUpdates?.find((item) => item.id === moduleId);
      if (!update) {
        setAiStatus("AI 초안을 받았지만 적용할 과정 내용이 없습니다.");
        return;
      }
      setAiPreview({
        task: "module-content",
        nextTab: "modules",
        draft,
        moduleId,
        title: `${targetModule.id}. ${targetModule.name} AI 초안 미리보기`,
        detail: "프로그램명, 우리학교 목소리, 세부 프로그램, 기대효과, 준비물을 확인한 뒤 적용합니다."
      });
      setAiStatus(`${targetModule.id}. ${targetModule.name} AI 초안 미리보기 생성 완료`);
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : "AI 초안 생성 실패");
    } finally {
      setModuleDraftingId(null);
    }
  }

  async function startInterviewRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      finalizingRef.current = false;
      cancelledRef.current = false;
      segmentIndexRef.current = 0;
      transcriptBeforeRecordingRef.current = stateRef.current.interview.transcript;
      transcriptPartsRef.current = transcriptBeforeRecordingRef.current ? [transcriptBeforeRecordingRef.current] : [];
      transcribeQueueRef.current = Promise.resolve();
      setIsRecording(true);
      setRecordingStatus("녹음 중 · 3분 단위로 자동 전사됩니다.");
      startSegmentRecorder();
    } catch (error) {
      setRecordingStatus(error instanceof Error ? error.message : "마이크 권한을 확인해주세요.");
    }
  }

  function startSegmentRecorder() {
    const stream = streamRef.current;
    if (!stream) return;
    // 오디오 비트레이트를 낮게 고정해 3분 세그먼트가 Vercel 함수 요청 본문 제한(약 4.5MB)을 넘지 않도록 한다.
    const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const isFinal = finalizingRef.current;
      if (!cancelledRef.current) {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        enqueueSegment(blob, segmentIndexRef.current++, isFinal);
      }
      if (!isFinal && !cancelledRef.current) {
        startSegmentRecorder();
      } else {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    segmentTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== "inactive" && !finalizingRef.current && !cancelledRef.current) recorder.stop();
    }, SEGMENT_MS);
  }

  function enqueueSegment(blob: Blob, index: number, isFinal: boolean) {
    transcribeQueueRef.current = transcribeQueueRef.current.then(async () => {
      if (cancelledRef.current) return;
      if (blob.size > 1000) {
        setRecordingStatus(`구간 ${index + 1} 전사 중${isFinal ? " (마지막 구간)" : ""}`);
        try {
          const transcript = await transcribeInterviewSegment(blob, index);
          if (cancelledRef.current) return;
          if (transcript.trim()) appendTranscript(transcript.trim());
        } catch (error) {
          if (cancelledRef.current) return;
          setRecordingStatus(`구간 ${index + 1} 전사 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
        }
      }
      if (cancelledRef.current) return;
      if (isFinal) {
        await finishRecordingAnalysis();
      } else if (!finalizingRef.current && !cancelledRef.current) {
        setRecordingStatus(`녹음 중 · 구간 ${index + 1} 전사 완료`);
      }
    });
  }

  function appendTranscript(text: string) {
    transcriptPartsRef.current.push(text);
    const joined = transcriptPartsRef.current.join("\n\n");
    setState((current) => ({ ...current, interview: { ...current.interview, transcript: joined } }));
  }

  async function finishRecordingAnalysis() {
    if (cancelledRef.current) return;
    const transcript = transcriptPartsRef.current.join("\n\n").trim();
    if (!transcript) {
      setRecordingStatus("전사된 내용이 없습니다. 마이크 입력을 확인해주세요.");
      return;
    }
    setRecordingStatus("전사 완료 · 면담 내용 종합 분석 중");
    try {
      const summary = await summarizeInterviewTranscript(transcript, stateRef.current);
      if (cancelledRef.current) return;
      setState((current) => ({
        ...current,
        interview: {
          ...current.interview,
          priorLevel: summary.priorLevel || current.interview.priorLevel,
          infraConsiderations: summary.infraConsiderations || current.interview.infraConsiderations,
          schoolRequests: summary.schoolRequests || current.interview.schoolRequests,
          additionalChecks: summary.additionalChecks || current.interview.additionalChecks,
          participationGoal: summary.participationGoal || current.interview.participationGoal,
          resultSummary: summary.resultSummary || current.interview.resultSummary,
          followUpQuestions: summary.followUpQuestions?.length ? summary.followUpQuestions : current.interview.followUpQuestions
        },
        plan: {
          ...current.plan,
          interviewSummary: summary.planInterviewSummary || current.plan.interviewSummary
        }
      }));
      setRecordingStatus("전사 및 AI 분석 완료 · 심층면담 항목에 반영했습니다.");
    } catch (error) {
      if (cancelledRef.current) return;
      setRecordingStatus(error instanceof Error ? error.message : "면담 종합 분석 실패");
    }
  }

  function stopInterviewRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    finalizingRef.current = true;
    if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
    setIsRecording(false);
    setRecordingStatus("녹음 종료 · 자동 전사 및 요약 중");
    recorder.stop();
  }

  function cancelRecording() {
    cancelledRef.current = true;
    finalizingRef.current = true;
    if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    transcriptPartsRef.current = transcriptBeforeRecordingRef.current ? [transcriptBeforeRecordingRef.current] : [];
    setState((current) => ({
      ...current,
      interview: { ...current.interview, transcript: transcriptBeforeRecordingRef.current }
    }));
    setRecordingStatus("녹음을 취소했습니다. 전사와 요약을 반영하지 않습니다.");
  }

  function applyModule(id: number) {
    setState((current) => ({
      ...current,
      modules: current.modules.map((module) => {
        if (module.id !== id) return module;
        return {
          ...module,
          selected: true,
          editableProgram: module.editableProgram || module.defaultProgram
        };
      })
    }));
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(compactStoredState(state), null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project?.schoolName ?? "school"}_컨설팅_백업.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("작업 JSON을 저장했습니다.");
  }

  function validateBeforeDownload(kind: "interview" | "plan") {
    if (!state.project) return "진단 CSV를 먼저 업로드해주세요.";
    if (kind === "interview") {
      if (!state.interview.dateTime.trim()) return "심층면담 일시를 입력해주세요.";
      if (!state.interview.participationGoal.trim() || !state.interview.resultSummary.trim()) {
        return "심층면담 결과 핵심 요약의 참여 목표와 면담 핵심 결과를 작성해주세요.";
      }
    }
    if (kind === "plan") {
      const blockingRule = validations.find((item) => item.level === "error");
      if (blockingRule) return blockingRule.message;
      if (!state.plan.strength1.trim() || !state.plan.challenge1.trim()) return "운영계획서 강점과 도전 과제를 작성해주세요.";
      if (!state.plan.roadmapDirection.trim() || !state.plan.roadmapNotes.trim()) return "로드맵 방향과 기대효과 종합 의견을 작성해주세요.";
    }
    return "";
  }

  async function handleDownloadInterviewDocx() {
    if (docxGenerating) return;
    const validationMessage = validateBeforeDownload("interview");
    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }
    setDocxGenerating("interview");
    try {
      const { downloadInterviewDocx } = await import("./lib/docx/exportDocs");
      await downloadInterviewDocx(state);
      showCompletion("생성 완료", "심층면담지 DOCX를 생성했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "심층면담지 DOCX 생성에 실패했습니다.", "error");
    } finally {
      setDocxGenerating(null);
    }
  }

  async function handleDownloadPlanDocx() {
    if (docxGenerating) return;
    const validationMessage = validateBeforeDownload("plan");
    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }
    setDocxGenerating("plan");
    try {
      const { downloadPlanDocx } = await import("./lib/docx/exportDocs");
      await downloadPlanDocx(state);
      showCompletion("생성 완료", "운영계획서 DOCX를 생성했습니다.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "운영계획서 DOCX 생성에 실패했습니다.", "error");
    } finally {
      setDocxGenerating(null);
    }
  }

  function downloadScheduleCsv() {
    if (!state.project) {
      showToast("진단 CSV를 먼저 업로드해주세요.", "error");
      return;
    }
    const blockingRule = validations.find((item) => item.level === "error");
    if (blockingRule) {
      showToast(blockingRule.message, "error");
      return;
    }
    const schoolName = state.project?.schoolName ?? "새학교";
    const rows = [
      ["순번", "과정", "대상", "차시", "일정", "시간", "장소", "인원", "방식", "중점 도구", "운영 주제", "준비물/확인사항"],
      ...selectedModules.map((module, index) => [
        String(index + 1),
        `${module.id}. ${module.name}`,
        module.target,
        `${module.hours}차시`,
        module.date || "학교 확인 필요",
        module.time || "학교 확인 필요",
        module.place || schoolName,
        module.headcount || "학교 확인 필요",
        module.method,
        module.mainTool,
        module.topic,
        module.materials
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schoolName}_최종_학교_스케줄표_${todayStamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { modules?: unknown }).modules)) {
        throw new Error("이 앱의 백업 JSON 형식이 아닙니다.");
      }
      requestEpochRef.current += 1;
      setAiUndo(null);
      setAiPreview(null);
      cancelRecording();
      setState(hydrateState(parsed));
      setUploadStatus("작업 파일을 불러왔습니다.");
      showToast("작업 JSON을 불러왔습니다.");
    } catch (error) {
      setUploadStatus(error instanceof Error ? `작업 불러오기 실패: ${error.message}` : "작업 불러오기 실패");
      showToast(error instanceof Error ? `작업 불러오기 실패: ${error.message}` : "작업 불러오기 실패", "error");
    }
  }

  async function resetWorkspace() {
    const confirmed = window.confirm("현재 입력한 내용과 자동저장된 작업을 모두 지우고 처음부터 시작할까요?");
    if (!confirmed) return;
    requestEpochRef.current += 1;
    setAiUndo(null);
    setAiPreview(null);
    cancelRecording();
    await clearState();
    setState(createInitialState());
    setUploadStatus("");
    setScheduleStatus("");
    setAiStatus("");
    setRecordingStatus("");
    setSaveStatus("새 프로젝트");
  }

  function undoLastAiApply() {
    if (!aiUndo) return;
    requestEpochRef.current += 1;
    setState(aiUndo.state);
    setAiStatus(`${aiUndo.label} 적용을 되돌렸습니다.`);
    setAiUndo(null);
    showToast("AI 적용 내용을 되돌렸습니다.");
  }

  function applyAiPreview() {
    if (!aiPreview) return;
    const undoState = stateRef.current;
    const label =
      aiPreview.moduleId != null
        ? `${aiPreview.moduleId}. ${state.modules.find((module) => module.id === aiPreview.moduleId)?.name ?? "과정"} AI 초안`
        : aiPreview.task === "diagnosis"
          ? "AI 심층 분석"
          : sectionCompletionText(aiPreview.draftSection).replace("을 반영했습니다.", "");
    setState((current) => ({
      ...applyAiDraftToState(current, aiPreview.draft, aiPreview.task, aiPreview.draftSection),
      activeTab: aiPreview.nextTab ?? current.activeTab
    }));
    setAiUndo({ state: undoState, label });
    setAiPreview(null);
    setAiStatus("AI 초안을 적용했습니다.");
    showCompletion("적용 완료", aiPreview.task === "diagnosis" ? "AI 심층 분석 결과를 반영했습니다." : `${label}을 반영했습니다.`);
  }

  function closeAiPreview() {
    setAiPreview(null);
    setAiStatus("AI 초안 적용을 취소했습니다.");
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">SC</div>
          <div>
            <strong>찾학컨 플래너</strong>
            <span>{state.project?.schoolName ?? "CSV 업로드 필요"}</span>
          </div>
        </div>
        <nav className="tabs">
          {navigationTabs.map(([key, label]) => (
            <button
              className={state.activeTab === key ? "active" : ""}
              key={key}
              onClick={() => patchState({ activeTab: key })}
              {...help(tabHelp(String(key)))}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebarFooter">
          <div className="sidebarRecording">
            <div className="recordingHeader">
              <strong>면담 녹음</strong>
              <button className="transcriptToggle" onClick={() => setShowTranscript((value) => !value)} type="button">
                {showTranscript ? "전사 닫기" : "전사 보기"}
              </button>
            </div>
            <div className="recordingActions">
              <button className={isRecording ? "resetButton recordingActive" : "resetButton"} onClick={isRecording ? stopInterviewRecording : startInterviewRecording}>
                {isRecording ? <Square size={16} /> : <Mic size={16} />}
                {isRecording ? "녹음 종료" : "녹음 시작"}
              </button>
              {isRecording && (
                <button className="resetButton" onClick={cancelRecording} type="button">
                  녹음 취소
                </button>
              )}
            </div>
            <span>{recordingStatus || (state.interview.transcript ? "전사 내용이 AI 초안에 반영됩니다." : "녹음 후 전사 내용이 AI 초안에 반영됩니다.")}</span>
            {showTranscript && (
              <div className="transcriptPanel">
                <textarea
                  value={state.interview.transcript}
                  onChange={(event) => patchInterview({ transcript: event.target.value })}
                  placeholder="녹음 종료 후 전사 내용이 여기에 표시됩니다. 필요한 경우 직접 수정할 수 있습니다."
                />
              </div>
            )}
          </div>
          <div className="sidebarFileTools">
            <strong>작업 파일 관리</strong>
            <label className="resetButton" {...help("저장해 둔 작업 JSON을 불러와 같은 입력 내용으로 이어서 작성합니다. 원본 CSV/PDF 파일 자체는 포함되지 않습니다.")}>
              <FolderOpen size={16} />
              작업 불러오기
              <input type="file" accept=".json" onChange={fileInputHandler(restoreBackup)} />
            </label>
            <button className="resetButton" onClick={downloadBackup} {...help("현재 입력 내용과 AI 초안, 연수 구성, 운영계획 입력값을 JSON 파일로 저장합니다. 원본 CSV/PDF 파일 자체는 포함되지 않습니다.")}>
              <Download size={16} />
              작업 저장
            </button>
          </div>
          <button className="resetButton" onClick={resetWorkspace}>
            <RotateCcw size={16} />
            처음부터 시작
          </button>
          <div className="statusCard">
            <Save size={16} />
            <span>{saveStatus}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        {aiPreview && (
          <div className="previewOverlay" role="dialog" aria-modal="true" aria-labelledby="ai-preview-title">
            <section className="previewDialog">
              <div className="sectionToolbar">
                <div>
                  <p className="eyebrow">적용 전 확인</p>
                  <h2 id="ai-preview-title">{aiPreview.title}</h2>
                  <p className="formHint">{aiPreview.detail}</p>
                </div>
              </div>
              <div className="previewList">
                {previewRows(aiPreview, state.modules).map((row) => (
                  <div className="previewRow" key={row.label}>
                    <strong>{row.label}</strong>
                    <p>{row.value || "작성 내용 없음"}</p>
                  </div>
                ))}
              </div>
              <div className="previewActions">
                <button className="button ghost" onClick={closeAiPreview} type="button">취소</button>
                <button className="button primary" onClick={applyAiPreview} type="button">
                  <CheckCircle2 size={17} />
                  이 초안 적용
                </button>
              </div>
            </section>
          </div>
        )}
        <div className="feedbackLayer" aria-live="polite">
          {completionNotice && !isAiBusy && (
            <div className="completionToast">
              <Suspense fallback={<div className="completionLottie" />}>
                <CompletionLottie className="completionLottie" />
              </Suspense>
              <div>
                <strong>{completionNotice.title}</strong>
                <span>{completionNotice.detail}</span>
                {aiUndo && (
                  <button className="toastAction" onClick={undoLastAiApply} type="button">
                    AI 적용 되돌리기
                  </button>
                )}
              </div>
            </div>
          )}
          {toastNotice && (
            <div className={`toastNotice ${toastNotice.tone}`}>
              {toastNotice.tone === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
              <span>{toastNotice.message}</span>
            </div>
          )}
        </div>
        <header className="topbar">
          <div>
            <p className="eyebrow">표준 파서: 서울고일초_사전 자가진단 분석.csv</p>
            <h1>{state.project?.schoolName ?? "학교 컨설팅 문서 생성 웹앱"}</h1>
          </div>
          <div className="actions">
            <button className={`button ghost ${showHelp ? "activeHelp" : ""}`} onClick={() => setShowHelp((value) => !value)} {...help("주요 버튼과 입력 영역에 마우스를 올렸을 때 설명을 보여주거나 숨깁니다.")}>
              <HelpCircle size={17} />
              도움말 {showHelp ? "켜짐" : "꺼짐"}
            </button>
          </div>
        </header>

        <section className="validationStrip">
          {state.project ? (
            <>
              <strong>{selectedHours}차시 구성</strong>
              <span>최소 12차시까지 {Math.max(0, 12 - selectedHours)}차시 남음</span>
              <span className={errorCount ? "danger" : "ok"}>{errorCount ? `${errorCount}개 확인 필요` : "운영 기준 충족"}</span>
              <span>식사와 다과 안내는 공식 운영 기준에 따라 표시됩니다.</span>
            </>
          ) : (
            <span>진단 CSV를 업로드하면 이 학교의 연수 구성이 운영 기준을 충족하는지 여기에 표시됩니다. 지금 보이는 모듈 선택은 CSV 업로드 전 기본값입니다.</span>
          )}
        </section>

        {(uploadStatus || scheduleStatus || aiStatus || recordingStatus) && (
          <section className="noticeStack" aria-live="polite">
            {uploadStatus && <div className="notice">{uploadStatus}</div>}
            {scheduleStatus && <div className="notice scheduleNotice"><CalendarDays size={17} />{scheduleStatus}</div>}
            {aiStatus && <div className="notice aiNotice"><Sparkles size={17} />{aiStatus}</div>}
            {recordingStatus && <div className="notice recordingNotice"><Mic size={17} />{recordingStatus}</div>}
          </section>
        )}
        {isAiBusy && state.activeTab !== "guide" && (
          <div className="aiWaitingPanel" role="status" aria-live="polite">
            <Suspense fallback={<div className="aiWaitingLottie" />}>
              <AiWaitingLottie className="aiWaitingLottie" />
            </Suspense>
            <div>
              <p className="eyebrow">{moduleDraftingId !== null ? "과정별 AI 초안" : "AI 분석 대기"}</p>
              <h2>{moduleDraftingId !== null ? `${moduleDraftingId}번 과정 초안을 작성하고 있습니다.` : "AI가 자료를 정리하고 있습니다."}</h2>
              <p>진단 결과와 입력 내용을 바탕으로 문서에 들어갈 표현을 다듬는 중입니다.</p>
            </div>
          </div>
        )}

        {state.activeTab === "diagnosis" && (
          <section className="grid">
            <article className="panel heroPanel" {...help("전체 평균과 AI 심층 분석 초안을 보여주는 요약 카드입니다. CSV 업로드 후 분석 초안을 만들 수 있습니다.")}>
              <div>
                <p className="eyebrow">{insightSourceLabel}</p>
                <h2>{insights.average ? `${insights.average.toFixed(2)}점` : "CSV를 업로드하세요"}</h2>
                <p>{diagnosisSummary}</p>
                <label className="button ghost inlineAction" {...help("사전 자가진단 CSV를 업로드하면 진단 분석을 만들고, NEIS_API_KEY가 있으면 학교기본정보도 자동 조회합니다.")}>
                  <Upload size={17} />
                  진단 CSV 업로드
                  <input type="file" accept=".csv" onChange={fileInputHandler(handleCsv)} />
                </label>
                <button className="button primary inlineAction" onClick={() => runAiDraft("diagnosis")} disabled={aiDraftingTask === "diagnosis"}>
                  {aiDraftingTask === "diagnosis" ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "diagnosis" ? "AI 분석중" : "AI로 심층 분석"}
                </button>
              </div>
              <BarChart3 className="heroIcon" />
            </article>
            <article className="panel wide" {...help("과정별 평균 점수를 막대로 비교합니다. 각 행에 마우스를 올리면 과정 설명을 볼 수 있습니다.")}>
              <h2>과정별 평균 점수</h2>
              <div className="bars">
                {(state.project?.moduleScores ?? []).map((score) => (
                  <div className="barRow" key={score.moduleId} {...help(moduleHelp(score.moduleId, state.modules))}>
                    <span>{score.moduleId}. {score.moduleName}</span>
                    <div className="barTrack">
                      <div className={`barFill ${stageTone(score.stage)}`} style={{ width: `${score.score * 20}%` }} />
                    </div>
                    <strong>{score.score.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel wide" {...help("자가진단 결과를 바탕으로 학교의 강점 2개와 도전 과제 2개를 문서용 문장으로 정리합니다.")}>
              <h2>우리학교 강점과 디지털 기반 교육 혁신을 위한 도전 과제</h2>
              <div className="insightCardGrid">
                <div className="insightBox strength">
                  <span>강점 01</span>
                  <p>{state.plan.strength1 || deriveStrengthText(insights.highs[0])}</p>
                </div>
                <div className="insightBox strength dark">
                  <span>강점 02</span>
                  <p>{state.plan.strength2 || deriveStrengthText(insights.highs[1])}</p>
                </div>
                <div className="insightBox challenge">
                  <span>과제 01</span>
                  <p>{state.plan.challenge1 || deriveChallengeText(insights.lows[0])}</p>
                </div>
                <div className="insightBox challenge dark">
                  <span>과제 02</span>
                  <p>{state.plan.challenge2 || deriveChallengeText(insights.lows[1])}</p>
                </div>
              </div>
            </article>
            <article className="panel wide" {...help("각 과정의 분석 결과와 시사점을 분리해서 보여줍니다. 시사점은 운영계획과 연수 구성의 근거로 사용됩니다.")}>
              <h2>사전 진단 - 과정별 진단 분석 결과</h2>
              <div className="tableScroller copyableTable" onClick={(event) => copyTable(event, "과정별 진단 분석표")} title="클릭하면 표 내용을 복사합니다.">
                <table className="diagnosisTable">
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>평균 점수</th>
                      <th>단계</th>
                      <th>자가 진단 분석 결과 및 시사점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.project?.moduleScores ?? []).map((score) => (
                      <tr key={score.moduleId}>
                        <td>모듈{score.moduleId}<br />{score.moduleName}</td>
                        <td>{score.score.toFixed(2)}</td>
                        <td>{score.stage}</td>
                        <td>
                          <p className="diagnosisCombinedText">{diagnosisCombinedText(score, state.plan.diagnosisImplications?.[String(score.moduleId)])}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            {(state.project?.infrastructureDistributions.length ?? 0) > 0 && (
              <article className="panel wide">
                <h2>학교 디지털 기반 교육 현황 — 문항별 응답 분포</h2>
                <p className="formHint">운영계획서 Ⅰ장 현황표에 그대로 출력됩니다.</p>
                {state.project!.infrastructureDistributions.map((question) => (
                  <div className="distBlock" key={question.question}>
                    <strong>{question.question}</strong>
                    <div className="bars">
                      {question.options.map((option) => (
                        <div className="barRow" key={option.label}>
                          <span>{option.label}</span>
                          <div className="barTrack">
                            <div className="barFill satisfy" style={{ width: `${Math.min(100, Math.max(2, option.ratio))}%` }} />
                          </div>
                          <strong>{option.ratio.toFixed(1)}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </article>
            )}
            {(state.project?.openEndedQuestions.length ?? 0) > 0 && (
              <article className="panel wide">
                <h2>서술형 응답 정리</h2>
                {state.project!.openEndedQuestions.map((question) => (
                  <div className="distBlock" key={question.question}>
                    <strong>{question.question}</strong>
                    <ul className="openEndedList">
                      {question.responses.map((responseText, index) => (
                        <li key={index}>{responseText}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            )}
            <article className="panel wide" {...help("도약, 만족, 추월 단계의 의미를 확인하는 참고 영역입니다.")}>
              <h2>단계별 설명</h2>
              <div className="stageGuideGrid">
                {Object.entries(stageDescriptions).map(([stage, description]) => (
                  <div className={`stageGuide ${stageTone(stage as keyof typeof stageDescriptions)}`} key={stage}>
                    <strong>{stage}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel" {...help("점수가 낮아 사전면담과 연수 설계에서 먼저 확인할 영역입니다.")}>
              <h2>우선 확인 TOP 3</h2>
              {insights.lows.map((item) => (
                <div className="miniCard warn" key={item.moduleId}>
                  <strong>{item.moduleName}</strong>
                  <span>{item.score.toFixed(2)}점 · {item.stage}</span>
                </div>
              ))}
            </article>
            <article className="panel" {...help("상대적으로 점수가 높아 강점으로 활용할 수 있는 영역입니다.")}>
              <h2>강점 TOP 3</h2>
              {insights.highs.map((item) => (
                <div className="miniCard good" key={item.moduleId}>
                  <strong>{item.moduleName}</strong>
                  <span>{item.score.toFixed(2)}점 · {item.stage}</span>
                </div>
              ))}
            </article>
            <article className="panel wide" {...help("AI가 만든 종합 분석문을 사람이 직접 수정하는 영역입니다. 운영계획서 현황 분석에 반영됩니다.")}>
              <h2>분석 초안 편집</h2>
              <textarea
                value={state.plan.editedInsights}
                onChange={(event) => patchPlan({ editedInsights: event.target.value, insightSource: "edited" })}
                placeholder="CSV 업로드 후 운영계획서에 반영할 분석 초안을 편집하세요."
              />
            </article>
          </section>
        )}

        {state.activeTab === "school" && (
          <SchoolInfoForm school={state.school} schoolName={state.project?.schoolName ?? ""} showHelp={showHelp} onChange={patchSchool} />
        )}

        {state.activeTab === "interview" && (
          <section className="formStack">
            <div className="panel">
              <div className="sectionToolbar">
                <div>
                  <h2>심층면담지 작성</h2>
                  <p className="formHint">진단 결과, 녹음 전사, 입력된 면담 내용을 바탕으로 Ⅴ. 기타 고려사항과 Ⅵ. 심층면담 결과 핵심 요약을 작성합니다.</p>
                </div>
                <button className="button primary" onClick={() => runAiDraft("interview-plan", "interview", "interview-core")} disabled={aiDraftingTask === "interview-plan"}>
                  {aiDraftingTask === "interview-plan" ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "interview-plan" ? "AI 작성중" : "AI 면담 항목 작성"}
                </button>
              </div>
            </div>
            <InterviewFormView interview={state.interview} onChange={patchInterview} />
          </section>
        )}

        {state.activeTab === "modules" && (
          <section className="moduleLayout">
            <div className="moduleCards">
              <div className="panel moduleAiPanel">
                <div>
                  <p className="eyebrow">선택 입력</p>
                  <h2>강의종합 CSV 일정 반영</h2>
                  <p>강의종합 CSV가 있는 학교만 업로드하세요. 없으면 직접 차시, 방식, 일정, 시간, 장소, 희망 주제를 입력하면 됩니다.</p>
                </div>
                <label className="button ghost">
                  <CalendarDays size={17} />
                  강의종합 CSV
                  <input type="file" accept=".csv" onChange={fileInputHandler(handleLectureScheduleCsv)} />
                </label>
              </div>
              <div className="panel moduleAiPanel">
                <div>
                  <p className="eyebrow">AI 작성 보조</p>
                  <h2>프로그램 초안·기대효과 작성</h2>
                  <p>사람이 정한 차시, 방식, 일정, 시간, 장소, 희망 주제는 유지하고, 선택된 과정의 프로그램명·우리학교 목소리·세부 프로그램 초안·기대효과만 작성합니다.</p>
                </div>
                <button className="button primary" onClick={() => runAiDraft("module-content")} disabled={aiDraftingTask === "module-content"}>
                  {aiDraftingTask === "module-content" ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "module-content" ? "AI 작성중" : "AI 초안 작성"}
                </button>
              </div>
              {state.modules.map((module) => (
                <article className={`moduleCard ${module.selected ? "selected" : ""}`} key={module.id} {...help(module.selected ? `${module.name} 과정의 차시, 일정, 희망 주제와 AI 초안을 편집합니다.` : `${module.name} 과정입니다. 선택하면 세부 입력 영역이 열립니다.`)}>
                  <div className="moduleHead">
                    <button className="moduleTitle" onClick={() => applyModule(module.id)}>
                      {module.selected && <CheckCircle2 size={18} />}
                      <span>{module.id}. {module.name}</span>
                    </button>
                    <label className="switch">
                      <input type="checkbox" checked={module.selected} disabled={module.required} onChange={(event) => updateModule(module.id, { selected: event.target.checked })} />
                      <span>{module.required ? "필수" : "선택"}</span>
                    </label>
                  </div>
                  <button className="button primary compact moduleDraftButton" onClick={() => runModuleDraft(module.id)} disabled={moduleDraftingId === module.id}>
                    {moduleDraftingId === module.id ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={15} />}
                    {moduleDraftingId === module.id ? "작성 중" : "AI 초안 작성"}
                  </button>
                  <p className="moduleDescription">{module.description}</p>
                  <div className="moduleGrid">
                    <label>차시<input type="number" min={0} value={module.hours} onChange={(event) => updateModule(module.id, { hours: Number(event.target.value) })} /></label>
                    <label>방식<select value={module.method} onChange={(event) => updateModule(module.id, { method: event.target.value as TrainingModule["method"] })}><option>오프라인</option><option>온라인</option></select></label>
                    <label>일정<input value={module.date} onChange={(event) => updateModule(module.id, { date: event.target.value })} /></label>
                    <label>시간<input value={module.time} onChange={(event) => updateModule(module.id, { time: event.target.value })} /></label>
                    <label>장소<input value={module.place} onChange={(event) => updateModule(module.id, { place: event.target.value })} /></label>
                    <label>인원<input value={module.headcount} onChange={(event) => updateModule(module.id, { headcount: event.target.value })} /></label>
                    <label>회차<input value={module.sessionRound} onChange={(event) => updateModule(module.id, { sessionRound: event.target.value })} placeholder="예: 1" /></label>
                    <label>중점 도구<input value={module.mainTool} onChange={(event) => updateModule(module.id, { mainTool: event.target.value })} placeholder="예: GEMINI" /></label>
                    <label>운영 주제<input value={module.topic} onChange={(event) => updateModule(module.id, { topic: event.target.value })} /></label>
                  </div>
                  {module.selected && (
                    <div className="programEditor">
                      <label>
                        프로그램명(주제)
                        <input value={module.programName} onChange={(event) => updateModule(module.id, { programName: event.target.value })} placeholder={`예: ${state.project?.schoolName ?? "우리학교"} 알아보기`} />
                      </label>
                      <label>
                        우리학교 목소리
                        <input value={module.schoolVoice} onChange={(event) => updateModule(module.id, { schoolVoice: event.target.value })} placeholder="면담·진단에서 확인된 학교 요구" />
                      </label>
                      <label>
                        세부 프로그램 초안
                        <textarea value={module.editableProgram} onChange={(event) => updateModule(module.id, { editableProgram: event.target.value })} />
                      </label>
                      <label>
                        기대효과
                        <textarea value={module.expectedEffect} onChange={(event) => updateModule(module.id, { expectedEffect: event.target.value })} />
                      </label>
                      <label>
                        준비물/확인사항
                        <input value={module.materials} onChange={(event) => updateModule(module.id, { materials: event.target.value })} />
                      </label>
                      <label>
                        비고
                        <input value={module.note} onChange={(event) => updateModule(module.id, { note: event.target.value })} />
                      </label>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <aside className="panel rules">
              <h2>운영 기준 확인</h2>
              {validations.map((item) => (
                <div className={`rule ${item.level}`} key={item.message}>{item.message}</div>
              ))}
            </aside>
          </section>
        )}

        {state.activeTab === "plan" && (
          <section className="formStack">
            <div className="panel">
              <div className="sectionToolbar">
                <div>
                  <h2>운영계획서 작성</h2>
                  <p className="formHint">운영계획서.pdf 양식 순서(Ⅰ 현황 → Ⅱ 강점·과제 → Ⅲ 면담 요약 → Ⅳ 이슈→목표 → Ⅴ 로드맵)대로 출력됩니다. Ⅰ장 현황·진단 분석은 진단 분석 탭에서 편집합니다.</p>
                </div>
                <button className="button primary" onClick={() => runAiDraft("interview-plan", "plan")} disabled={aiDraftingTask === "interview-plan"}>
                  {aiDraftingTask === "interview-plan" ? <span className="aiSpinner" aria-hidden="true" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "interview-plan" ? "AI 분석중" : "AI 초안"}
                </button>
              </div>
            </div>
            <PlanFormView plan={state.plan} onChange={patchPlan} onAiDraft={(section) => runAiDraft("interview-plan", "plan", section)} isAiBusy={aiDraftingTask === "interview-plan"} />
          </section>
        )}

        {state.activeTab === "guide" && (
          <section className="grid">
            <article className="panel">
              <h2>연수 구성 확인</h2>
              {state.project ? (
                <div className="guideMetric">
                  <strong>{selectedHours}차시 구성</strong>
                  <span>최소 12차시까지 {Math.max(0, 12 - selectedHours)}차시 남음</span>
                  <span className={errorCount ? "danger" : "ok"}>{errorCount ? `${errorCount}개 확인 필요` : "운영 기준 충족"}</span>
                </div>
              ) : (
                <p className="formHint">진단 CSV를 업로드하기 전에는 연수 구성 검증을 확정할 수 없습니다.</p>
              )}
              {validations.map((item) => (
                <div className={`rule ${item.level}`} key={item.message}>{item.message}</div>
              ))}
            </article>
            <article className="panel">
              <h2>심층면담 필수 안내</h2>
              <p className="formHint">학교 연수담당자에게 안내한 항목을 체크합니다. 체크 결과는 심층면담지 DOCX에 반영됩니다.</p>
              <div className="noticeList">
                {noticeItems.map((item, index) => (
                  <label className={`noticeItem ${state.interview.noticeChecks[index] ? "checked" : ""}`} key={item.title}>
                    <input type="checkbox" checked={state.interview.noticeChecks[index] ?? false} onChange={() => toggleNotice(index)} />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </label>
                ))}
              </div>
            </article>
            <article className="panel">
              <h2>학교 안내용 운영 안내</h2>
              <div className="guideList">
                <p><strong>과정 구성</strong> 총 5개 과정, 12차시 이상 운영합니다. 필수 2개 과정과 선택 3개 과정을 포함합니다.</p>
                <p><strong>필수 과정</strong> 0과정 ‘우리 학교 알아보기’는 첫 연수로, 7과정 ‘우리 학교 돌아보기’는 마지막 환류 과정으로 운영합니다. 두 과정은 각 1차시이며 오프라인 운영이 원칙입니다.</p>
                <p><strong>선택 과정</strong> 1~6과정 중 3개 이상을 선택합니다. 교직원·교원·학교 리더 과정은 과정당 2차시 이상을 권장하고, 학생·학부모 과정은 1차시 운영이 가능합니다.</p>
                <p><strong>차시 조율</strong> 필수 제외 선택 과정은 최대 15차시, 필수 포함 전체 최대 17차시 범위에서 학교와 코디네이터가 협의합니다.</p>
                <p><strong>운영 방식</strong> 모든 과정은 오프라인이 원칙입니다. 부득이한 경우 1~6과정에 한해 전체 연수 차시의 30% 이내에서 온라인 또는 블렌디드 운영을 협의할 수 있습니다.</p>
                <p><strong>식사·다과</strong> 사업 기간 내 식사 1회, 간식 3회가 제공됩니다. 리더십 과정 운영 시 예산 범위에서 식사 1회를 추가 제공할 수 있으며, 식사 시간은 연수 차시에 포함하지 않습니다.</p>
                <p><strong>제공 제외</strong> 학부모·학생·온라인 연수에는 식사와 다과가 제공되지 않습니다.</p>
                <p><strong>출석과 이수</strong> 연수 시작 전·후 출석 QR 태그가 필요합니다. 교사는 과정별 80% 이상 수강 시 직무이수 처리가 가능합니다.</p>
                <p><strong>일정 협의</strong> 운영계획서 일정은 운영 준비를 위한 예상 일정이며, 담당교사와 코디네이터가 지속적으로 소통하며 조율합니다.</p>
              </div>
            </article>
          </section>
        )}

        {state.activeTab === "export" && (
          <section className="grid">
            <article className="panel wide">
              <div className="sectionToolbar">
                <div>
                  <p className="eyebrow">최종 검토</p>
                  <h2>최종 학교 스케줄표</h2>
                </div>
                <button className="button ghost" onClick={downloadScheduleCsv}>
                  <CalendarDays size={17} />
                  스케줄표 CSV
                </button>
              </div>
              <ScheduleTable modules={selectedModules} schoolName={state.project?.schoolName ?? "새학교"} onCopy={(event) => copyTable(event, "최종 학교 스케줄표")} />
            </article>
            <article className="panel downloadCard">
              <FileText size={34} />
              <h2>심층면담지 DOCX</h2>
              <p>필수 안내 확인, 운영 개요, 학교 일반사항·인프라, 참여 목표, 친화도 진단, 모듈 구성, 고려사항, 핵심 요약을 PDF 양식 순서로 생성합니다.</p>
              <button className="button primary" onClick={handleDownloadInterviewDocx} disabled={docxGenerating !== null}>
                {docxGenerating === "interview" ? <span className="aiSpinner" aria-hidden="true" /> : <FileDown size={18} />}
                {docxGenerating === "interview" ? "생성 중" : "다운로드"}
              </button>
            </article>
            <article className="panel downloadCard">
              <FileText size={34} />
              <h2>운영계획서 DOCX</h2>
              <p>현황 분석, 강점·도전과제, 1·2차 면담 요약, 이슈→목표, 과정별 세부 프로그램·기대효과를 PDF 양식 순서로 생성합니다.</p>
              <button className="button primary" onClick={handleDownloadPlanDocx} disabled={docxGenerating !== null}>
                {docxGenerating === "plan" ? <span className="aiSpinner" aria-hidden="true" /> : <FileDown size={18} />}
                {docxGenerating === "plan" ? "생성 중" : "다운로드"}
              </button>
            </article>
            <article className="panel workFileCard wide">
              <div>
                <p className="eyebrow">선택 사항</p>
                <h2>작업 파일 관리</h2>
                <p>현재 입력 내용과 AI 초안, 연수 구성, 운영계획 입력값을 JSON으로 보관합니다. 같은 웹앱에서 불러오면 이어서 작성할 수 있으며 원본 CSV/PDF 파일 자체는 포함되지 않습니다.</p>
              </div>
              <div className="workFileActions">
                <label className="button ghost">
                  <FolderOpen size={17} />
                  작업 불러오기
                  <input type="file" accept=".json" onChange={fileInputHandler(restoreBackup)} />
                </label>
                <button className="button ghost" onClick={downloadBackup}>
                  <Download size={17} />
                  작업 저장
                </button>
              </div>
            </article>
          </section>
        )}
        <footer className="appFooter">Copyright © 2026 서울가동초등학교 백인규. All rights reserved.</footer>
      </main>
    </div>
  );
}

function tabHelp(tab: string) {
  const guide: Record<string, string> = {
    diagnosis: "자가진단 CSV를 바탕으로 평균 점수, 강점·과제, 분석 결과와 시사점을 확인하는 화면입니다.",
    school: "학교 일반사항과 인프라를 입력합니다. CSV 업로드 후 나이스 학교정보가 자동 조회되며, 버튼으로 다시 조회할 수도 있습니다.",
    interview: "심층면담지 항목을 작성하고 녹음 전사 또는 AI 초안으로 면담 내용을 정리합니다.",
    modules: "연수 과정을 선택하고 차시, 일정, 희망 주제, 과정별 AI 초안을 작성합니다. 선택하지 않은 과정은 접힙니다.",
    plan: "운영계획서 본문에 들어갈 강점·과제, 면담 요약, 이슈와 목표, 로드맵을 작성합니다.",
    guide: "학교에 안내할 연수 운영 기준과 현재 구성의 확인 사항을 모아 설명합니다.",
    export: "최종 일정표 CSV와 심층면담지/운영계획서 DOCX를 내려받습니다."
  };
  return guide[tab] ?? "";
}

function moduleHelp(moduleId: number, modules: TrainingModule[]) {
  const moduleCourseGuide: Record<number, string> = {
    0: "0. 우리 학교 알아보기: 필수 과정입니다. 교직원이 사전 자가진단 결과와 학교 여건을 함께 확인하고, 연수 목표와 운영 방향을 맞추는 1차시 오프라인 과정입니다.",
    1: "1. 학교 AI·디지털 리더 과정: 학교 관리자 대상 2~3차시 과정입니다. 학교 단위 AI·디지털 교육 전환 방향과 리더십, 운영 체계를 논의합니다.",
    2: "2. 수업혁신을 위한 학부모의 이해: 학부모 대상 1~3차시 과정입니다. AI·디지털 기반 수업 변화와 학교 교육 방향에 대한 공감대를 형성합니다.",
    3: "3. 학생 AI·디지털 기초 소양 교육: 학생 대상 1~3차시 과정입니다. AI·디지털 도구의 안전하고 책임 있는 활용과 기초 소양을 다룹니다.",
    4: "4. AI·디지털 문제해결 실무 과정: 교직원 대상 2~3차시 과정입니다. 수업·업무 현장의 문제를 AI·디지털 도구로 해결하는 실습 중심 과정입니다.",
    5: "5. 교과별 AI·디지털 수업실천 과정: 교원 대상 2~3차시 과정입니다. 교과 성취기준과 수업 목표에 맞춰 AI·디지털 도구 활용 수업을 설계하고 실천 방안을 다룹니다.",
    6: "6. AI·디지털 수업 자율 주제 과정: 교원 대상 2~3차시 과정입니다. 학교가 희망하는 자율 주제를 바탕으로 맞춤형 수업 설계와 실습을 운영합니다.",
    7: "7. 우리 학교 돌아보기: 필수 과정입니다. 연수 후 학교 변화와 실행 결과를 돌아보고, 지속 운영 방향을 정리하는 1차시 오프라인 환류 과정입니다."
  };
  if (moduleCourseGuide[moduleId]) return moduleCourseGuide[moduleId];
  const module = modules.find((item) => item.id === moduleId);
  if (!module) return "이 과정의 평균 점수와 단계입니다.";
  return `${module.id}. ${module.name}: ${module.description}`;
}

function polishDraftText(text: string) {
  return text
    .replace(/극대화함/g, "높일 필요가 있습니다")
    .replace(/마련함/g, "마련할 필요가 있습니다")
    .replace(/개발함/g, "개발할 필요가 있습니다")
    .replace(/정립함/g, "정립할 필요가 있습니다")
    .replace(/공유함/g, "공유할 필요가 있습니다")
    .replace(/확산함/g, "확산할 필요가 있습니다")
    .replace(/강화함/g, "강화할 필요가 있습니다")
    .replace(/제고함/g, "높일 필요가 있습니다");
}

function ScheduleTable({ modules, schoolName, onCopy }: { modules: TrainingModule[]; schoolName: string; onCopy?: (event: MouseEvent<HTMLElement>) => void }) {
  if (modules.length === 0) {
    return <p className="emptyText">선택된 과정이 없습니다. 연수 구성에서 과정을 선택하면 스케줄표가 생성됩니다.</p>;
  }

  return (
    <div className="tableScroller copyableTable" onClick={onCopy} title="클릭하면 표 내용을 복사합니다.">
      <table className="scheduleTable">
        <thead>
          <tr>
            <th>순번</th>
            <th>과정</th>
            <th>대상</th>
            <th>차시</th>
            <th>일정</th>
            <th>시간</th>
            <th>장소</th>
            <th>인원</th>
            <th>방식</th>
            <th>중점 도구</th>
            <th>운영 주제</th>
            <th>준비물/확인사항</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module, index) => (
            <tr key={module.id}>
              <td>{index + 1}</td>
              <td>{module.id}. {module.name}</td>
              <td>{module.target}</td>
              <td>{module.hours}차시</td>
              <td>{module.date || "학교 확인 필요"}</td>
              <td>{module.time || "학교 확인 필요"}</td>
              <td>{module.place || schoolName}</td>
              <td>{module.headcount || "학교 확인 필요"}</td>
              <td>{module.method}</td>
              <td>{module.mainTool || "-"}</td>
              <td>{module.topic || "학교 확인 필요"}</td>
              <td>{module.materials || "학교 확인 필요"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function diagnosisCombinedText(score: ModuleScore, aiImplication?: string) {
  if (aiImplication?.trim()) {
    return normalizeDiagnosisAnalysis(aiImplication);
  }
  return `${diagnosisResultText(score)} ${normalizeDiagnosisAnalysis(diagnosisImplicationText(score))}`;
}

function normalizeDiagnosisAnalysis(text: string) {
  const cleaned = polishDraftText(text)
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
    .replace(/공유함/g, "공유할 필요가 있습니다")
    .replace(/[.。]+$/g, "");
  if (!cleaned) return "연수 구성과 면담 내용을 함께 검토해 학교 맞춤형 실행 방향을 구체화할 필요가 있습니다.";
  return `${cleaned}.`;
}

function sectionCompletionText(section?: AiDraftRequest["draftSection"]) {
  if (section === "interview-core") return "심층면담 결과 핵심요약 초안을 반영했습니다.";
  if (section === "interview-summary") return "심층면담 1차 결과 요약 초안을 반영했습니다.";
  if (section === "second-interview") return "심층면담 2차 이상 결과 요약 초안을 반영했습니다.";
  if (section === "issue-goals") return "이슈와 목표 도출 초안을 반영했습니다.";
  if (section === "roadmap") return "로드맵 및 기대효과 종합 의견을 반영했습니다.";
  return "AI 초안을 작성해 화면에 반영했습니다.";
}

function sectionPreviewText(section?: AiDraftRequest["draftSection"]) {
  if (section === "interview-core") return "Ⅴ. 기타 고려사항과 Ⅵ. 심층면담 결과 핵심 요약에 들어갈 초안을 확인합니다.";
  if (section === "interview-summary") return "운영계획서의 심층면담 1차 결과 요약 초안을 확인합니다.";
  if (section === "second-interview") return "심층면담 2차 이상 결과 요약과 향후 예정사항 초안을 확인합니다.";
  if (section === "issue-goals") return "이슈→목표 도출과 로드맵 방향 초안을 확인합니다.";
  if (section === "roadmap") return "로드맵 및 기대효과 종합 의견 초안을 확인합니다.";
  return "AI가 작성한 초안을 확인한 뒤 적용합니다.";
}

function previewRows(preview: AiPreviewState, modules: TrainingModule[]) {
  const draft = preview.draft;
  if (preview.task === "diagnosis") {
    return [
      { label: "진단 종합 분석", value: draft.diagnosisInsight },
      { label: "강점 01", value: draft.strength1 },
      { label: "강점 02", value: draft.strength2 },
      { label: "과제 01", value: draft.challenge1 },
      { label: "과제 02", value: draft.challenge2 },
      { label: "과정별 분석 및 시사점", value: Object.entries(draft.diagnosisImplications ?? {}).map(([key, value]) => `모듈${key}: ${value}`).join("\n") }
    ].filter((row) => row.value);
  }
  if (preview.task === "module-content") {
    return (draft.moduleUpdates ?? []).map((update) => {
      const module = modules.find((item) => item.id === update.id);
      return {
        label: `${update.id}. ${module?.name ?? "과정"} 초안`,
        value: [
          update.programName && `프로그램명: ${update.programName}`,
          update.schoolVoice && `우리학교 목소리: ${update.schoolVoice}`,
          update.editableProgram && `세부 프로그램: ${update.editableProgram}`,
          update.expectedEffect && `기대효과: ${update.expectedEffect}`,
          update.materials && `준비물/확인사항: ${update.materials}`
        ].filter(Boolean).join("\n")
      };
    });
  }
  if (preview.draftSection === "interview-core") {
    return [
      { label: "선행 수준 확인", value: draft.priorLevel },
      { label: "인프라 환경 고려사항", value: draft.infraConsiderations },
      { label: "학교 측 별도 요청사항", value: draft.schoolRequests },
      { label: "기타 확인 필요사항", value: draft.additionalChecks },
      { label: "면담 대상 학교의 연수 참여 목표", value: draft.participationGoal },
      { label: "면담 핵심 결과", value: draft.interviewResultSummary }
    ].filter((row) => row.value);
  }
  if (preview.draftSection === "interview-summary") return [{ label: "심층면담 1차 결과 요약", value: draft.interviewSummary }];
  if (preview.draftSection === "second-interview") {
    return [
      { label: "심층면담 2차 이상 결과 요약", value: draft.interviewSummary ?? draft.interviewResultSummary },
      { label: "향후 예정사항", value: draft.roadmapDirection }
    ].filter((row) => row.value);
  }
  if (preview.draftSection === "issue-goals") {
    return [
      { label: "이슈→목표", value: (draft.issueGoals ?? []).map((item, index) => `이슈 0${index + 1}: ${item.issue}\n목표 0${index + 1}: ${item.goal}`).join("\n\n") },
      { label: "우리학교 혁신 로드맵 방향", value: draft.roadmapDirection }
    ].filter((row) => row.value);
  }
  if (preview.draftSection === "roadmap") {
    return [
      { label: "우리학교 혁신 로드맵 방향", value: draft.roadmapDirection },
      { label: "로드맵 및 기대효과 종합 의견", value: draft.roadmapNotes }
    ].filter((row) => row.value);
  }
  return [{ label: "AI 초안", value: "적용 가능한 초안을 확인했습니다." }];
}

function diagnosisResultText(score: ModuleScore) {
  const stageLabel = score.score < 3.8 ? "도약" : score.score < 4.6 ? "만족" : "추월";
  if (score.score < 3.8) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 구성원의 공감대와 실행 기반을 더 촘촘히 확인할 필요가 있는 영역으로 해석됩니다.`;
  }
  if (score.score < 4.6) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 기본적인 이해와 실행 의지는 형성되어 있으나, 실제 수업·업무 적용 경험을 더 넓힐 여지가 있습니다.`;
  }
  return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 이미 높은 실행 기반을 갖춘 강점 영역으로 볼 수 있습니다.`;
}

function diagnosisImplicationText(score: ModuleScore) {
  if (score.score < 3.8) {
    return `시사점: 연수에서는 기본 개념 정리, 안전한 실습, 구성원 간 공감대 형성을 우선 배치하고 사전면담에서 참여 장벽과 필요한 지원 방식을 구체적으로 확인할 필요가 있습니다.`;
  }
  if (score.score < 4.6) {
    return `시사점: 학교 상황에 맞는 실습과 공동 설계 활동을 통해 현재의 이해 수준을 실제 적용력으로 전환하고, 과정별 산출물이 수업·업무 개선으로 이어지도록 설계할 필요가 있습니다.`;
  }
  return `시사점: 강점 영역의 우수 사례를 공유하고 다른 과정과 연결해 학교 전체의 지속 가능한 디지털 교육 운영 모델로 확산하는 방향이 적절합니다.`;
}

function deriveStrengthText(score?: ModuleScore) {
  if (!score) return "AI 심층 분석을 실행하면 진단 결과를 바탕으로 강점이 작성됩니다.";
  return `${score.moduleName} 영역의 응답 수준이 상대적으로 높아 학교 구성원의 기본 이해와 참여 기반이 확인됩니다. 이 강점을 연수 전반의 실행 동력으로 활용할 수 있습니다.`;
}

function deriveChallengeText(score?: ModuleScore) {
  if (!score) return "AI 심층 분석을 실행하면 진단 결과를 바탕으로 도전 과제가 작성됩니다.";
  return `${score.moduleName} 영역은 우선 보완이 필요한 지점입니다. 연수에서 구체적인 사례, 실습, 적용 계획을 함께 다루어 현장 실행력을 높일 필요가 있습니다.`;
}

function mergeModuleAiUpdate(module: TrainingModule, update: AiModuleUpdate, schoolName: string): TrainingModule {
  return {
    ...module,
    selected: module.required ? true : update.selected ?? module.selected,
    hours: module.required ? 1 : typeof update.hours === "number" ? update.hours : module.hours,
    date: update.date ?? module.date,
    time: update.time ?? module.time,
    method: update.method ?? module.method,
    mainTool: update.mainTool ?? module.mainTool,
    topic: update.topic ?? module.topic,
    programName: update.programName ?? module.programName,
    schoolVoice: update.schoolVoice ?? module.schoolVoice,
    editableProgram: update.editableProgram ?? module.editableProgram,
    expectedEffect: update.expectedEffect ?? module.expectedEffect,
    materials: update.materials ?? module.materials,
    place: update.place || module.place || schoolName
  };
}

/**
 * <input type="file">는 같은 파일을 다시 선택해도 value가 안 바뀌었다고 보고 change 이벤트를
 * 안 쏜다. 그래서 처리 직후 value를 비워, 사용자가 같은 파일을 다시 골라도 항상 반응하게 한다.
 */
function fileInputHandler(handler: (file: File) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handler(file);
  };
}

function escapeCsv(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function todayStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}
