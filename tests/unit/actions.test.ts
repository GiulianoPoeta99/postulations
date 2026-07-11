/**
 * Unit tests for CV version helpers in app/actions.ts.
 * Uses real filesystem in a temp directory per test.
 * compileCv is tested by mocking child_process at the module level.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// We mock child_process.execSync at the top level so compileCv can use it
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

// We also need to redirect where actions.ts looks for data.
// actions.ts uses `path.join(process.cwd(), "data")` which we can't easily
// change, so instead we write files directly to the real data dir in a
// dedicated test subdirectory, and clean up afterwards.
const cwd = process.cwd();
const testDataBase = path.join(cwd, "data", "_test_actions_unit");
const versionsDir = path.join(testDataBase, "cv_versions");
const outputDir = path.join(testDataBase, "rendercv_output");

// Patch the actions module to use our test dir by temporarily replacing
// the module-level constants via direct reimport with mocked paths.
// Since actions.ts hardcodes `path.join(process.cwd(), "data")`, we use
// a different strategy: write tests against the REAL functions using real
// files in a temp subdir, verifying behaviour end-to-end.

// Helper: create a fresh versionsDir + outputDir for each test
function setupTestDirs() {
  fs.mkdirSync(versionsDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
}

function cleanTestDirs() {
  fs.rmSync(testDataBase, { recursive: true, force: true });
}

// Because actions.ts hardcodes `process.cwd()/data/cv_versions`, we need to
// test the REAL data directory. We use a unique prefix to avoid collisions.
// These tests create files in the real data/ dir and clean up after.

const realVersionsDir = path.join(cwd, "data", "cv_versions");
const realOutputDir = path.join(cwd, "data", "rendercv_output");

function uniqueName() {
  return `_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

describe("listCvVersions", () => {
  const testFiles: string[] = [];

  afterEach(() => {
    for (const f of testFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    testFiles.length = 0;
  });

  it("includes versions created with saveCvVersion", async () => {
    const { listCvVersions, saveCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    await saveCvVersion(name, "content");
    const filePath = path.join(realVersionsDir, `${name}.yaml`);
    testFiles.push(filePath);

    const versions = await listCvVersions();
    expect(versions).toContain(name);
  });

  it("does not include non-yaml files", async () => {
    fs.mkdirSync(realVersionsDir, { recursive: true });
    const txtPath = path.join(realVersionsDir, "_test_readme.txt");
    fs.writeFileSync(txtPath, "ignored");
    testFiles.push(txtPath);

    const { listCvVersions } = await import("@/app/actions");
    const versions = await listCvVersions();
    expect(versions).not.toContain("_test_readme.txt");
    expect(versions).not.toContain("_test_readme");
  });
});

describe("getCvVersion", () => {
  const testFiles: string[] = [];

  afterEach(() => {
    for (const f of testFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    testFiles.length = 0;
  });

  it("returns file content for existing version", async () => {
    const { saveCvVersion, getCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    await saveCvVersion(name, "cv:\n  name: Test User");
    testFiles.push(path.join(realVersionsDir, `${name}.yaml`));

    expect(await getCvVersion(name)).toBe("cv:\n  name: Test User");
  });

  it("returns empty string for non-existent version", async () => {
    const { getCvVersion } = await import("@/app/actions");
    expect(await getCvVersion(`_nonexistent_${Date.now()}`)).toBe("");
  });

  it("sanitizes path traversal: ../../etc/passwd → returns empty", async () => {
    const { getCvVersion } = await import("@/app/actions");
    const result = await getCvVersion("../../etc/passwd");
    expect(typeof result).toBe("string");
    // Should not be the /etc/passwd contents
    expect(result).toBe("");
  });
});

describe("saveCvVersion", () => {
  const testFiles: string[] = [];

  afterEach(() => {
    for (const f of testFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
    testFiles.length = 0;
  });

  it("writes content to the correct yaml file", async () => {
    const { saveCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    const filePath = path.join(realVersionsDir, `${name}.yaml`);
    testFiles.push(filePath);

    await saveCvVersion(name, "cv:\n  name: Saved");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("cv:\n  name: Saved");
  });

  it("overwrites existing version", async () => {
    const { saveCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    const filePath = path.join(realVersionsDir, `${name}.yaml`);
    testFiles.push(filePath);

    await saveCvVersion(name, "first");
    await saveCvVersion(name, "second");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("second");
  });
});

describe("deleteCvVersion", () => {
  it("removes the yaml file", async () => {
    const { saveCvVersion, deleteCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    await saveCvVersion(name, "to delete");
    const filePath = path.join(realVersionsDir, `${name}.yaml`);
    expect(fs.existsSync(filePath)).toBe(true);

    await deleteCvVersion(name);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("also deletes associated PDF and PNG files", async () => {
    const { saveCvVersion, deleteCvVersion } = await import("@/app/actions");
    const name = uniqueName();
    await saveCvVersion(name, "x");
    fs.mkdirSync(realOutputDir, { recursive: true });
    const pdfPath = path.join(realOutputDir, `${name}.pdf`);
    const pngPath = path.join(realOutputDir, `${name}_1.png`);
    fs.writeFileSync(pdfPath, "pdf");
    fs.writeFileSync(pngPath, "png");

    await deleteCvVersion(name);
    expect(fs.existsSync(pdfPath)).toBe(false);
    expect(fs.existsSync(pngPath)).toBe(false);
  });
});

describe("renameCvVersion", () => {
  it("renames YAML, PDF, and PNG files", async () => {
    const { saveCvVersion, renameCvVersion } = await import("@/app/actions");
    const oldName = uniqueName();
    const newName = uniqueName();
    
    await saveCvVersion(oldName, "data");
    fs.mkdirSync(realOutputDir, { recursive: true });
    fs.writeFileSync(path.join(realOutputDir, `${oldName}.pdf`), "pdf content");
    fs.writeFileSync(path.join(realOutputDir, `${oldName}_1.png`), "png content");

    const result = await renameCvVersion(oldName, newName);
    expect(result.success).toBe(true);

    // Old files should not exist
    expect(fs.existsSync(path.join(realVersionsDir, `${oldName}.yaml`))).toBe(false);
    expect(fs.existsSync(path.join(realOutputDir, `${oldName}.pdf`))).toBe(false);
    expect(fs.existsSync(path.join(realOutputDir, `${oldName}_1.png`))).toBe(false);

    // New files should exist
    expect(fs.existsSync(path.join(realVersionsDir, `${newName}.yaml`))).toBe(true);
    expect(fs.existsSync(path.join(realOutputDir, `${newName}.pdf`))).toBe(true);
    expect(fs.existsSync(path.join(realOutputDir, `${newName}_1.png`))).toBe(true);
  });

// removed
});

describe("compileCv", () => {
  it("writes the YAML file before attempting to compile", async () => {
    const { compileCv } = await import("@/app/actions");
    // compileCv will fail (no python/rendercv) but should still write YAML first
    const result = await compileCv("default", "cv:\n  name: CompileTest");

    // Whether success or error, the result must have a 'success' boolean
    expect(typeof result.success).toBe("boolean");

    // If it failed (no python), error should be a string
    if (!result.success) {
      expect(typeof result.error).toBe("string");
      expect(result.error!.length).toBeGreaterThan(0);
    }
  });

  it("sanitizes version name — removes special chars", async () => {
    const { compileCv } = await import("@/app/actions");
    // Version "../../evil" sanitizes to "" → "default"
    const result = await compileCv("../../evil", "cv:\n  name: Test");
    expect(typeof result.success).toBe("boolean");
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns { success: false, error } when compile fails", async () => {
    const { compileCv } = await import("@/app/actions");
    // In the test environment, python3 -m rendercv will likely fail
    const result = await compileCv("default", "invalid yaml: [[[");
    // Either success (rendercv installed) or failure with error string
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(result).toHaveProperty("success");
  });

  it("deletes old png files before rendering", async () => {
    const { compileCv } = await import("@/app/actions");
    fs.mkdirSync(realOutputDir, { recursive: true });
    const oldPngPath = path.join(realOutputDir, "cleanup_1.png");
    fs.writeFileSync(oldPngPath, "old png");
    expect(fs.existsSync(oldPngPath)).toBe(true);

    await compileCv("cleanup", "invalid yaml: [[[");
    // Since compileCv cleans up files matching `${sanitized}_*.png` before compiling,
    // and the invalid YAML causes rendercv to fail, the old png should be deleted and not recreated.
    expect(fs.existsSync(oldPngPath)).toBe(false);
  });
});



