# 고일초 컨설팅 웹앱 구현 계획

## 1. 구현 전략

기존 `goil-consulting-app.html`은 슬라이드형 안내 도구로 출발했기 때문에 최종 산출물 생성 목적에 맞지 않는다. 다음 버전은 문서 작성 중심의 업무 앱으로 재구성한다.

우선순위는 다음과 같다.

1. 표준 사전 자가진단 CSV 파서를 먼저 구현
2. PDF 공식 양식 구조를 앱 데이터 모델로 변환
3. 고일초 CSV 데이터는 샘플/초기 프로젝트로 탑재
4. 진단 결과 시각화와 분석 문구 편집
5. 심층면담지 입력 폼 구현
6. 운영계획서 입력 폼 구현
7. 연수 구성 검증 엔진 구현
8. DOCX 다운로드 구현
9. 백업/복원 구현

## 2. 추천 기술 스택

### 2.1 Vercel 배포 버전

- Vite
- TypeScript
- React
- `docx` npm package
- `file-saver`
- `papaparse`
- `zustand` 또는 단순 reducer
- `localforage`
- SVG 기반 자체 차트 또는 `recharts`

장점:
- DOCX 생성 안정성 높음
- 컴포넌트 분리 가능
- Vercel 미리보기/프로덕션 배포 쉬움
- 이후 다른 학교 데이터 확장 가능
- 필요 시 Vercel Functions로 서버 측 DOCX 생성 확장 가능

### 2.2 단일 HTML 버전

- HTML/CSS/Vanilla JS
- 업로드 CSV 데이터
- 내장 ZIP 생성 함수로 최소 DOCX 생성

장점:
- 파일 하나로 사용 가능
- 인터넷 없이 실행 가능

한계:
- 표가 많은 DOCX의 품질 관리가 어려움
- 템플릿 유지보수 불편
- 로고/푸터/페이지 나눔 구현이 취약

### 2.3 최종 권장

Vercel 배포를 전제로 Vite + TypeScript + `docx` 라이브러리로 구현한다. 단, 학교 현장에서 오프라인 백업이 필요하면 빌드 결과물을 zip으로 내려받아 로컬에서 열 수 있게 한다. DOCX 품질이 브라우저 생성만으로 부족하면 Vercel Functions 기반 문서 생성 API를 추가한다.

## 3. 데이터 모델

### 3.1 AppState

```ts
type AppState = {
  school: SchoolProfile;
  diagnosis: DiagnosisData;
  interview: InterviewForm;
  plan: OperationPlanForm;
  modules: TrainingModule[];
  decisions: DecisionItem[];
  documents: DocumentMeta;
  updatedAt: string;
};
```

### 3.2 SchoolProfile

```ts
type SchoolProfile = {
  schoolName: string;
  region: "서울" | "인천" | "강원" | "제주" | "";
  address: string;
  schoolLevel: string;
  schoolType: string;
  leadingSchool: "유" | "무" | "";
  teacherCount: string;
  staffCount: string;
  classCount: string;
  studentCount: string;
  teacherDeviceTypes: string[];
  studentDeviceRatio: string;
  technicalIssues: string[];
  budgetStatus: string;
  infrastructureNotes: string;
};
```

### 3.3 DiagnosisData

```ts
type DiagnosisData = {
  infrastructureRows: {
    question: string;
    option: string;
    count: number;
    ratio: number;
  }[];
  moduleScores: {
    moduleId: number;
    moduleName: string;
    score: number;
    stage: "도약" | "만족" | "추월";
    implication: string;
  }[];
  writtenTools: string[];
  supportNeeds: string[];
  autoInsights: string[];
  editedInsights: string;
};
```

### 3.4 TrainingModule

```ts
type TrainingModule = {
  id: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  required: boolean;
  selected: boolean;
  target: "교직원" | "학교 관리자" | "학부모" | "학생" | "교원";
  hours: number;
  date: string;
  startTime: string;
  endTime: string;
  place: string;
  headcount: string;
  method: "강의/토론" | "실습" | "워크숍" | "온라인" | "";
  desiredTopic: string;
  mainTool: string;
  operationTopic: string;
  note: string;
};
```

