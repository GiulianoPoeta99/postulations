import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const versionParam = searchParams.get("version") || "default";
  let langParam = searchParams.get("lang") || "";

  let version = versionParam;
  if (versionParam.includes("::")) {
    const parts = versionParam.split("::");
    version = parts[0];
    langParam = parts[1];
  }

  const sanitizedVersion = version.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const suffix = langParam ? `_${langParam}` : "";
  const basename = `${sanitizedVersion}${suffix}`;

  const previewFilePath = path.join(
    process.cwd(),
    "data",
    "rendercv_output",
    `${sanitizedVersion}_preview${suffix}.pdf`
  );

  const filePath = path.join(
    process.cwd(),
    "data",
    "rendercv_output",
    `${sanitizedVersion}${suffix}.pdf`
  );

  const targetPath = fs.existsSync(previewFilePath) ? previewFilePath : filePath;

  if (!fs.existsSync(targetPath)) {
    return new NextResponse("PDF no encontrado.", { status: 404 });
  }

  try {
    const file = fs.readFileSync(targetPath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${basename}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error: any) {
    return new NextResponse(`Error al leer el archivo PDF: ${error.message}`, { status: 500 });
  }
}
