# School Consulting Planner

찾아가는 학교 컨설팅 현장에서 사전 진단 CSV를 분석하고, 심층면담지와 운영계획서 DOCX 초안을 작성하는 웹앱입니다.

## 현재 앱의 성격

- Vite + React + TypeScript 기반 단일 페이지 앱입니다.
- 최종 산출물은 `심층면담지.docx`, `운영계획서.docx`, 최종 스케줄 CSV, 작업 백업 JSON입니다.
- PDF 양식의 섹션 순서와 운영 기준을 참고하지만, 앱에서 직접 PDF를 생성하지는 않습니다.
- AI 초안과 녹음 전사는 Vercel Functions의 Gemini API 호출을 사용합니다.

## 주요 기능

- 사전 자가진단 CSV 업로드 및 과정별 평균 점수 분석
- 과정별 강점·도전과제, 분석 결과 및 시사점 AI 초안 작성
- 인프라 문항 응답 분포와 서술형 응답 확인
- 나이스 교육정보 개방 포털 학교기본정보 자동 조회
- 심층면담지 작성: 필수 안내, 운영 개요, 참여 목표, 디지털 친화도, 기타 고려사항, 핵심 요약
- 면담 녹음: 3분 단위 구간 전사 후 심층면담 항목 요약 반영
- 연수 과정 선택, 차시·일정·장소·희망 주제 입력, 과정별 AI 초안 작성
- 운영계획서 작성: 강점·과제, 면담 요약, 이슈→목표, 로드맵 및 기대효과
- IndexedDB 자동저장 및 작업 백업 JSON 저장/복원
- DOCX 다운로드 전 기본 운영 기준 검증

## 실행

```bash
npm install
npm run dev
```

`npm run dev`는 Vite UI 확인용입니다. `/api` 함수가 실행되지 않으므로 AI 초안, 녹음 전사, NEIS 조회는 동작하지 않습니다.

전체 기능을 로컬에서 확인하려면 Vercel CLI로 실행합니다.

```bash
npm install -g vercel
vercel dev
```

## 환경변수

- `GEMINI_API_KEY`: AI 초안 생성 및 면담 전사용 Gemini API 키
- `GEMINI_MODEL`: 선택 사항. 기본 모델 대신 사용할 Gemini 모델명
- `NEIS_API_KEY`: 나이스 교육정보 개방 포털 학교기본정보 조회 인증키
- `API_RATE_LIMIT`: 선택 사항. 서버 함수별 분당 호출 제한. 기본값은 30회

## 빌드

```bash
npm run build
```

## 운영상 주의

- 작업 백업 JSON에는 학교 정보, 입력 내용, AI 초안, 면담 전사 내용이 포함됩니다. 개인정보와 면담 기록 관리에 유의해야 합니다.
- 녹음 전사와 AI 초안은 브라우저, Vercel Functions, Gemini API를 경유합니다.
- 배포 URL이 공개되면 API 호출 비용이 발생할 수 있으므로 운영 환경에서는 접근 제한 또는 rate limit 설정이 필요합니다.
- 원본 CSV/PDF 파일 자체는 백업 JSON에 포함되지 않습니다.

## 문서

- [PRD](./prd.md)
- [Implementation Plan](./implementation.md)
- [Design System](./design.md)
