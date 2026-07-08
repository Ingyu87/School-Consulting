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
import { defaultModules } from "./data/modules";
import { generateAiDraft } from "./lib/ai";
import { analyzeInterviewAudio } from "./lib/audio";
import { buildInsights, stageDescriptions, stageTone } from "./lib/diagnosis";
import { parseDiagnosisCsv } from "./lib/csv/parseDiagnosisCsv";
import { parseLectureScheduleCsv } from "./lib/csv/parseLectureScheduleCsv";
import { downloadInterviewDocx, downloadPlanDocx } from "./lib/docx/exportDocs";
import { clearState, loadState, saveState } from "./lib/storage";
import { validateModules } from "./lib/validation";
import type { AppState, TrainingModule } from "./types";

const initialState: AppState = {
  activeTab: "diagnosis",
  project: null,
  modules: defaultModules,
  interview: {
    dateTime: "",
    coordinators: "",
    participants: "",
    transcript: "",
    notes: "",
    resultSummary: ""
  },
  plan: {
    strengths: "",
    strength1: "",
    strength2: "",
    challenges: "",
    challenge1: "",
    challenge2: "",
    interviewSummary: "",
    roadmapNotes: "",
    editedInsights: "",
    diagnosisImplications: {},
    insightSource: "basic"
  },
  updatedAt: new Date().toISOString()
};

const tabs = [
  ["diagnosis", "진단 분석"],
  ["plan", "운영계획"],
  ["modules", "연수 구성"],
  ["interview", "심층면담"],
  ["export", "다운로드"]
] as const;

