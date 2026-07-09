// 심층면담지.pdf 공식 양식의 고정 항목. PDF에 없는 항목을 추가하지 않는다.

export const noticeItems = [
  {
    title: "사전/사후 자가진단 설문조사 운영 지원 역할",
    detail:
      "사전 자가진단 조사(심층면담 이전 및 이후) 80% 이상 참여를 위한 교내 전파 및 독려 지원 · 연수 종료 후 사후 역량 향상도 평가를 위한 설문조사 교내 전파 및 독려 지원"
  },
  {
    title: "연수 대상자(교사/직원) 정보 등록 처리 필수",
    detail:
      "이수처리(미처리 희망자 포함)를 위한 한국과학창의재단 이수자 정보 등록 처리 절차 교내 전파 및 독려 지원 · 미등록자는 직무연수 이수처리 불가, 처리 기간 초과 시 별도 등록 방안 없음 안내"
  },
  {
    title: "연수 모듈(과목)별 참여자 집계/전달",
    detail:
      "간식·식사 등 지원을 위해 사전에 해당 연수 참여 인원 명단 집계 및 운영기관 전달 필요 · 공식 참여율은 신청자 수 대비 당일 참여자 수로 집계"
  },
  {
    title: "참여 후기 수집 지원",
    detail: "연수 운영 중 또는 이후 참여 후기 인터뷰 수집 지원 / 3명 이상 간단한 후기(제목 1줄, 내용 100자 이내)"
  },
  {
    title: "연수 후 학교 변화 모니터링 자문",
    detail:
      "사업 참여 이후 학교 내 변화 여부 및 활동에 대한 간단한 모니터링 서면 자문 시행 (예: 수업 적용 사례, 학생 동아리·교사 연구회 활동 사례 등)"
  }
] as const;

export const goalOptions = [
  "교내 교육공동체 중심의 활발한 연구 및 수업 나눔 활동",
  "AI 디지털 교과서의 안정적 도입 및 맞춤형 에듀테크 수업 활성화",
  "학생 대상 AI / 디지털 관련 동아리 운영 및 활성화",
  "디지털 교육 관련 연구대회 출품 및 선도학교/연구학교 운영 준비"
] as const;

export const capabilityOptions = ["상", "중", "하", "편차 심함"] as const;

export const reactionOptions = ["매우 긍정적 및 선도적", "수용적이나 소극적", "거부감 및 우려 존재"] as const;

export const regionOptions = ["서울", "인천", "강원", "제주"] as const;

export const schoolLevelOptions = ["초", "중", "고", "특수", "기타(각종)"] as const;

export const establishmentOptions = ["공립", "국립", "사립"] as const;

export const schoolCharacterOptions = ["일반", "특목", "자율", "중점"] as const;

export const leadingSchoolOptions = ["유", "무"] as const;

export const teacherDeviceOptions = ["태블릿 PC", "노트북/데스크탑", "Mac/IOS", "웨일북", "크롬북"] as const;

export const studentDeviceRatioOptions = ["100% 이상", "80% 이상", "60% 이상", "40% 이상", "40% 미만"] as const;

export const technicalIssueOptions = ["기기 노후 및 잦은 고장", "네트워크 인프라 불안정", "관리 인력 부재"] as const;

export const submissionEmail = "26schoolchange@kocoa.or.kr";
