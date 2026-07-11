import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import fs from "node:fs";

// ─── isApplicationStatus ──────────────────────────────────────────────────────

import { isApplicationStatus, applicationStatuses, getCvStorageDir, getCvFilePath } from "@/lib/db";

describe("isApplicationStatus", () => {
  it("returns true for all valid statuses", () => {
    for (const s of applicationStatuses) {
      expect(isApplicationStatus(s)).toBe(true);
    }
  });

  it("returns false for empty string", () => {
    expect(isApplicationStatus("")).toBe(false);
  });

  it("returns false for English status names", () => {
    expect(isApplicationStatus("rejected")).toBe(false);
    expect(isApplicationStatus("pending")).toBe(false);
  });

  it("returns false for uppercase valid status", () => {
    expect(isApplicationStatus("APLICADO")).toBe(false);
  });

  it("returns false for arbitrary strings", () => {
    expect(isApplicationStatus("undefined")).toBe(false);
    expect(isApplicationStatus("null")).toBe(false);
  });
});

// ─── getCvStorageDir ─────────────────────────────────────────────────────────

describe("getCvStorageDir", () => {
  it("creates and returns the cvs directory", () => {
    const dir = getCvStorageDir();
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toContain("cvs");
  });

  it("returns same path on repeated calls", () => {
    const dir1 = getCvStorageDir();
    const dir2 = getCvStorageDir();
    expect(dir1).toBe(dir2);
  });
});

// ─── getCvFilePath ────────────────────────────────────────────────────────────

describe("getCvFilePath", () => {
  it("joins storage dir with the stored name", () => {
    const result = getCvFilePath("some-uuid.pdf");
    expect(result).toMatch(/cvs[/\\]some-uuid\.pdf$/);
  });

  it("strips directory traversal attempts using path.basename", () => {
    const result = getCvFilePath("../../etc/passwd");
    expect(result).toMatch(/cvs[/\\]passwd$/);
    expect(result).not.toContain("..");
  });
});
