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

  const sanitized = version.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const suffix = langParam ? `_${langParam}` : "";
  const basename = `${sanitized}${suffix}`;
  
  const filePath = path.join(process.cwd(), "data", "rendercv_output", `${basename}.pdf`);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("CV PDF no encontrado. Por favor, compila primero.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  try {
    const file = fs.readFileSync(filePath);
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
