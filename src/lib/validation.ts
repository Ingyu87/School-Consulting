import type { TrainingModule } from "../types";

export type ValidationItem = {
  level: "ok" | "warning" | "error";
  message: string;
};

export function validateModules(modules: TrainingModule[]): ValidationItem[] {
  const selected = modules.filter((module) => module.selected);
  const totalHours = selected.reduce((sum, module) => sum + module.hours, 0);
  const optional = selected.filter((module) => !module.required);
  const module123Hours = selected
    .filter((module) => [1, 2, 3].includes(module.id))
    .reduce((sum, module) => sum + module.hours, 0);
  const onlineHours = selected
    .filter((module) => module.method === "온라인")
    .reduce((sum, module) => sum + module.hours, 0);
  const teacherHours = selected
    .filter((module) => ["교원", "교직원", "학교 관리자"].includes(module.target))
    .reduce((sum, module) => sum + module.hours, 0);

  return [
    {
      level: selected.length >= 5 ? "ok" : "error",
      message: `총 ${selected.length}개 과정 선택: 5개 과정 이상이어야 합니다.`
    },
    {
      level: totalHours >= 12 ? "ok" : "error",
      message: `현재 ${totalHours}차시: 최소 12차시까지 ${Math.max(0, 12 - totalHours)}차시 남았습니다.`
    },
    {
      level: totalHours <= 17 ? "ok" : "error",
      message: `필수 포함 총 ${totalHours}차시: 최대 17차시 이하여야 합니다.`
    },
    {
      level: modules.find((module) => module.id === 0)?.selected && modules.find((module) => module.id === 7)?.selected ? "ok" : "error",
      message: "필수 과정 0과 7은 각각 1차시로 포함되어야 합니다."
    },
    {
      level: optional.length >= 3 ? "ok" : "error",
      message: `선택 과정 ${optional.length}개: 최소 3개 이상이어야 합니다.`
    },
    {
      level: module123Hours <= 5 ? "ok" : "error",
      message: `모듈 1+2+3 합계 ${module123Hours}차시: 최대 5차시입니다.`
    },
    {
      level: teacherHours >= 2 ? "ok" : "error",
      message: `교원 대상 연수 ${teacherHours}차시: 최소 2차시 이상 구성해야 합니다.`
    },
    {
      level: totalHours === 0 || onlineHours / totalHours <= 0.3 ? "ok" : "error",
      message: `온라인 ${onlineHours}차시: 전체 차시의 30% 이하여야 합니다.`
    },
    {
      level: "warning",
      message: "PDF 기준: 사업 기간 내 식사 1회, 간식 3회 제공. 리더십 과정 진행 시 예산 내 식사 1회 추가 제공 가능합니다."
    },
    {
      level: "warning",
      message: "PDF 기준: 학부모·학생·온라인 연수는 식사·다과 미제공이며 식사 시간은 차시에 포함하지 않습니다."
    }
  ];
}
