"use server";

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { parse, stringify } from "yaml";

function resolveLanguage(obj: any, lang: string): any {
  if (Array.isArray(obj)) {
    return obj.map(item => resolveLanguage(item, lang));
  }
  if (obj !== null && typeof obj === "object") {
    const keys = Object.keys(obj);
    const isTranslationObj = keys.every(k => ["en", "es", "pt", "fr", "de", "it"].includes(k));
    
    if (isTranslationObj && obj[lang] !== undefined) {
      return resolveLanguage(obj[lang], lang);
    }
    
    const newObj: any = {};
    for (const key of keys) {
      newObj[key] = resolveLanguage(obj[key], lang);
    }
    return newObj;
  }
  return obj;
}
import {
  createApplication,
  getCvFilePath,
  getCvStorageDir,
  isApplicationStatus,
  softDeleteApplication,
  updateApplication,
  updateApplicationStatus,
  updateApplicationNote,
  softDeleteApplicationNote,
  listCvVersionsFromDb,
  getCvVersionFromDb,
  saveCvVersionToDb,
  deleteCvVersionFromDb,
  renameCvVersionInDb,
  type ApplicationInput,
  type CvInput
} from "@/lib/db";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readApplicationInput(formData: FormData): ApplicationInput {
  const estado = formString(formData, "estado");

  return {
    titulo: formString(formData, "titulo"),
    nombreEmpresa: formString(formData, "nombreEmpresa"),
    linkPropuesta: formString(formData, "linkPropuesta"),
    estado: isApplicationStatus(estado) ? estado : "aplicado",
    textoPostulacion: formString(formData, "textoPostulacion")
  };
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

function sanitizeFilename(filename: string) {
  const basename = filename.replace(/\\/g, "/").split("/").pop() || "cv";
  const sanitized = basename.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160).trim();
  return sanitized || "cv";
}

async function extractCvData(formData: FormData): Promise<CvInput | null> {
  const file = formData.get("cvFile");
  let cvVersion = formString(formData, "cvVersion");
  const cvLanguage = formString(formData, "cvLanguage");
  
  if (cvVersion && cvLanguage) {
    cvVersion = `${cvVersion}::${cvLanguage}`;
  }
  
  let cvFilename = "";
  let cvStoredName = "";

  if (isUploadedFile(file) && file.size > 0) {
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("El CV supera el limite de 15 MB.");
    }

    cvFilename = sanitizeFilename(file.name || "cv");
    const extension = path.extname(cvFilename).slice(0, 12).toLowerCase() || ".bin";
    cvStoredName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    fs.mkdirSync(getCvStorageDir(), { recursive: true });
    fs.writeFileSync(getCvFilePath(cvStoredName), bytes);
  }

  // If the field cvVersion is present in the form at all (even if empty), we return an object.
  // This allows clearing the cvVersion by submitting an empty string.
  if (formData.has("cvVersion") || cvFilename) {
    return { cvFilename, cvStoredName, cvVersion };
  }
  return null;
}

export async function createPostulacion(formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  const cv = await extractCvData(formData);
  const id = createApplication(input, cv);
  const notaInicial = formString(formData, "notaInicial");

  if (notaInicial) {
    createApplicationNote(id, "Nota inicial", notaInicial);
  }

  revalidatePath("/");
}

export async function updatePostulacion(id: number, formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  const cv = await extractCvData(formData);
  updateApplication(id, input, cv);
  revalidatePath("/");
}

export async function deletePostulacion(id: number) {
  softDeleteApplication(id);
  revalidatePath("/");
}

export async function updateStatusAction(id: number, status: string) {
  if (isApplicationStatus(status)) {
    updateApplicationStatus(id, status);
    revalidatePath("/");
  }
}

export async function createNota(postulacionId: number, formData: FormData) {
  const content = formString(formData, "content");
  const title = formString(formData, "title") || "Nueva Nota";

  if (!content) return;

  createApplicationNote(postulacionId, title, content);
  revalidatePath("/");
}

