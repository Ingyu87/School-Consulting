import { describe, expect, it } from "vitest";
import { createInitialState } from "./defaults";
import { compactStoredState } from "./storage";

describe("compactStoredState", () => {
  it("removes raw CSV rows before persistence", () => {
    const state = createInitialState();
    state.project = {
      schoolName: "서울고일초",
      sourceFileName: "sample.csv",
      rawRows: [["원본", "행"]],
      moduleScores: [],
      infrastructureDistributions: [],
      openEndedQuestions: [],
      parseWarnings: []
    };

    expect(compactStoredState(state).project?.rawRows).toEqual([]);
  });
});
