import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  FolderOpen,
  Mic,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Upload
} from "lucide-react";
import { InterviewFormView } from "./components/InterviewFormView";
import { LottiePlayer } from "./components/LottiePlayer";
import { PlanFormView } from "./components/PlanFormView";
import { SchoolInfoForm } from "./components/SchoolInfoForm";
import aiAnalysisLoader from "./assets/ai-analysis-loader.json";
import { generateAiDraft } from "./lib/ai";
import { summarizeInterviewTranscript, transcribeInterviewSegment } from "./lib/audio";
import { createInitialState, hydrateState } from "./lib/defaults";
import { buildInsights, stageDescriptions, stageTone } from "./lib/diagnosis";
import { parseDiagnosisCsv } from "./lib/csv/parseDiagnosisCsv";
import { parseLectureScheduleCsv } from "./lib/csv/parseLectureScheduleCsv";
import { downloadInterviewDocx, downloadPlanDocx } from "./lib/docx/exportDocs";
import { clearState, loadState, saveState } from "./lib/storage";
import { validateModules } from "./lib/validation";
import type { AiModuleUpdate, AppState, InterviewState, ModuleScore, PlanState, SchoolInfo, TrainingModule } from "./types";

// Vercel 함수 요청 크기 제한(약 4.5MB) 때문에 긴 면담 녹음은 구간으로 나눠 전사한다.
const SEGMENT_MS = 180_000;

const tabs = [
  ["diagnosis", "진단 분석"],
  ["school", "학교 정보"],
  ["interview", "심층면담"],
  ["modules", "연수 구성"],
  ["plan", "운영계획"],
  ["export", "다운로드"]
] as const;