### 3.5 InterviewForm

```ts
type InterviewForm = {
  overview: {
    dateTime: string;
    coordinators: Coordinator[];
    operationManager: string;
    teachers: ParticipantTeacher[];
  };
  requiredNoticeChecks: RequiredNoticeCheck[];
  goals: string[];
  goalEtc: string;
  digitalReadiness: {
    capability: "상" | "중" | "하" | "편차 심함" | "";
    reaction: "매우 긍정적 및 선도적" | "수용적이나 소극적" | "거부감 및 우려 존재" | "";
    notes: string;
  };
  considerations: {
    priorLevel: string;
    infrastructure: string;
    schoolRequests: string;
    additionalChecks: string;
  };
  summary: {
    participationGoal: string;
    interviewResult: string;
  };
};
```

### 3.6 OperationPlanForm

```ts
type OperationPlanForm = {
  strengths: string[];
  challenges: string[];
  firstInterviewSummary: string;
  followUpInterviewSummary: string;
  issuesToGoals: {
    issue: string;
    goal: string;
    relatedModules: number[];
  }[];
  roadmap: {
    moduleId: number;
    detailedProgram: string;
    schedule: string;
    expectedEffect: string;
  }[];
};
```

## 4. 검증 엔진

### 4.1 검증 항목

```ts
type ValidationResult = {
  id: string;
  level: "ok" | "warning" | "error";
  message: string;
  source: "PDF";
};
```

### 4.2 필수 검증

- 총 선택 과정 수가 5개 이상인지
- 총 차시가 12차시 이상인지
- 필수 모듈 0과 7이 선택되어 있고 각각 1차시인지
- 선택 모듈이 3개 이상인지
- 필수 포함 총 차시가 17차시 이하인지
- 필수 제외 차시가 15차시 이하인지
- 모듈1+2+3 합계가 5차시 이하인지
- 교원 대상 모듈이 2차시 이상인지
- 온라인 차시가 전체 차시의 30% 이하인지
- 학생/학부모/온라인 과정에 식사·다과를 배정하지 않았는지
- 식사 시간이 차시에 포함되어 있지 않은지

### 4.3 검증 표시 원칙

- `오류`: PDF 기준 위반, 문서 생성 전 반드시 수정 필요
- `주의`: 확인 필요, 문서 생성 가능하나 확인 메모 표시
- `충족`: 기준 충족

## 5. 화면 구조

### 5.1 Layout

- 좌측 사이드바: 단계 이동
- 상단 바: 학교명, 자동저장 상태, 백업, 불러오기, 문서 다운로드
- 우측 본문: 현재 단계 입력/시각화
- 하단 고정 검증 요약: 오류/주의/충족 개수

### 5.2 단계

1. `진단 결과`
2. `학교 정보`
3. `심층면담`
4. `모듈 구성`
5. `운영계획`
6. `검토 및 다운로드`

## 6. 진단 결과 구현

### 6.1 CSV 파싱

초기 구현부터 사용자가 업로드한 표준 CSV를 파싱한다. 파서 기준 파일명은 `서울고일초_사전 자가진단 분석.csv` 형식이며, 실제 학교명은 파일명과 CSV 본문에서 자동 추출한다. 고일초 데이터는 테스트와 샘플 초기 프로젝트에만 사용하고 코드 로직에 고정하지 않는다.

파싱 항목:
- STEP1 과정별 평균
- STEP2 문항별 응답 분포
- STEP3 사전/사후 비교는 현재 사전값 중심으로 표시

### 6.2 자동 분석 문구

초안 생성 규칙:
- 점수 3.8 미만: 도약 단계, 우선 지원 필요
- 점수 3.8 이상 4.6 미만: 만족 단계, 실천 강화
- 점수 4.6 이상: 추월 단계, 사례 확산

