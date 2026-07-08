"use server";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  createApplication,
  createApplicationNote,
  getCvFilePath,
  getCvStorageDir,
  isApplicationStatus,
  softDeleteApplication,
  softDeleteApplicationNote,
  updateApplication,
  updateApplicationNote,
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

async function saveCvFile(formData: FormData): Promise<CvInput | null> {
  const file = formData.get("cvFile");

  if (!isUploadedFile(file) || file.size === 0) {
    return null;
  }

  const maxSize = 15 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("El CV supera el limite de 15 MB.");
  }

  const cvFilename = sanitizeFilename(file.name || "cv");
  const extension = path.extname(cvFilename).slice(0, 12).toLowerCase() || ".bin";
  const cvStoredName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  fs.mkdirSync(getCvStorageDir(), { recursive: true });
  fs.writeFileSync(getCvFilePath(cvStoredName), bytes);

  return { cvFilename, cvStoredName };
}

export async function createPostulacion(formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  const cv = await saveCvFile(formData);
  const id = createApplication(input, cv);
  const notaInicial = formString(formData, "notaInicial");

  if (notaInicial) {
    createApplicationNote(id, notaInicial);
  }

  revalidatePath("/");
}

export async function updatePostulacion(id: number, formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  const cv = await saveCvFile(formData);
  updateApplication(id, input, cv);
  revalidatePath("/");
}

export async function deletePostulacion(id: number) {
  softDeleteApplication(id);
  revalidatePath("/");
}

export async function createNota(postulacionId: number, formData: FormData) {
  const content = formString(formData, "content");

  if (!content) {
    return;
  }

  createApplicationNote(postulacionId, content);
  revalidatePath("/");
}

export async function updateNota(id: number, formData: FormData) {
  const content = formString(formData, "content");

  if (!content) {
    return;
  }

  updateApplicationNote(id, content);
  revalidatePath("/");
}

export async function deleteNota(id: number) {
  softDeleteApplicationNote(id);
  revalidatePath("/");
}
