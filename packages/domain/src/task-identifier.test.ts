import { describe, expect, it } from "vitest";
import { extractTaskIdentifiers, formatTaskIdentifier, parseTaskIdentifier } from "./task-identifier.js";

describe("task identifiers", () => {
  it("formats and parses", () => {
    expect(formatTaskIdentifier("tf", 123)).toBe("TF-123");
    expect(parseTaskIdentifier("TF-123")).toEqual({ projectKey: "TF", number: 123 });
  });

  it("extracts from git text", () => {
    const ids = extractTaskIdentifiers("feature/TF-123-auth\nfix(TF-456): typo");
    expect(ids).toContain("TF-123");
    expect(ids).toContain("TF-456");
  });
});
