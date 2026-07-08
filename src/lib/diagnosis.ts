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
