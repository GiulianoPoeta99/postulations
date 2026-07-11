import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get("version") || "default";
  
  const sanitized = version.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
  const filePath = path.join(process.cwd(), "data", "rendercv_output", `${sanitized}.pdf`);

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
        "Content-Disposition": `inline; filename="${sanitized}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error: any) {
    return new NextResponse(`Error al leer el archivo PDF: ${error.message}`, { status: 500 });
  }
}
