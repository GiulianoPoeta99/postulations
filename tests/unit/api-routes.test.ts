import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NextRequest } from "next/server";

// ─── PDF route ────────────────────────────────────────────────────────────────

describe("GET /api/cv/pdf", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cv-pdf-test-"));
    vi.stubEnv("POSTULACIONES_DATA_DIR", tmpDir);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/cv/pdf");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url.toString());
  }

  it("returns 404 when PDF does not exist", async () => {
    const { GET } = await import("@/app/api/cv/pdf/route");
    const res = await GET(makeRequest({ version: "default" }));
    expect(res.status).toBe(404);
  });

  it("returns the PDF with correct headers when file exists", async () => {
    const outputDir = path.join(process.cwd(), "data", "rendercv_output");
    fs.mkdirSync(outputDir, { recursive: true });
    const pdfPath = path.join(outputDir, "default.pdf");
    fs.writeFileSync(pdfPath, "%PDF-1.4 fake content");

    try {
      const { GET } = await import("@/app/api/cv/pdf/route");
      const res = await GET(makeRequest({ version: "default" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("Content-Disposition")).toContain("default.pdf");
    } finally {
      fs.rmSync(pdfPath, { force: true });
    }
  });

  it("returns 500 when file exists but read fails", async () => {
    const outputDir = path.join(process.cwd(), "data", "rendercv_output");
    fs.mkdirSync(outputDir, { recursive: true });
    const pdfPath = path.join(outputDir, "default.pdf");
    fs.writeFileSync(pdfPath, "pdf");

    const originalReadFileSync = fs.readFileSync;
    // @ts-ignore
    fs.readFileSync = () => { throw new Error("disk error"); };

    try {
      const { GET } = await import("@/app/api/cv/pdf/route");
      const res = await GET(makeRequest({ version: "default" }));
      expect(res.status).toBe(500);
    } finally {
      // @ts-ignore
      fs.readFileSync = originalReadFileSync;
      fs.rmSync(pdfPath, { force: true });
    }
  });

  it("sanitizes malicious version parameter", async () => {
    const { GET } = await import("@/app/api/cv/pdf/route");
    const res = await GET(makeRequest({ version: "../../etc/passwd" }));
    // sanitized to "" → "default" → file doesn't exist → 404
    expect(res.status).toBe(404);
  });

  it("defaults to version=default when not specified", async () => {
    const { GET } = await import("@/app/api/cv/pdf/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(404); // file doesn't exist, but it tried "default"
  });
});

// ─── Preview route ────────────────────────────────────────────────────────────

describe("GET /api/cv/preview", () => {
  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/cv/preview");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url.toString());
  }

  it("returns 400 for page=0", async () => {
    const { GET } = await import("@/app/api/cv/preview/route");
    const res = await GET(makeRequest({ page: "0" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for page=-1", async () => {
    const { GET } = await import("@/app/api/cv/preview/route");
    const res = await GET(makeRequest({ page: "-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric page", async () => {
    const { GET } = await import("@/app/api/cv/preview/route");
    const res = await GET(makeRequest({ page: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when PNG does not exist", async () => {
    const { GET } = await import("@/app/api/cv/preview/route");
    const res = await GET(makeRequest({ version: "default", page: "1" }));
    expect(res.status).toBe(404);
  });

  it("returns PNG with correct headers when file exists", async () => {
    const outputDir = path.join(process.cwd(), "data", "rendercv_output");
    fs.mkdirSync(outputDir, { recursive: true });
    const pngPath = path.join(outputDir, "default_1.png");
    const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    fs.writeFileSync(pngPath, fakeBytes);

    try {
      const { GET } = await import("@/app/api/cv/preview/route");
      const res = await GET(makeRequest({ version: "default", page: "1" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    } finally {
      fs.rmSync(pngPath, { force: true });
    }
  });

  it("returns 500 when PNG file exists but read fails", async () => {
    const outputDir = path.join(process.cwd(), "data", "rendercv_output");
    fs.mkdirSync(outputDir, { recursive: true });
    const pngPath = path.join(outputDir, "default_1.png");
    fs.writeFileSync(pngPath, "png");

    const originalReadFileSync = fs.readFileSync;
    // @ts-ignore
    fs.readFileSync = () => { throw new Error("disk error"); };

    try {
      const { GET } = await import("@/app/api/cv/preview/route");
      const res = await GET(makeRequest({ version: "default", page: "1" }));
      expect(res.status).toBe(500);
    } finally {
      // @ts-ignore
      fs.readFileSync = originalReadFileSync;
      fs.rmSync(pngPath, { force: true });
    }
  });

  it("sanitizes malicious version parameter", async () => {
    const { GET } = await import("@/app/api/cv/preview/route");
    const res = await GET(makeRequest({ version: "../../../etc", page: "1" }));
    expect(res.status).toBe(404); // sanitized, file not found
  });
});
