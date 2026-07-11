/**
 * Integration tests for Server Actions in app/actions.ts.
 * We call the exported async functions directly with synthetic FormData.
 * revalidatePath is mocked in tests/setup.ts.
 * Database uses :memory: SQLite (set in tests/setup.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";

// Reset modules and DB singleton for each test to get clean slate
beforeEach(() => {
  vi.resetModules();
  (globalThis as any).postulacionesDb = undefined;
  vi.mocked(revalidatePath).mockClear();
});

function makeFormData(data: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(data)) {
    fd.set(key, val);
  }
  return fd;
}

async function getActions() {
  return await import("@/app/actions");
}

async function getDb() {
  return await import("@/lib/db");
}

// ─── createPostulacion ───────────────────────────────────────────────────────

describe("createPostulacion", () => {
  it("creates application and calls revalidatePath", async () => {
    const { createPostulacion } = await getActions();
    const { listApplications } = await getDb();

    const fd = makeFormData({ nombreEmpresa: "Acme Corp", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" });
    await createPostulacion(fd);

    const apps = listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0].nombreEmpresa).toBe("Acme Corp");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does nothing if nombreEmpresa is empty", async () => {
    const { createPostulacion } = await getActions();
    const { listApplications } = await getDb();

    const fd = makeFormData({ nombreEmpresa: "  ", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" });
    await createPostulacion(fd);

    expect(listApplications()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("creates initial note when notaInicial is provided", async () => {
    const { createPostulacion } = await getActions();
    const { listApplications } = await getDb();

    const fd = makeFormData({
      nombreEmpresa: "WithNote",
      estado: "aplicado",
      linkPropuesta: "",
      textoPostulacion: "",
      notaInicial: "This is an initial note",
    });
    await createPostulacion(fd);

    const app = listApplications()[0];
    expect(app.noteCount).toBe(1);
    expect(app.latestNote).toBe("This is an initial note");
    expect(app.notes[0].title).toBe("Nota inicial");
  });

  it("does not create note if notaInicial is empty", async () => {
    const { createPostulacion } = await getActions();
    const { listApplications } = await getDb();

    const fd = makeFormData({
      nombreEmpresa: "NoNote",
      estado: "aplicado",
      linkPropuesta: "",
      textoPostulacion: "",
      notaInicial: "",
    });
    await createPostulacion(fd);

    expect(listApplications()[0].noteCount).toBe(0);
  });
});

// ─── updatePostulacion ───────────────────────────────────────────────────────

describe("updatePostulacion", () => {
  it("updates application fields and calls revalidatePath", async () => {
    const { createPostulacion, updatePostulacion } = await getActions();
    const { listApplications } = await getDb();

    await createPostulacion(makeFormData({ nombreEmpresa: "Original", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" }));
    const appId = listApplications()[0].id;

    await updatePostulacion(
      appId,
      makeFormData({ nombreEmpresa: "Updated", estado: "entrevista", linkPropuesta: "https://example.com", textoPostulacion: "new text" })
    );

    const updated = listApplications()[0];
    expect(updated.nombreEmpresa).toBe("Updated");
    expect(updated.estado).toBe("entrevista");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does nothing if nombreEmpresa is empty", async () => {
    const { createPostulacion, updatePostulacion } = await getActions();
    const { listApplications } = await getDb();

    await createPostulacion(makeFormData({ nombreEmpresa: "Keep", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" }));
    const appId = listApplications()[0].id;
    vi.mocked(revalidatePath).mockClear();

    await updatePostulacion(appId, makeFormData({ nombreEmpresa: "", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" }));

    // Should not have updated
    expect(listApplications()[0].nombreEmpresa).toBe("Keep");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ─── deletePostulacion ───────────────────────────────────────────────────────

describe("deletePostulacion", () => {
  it("soft-deletes and calls revalidatePath", async () => {
    const { createPostulacion, deletePostulacion } = await getActions();
    const { listApplications } = await getDb();

    await createPostulacion(makeFormData({ nombreEmpresa: "ToBeDel", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" }));
    const appId = listApplications()[0].id;
    vi.mocked(revalidatePath).mockClear();

    await deletePostulacion(appId);

    expect(listApplications()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

// ─── updatePostulacionNotasAction ──────────────────────────────────────────────────────────────

describe("createNota", () => {
  it("creates a note on existing application", async () => {
    const { createPostulacion, createNota } = await getActions();
    const { listApplications } = await getDb();

    await createPostulacion(makeFormData({ nombreEmpresa: "NoteApp", estado: "aplicado", linkPropuesta: "", textoPostulacion: "" }));
    const appId = listApplications()[0].id;

    await createNota(appId, makeFormData({ title: "My note title", content: "My note content" }));

    const app = listApplications()[0];
    expect(app.noteCount).toBe(1);
    expect(app.latestNote).toBe("My note content");
    expect(app.notes[0].title).toBe("My note title");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
