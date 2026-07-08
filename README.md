# School Consulting Planner

찾아가는 학교 컨설팅 심층면담 현장에서 사용하는 진단 분석 및 문서 생성 웹앱입니다.

## 목표

- 학교별 사전 자가진단 CSV 업로드
- 진단 결과 시각화 및 분석 초안 생성
- 심층면담지 작성
- 연수 모듈/일정 구성 및 PDF 공식 기준 검증
- 운영계획서 작성
- `심층면담지.docx`, `운영계획서.docx` 다운로드

## 문서

- [PRD](./prd.md)
- [Implementation Plan](./implementation.md)
- [Design System](./design.md)

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드 확인:

```bash
npm run build
```

## 현재 구현

- `서울고일초_사전 자가진단 분석.csv` 형식의 CSV 업로드 및 마커 기반 파싱
- 과정별 평균 점수 시각화, 우선 확인/강점 영역 자동 요약
- 0~7과정 카드 클릭 적용, 기본 세부 프로그램/기대효과 자동 입력
- 교사가 현장에서 세부 프로그램, 기대효과, 준비사항을 직접 수정 가능
- IndexedDB 기반 자동저장으로 새로고침 및 재접속 후 작업 유지
- PDF 공식 기준 기반 12차시/필수과정/선택과정/온라인 차시 등 검증
- `심층면담지.docx`, `운영계획서.docx` 브라우저 다운로드

## 배포 방향

Vercel 배포를 기준으로 구현합니다.

1차 구현은 Vite + React + TypeScript 기반 정적 앱으로 시작합니다.
DOCX 품질이 더 필요할 경우 Vercel Functions 기반 문서 생성 API를 추가합니다.
