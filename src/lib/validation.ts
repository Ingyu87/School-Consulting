import type { TrainingModule } from "../types";

export type ValidationItem = {
  level: "ok" | "warning" | "error";
  message: string;
};

const teacherTargets = ["교원", "교직원", "학교 관리자"];

export function validateModules(modules: TrainingModule[]): ValidationItem[] {
  const selected = modules.filter((module) => module.selected);
  const totalHours = selected.reduce((sum, module) => sum + module.hours, 0);
  const optional = selected.filter((module) => !module.required);
  const optionalHours = optional.reduce((sum, module) => sum + module.hours, 0);
  const module123Hours = selected
    .filter((module) => [1, 2, 3].includes(module.id))
    .reduce((sum, module) => sum + module.hours, 0);
  const onlineHours = selected
    .filter((module) => module.method === "온라인")
    .reduce((sum, module) => sum + module.hours, 0);
  const requiredZero = modules.find((module) => module.id === 0);
  const requiredSeven = modules.find((module) => module.id === 7);
  const requiredModulesValid =
    requiredZero?.selected === true &&
    requiredSeven?.selected === true &&
    requiredZero.hours === 1 &&
    requiredSeven.hours === 1;
  const requiredOnline = selected.some((module) => module.required && module.method === "온라인");

  // 운영 안내 기준: 교원 대상 연수는 모듈 단위로 2차시 이상 구성해야 함 (필수 0·7은 1차시 고정이라 제외)
  const shortTeacherModules = optional.filter(
    (module) => teacherTargets.includes(module.target) && module.hours < 2
  );

  return [
    {
      level: selected.length >= 5 ? "ok" : "error",
      message: `총 ${selected.length}개 과정 선택: 5개 과정 이상이어야 합니다. (필수 2개 + 선택 3개)`
    },
    {
      level: totalHours >= 12 ? "ok" : "error",
      message: `현재 ${totalHours}차시: 최소 12차시까지 ${Math.max(0, 12 - totalHours)}차시 남았습니다.`
    },
    {
      level: optionalHours <= 15 ? "ok" : "error",
      message: `필수 제외 ${optionalHours}차시: 최대 15차시 이하여야 합니다.`
    },
    {
      level: totalHours <= 17 ? "ok" : "error",
      message: `필수 포함 총 ${totalHours}차시: 최대 17차시 이하여야 합니다.`
    },
    {
      level: requiredModulesValid ? "ok" : "error",
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
      level: shortTeacherModules.length === 0 ? "ok" : "error",
      message:
        shortTeacherModules.length === 0
          ? "교원 대상 선택 과정은 모두 모듈 단위 2차시 이상입니다."
          : `교원 대상 과정은 모듈 단위로 2차시 이상이어야 합니다. 확인 필요: ${shortTeacherModules
              .map((module) => `모듈${module.id}(${module.hours}차시)`)
              .join(", ")}`
    },
    {
      level: totalHours === 0 || onlineHours / totalHours <= 0.3 ? "ok" : "error",
      message: `온라인 ${onlineHours}차시: 전체 차시의 30% 이하여야 합니다. (모듈1~6만 온라인 가능)`
    },
    {
      level: requiredOnline ? "error" : "ok",
      message: requiredOnline
        ? "필수 모듈 0·7은 오프라인으로 운영해야 합니다."
        : "필수 모듈 0·7 오프라인 운영 기준을 충족합니다."
    },
    {
      level: "warning",
      message: "운영 안내: 0과정은 첫 연수로, 7과정은 모든 연수 종료 후 환류 과정으로 마지막에 운영합니다."
    },
    {
      level: "warning",
      message: "운영 안내: 사업 기간 내 식사 1회, 간식 3회가 제공되며 리더십 과정 진행 시 예산 범위에서 식사 1회가 추가 제공될 수 있습니다."
    },
    {
      level: "warning",
      message: "운영 안내: 학부모·학생·온라인 연수는 식사·다과가 제공되지 않으며, 식사 시간은 연수 차시에 포함하지 않습니다."
    }
  ];
}
