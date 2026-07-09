import { describe, expect, it } from "vitest";
import { createInitialState, hydrateState } from "./defaults";

describe("hydrateState", () => {
  it("restores new interview fields with safe defaults", () => {
    const restored = hydrateState({
      ...createInitialState(),
      interview: {
        transcript: "면담 전사",
        followUpQuestions: ["참여 인원 확인 필요", 123]
      }
    });

    expect(restored.interview.transcript).toBe("면담 전사");
    expect(restored.interview.followUpQuestions).toEqual(["참여 인원 확인 필요"]);
    expect(restored.interview.teachers).toHaveLength(5);
  });

  it("keeps required modules selected when restoring saved data", () => {
    const restored = hydrateState({
      modules: [
        { id: 0, selected: false },
        { id: 7, selected: false }
      ]
    });

    expect(restored.modules.find((module) => module.id === 0)?.selected).toBe(true);
    expect(restored.modules.find((module) => module.id === 7)?.selected).toBe(true);
  });
});
