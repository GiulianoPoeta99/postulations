import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCvFile, getCvFilePath } from "@/lib/db";

function contentTypeFor(filename: string) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".doc") {
    return "application/msword";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/octet-stream";
}

function headerFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const storedName = path.basename(decodeURIComponent(filename));
  const cv = getCvFile(storedName);

  if (!cv) {
    return NextResponse.json({ error: "CV no encontrado" }, { status: 404 });
  }

  const filePath = getCvFilePath(cv.cvStoredName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const file = fs.readFileSync(filePath);

  return new Response(file, {
    headers: {
      "Content-Disposition": `attachment; filename="${headerFilename(cv.cvFilename)}"`,
      "Content-Length": String(file.length),
      "Content-Type": contentTypeFor(cv.cvFilename)
    }
  });
}
