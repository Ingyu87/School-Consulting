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

## 배포 방향

Vercel 배포를 기준으로 구현합니다.

1차 구현은 Vite + React + TypeScript 기반 정적 앱으로 시작합니다.
DOCX 품질이 더 필요할 경우 Vercel Functions 기반 문서 생성 API를 추가합니다.