분석 초안:
- CSV에서 추출한 최저 영역, 최고 영역, 인프라 응답 분포를 기준으로 자동 생성한다.
- 학교별 자동 분석은 확정 문구가 아니라 `분석 초안`으로 표시한다.
- 사용자가 수정한 문구가 운영계획서와 심층면담지에 반영된다.

## 7. DOCX 생성 구조

### 7.1 생성 방식

`docx` 라이브러리를 사용해 문서 구조를 직접 생성한다.

필수 구성:
- 페이지 여백
- 제목 스타일
- 남색 표 헤더
- 회색 구분 셀
- 얇은 표 테두리
- 체크박스 텍스트
- 기관명 푸터 텍스트

### 7.2 파일명

- `{학교명}_심층면담지_YYYYMMDD.docx`
- `{학교명}_운영계획서_YYYYMMDD.docx`

### 7.3 이미지/로고

초기 버전:
- 푸터에는 기관명 텍스트로 대체

후속 버전:
- PDF에서 추출한 로고 이미지 또는 제공 로고 파일 삽입

## 8. 저장/복원

### 8.1 저장 방식

- 앱 상태는 입력 즉시 IndexedDB에 저장
- 저장 상태: `저장 중`, `자동저장됨`, `저장 실패`

### 8.2 백업

- `전체 백업.json` 다운로드
- `백업 불러오기`로 복원
- 다른 학교로 확장 시 학교별 프로젝트 파일로 활용

## 9. 배포

### 9.1 Vercel

```bash
npm create vite@latest goil-consulting-planner -- --template react-ts
npm install docx file-saver papaparse localforage
npm run build
```

Vercel 설정:
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Git 연동 시 main 브랜치는 production, 그 외 브랜치는 preview 배포

Vercel CLI 배포:

```bash
npm install -g vercel
vercel
vercel --prod
```

문서 생성 API를 추가할 경우:

```text
/api/generate-interview-docx
/api/generate-plan-docx
```

초기 버전은 브라우저에서 DOCX를 생성하고, API는 후속 확장으로 둔다.

### 9.2 로컬 사용

```bash
npm run dev
```

또는 빌드 결과물을 압축해 오프라인 사용.

## 10. 마이그레이션 계획

### 10.1 1단계

- 기존 HTML의 데이터와 검증 로직 중 필요한 부분만 추출
- 디자인은 폐기하고 PDF 양식 스타일로 재작성

### 10.2 2단계

- React 컴포넌트 구조 작성
- 진단 결과 화면 구현
- 모듈 구성 검증 구현

### 10.3 3단계

- 심층면담지 입력 폼 구현
- 운영계획서 입력 폼 구현
- 양식 간 데이터 자동 연동

### 10.4 4단계

- DOCX 생성
- 실제 Word 열람 테스트
- 표 깨짐, 페이지 흐름, 문구 검수

### 10.5 5단계

- Vercel 배포
- 사용자 테스트
- 표준 CSV 업로드 기능 정교화

## 11. 테스트 체크리스트

- 새로고침 후 입력값 유지
- 백업 JSON 다운로드/복원
- 총 12차시 미만일 때 오류 표시
- 모듈0/7 해제 불가
- 모듈1+2+3 합계 5차시 초과 시 오류 표시
- 학생/학부모/온라인 과정 식사·다과 미제공 안내
- `심층면담지.docx` Word 열림
- `운영계획서.docx` Word 열림
- 생성 문서가 PDF 양식 순서를 따름
- 출력 문서에 CSV 가안이 확정처럼 표기되지 않음

## 12. 범용 CSV 분석 구현 계획

### 12.1 CSV 업로드 플로우

```text
CSV 업로드
→ 인코딩 감지
→ 행/열 원본 보존
→ STEP 마커 탐지
→ 학교명 추출
→ 진단 데이터 정규화
→ 자동 분석 생성
→ 프로젝트 생성/저장
```

### 12.2 인코딩 대응

