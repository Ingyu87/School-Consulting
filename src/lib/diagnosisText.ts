import type { ModuleScore } from "../types";

/**
 * 진단표 "자가 진단 분석 결과 및 시사점" 문구 생성기.
 * 화면(진단 분석 탭)과 운영계획서 DOCX가 반드시 같은 문구를 쓰도록 여기에서만 만든다.
 *
 * AI를 아직 안 돌렸거나 특정 모듈만 응답이 비어 있을 때 쓰는 대체 문구는,
 * 단계(도약/만족/추월)만으로 문장을 고르면 같은 단계에 속한 모듈끼리 글자 그대로
 * 똑같아 보이므로 모듈별 실제 초점을 문장 안에 반드시 넣는다.
 */
const moduleFocusHints: Record<number, string> = {
  0: "학교 여건과 연수 목표를 구성원이 함께 확인하는 시작 단계",
  1: "관리자의 AI·디지털 전환 리더십과 운영 체계",
  2: "학부모의 수업 변화 이해와 가정 연계",
  3: "학생의 AI·디지털 기초 소양과 안전한 활용",
  4: "교직원의 실무 문제 해결과 업무 효율화",
  5: "교과 수업 설계에 AI·디지털 도구를 접목하는 실천력",
  6: "학교가 희망하는 자율 주제 중심의 맞춤형 수업",
  7: "연수 이후 변화를 돌아보고 지속 운영 방향을 정리하는 환류 단계"
};

export function diagnosisCombinedText(score: ModuleScore, aiImplication?: string) {
  if (aiImplication?.trim()) {
    return normalizeDiagnosisAnalysis(aiImplication);
  }
  return `${diagnosisResultText(score)} ${normalizeDiagnosisAnalysis(diagnosisImplicationText(score))}`;
}

export function diagnosisResultText(score: ModuleScore) {
  const stageLabel = score.score < 3.8 ? "도약" : score.score < 4.6 ? "만족" : "추월";
  if (score.score < 3.8) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 구성원의 공감대와 실행 기반을 더 촘촘히 확인할 필요가 있는 영역으로 해석됩니다.`;
  }
  if (score.score < 4.6) {
    return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 기본적인 이해와 실행 의지는 형성되어 있으나, 실제 수업·업무 적용 경험을 더 넓힐 여지가 있습니다.`;
  }
  return `${score.moduleName} 영역은 평균 ${score.score.toFixed(2)}점으로 ${stageLabel} 단계입니다. 이미 높은 실행 기반을 갖춘 강점 영역으로 볼 수 있습니다.`;
}

export function diagnosisImplicationText(score: ModuleScore) {
  const focus = moduleFocusHints[score.moduleId] ?? score.moduleName;
  if (score.score < 3.8) {
    return `시사점: ${focus}에 대한 기본 개념과 안전한 실습을 연수에서 우선 배치하고, 사전면담에서 참여 장벽과 필요한 지원 방식을 구체적으로 확인할 필요가 있습니다.`;
  }
  if (score.score < 4.6) {
    return `시사점: ${focus} 영역을 학교 상황에 맞는 실습과 공동 설계 활동으로 연결해 실제 적용력을 높이고, 산출물이 수업·업무 개선으로 이어지도록 설계할 필요가 있습니다.`;
  }
  return `시사점: ${focus}에서 확인된 강점 사례를 공유하고 다른 과정과 연결해 학교 전체로 확산하는 방향이 적절합니다.`;
}

export function normalizeDiagnosisAnalysis(text: string) {
  const cleaned = polishDraftText(text)
    .replace(/^시사점[:：]?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/단계임을 확인함/g, "단계로 해석됩니다")
    .replace(/것으로 예측됨/g, "것으로 보입니다")
    .replace(/확인함/g, "확인됩니다")
    .replace(/[.。]+$/g, "");
  if (!cleaned) return "연수 구성과 면담 내용을 함께 검토해 학교 맞춤형 실행 방향을 구체화할 필요가 있습니다.";
  return `${cleaned}.`;
}

export function polishDraftText(text: string) {
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
