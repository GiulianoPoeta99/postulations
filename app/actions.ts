"use server";

import { revalidatePath } from "next/cache";
import {
  createApplication,
  deleteApplication,
  isApplicationStatus,
  updateApplication,
  type ApplicationInput
} from "@/lib/db";

function formString(formData: FormData, key: keyof ApplicationInput): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readApplicationInput(formData: FormData): ApplicationInput {
  const estado = formString(formData, "estado");

  return {
    nombreEmpresa: formString(formData, "nombreEmpresa"),
    linkPropuesta: formString(formData, "linkPropuesta"),
    estado: isApplicationStatus(estado) ? estado : "aplicado",
    notas: formString(formData, "notas")
  };
}

export async function createPostulacion(formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  createApplication(input);
  revalidatePath("/");
}

export async function updatePostulacion(id: number, formData: FormData) {
  const input = readApplicationInput(formData);

  if (!input.nombreEmpresa) {
    return;
  }

  updateApplication(id, input);
  revalidatePath("/");
}

export async function deletePostulacion(id: number) {
  deleteApplication(id);
  revalidatePath("/");
}