export async function updateNota(id: number, formData: FormData) {
  const content = formString(formData, "content");
  const title = formString(formData, "title") || "Nota sin título";

  if (!content) return;

  updateApplicationNote(id, title, content);
  revalidatePath("/");
}

export async function deleteNota(id: number) {
  softDeleteApplicationNote(id);
  revalidatePath("/");
}

const dataDir = path.join(process.cwd(), "data");
const versionsDir = path.join(dataDir, "cv_versions");
const outputDir = path.join(dataDir, "rendercv_output");

function ensureVersionsDir() {
  fs.mkdirSync(versionsDir, { recursive: true });
  const files = fs.readdirSync(versionsDir);
  if (files.length === 0) {
    const defaultPath = path.join(versionsDir, "default.yaml");
    const oldCvPath = path.join(dataDir, "cv.yaml");
    if (fs.existsSync(oldCvPath)) {
      fs.copyFileSync(oldCvPath, defaultPath);
    } else {
      const examplePath = path.join(process.cwd(), "rendercv-repo", "examples", "John_Doe_ClassicTheme_CV.yaml");
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, defaultPath);
      }
    }
  }
}

export async function listCvVersions(): Promise<string[]> {
  ensureVersionsDir();
  return listCvVersionsFromDb();
}

export async function getCvVersion(name: string): Promise<string> {
  ensureVersionsDir();
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) return "";
  
  // Try DB first
  const dbContent = getCvVersionFromDb(sanitized);
  if (dbContent) return dbContent;

  // Fallback to file if DB doesn't have it (shouldn't happen after migration)
  const versionPath = path.join(versionsDir, `${sanitized}.yaml`);
  if (fs.existsSync(versionPath)) {
    return fs.readFileSync(versionPath, "utf-8");
  }
  return "";
}

// Removed getCvYaml function

export async function saveCvVersion(name: string, content: string): Promise<void> {
  ensureVersionsDir();
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) return;
  const versionPath = path.join(versionsDir, `${sanitized}.yaml`);
  fs.writeFileSync(versionPath, content, "utf-8");
  
  // Save to DB snapshot
  saveCvVersionToDb(sanitized, content);
  revalidatePath("/");
}

export async function deleteCvVersion(name: string): Promise<void> {
  ensureVersionsDir();
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) return;
  
  deleteCvVersionFromDb(sanitized);

  const versionPath = path.join(versionsDir, `${sanitized}.yaml`);
  if (fs.existsSync(versionPath)) {
    fs.unlinkSync(versionPath);
  }

  const pdfPath = path.join(outputDir, `${sanitized}.pdf`);
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  
  // Also delete preview PDF
  const previewPdfPath = path.join(outputDir, `${sanitized}_preview.pdf`);
  if (fs.existsSync(previewPdfPath)) fs.unlinkSync(previewPdfPath);

  if (fs.existsSync(outputDir)) {
    const pngFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(`${sanitized}_`) && f.endsWith(".png"));
    for (const file of pngFiles) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
  revalidatePath("/");
}

