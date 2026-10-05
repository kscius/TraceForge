import { describe, expect, it } from "vitest";
import { WorkflowEngine } from "./workflow.js";

describe("WorkflowEngine", () => {
  const states = [
    { id: "s1", key: "todo", isTerminal: false },
    { id: "s2", key: "done", isTerminal: true },
  ];
  const transitions = [{ fromStateId: "s1", toStateId: "s2" }];
  const engine = new WorkflowEngine(states, transitions);

  it("allows configured transitions", () => {
    expect(engine.canTransition("s1", "s2")).toBe(true);
    expect(engine.canTransition("s2", "s1")).toBe(false);
  });

  it("detects terminal states", () => {
    expect(engine.isTerminal("s2")).toBe(true);
    expect(engine.isTerminal("s1")).toBe(false);
  });
});
