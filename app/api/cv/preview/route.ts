import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || "1";
  const versionParam = searchParams.get("version") || "default";
  const langParam = searchParams.get("lang") || "";

  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return new NextResponse("Numero de pagina invalido.", { status: 400 });
  }

  const sanitizedVersion = versionParam.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const suffix = langParam ? `_${langParam}` : "";
  
  const previewFilePath = path.join(
    process.cwd(),
    "data",
    "rendercv_output",
    `${sanitizedVersion}_preview${suffix}_${pageNum}.png`
  );

  const filePath = path.join(
    process.cwd(),
    "data",
    "rendercv_output",
    `${sanitizedVersion}${suffix}_${pageNum}.png`
  );

  const targetPath = fs.existsSync(previewFilePath) ? previewFilePath : filePath;

  if (!fs.existsSync(targetPath)) {
    return new NextResponse("Pagina de previsualizacion no encontrada.", { status: 404 });
  }

  try {
    const file = fs.readFileSync(targetPath);
    return new Response(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error: any) {
    return new NextResponse(`Error al leer la imagen: ${error.message}`, { status: 500 });
  }
}
