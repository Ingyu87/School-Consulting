import { describe, expect, it } from "vitest";
import { defaultModules } from "../data/modules";
import { validateModules } from "./validation";

describe("validateModules", () => {
  it("accepts a 12-hour plan with required modules and three optional courses", () => {
    const modules = defaultModules.map((module) => ({
      ...module,
      selected: [0, 1, 4, 5, 7].includes(module.id),
      hours: module.id === 0 || module.id === 7 ? 1 : module.id === 1 ? 2 : 4,
      method: "오프라인" as const
    }));

    const errors = validateModules(modules).filter((item) => item.level === "error");

    expect(errors).toHaveLength(0);
  });

  it("blocks missing optional courses and short total hours", () => {
    const modules = defaultModules.map((module) => ({
      ...module,
      selected: module.required,
      method: "오프라인" as const
    }));

    const messages = validateModules(modules)
      .filter((item) => item.level === "error")
      .map((item) => item.message);

    expect(messages.some((message) => message.includes("5개 과정 이상"))).toBe(true);
    expect(messages.some((message) => message.includes("최소 12차시"))).toBe(true);
  });
});