학교 CSV는 UTF-8 BOM, UTF-8, CP949 가능성이 있다.

브라우저 구현:
- 우선 `FileReader.readAsArrayBuffer`
- `TextDecoder("utf-8")` 시도
- 깨짐이 감지되면 `TextDecoder("euc-kr")` 또는 `encoding-japanese` 계열 라이브러리 검토
- Vercel 배포 버전에서는 클라이언트에서 `papaparse`로 CSV 파싱

### 12.3 CSV 마커 기반 파서

행/열 위치에 고정 의존하지 않는다.

탐지 마커:
- `찾아가는 학교 컨설팅`
- `STEP1. 사전 자가진단 종합 분석표`
- `STEP2. 학교 디지털 기반 교육 현황 알아보기`
- `STEP3. 학교 디지털 기반 교육 혁신 현황 자가진단 데이터 분석`
- `문항`
- `평균`
- `결과`
- `비율`
- `서술형`

### 12.4 정규화 함수

```ts
function parseDiagnosisCsv(file: File): Promise<ParsedDiagnosisProject>
```

반환:

```ts
type ParsedDiagnosisProject = {
  schoolName: string;
  rawRows: string[][];
  detectedSections: {
    step1?: SectionRange;
    step2?: SectionRange;
    step3?: SectionRange;
  };
  moduleScores: ModuleScore[];
  infrastructureDistributions: DistributionQuestion[];
  openEndedQuestions: OpenEndedQuestion[];
  parseWarnings: string[];
};
```

### 12.5 학교명 추출

우선순위:
1. 파일명에서 추출: `서울고일초등학교`, `서울고일초`, `고일초`
2. CSV 첫 행의 `찾아가는 학교 컨설팅 <...>` 패턴
3. 사용자 입력

### 12.6 분석 엔진

```ts
function buildDiagnosisInsights(project: ParsedDiagnosisProject): DiagnosisInsights
```

생성 항목:
- 전체 평균
- 최저 영역 3개
- 최고 영역 3개
- 단계별 영역 수
- 인프라 리스크 요약
- 추천 확인 질문
- 추천 연수 모듈 후보
- 운영계획서용 분석 문단 초안

### 12.7 단계 판정

```ts
function scoreStage(score: number): "도약" | "만족" | "추월" {
  if (score < 3.8) return "도약";
  if (score < 4.6) return "만족";
  return "추월";
}
```

## 13. 시각화 구현 계획

### 13.1 차트 방식

초기 버전은 외부 차트 라이브러리 의존을 줄이기 위해 SVG 컴포넌트로 구현한다.

필요 시 `recharts` 도입:
- BarChart
- StackedBarChart
- RadarChart
- ResponsiveContainer

### 13.2 컴포넌트

```text
DiagnosisDashboard
├─ CsvUploadPanel
├─ SchoolSummaryHeader
├─ ScoreOverviewCards
├─ ModuleScoreBarChart
├─ StageDistributionChart
├─ InfrastructureStackedBars
├─ TopBottomInsightCards
├─ ModuleRecommendationMap
└─ EditableAnalysisDraft
```

### 13.3 애니메이션 구현

권장:
- CSS transition
- requestAnimationFrame 기반 count-up
- IntersectionObserver로 화면 진입 시 애니메이션 1회 실행
- React 사용 시 `framer-motion`은 선택 사항으로만 검토

애니메이션 토큰:

```ts
const motion = {
  fast: "160ms",
  normal: "280ms",
  slow: "420ms",
  easing: "cubic-bezier(0.2, 0, 0, 1)"
};
```

### 13.4 그래프 색상 토큰

```ts
const chartColors = {
  module0: "#2563EB",
  module1: "#7C3AED",
  module2: "#DB2777",
  module3: "#F97316",
  module4: "#0891B2",
  module5: "#16A34A",
  module6: "#4F46E5",
  module7: "#0F766E",
  stageLeap: "#F59E0B",
  stageSatisfy: "#2563EB",
  stageLead: "#10B981",
  risk: "#EF4444",
  neutral: "#64748B"
};
```

