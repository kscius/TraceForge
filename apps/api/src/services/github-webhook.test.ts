import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractTaskIdentifiers } from "@traceforge/domain";
import { verifyGithubSignature } from "./github-webhook.js";

describe("github webhook", () => {
  it("verifies signature when secret configured", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
    const body = JSON.stringify({ action: "opened" });
    const sig =
      "sha256=" + createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifyGithubSignature(body, sig)).toBe(true);
    expect(verifyGithubSignature(body, "sha256=deadbeef")).toBe(false);
  });

  it("extracts task ids from PR payload text", () => {
    const ids = extractTaskIdentifiers("TF-123: add auth\nfeature/TF-456-login");
    expect(ids).toEqual(expect.arrayContaining(["TF-123", "TF-456"]));
  });
});
