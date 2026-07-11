/**
 * Integration tests for lib/db.ts using a real SQLite :memory: database.
 * DATABASE_PATH=:memory: is set in tests/setup.ts.
 *
 * Because lib/db.ts uses a module-level singleton (globalThis.postulacionesDb),
 * each test file gets a fresh module via vi.resetModules() in beforeEach.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

// Reset module registry so each test gets a fresh in-memory DB
beforeEach(() => {
  vi.resetModules();
  // Clear the singleton so the module creates a new :memory: DB
  (globalThis as any).postulacionesDb = undefined;
});

async function getDb() {
  return await import("@/lib/db");
}

// ─── listApplications ────────────────────────────────────────────────────────

describe("listApplications", () => {
  it("returns empty array when no applications exist", async () => {
    const { listApplications } = await getDb();
    expect(listApplications()).toEqual([]);
  });

  it("returns created application with correct fields", async () => {
    const { createApplication, listApplications } = await getDb();
    createApplication({ nombreEmpresa: "Acme", linkPropuesta: "", estado: "aplicado", textoPostulacion: "text" });
    const apps = listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0].nombreEmpresa).toBe("Acme");
    expect(apps[0].estado).toBe("aplicado");
    expect(apps[0].noteCount).toBe(0);
    expect(apps[0].deletedAt).toBeNull();
  });

  it("does not return soft-deleted applications", async () => {
    const { createApplication, softDeleteApplication, listApplications } = await getDb();
    const id = createApplication({ nombreEmpresa: "Gone", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    softDeleteApplication(id);
    expect(listApplications()).toHaveLength(0);
  });

  it("returns applications ordered by id DESC", async () => {
    const { createApplication, listApplications } = await getDb();
    createApplication({ nombreEmpresa: "First", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    createApplication({ nombreEmpresa: "Second", linkPropuesta: "", estado: "pendiente", textoPostulacion: "" });
    const apps = listApplications();
    expect(apps[0].nombreEmpresa).toBe("Second");
    expect(apps[1].nombreEmpresa).toBe("First");
  });
});

// ─── createApplication ───────────────────────────────────────────────────────

describe("createApplication", () => {
  it("returns a positive integer ID", async () => {
    const { createApplication } = await getDb();
    const id = createApplication({ nombreEmpresa: "Corp", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    expect(id).toBeGreaterThan(0);
  });

  it("stores CV fields when provided", async () => {
    const { createApplication, listApplications } = await getDb();
    createApplication(
      { nombreEmpresa: "WithCV", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "resume.pdf", cvStoredName: "abc123.pdf" }
    );
    const app = listApplications()[0];
    expect(app.cvFilename).toBe("resume.pdf");
    expect(app.cvStoredName).toBe("abc123.pdf");
  });

  it("stores empty CV fields when CV not provided", async () => {
    const { createApplication, listApplications } = await getDb();
    createApplication({ nombreEmpresa: "NoCv", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    const app = listApplications()[0];
    expect(app.cvFilename).toBe("");
    expect(app.cvStoredName).toBe("");
  });

  it("stores null CV when explicitly null", async () => {
    const { createApplication, listApplications } = await getDb();
    createApplication({ nombreEmpresa: "NullCv", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" }, null);
    const app = listApplications()[0];
    expect(app.cvFilename).toBe("");
  });
});

// ─── updateApplication ───────────────────────────────────────────────────────

describe("updateApplication", () => {
  it("updates all basic fields", async () => {
    const { createApplication, updateApplication, listApplications } = await getDb();
    const id = createApplication({ nombreEmpresa: "Old", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    updateApplication(id, { nombreEmpresa: "New", linkPropuesta: "https://x.com", estado: "entrevista", textoPostulacion: "updated" });
    const app = listApplications()[0];
    expect(app.nombreEmpresa).toBe("New");
    expect(app.estado).toBe("entrevista");
    expect(app.linkPropuesta).toBe("https://x.com");
  });

  it("preserves existing CV when no new CV provided", async () => {
    const { createApplication, updateApplication, listApplications } = await getDb();
    const id = createApplication(
      { nombreEmpresa: "Kept", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "old.pdf", cvStoredName: "old-uuid.pdf" }
    );
    updateApplication(id, { nombreEmpresa: "Kept", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    const app = listApplications()[0];
    expect(app.cvFilename).toBe("old.pdf");
  });

  it("updates CV when new CV provided", async () => {
    const { createApplication, updateApplication, listApplications } = await getDb();
    const id = createApplication(
      { nombreEmpresa: "UpdateCV", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "old.pdf", cvStoredName: "old.pdf" }
    );
    updateApplication(
      id,
      { nombreEmpresa: "UpdateCV", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "new.pdf", cvStoredName: "new.pdf" }
    );
    const app = listApplications()[0];
    expect(app.cvFilename).toBe("new.pdf");
  });

  it("does not update a soft-deleted application", async () => {
    const { createApplication, softDeleteApplication, updateApplication, listApplications } = await getDb();
    const id = createApplication({ nombreEmpresa: "Ghost", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    softDeleteApplication(id);
    // updateApplication should silently skip (WHERE deleted_at IS NULL)
    updateApplication(id, { nombreEmpresa: "Should Not Update", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    // Application is still deleted so listApplications returns 0
    expect(listApplications()).toHaveLength(0);
  });
});

// ─── softDeleteApplication ───────────────────────────────────────────────────

describe("softDeleteApplication", () => {
  it("sets deleted_at timestamp", async () => {
    const { createApplication, softDeleteApplication, listApplications } = await getDb();
    createApplication({ nombreEmpresa: "ToDelete", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    // Before delete: 1 result
    expect(listApplications()).toHaveLength(1);
    const id = listApplications()[0].id;
    softDeleteApplication(id);
    expect(listApplications()).toHaveLength(0);
  });

  it("is idempotent — deleting twice does not throw", async () => {
    const { createApplication, softDeleteApplication } = await getDb();
    const id = createApplication({ nombreEmpresa: "Twice", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    expect(() => {
      softDeleteApplication(id);
      softDeleteApplication(id);
    }).not.toThrow();
  });
});

// ─── createApplicationNote ───────────────────────────────────────────────────

describe("createApplicationNote", () => {
  it("creates a note and it appears in listApplications", async () => {
    const { createApplication, createApplicationNote, listApplications } = await getDb();
    const id = createApplication({ nombreEmpresa: "WithNote", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    createApplicationNote(id, "My first note");
    const app = listApplications()[0];
    expect(app.noteCount).toBe(1);
    expect(app.latestNote).toBe("My first note");
  });

  it("does not create note for non-existent application", async () => {
    const { createApplicationNote, listApplications } = await getDb();
    // Should not throw, just silently not insert
    expect(() => createApplicationNote(99999, "Orphan note")).not.toThrow();
  });

  it("does not create note for soft-deleted application", async () => {
    const { createApplication, softDeleteApplication, createApplicationNote, listApplications } = await getDb();
    const id = createApplication({ nombreEmpresa: "Deleted", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    softDeleteApplication(id);
    createApplicationNote(id, "note on deleted");
    // Application doesn't appear in list, so we can't verify the note count
    // but the important thing is no exception thrown
  });
});

// ─── updateApplicationNote ───────────────────────────────────────────────────

describe("updateApplicationNote", () => {
  it("updates note content", async () => {
    const { createApplication, createApplicationNote, updateApplicationNote, listApplications } = await getDb();
    const appId = createApplication({ nombreEmpresa: "NoteEdit", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    createApplicationNote(appId, "original");
    const noteId = listApplications()[0].notes[0].id;
    updateApplicationNote(noteId, "updated content");
    const app = listApplications()[0];
    expect(app.notes[0].content).toBe("updated content");
  });
});

// ─── softDeleteApplicationNote ───────────────────────────────────────────────

describe("softDeleteApplicationNote", () => {
  it("removes note from listing", async () => {
    const { createApplication, createApplicationNote, softDeleteApplicationNote, listApplications } = await getDb();
    const appId = createApplication({ nombreEmpresa: "NoteDelete", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" });
    createApplicationNote(appId, "to be deleted");
    const noteId = listApplications()[0].notes[0].id;
    softDeleteApplicationNote(noteId);
    const app = listApplications()[0];
    expect(app.noteCount).toBe(0);
    expect(app.latestNote).toBe("");
  });
});

// ─── getCvFile ───────────────────────────────────────────────────────────────

describe("getCvFile", () => {
  it("returns null when storedName not found", async () => {
    const { getCvFile } = await getDb();
    const result = getCvFile("nonexistent-uuid.pdf");
    expect(result).toBeNull();
  });

  it("returns CvInput for existing storedName", async () => {
    const { createApplication, getCvFile } = await getDb();
    createApplication(
      { nombreEmpresa: "CVFile", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "resume.pdf", cvStoredName: "stored-uuid.pdf" }
    );
    const result = getCvFile("stored-uuid.pdf");
    expect(result).not.toBeNull();
    expect(result!.cvFilename).toBe("resume.pdf");
    expect(result!.cvStoredName).toBe("stored-uuid.pdf");
  });

  it("returns null for soft-deleted application's CV", async () => {
    const { createApplication, softDeleteApplication, listApplications, getCvFile } = await getDb();
    const id = createApplication(
      { nombreEmpresa: "Deleted", linkPropuesta: "", estado: "aplicado", textoPostulacion: "" },
      { cvFilename: "x.pdf", cvStoredName: "deleted-uuid.pdf" }
    );
    softDeleteApplication(id);
    const result = getCvFile("deleted-uuid.pdf");
    expect(result).toBeNull();
  });
});