const navigationTabs = [...tabs.slice(0, 5), ["guide", "운영 안내"], tabs[5]] as const;

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

  const stateRef = useRef(state);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const segmentIndexRef = useRef(0);
  const finalizingRef = useRef(false);
  const cancelledRef = useRef(false);
  const transcriptPartsRef = useRef<string[]>([]);
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

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function patchInterview(patch: Partial<InterviewState>) {
    setState((current) => ({ ...current, interview: { ...current.interview, ...patch } }));
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
      if (state.project) {
        const confirmed = window.confirm(
          `현재 ${state.project.schoolName} 작업(면담·연수 구성·운영계획 입력 포함)을 모두 지우고 ${project.schoolName} 프로젝트를 새로 시작할까요?\n\n기존 작업을 보관하려면 취소 후 다운로드 탭에서 '작업 저장'을 먼저 해주세요.`
        );
        if (!confirmed) {
          setUploadStatus("새 학교 업로드를 취소했습니다.");
          return;
        }
      }
      const fresh = createInitialState();
      setState({
        ...fresh,
        project,
        activeTab: "diagnosis",
        modules: fresh.modules.map((module) => ({ ...module, place: project.schoolName })),
        plan: { ...fresh.plan, editedInsights: buildInsights(project.moduleScores).draft }
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

  async function runAiDraft(task: "diagnosis" | "interview-plan" | "module-content") {
    if (!state.project) {
      setAiStatus("진단 CSV를 먼저 업로드해주세요.");
      return;
    }

    setAiStatus("AI 초안 생성 중");
    setAiDraftingTask(task);
    try {
      const draft = await generateAiDraft({
        task,
        schoolName: state.project.schoolName,
        project: state.project,
        school: state.school,
        modules: state.modules,
        interview: state.interview,
        plan: state.plan
      });

      setState((current) => {
        const nextModules = draft.moduleUpdates?.length
          ? current.modules.map((module) => {
              const update = draft.moduleUpdates?.find((item) => item.id === module.id);
              if (!update) return module;
              return mergeModuleContentUpdate(module, update);
            })
          : current.modules;

        return {
          ...current,
          modules: nextModules,
          interview: {
            ...current.interview,
            priorLevel: draft.priorLevel ?? current.interview.priorLevel,
            infraConsiderations: draft.infraConsiderations ?? current.interview.infraConsiderations,
            schoolRequests: draft.schoolRequests ?? current.interview.schoolRequests,
            additionalChecks: draft.additionalChecks ?? current.interview.additionalChecks,
            participationGoal: draft.participationGoal ?? current.interview.participationGoal,
            resultSummary: draft.interviewResultSummary ?? current.interview.resultSummary
          },
          plan: {
            ...current.plan,
            editedInsights: draft.diagnosisInsight ?? current.plan.editedInsights,
            diagnosisImplications: draft.diagnosisImplications ?? current.plan.diagnosisImplications,
            insightSource: draft.diagnosisInsight ? "ai" : current.plan.insightSource,
            strengths: draft.strength1 ?? current.plan.strengths,
            strength1: draft.strength1 ?? current.plan.strength1,
            strength2: draft.strength2 ?? current.plan.strength2,
            challenges: draft.challenge1 ?? current.plan.challenges,
            challenge1: draft.challenge1 ?? current.plan.challenge1,
            challenge2: draft.challenge2 ?? current.plan.challenge2,
            interviewSummary: draft.interviewSummary ?? current.plan.interviewSummary,
            issueGoals: normalizeIssueGoals(draft.issueGoals) ?? current.plan.issueGoals,
            roadmapDirection: draft.roadmapDirection ?? current.plan.roadmapDirection,
            roadmapNotes: draft.roadmapNotes ?? current.plan.roadmapNotes
          },
          activeTab: task === "diagnosis" ? "diagnosis" : task === "interview-plan" ? "interview" : "modules"
        };
      });
      setAiStatus("AI 초안 생성 완료");
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
      const update = draft.moduleUpdates?.find((item) => item.id === moduleId);
      if (!update) {
        setAiStatus("AI 초안을 받았지만 적용할 과정 내용이 없습니다.");
        return;
      }
      setState((current) => ({
        ...current,
        modules: current.modules.map((module) => (module.id === moduleId ? mergeModuleContentUpdate(module, update) : module)),
        activeTab: "modules"
      }));
      setAiStatus(`${targetModule.id}. ${targetModule.name} AI 초안 작성 완료`);
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
      transcriptPartsRef.current = stateRef.current.interview.transcript ? [stateRef.current.interview.transcript] : [];
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
    const recorder = new MediaRecorder(stream);
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
          if (transcript.trim()) appendTranscript(transcript.trim());
        } catch (error) {
          appendTranscript(`(구간 ${index + 1} 전사 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"})`);
        }
      }
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
      setState((current) => ({
        ...current,
        interview: {
          ...current.interview,
          priorLevel: summary.priorLevel || current.interview.priorLevel,
          infraConsiderations: summary.infraConsiderations || current.interview.infraConsiderations,
          schoolRequests: summary.schoolRequests || current.interview.schoolRequests,
          additionalChecks: summary.additionalChecks || current.interview.additionalChecks,
          participationGoal: summary.participationGoal || current.interview.participationGoal,
          resultSummary: summary.resultSummary || current.interview.resultSummary
        },
        plan: {
          ...current.plan,
          interviewSummary: summary.planInterviewSummary || current.plan.interviewSummary
        }
      }));
      setRecordingStatus("전사 및 AI 분석 완료 · 심층면담 항목에 반영했습니다.");
    } catch (error) {
      setRecordingStatus(error instanceof Error ? error.message : "면담 종합 분석 실패");
    }
  }

  function stopInterviewRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    finalizingRef.current = true;
    if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
    setIsRecording(false);
    setRecordingStatus("녹음 종료 · 마지막 구간 전사 중");
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
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project?.schoolName ?? "school"}_컨설팅_백업.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadScheduleCsv() {
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
      setState(hydrateState(parsed));
      setUploadStatus("작업 파일을 불러왔습니다.");
    } catch (error) {
      setUploadStatus(error instanceof Error ? `작업 불러오기 실패: ${error.message}` : "작업 불러오기 실패");
    }
  }

  async function resetWorkspace() {
    const confirmed = window.confirm("현재 입력한 내용과 자동저장된 작업을 모두 지우고 처음부터 시작할까요?");
    if (!confirmed) return;
    cancelRecording();
    await clearState();
    setState(createInitialState());
    setUploadStatus("");
    setScheduleStatus("");
    setAiStatus("");
    setRecordingStatus("");
    setSaveStatus("새 프로젝트");
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
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebarFooter">
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
        <header className="topbar">
          <div>
            <p className="eyebrow">표준 파서: 서울고일초_사전 자가진단 분석.csv</p>
            <h1>{state.project?.schoolName ?? "학교 컨설팅 문서 생성 웹앱"}</h1>
          </div>
          <div className="actions">
            <label className="button ghost">
              <Upload size={17} />
              진단 CSV
              <input type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && handleCsv(event.target.files[0])} />
            </label>
          </div>
        </header>

        <section className="validationStrip">
          <strong>{selectedHours}차시 구성</strong>
          <span>최소 12차시까지 {Math.max(0, 12 - selectedHours)}차시 남음</span>
          <span className={errorCount ? "danger" : "ok"}>{errorCount ? `${errorCount}개 오류` : "PDF 기준 충족"}</span>
          <span>식사/다과 안내는 PDF 기준만 표시</span>
        </section>

        {state.activeTab === "guide" && uploadStatus && <div className="notice">{uploadStatus}</div>}
        {state.activeTab === "guide" && scheduleStatus && <div className="notice scheduleNotice"><CalendarDays size={17} />{scheduleStatus}</div>}
        {state.activeTab === "guide" && aiStatus && <div className="notice aiNotice"><Sparkles size={17} />{aiStatus}</div>}
        {state.activeTab === "guide" && recordingStatus && <div className="notice recordingNotice"><Mic size={17} />{recordingStatus}</div>}
        {isAiBusy && state.activeTab !== "guide" && (
          <div className="aiBusyBanner">
            <LottiePlayer animationData={aiAnalysisLoader} className="aiBusyAnimation small" label="AI 분석중" />
            <span>{moduleDraftingId !== null ? `${moduleDraftingId}번 과정 AI 초안 작성중` : "AI 분석중"}</span>
          </div>
        )}

        {state.activeTab === "diagnosis" && (
          <section className="grid">
            <article className="panel heroPanel">
              <div>
                <p className="eyebrow">{insightSourceLabel}</p>
                <h2>{insights.average ? `${insights.average.toFixed(2)}점` : "CSV를 업로드하세요"}</h2>
                <p>{diagnosisSummary}</p>
                <button className="button primary inlineAction" onClick={() => runAiDraft("diagnosis")} disabled={aiDraftingTask === "diagnosis"}>
                  {aiDraftingTask === "diagnosis" ? <LottiePlayer animationData={aiAnalysisLoader} className="buttonLottie" label="AI 분석중" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "diagnosis" ? "AI 분석중" : "AI로 심층 분석"}
                </button>
              </div>
              {aiDraftingTask === "diagnosis" ? <LottiePlayer animationData={aiAnalysisLoader} className="heroLottie" label="AI 분석중" /> : <BarChart3 className="heroIcon" />}
            </article>
            <article className="panel wide">
              <h2>과정별 평균 점수</h2>
              <div className="bars">
                {(state.project?.moduleScores ?? []).map((score) => (
                  <div className="barRow" key={score.moduleId}>
                    <span>{score.moduleId}. {score.moduleName}</span>
                    <div className="barTrack">
                      <div className={`barFill ${stageTone(score.stage)}`} style={{ width: `${score.score * 20}%` }} />
                    </div>
                    <strong>{score.score.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel wide">
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
            <article className="panel wide">
              <h2>사전 진단 - 과정별 진단 분석 결과</h2>
              <div className="tableScroller">
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
                        <td>{state.plan.diagnosisImplications?.[String(score.moduleId)] || diagnosisResultText(score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            {false && (state.project?.infrastructureDistributions.length ?? 0) > 0 && (
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
            {false && (state.project?.openEndedQuestions.length ?? 0) > 0 && (
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
            <article className="panel wide">
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
            <article className="panel">
              <h2>우선 확인 TOP 3</h2>
              {insights.lows.map((item) => (
                <div className="miniCard warn" key={item.moduleId}>
                  <strong>{item.moduleName}</strong>
                  <span>{item.score.toFixed(2)}점 · {item.stage}</span>
                </div>
              ))}
            </article>
            <article className="panel">
              <h2>강점 TOP 3</h2>
              {insights.highs.map((item) => (
                <div className="miniCard good" key={item.moduleId}>
                  <strong>{item.moduleName}</strong>
                  <span>{item.score.toFixed(2)}점 · {item.stage}</span>
                </div>
              ))}
            </article>
            <article className="panel wide">
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
          <SchoolInfoForm school={state.school} schoolName={state.project?.schoolName ?? ""} onChange={patchSchool} />
        )}

        {state.activeTab === "interview" && (
          <section className="formStack">
            <div className="panel">
              <div className="sectionToolbar">
                <div>
                  <h2>심층면담지 작성</h2>
                  <p className="formHint">심층면담지.pdf 양식 순서 그대로 작성됩니다. 녹음하면 구간별로 자동 전사되고, 종료 시 면담 항목이 자동 채워집니다.</p>
                </div>
                <div className="toolbarActions">
                  <button className={isRecording ? "button dangerButton" : "button ghost"} onClick={isRecording ? stopInterviewRecording : startInterviewRecording}>
                    {isRecording ? <Square size={17} /> : <Mic size={17} />}
                    {isRecording ? "녹음 정지" : "녹음 시작"}
                  </button>
                  <button className="button primary" onClick={() => runAiDraft("interview-plan")} disabled={aiDraftingTask === "interview-plan"}>
                    {aiDraftingTask === "interview-plan" ? <LottiePlayer animationData={aiAnalysisLoader} className="buttonLottie" label="AI 분석중" /> : <Sparkles size={17} />}
                    {aiDraftingTask === "interview-plan" ? "AI 분석중" : "AI 초안"}
                  </button>
                </div>
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
                  <input type="file" accept=".csv" onChange={(event) => event.target.files?.[0] && handleLectureScheduleCsv(event.target.files[0])} />
                </label>
              </div>
              <div className="panel moduleAiPanel">
                <div>
                  <p className="eyebrow">AI 작성 보조</p>
                  <h2>프로그램 초안·기대효과 작성</h2>
                  <p>사람이 정한 차시, 방식, 일정, 시간, 장소, 희망 주제는 유지하고, 선택된 과정의 프로그램명·우리학교 목소리·세부 프로그램 초안·기대효과만 작성합니다.</p>
                </div>
                <button className="button primary" onClick={() => runAiDraft("module-content")} disabled={aiDraftingTask === "module-content"}>
                  {aiDraftingTask === "module-content" ? <LottiePlayer animationData={aiAnalysisLoader} className="buttonLottie" label="AI 분석중" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "module-content" ? "AI 작성중" : "AI 초안 작성"}
                </button>
              </div>
              {state.modules.map((module) => (
                <article className={`moduleCard ${module.selected ? "selected" : ""}`} key={module.id}>
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
                    {moduleDraftingId === module.id ? <LottiePlayer animationData={aiAnalysisLoader} className="buttonLottie" label="AI 분석중" /> : <Sparkles size={15} />}
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
              <h2>PDF 기준 검증</h2>
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
                <button className="button primary" onClick={() => runAiDraft("interview-plan")} disabled={aiDraftingTask === "interview-plan"}>
                  {aiDraftingTask === "interview-plan" ? <LottiePlayer animationData={aiAnalysisLoader} className="buttonLottie" label="AI 분석중" /> : <Sparkles size={17} />}
                  {aiDraftingTask === "interview-plan" ? "AI 분석중" : "AI 초안"}
                </button>
              </div>
            </div>
            <PlanFormView plan={state.plan} onChange={patchPlan} />
          </section>
        )}

        {state.activeTab === "guide" && (
          <section className="grid">
            <article className="panel">
              <h2>PDF 기준 검증</h2>
              <div className="guideMetric">
                <strong>{selectedHours}차시 구성</strong>
                <span>최소 12차시까지 {Math.max(0, 12 - selectedHours)}차시 남음</span>
                <span className={errorCount ? "danger" : "ok"}>{errorCount ? `${errorCount}개 오류` : "PDF 기준 충족"}</span>
              </div>
              {validations.map((item) => (
                <div className={`rule ${item.level}`} key={item.message}>{item.message}</div>
              ))}
            </article>
            <article className="panel">
              <h2>운영 안내</h2>
              <div className="guideList">
                <p>연수 구성 화면에서는 과정별 희망 주제를 먼저 입력한 뒤 각 과정의 <strong>AI 초안 작성</strong> 버튼을 눌러 세부 프로그램 초안, 기대효과, 준비물/확인사항을 작성합니다.</p>
                <p>사람이 입력한 차시, 방식, 일정, 시간, 장소, 인원, 희망 주제는 AI가 바꾸지 않도록 요청합니다.</p>
                <p>서울 지역의 학생용 디지털 기기는 안내 문구에서 <strong>디벗</strong> 표현을 사용할 수 있습니다.</p>
                <p>식사/다과 가능 여부는 공식 PDF 기준에 근거한 검증 메시지만 확인합니다.</p>
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
              <ScheduleTable modules={selectedModules} schoolName={state.project?.schoolName ?? "새학교"} />
            </article>
            <article className="panel downloadCard">
              <FileText size={34} />
              <h2>심층면담지 DOCX</h2>
              <p>필수 안내 확인, 운영 개요, 학교 일반사항·인프라, 참여 목표, 친화도 진단, 모듈 구성, 고려사항, 핵심 요약을 PDF 양식 순서로 생성합니다.</p>
              <button className="button primary" onClick={() => downloadInterviewDocx(state)}><FileDown size={18} />다운로드</button>
            </article>
            <article className="panel downloadCard">
              <FileText size={34} />
              <h2>운영계획서 DOCX</h2>
              <p>현황 분석, 강점·도전과제, 1·2차 면담 요약, 이슈→목표, 과정별 세부 프로그램·기대효과를 PDF 양식 순서로 생성합니다.</p>
              <button className="button primary" onClick={() => downloadPlanDocx(state)}><FileDown size={18} />다운로드</button>
            </article>
            <article className="panel workFileCard wide">
              <div>
                <p className="eyebrow">선택 사항</p>
                <h2>작업 파일 관리</h2>
                <p>현재 입력 상태를 파일로 보관하거나, 다른 컴퓨터·다른 학교 작업으로 이어서 할 때 사용합니다.</p>
              </div>
              <div className="workFileActions">
                <label className="button ghost">
                  <FolderOpen size={17} />
                  작업 불러오기
                  <input type="file" accept=".json" onChange={(event) => event.target.files?.[0] && restoreBackup(event.target.files[0])} />
                </label>
                <button className="button ghost" onClick={downloadBackup}>
                  <Download size={17} />
                  작업 저장
                </button>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function ScheduleTable({ modules, schoolName }: { modules: TrainingModule[]; schoolName: string }) {
  if (modules.length === 0) {
    return <p className="emptyText">선택된 과정이 없습니다. 연수 구성에서 과정을 선택하면 스케줄표가 생성됩니다.</p>;
  }

  return (
    <div className="tableScroller">
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

function diagnosisResultText(score: ModuleScore) {
  const stageLabel = score.score < 3.8 ? "도약" : score.score < 4.6 ? "만족" : "추월";
  if (score.score < 3.8) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 구성원의 공감대와 실행 기반을 더 촘촘히 확인할 필요가 있으며, 연수에서는 기본 개념 정리와 현장 적용 사례를 함께 다루어 참여 장벽을 낮추는 방향이 적절합니다.`;
  }
  if (score.score < 4.6) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 기본적인 이해와 실행 의지는 형성되어 있으므로, 연수에서는 학교 상황에 맞는 실습과 공동 설계 활동을 통해 실제 수업·업무 적용력을 높이는 데 초점을 둘 필요가 있습니다.`;
  }
  return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 이미 높은 실행 기반을 갖춘 강점 영역이므로, 연수에서는 우수 사례를 공유하고 다른 과정과 연결해 학교 전체의 지속 가능한 혁신 체계로 확산하는 방향이 적절합니다.`;
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

function mergeModuleContentUpdate(module: TrainingModule, update: AiModuleUpdate): TrainingModule {
  return {
    ...module,
    programName: update.programName ?? module.programName,
    schoolVoice: update.schoolVoice ?? module.schoolVoice,
    editableProgram: update.editableProgram ?? module.editableProgram,
    expectedEffect: update.expectedEffect ?? module.expectedEffect,
    materials: update.materials ?? module.materials
  };
}

function normalizeIssueGoals(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const issueGoals = [
    { issue: "", goal: "" },
    { issue: "", goal: "" },
    { issue: "", goal: "" }
  ];
  value.slice(0, 3).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    issueGoals[index] = { issue: String((item as any).issue ?? ""), goal: String((item as any).goal ?? "") };
  });
  return issueGoals;
}

function escapeCsv(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function todayStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}