export async function renameCvVersion(oldName: string, newName: string): Promise<{ success: boolean; error?: string }> {
  ensureVersionsDir();
  const sanitizedOld = oldName.replace(/[^a-zA-Z0-9_-]/g, "");
  const sanitizedNew = newName.replace(/[^a-zA-Z0-9_-]/g, "");

  if (!sanitizedOld) return { success: false, error: "El nombre original es inválido." };
  if (!sanitizedNew) return { success: false, error: "El nuevo nombre es inválido." };
  if (sanitizedOld === sanitizedNew) return { success: true };

  const oldVersionPath = path.join(versionsDir, `${sanitizedOld}.yaml`);
  const newVersionPath = path.join(versionsDir, `${sanitizedNew}.yaml`);

  if (!fs.existsSync(oldVersionPath)) return { success: false, error: "La versión original no existe." };
  if (fs.existsSync(newVersionPath)) return { success: false, error: "Ya existe una versión con ese nombre." };

  try {
    fs.renameSync(oldVersionPath, newVersionPath);
    renameCvVersionInDb(sanitizedOld, sanitizedNew);

    // Also rename associated output files if they exist
    const oldPdfPath = path.join(outputDir, `${sanitizedOld}.pdf`);
    const newPdfPath = path.join(outputDir, `${sanitizedNew}.pdf`);
    if (fs.existsSync(oldPdfPath)) fs.renameSync(oldPdfPath, newPdfPath);
    
    // Rename previews
    const oldPreviewPdfPath = path.join(outputDir, `${sanitizedOld}_preview.pdf`);
    const newPreviewPdfPath = path.join(outputDir, `${sanitizedNew}_preview.pdf`);
    if (fs.existsSync(oldPreviewPdfPath)) fs.renameSync(oldPreviewPdfPath, newPreviewPdfPath);

    if (fs.existsSync(outputDir)) {
      const pngFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(`${sanitizedOld}_`) && f.endsWith(".png"));
      for (const file of pngFiles) {
        const suffix = file.substring(sanitizedOld.length); // gets "_1.png" or "_preview_1.png"
        fs.renameSync(path.join(outputDir, file), path.join(outputDir, `${sanitizedNew}${suffix}`));
      }
    }
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al renombrar los archivos." };
  }
}

export async function compileCv(name: string, yamlContent: string, language?: string): Promise<{ success: boolean; error?: string; pageCount?: number }> {
  try {
    ensureVersionsDir();
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!sanitized) return { success: false, error: "Nombre inválido." };
    
    // WARNING: We write to a _preview.yaml instead of overwriting the original file.
    // This allows the user to have unsaved changes in the UI that are compiled live,
    // without destroying the saved version.
    const tempVersionPath = path.join(versionsDir, `${sanitized}_preview.yaml`);
    fs.writeFileSync(tempVersionPath, yamlContent, "utf-8");

    let compilePath = tempVersionPath;
    if (language) {
      try {
        const obj = parse(yamlContent);
        const resolved = resolveLanguage(obj, language);
        
        // Remove shared_data from cv where it actually resides
        if (resolved && resolved.cv && resolved.cv.shared_data) {
          delete resolved.cv.shared_data;
        }
        
        compilePath = path.join(versionsDir, `${sanitized}_preview_compiled.yaml`);
        fs.writeFileSync(compilePath, stringify(resolved), "utf-8");
      } catch (err) {
        console.error("YAML preprocessing error:", err);
      }
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const suffix = language ? `_${language}` : "";
    const basename = `${sanitized}_preview${suffix}`;

    const pdfPath = path.join(outputDir, `${basename}.pdf`);
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    const pngFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(`${basename}_`) && f.endsWith(".png"));
    for (const file of pngFiles) {
      fs.unlinkSync(path.join(outputDir, file));
    }

    const pdfOutputPath = path.join(outputDir, `${basename}.pdf`);
    const pngOutputPath = path.join(outputDir, `${basename}.png`);
    
    try {
      const cmd = `python3 -m rendercv render "${compilePath}" -o "${outputDir}" --pdf-path "${pdfOutputPath}" --png-path "${pngOutputPath}" --dont-generate-markdown --dont-generate-html`;
      execSync(cmd, { stdio: "pipe" });
    } finally {
      // Always clean up the temporary compiled YAML to avoid garbage files
      if (compilePath !== tempVersionPath && fs.existsSync(compilePath)) {
        fs.unlinkSync(compilePath);
      }
      if (fs.existsSync(tempVersionPath)) {
        fs.unlinkSync(tempVersionPath);
      }
    }

    const newPngFiles = fs.readdirSync(outputDir).filter(f => f.startsWith(`${basename}_`) && f.endsWith(".png"));
    
    // We don't revalidatePath here because this is just a preview compilation.
    // The actual save action triggers revalidatePath.
    return { success: true, pageCount: newPngFiles.length };
  } catch (error: any) {
    console.error("RenderCV compile error:", error);
    const stderr = error.stderr?.toString() || error.message || "Error al compilar el CV.";
    return { success: false, error: stderr };
  }
}