## 14. 범용 프로젝트 저장 구조

기존에는 고일초 단일 상태였지만, 다음 버전은 다중 학교 프로젝트를 저장한다.

```ts
type StoredWorkspace = {
  activeProjectId: string;
  projects: Record<string, SchoolProject>;
};

type SchoolProject = {
  id: string;
  schoolName: string;
  sourceFileName: string;
  createdAt: string;
  updatedAt: string;
  diagnosis: ParsedDiagnosisProject;
  appState: AppState;
};
```

저장 키:

```ts
const STORAGE_KEY = "school-consulting-planner-workspace-v1";
```

## 15. 범용화 테스트

테스트용 CSV:
- 고일초 CSV
- 일정이 없는 학교 CSV
- 학교명이 파일명에만 있는 CSV
- STEP2가 비어 있는 CSV
- 서술형 응답이 없는 CSV
- 열 위치가 한 칸 밀린 CSV

검증:
- 학교명 추출 실패 시 수동 입력으로 진행 가능
- 과정별 점수 추출 실패 시 사용자에게 파싱 경고 표시
- 일부 문항이 없어도 앱 전체가 멈추지 않음
- 문서 생성 시 비어 있는 값은 빈칸으로 출력

## 16. Vercel 아키텍처

### 16.1 1차 구현: 정적 클라이언트 앱

```text
Vercel Static Hosting
└─ React/Vite App
   ├─ CSV 업로드 및 파싱
   ├─ 진단 대시보드
   ├─ 면담/운영계획 입력
   ├─ IndexedDB 자동저장
   └─ 브라우저 DOCX 생성
```

이 단계에서는 사용자가 업로드한 CSV와 입력 데이터가 외부 서버로 전송되지 않는다. 모든 분석과 문서 생성은 브라우저에서 처리한다.

### 16.2 2차 확장: Vercel Functions 문서 생성

브라우저 생성 DOCX의 표 품질이 부족하거나 템플릿 치환이 필요해지면 Vercel Functions를 추가한다.

```text
POST /api/generate-interview-docx
POST /api/generate-plan-docx
```

요청 본문:

```ts
type GenerateDocxRequest = {
  schoolName: string;
  appState: AppState;
  documentType: "interview" | "plan";
};
```

응답:

```ts
Blob // application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

### 16.3 서버 전송 원칙

- 기본값은 클라이언트 처리
- 서버 API는 사용자가 `문서 생성` 버튼을 누를 때만 호출
- 서버는 업로드 파일과 생성 데이터를 저장하지 않음
- Vercel Function은 요청을 처리한 뒤 DOCX 바이너리만 반환
- 개인정보성 연락처/휴대폰 등은 사용자가 입력할 수 있으므로 로그에 남기지 않음

### 16.4 권장 프로젝트 구조

```text
goil-consulting-planner/
├─ package.json
├─ vite.config.ts
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ features/
│  │  ├─ diagnosis/
│  │  ├─ interview/
│  │  ├─ modules/
│  │  ├─ plan/
│  │  └─ export/
│  ├─ lib/
│  │  ├─ csv/
│  │  ├─ validation/
│  │  ├─ storage/
│  │  └─ docx/
│  └─ styles/
├─ api/
│  ├─ generate-interview-docx.ts
│  └─ generate-plan-docx.ts
└─ vercel.json
```

`api/` 폴더는 2차 확장 시 추가한다. 1차 구현에서는 없어도 된다.

### 16.5 vercel.json

초기 Vite 정적 앱은 `vercel.json`이 없어도 배포 가능하다. 필요 시 다음 정도만 둔다.

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### 16.6 Vercel 환경변수

초기 버전에는 환경변수가 필요 없다.

후속으로 외부 저장소, 인증, 서버 문서 템플릿을 붙일 경우에만 환경변수를 사용한다. CSV와 면담 데이터는 기본적으로 브라우저 로컬 저장을 우선한다.