export default function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [saveStatus, setSaveStatus] = useState("불러오는 중");
  const [uploadStatus, setUploadStatus] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
  const selectedHours = state.modules.filter((module) => module.selected).reduce((sum, module) => sum + module.hours, 0);
  const errorCount = validations.filter((item) => item.level === "error").length;

  function patchState(patch: Partial<AppState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  async function handleCsv(file: File) {
    setUploadStatus("CSV 분석 중");
    try {
      const project = await parseDiagnosisCsv(file);
      setState((current) => ({
        ...current,
        project,
        activeTab: "diagnosis",
        modules: current.modules.map((module) => ({
          ...module,
          place: module.place || project.schoolName
        })),
        interview: {
          ...current.interview,
          dateTime: current.interview.dateTime || `장소: ${project.schoolName}`,
          notes: current.interview.notes || `심층면담은 ${project.schoolName}에서 진행하는 것을 기본으로 하며, 세부 일시와 참석자는 학교 확인 후 확정한다.`
        },
        plan: {
          ...current.plan,
          editedInsights: buildInsights(project.moduleScores).draft,
          diagnosisImplications: {},
          insightSource: "basic"
        }
      }));
      setUploadStatus(`${project.schoolName} 분석 완료`);
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

        return {
          ...current,
          modules: nextModules,
          interview: {
            ...current.interview,
            dateTime: imported.interviewDateTime || current.interview.dateTime || `장소: ${schoolName}`,
            coordinators: imported.coordinators.join(", ") || current.interview.coordinators,
            participants: imported.teacher || current.interview.participants,
            notes: [current.interview.notes, ...imported.notes].filter(Boolean).join("\n\n")
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
    try {
      const draft = await generateAiDraft({
        task,
        schoolName: state.project.schoolName,
        project: state.project,
        modules: state.modules,
        interview: state.interview,
        plan: state.plan
      });

      setState((current) => {
        const nextModules = task === "module-content" && draft.moduleUpdates?.length
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
            dateTime: current.interview.dateTime || `장소: ${current.project?.schoolName ?? ""}`,
            notes: draft.interviewNotes ?? current.interview.notes,
            resultSummary: draft.interviewResultSummary ?? current.interview.resultSummary
          },
          plan: {
            ...current.plan,
            editedInsights: draft.diagnosisInsight ?? current.plan.editedInsights,
            diagnosisImplications: draft.diagnosisImplications ?? current.plan.diagnosisImplications,
            insightSource: draft.diagnosisInsight ? "ai" : current.plan.insightSource,
            strengths: draft.strengths ?? current.plan.strengths,
            strength1: draft.strength1 ?? current.plan.strength1,
            strength2: draft.strength2 ?? current.plan.strength2,
            challenges: draft.challenges ?? current.plan.challenges,
            challenge1: draft.challenge1 ?? current.plan.challenge1,
            challenge2: draft.challenge2 ?? current.plan.challenge2,
            interviewSummary: draft.interviewSummary ?? current.plan.interviewSummary,
            roadmapNotes: draft.roadmapNotes ?? current.plan.roadmapNotes
          },
          activeTab: task === "diagnosis" ? "diagnosis" : task === "interview-plan" ? "interview" : "modules"
        };
      });
      setAiStatus(draft.warnings?.length ? `AI 초안 생성 완료 · 확인 필요 ${draft.warnings.length}건` : "AI 초안 생성 완료");
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : "AI 초안 생성 실패");
    }
  }

  async function startInterviewRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void analyzeRecordedInterview(new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      setIsRecording(true);
      setRecordingStatus("녹음 중");
    } catch (error) {
      setRecordingStatus(error instanceof Error ? error.message : "마이크 권한을 확인해주세요.");
    }
  }

  function stopInterviewRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    setRecordingStatus("전사 및 AI 분석 중");
    setIsRecording(false);
    mediaRecorderRef.current.stop();
  }

  async function analyzeRecordedInterview(audio: Blob) {
    try {
      const result = await analyzeInterviewAudio(audio, state);
      setState((current) => ({
        ...current,
        interview: {
          ...current.interview,
          transcript: result.transcript || current.interview.transcript,
          notes: result.considerations || current.interview.notes,
          resultSummary: result.resultSummary || current.interview.resultSummary
        },
        plan: {
          ...current.plan,
          interviewSummary: result.planInterviewSummary || current.plan.interviewSummary
        }
      }));
      setRecordingStatus("전사 및 AI 분석 완료");
    } catch (error) {
      setRecordingStatus(error instanceof Error ? error.message : "전사 및 AI 분석 실패");
    }
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
      ["순번", "과정", "대상", "차시", "일정", "시간", "장소", "방식", "희망 주제", "준비물/확인사항"],
      ...selectedModules.map((module, index) => [
        String(index + 1),
        `${module.id}. ${module.name}`,
        module.target,
        `${module.hours}차시`,
        module.date || "학교 확인 필요",
        module.time || "학교 확인 필요",
        module.place || schoolName,
        module.method,
        module.topic,
        module.materials
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schoolName}_최종_학교_스케줄표_${todayStamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(file: File) {
    const text = await file.text();
    setState(JSON.parse(text) as AppState);
  }

  async function resetWorkspace() {
    const confirmed = window.confirm("현재 입력한 내용과 자동저장된 작업을 모두 지우고 처음부터 시작할까요?");
    if (!confirmed) return;
    if (isRecording) stopInterviewRecording();
    await clearState();
    setState({ ...initialState, updatedAt: new Date().toISOString() });
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
          {tabs.map(([key, label]) => (
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

        {uploadStatus && <div className="notice">{uploadStatus}</div>}
        {scheduleStatus && <div className="notice scheduleNotice"><CalendarDays size={17} />{scheduleStatus}</div>}
        {aiStatus && <div className="notice aiNotice"><Sparkles size={17} />{aiStatus}</div>}
        {recordingStatus && <div className="notice recordingNotice"><Mic size={17} />{recordingStatus}</div>}

        {state.activeTab === "diagnosis" && (
          <section className="grid">
            <article className="panel heroPanel">
              <div>
                <p className="eyebrow">{insightSourceLabel}</p>
                <h2>{insights.average ? `${insights.average.toFixed(2)}점` : "CSV를 업로드하세요"}</h2>
                <p>{diagnosisSummary}</p>
                <button className="button primary inlineAction" onClick={() => runAiDraft("diagnosis")}>
                  <Sparkles size={17} />
                  AI로 심층 분석
                </button>
              </div>
              <BarChart3 className="heroIcon" />
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
              <h2>사전 진단 - 과정별 진단 분석 결과</h2>
              <div className="tableScroller">
                <table className="diagnosisTable">
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>평균 점수</th>
                      <th>단계</th>
                      <th>자가 진단 분석 결과</th>
                      <th>시사점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.project?.moduleScores ?? []).map((score) => (
                      <tr key={score.moduleId}>
                        <td>모듈{score.moduleId}<br />{score.moduleName}</td>
                        <td>{score.score.toFixed(2)}</td>
                        <td>{score.stage}</td>
                        <td>{score.question || `${score.moduleName} 영역의 평균 점수는 ${score.score.toFixed(2)}점입니다.`}</td>
                        <td>{state.plan.diagnosisImplications?.[String(score.moduleId)] || "AI로 심층 분석을 실행하면 CSV 결과를 바탕으로 시사점이 작성됩니다."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
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
                onChange={(event) => patchState({ plan: { ...state.plan, editedInsights: event.target.value, insightSource: "edited" } })}
                placeholder="CSV 업로드 후 운영계획서에 반영할 분석 초안을 편집하세요."
              />
            </article>
          </section>
        )}

        {state.activeTab === "interview" && (
          <section className="panel formPanel">
            <div className="sectionToolbar">
              <h2>심층면담지 작성</h2>
              <div className="toolbarActions">
                <button className={isRecording ? "button dangerButton" : "button ghost"} onClick={isRecording ? stopInterviewRecording : startInterviewRecording}>
                  {isRecording ? <Square size={17} /> : <Mic size={17} />}
                  {isRecording ? "녹음 정지" : "녹음 시작"}
                </button>
                <button className="button primary" onClick={() => runAiDraft("interview-plan")}>
                  <Sparkles size={17} />
                  AI 초안
                </button>
              </div>
            </div>
            <FormInput label="심층면담 일시/장소" value={state.interview.dateTime} onChange={(value) => patchState({ interview: { ...state.interview, dateTime: value } })} />
            <FormInput label="참여 코디네이터" value={state.interview.coordinators} onChange={(value) => patchState({ interview: { ...state.interview, coordinators: value } })} />
            <FormInput label="참여 교원" value={state.interview.participants} onChange={(value) => patchState({ interview: { ...state.interview, participants: value } })} />
            <FormArea label="면담 전사" value={state.interview.transcript ?? ""} onChange={(value) => patchState({ interview: { ...state.interview, transcript: value } })} />
            <FormArea label="기타 고려사항" value={state.interview.notes} onChange={(value) => patchState({ interview: { ...state.interview, notes: value } })} />
            <FormArea label="면담 핵심 결과" value={state.interview.resultSummary} onChange={(value) => patchState({ interview: { ...state.interview, resultSummary: value } })} />
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
                  <p>사람이 정한 차시, 방식, 일정, 시간, 장소, 희망 주제는 유지하고, 선택된 과정의 세부 프로그램 초안과 기대효과만 작성합니다.</p>
                </div>
                <button className="button primary" onClick={() => runAiDraft("module-content")}>
                  <Sparkles size={17} />
                  AI 초안 작성
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
                  <p className="moduleDescription">{module.description}</p>
                  <div className="moduleGrid">
                    <label>차시<input type="number" min={0} value={module.hours} onChange={(event) => updateModule(module.id, { hours: Number(event.target.value) })} /></label>
                    <label>방식<select value={module.method} onChange={(event) => updateModule(module.id, { method: event.target.value as TrainingModule["method"] })}><option>오프라인</option><option>온라인</option></select></label>
                    <label>일정<input value={module.date} onChange={(event) => updateModule(module.id, { date: event.target.value })} /></label>
                    <label>시간<input value={module.time} onChange={(event) => updateModule(module.id, { time: event.target.value })} /></label>
                    <label>장소<input value={module.place} onChange={(event) => updateModule(module.id, { place: event.target.value })} /></label>
                    <label>희망 주제<input value={module.topic} onChange={(event) => updateModule(module.id, { topic: event.target.value })} /></label>
                  </div>
                  {module.selected && (
                    <div className="programEditor">
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
          <section className="panel formPanel">
            <h2>운영계획서 작성</h2>
            <div className="twoColumnFields">
              <FormArea label="우리학교 강점 1" value={state.plan.strength1 ?? state.plan.strengths} onChange={(value) => patchState({ plan: { ...state.plan, strength1: value } })} />
              <FormArea label="우리학교 강점 2" value={state.plan.strength2 ?? ""} onChange={(value) => patchState({ plan: { ...state.plan, strength2: value } })} />
              <FormArea label="도전 과제 1" value={state.plan.challenge1 ?? state.plan.challenges} onChange={(value) => patchState({ plan: { ...state.plan, challenge1: value } })} />
              <FormArea label="도전 과제 2" value={state.plan.challenge2 ?? ""} onChange={(value) => patchState({ plan: { ...state.plan, challenge2: value } })} />
            </div>
            <FormArea label="심층면담 결과 요약" value={state.plan.interviewSummary} onChange={(value) => patchState({ plan: { ...state.plan, interviewSummary: value } })} />
            <FormArea label="로드맵 및 기대효과" value={state.plan.roadmapNotes} onChange={(value) => patchState({ plan: { ...state.plan, roadmapNotes: value } })} />
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
              <p>면담 개요, 안내 확인, 연수 구성, 고려사항을 문서로 생성합니다.</p>
              <button className="button primary" onClick={() => downloadInterviewDocx(state)}><FileDown size={18} />다운로드</button>
            </article>
            <article className="panel downloadCard">
              <FileText size={34} />
              <h2>운영계획서 DOCX</h2>
              <p>진단 분석, 강점/도전과제, 로드맵, 기대효과를 문서로 생성합니다.</p>
              <button className="button primary" onClick={() => downloadPlanDocx(state)}><FileDown size={18} />다운로드</button>
            </article>
            <article className="panel workFileCard wide">
              <div>
                <p className="eyebrow">선택 사항</p>
                <h2>작업 파일 관리</h2>
                <p>현재 입력 상태를 파일로 보관하거나, 다른 컴퓨터에서 이어서 작업할 때 사용합니다.</p>
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

function FormInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function FormArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
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
            <th>방식</th>
            <th>희망 주제</th>
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
              <td>{module.method}</td>
              <td>{module.topic || "학교 확인 필요"}</td>
              <td>{module.materials || "학교 확인 필요"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function mergeModuleAiUpdate(module: TrainingModule, update: NonNullable<Awaited<ReturnType<typeof generateAiDraft>>["moduleUpdates"]>[number], schoolName: string): TrainingModule {
  return {
    ...module,
    selected: module.required ? true : update.selected ?? module.selected,
    hours: module.required ? 1 : typeof update.hours === "number" ? update.hours : module.hours,
    date: update.date ?? module.date,
    time: update.time ?? module.time,
    method: update.method ?? module.method,
    topic: update.topic ?? module.topic,
    editableProgram: update.editableProgram ?? module.editableProgram,
    expectedEffect: update.expectedEffect ?? module.expectedEffect,
    materials: update.materials ?? module.materials,
    place: update.place || module.place || schoolName
  };
}

function mergeModuleContentUpdate(module: TrainingModule, update: NonNullable<Awaited<ReturnType<typeof generateAiDraft>>["moduleUpdates"]>[number]): TrainingModule {
  return {
    ...module,
    editableProgram: update.editableProgram ?? module.editableProgram,
    expectedEffect: update.expectedEffect ?? module.expectedEffect,
    materials: update.materials ?? module.materials
  };
}

function hydrateState(saved: AppState): AppState {
  const savedById = new Map(saved.modules.map((module) => [module.id, module]));
  return {
    ...initialState,
    ...saved,
    modules: defaultModules.map((base) => ({
      ...base,
      ...savedById.get(base.id),
      description: savedById.get(base.id)?.description ?? base.description,
      defaultProgram: savedById.get(base.id)?.defaultProgram ?? base.defaultProgram,
      editableProgram: savedById.get(base.id)?.editableProgram ?? base.editableProgram,
      expectedEffect: savedById.get(base.id)?.expectedEffect ?? base.expectedEffect,
      materials: savedById.get(base.id)?.materials ?? base.materials
    }))
  };
}

function escapeCsv(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function todayStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}
