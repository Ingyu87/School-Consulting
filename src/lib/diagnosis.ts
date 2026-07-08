import type { ModuleScore, ScoreStage } from "../types";

export function scoreStage(score: number): ScoreStage {
  if (score < 3.8) return "도약";
  if (score < 4.6) return "만족";
  return "추월";
}

export function stageTone(stage: ScoreStage) {
  if (stage === "도약") return "leap";
  if (stage === "만족") return "satisfy";
  return "lead";
}

export const stageDescriptions: Record<ScoreStage, string> = {
  도약: "3.8점 미만: 우선 지원과 면담 확인이 필요한 단계입니다. 학교 여건, 참여자 수준, 운영 제약을 확인해 기초 역량과 실행 기반을 보완합니다.",
  만족: "3.8점 이상 4.6점 미만: 기본 이해와 실천 기반이 형성된 단계입니다. 수업 적용 사례와 교내 확산을 중심으로 실천력을 강화합니다.",
  추월: "4.6점 이상: 학교 내 실행 역량이 높게 나타나는 단계입니다. 강점을 사례화하고 다른 과정과 연계해 확산 전략을 구체화합니다."
};

export function diagnosisImplication(score: ModuleScore) {
  if (score.stage === "도약") {
    return `${score.moduleName}은 우선 확인 영역입니다. 심층면담에서 낮은 응답의 원인, 참여자 선행 수준, 학교가 희망하는 지원 방식을 확인하고 연수 구성에 반영합니다.`;
  }
  if (score.stage === "만족") {
    return `${score.moduleName}은 기본 기반이 확인되는 영역입니다. 학교의 현재 실천 사례를 점검하고, 실제 수업·업무 적용으로 이어질 수 있도록 실습과 사례 공유를 강화합니다.`;
  }
  return `${score.moduleName}은 강점으로 활용 가능한 영역입니다. 학교 내 우수 사례를 발굴하고, 후속 연수에서 공유·확산할 수 있는 실행 과제로 연결합니다.`;
}

export function buildInsights(scores: ModuleScore[]) {
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const lows = sorted.slice(0, 3);
  const highs = sorted.slice(-3).reverse();
  const average =
    scores.length > 0
      ? scores.reduce((sum, item) => sum + item.score, 0) / scores.length
      : 0;
  const lowText = lows
    .map((item) => `${item.moduleName}(${item.score.toFixed(2)})`)
    .join(", ");
  const highText = highs
    .map((item) => `${item.moduleName}(${item.score.toFixed(2)})`)
    .join(", ");

  return {
    average,
    lows,
    highs,
    draft:
      scores.length === 0
        ? "CSV를 업로드하면 과정별 진단 결과를 바탕으로 분석 초안이 생성됩니다."
        : `전체 평균은 ${average.toFixed(2)}점입니다. 우선 확인 영역은 ${lowText}이며, 강점으로 설명할 수 있는 영역은 ${highText}입니다. 낮은 영역은 심층면담에서 학교 여건, 참여자 수준, 희망 연수 방식과 연결해 확인합니다.`
  };
}
