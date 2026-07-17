import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ importId: string; filename: string }> },
) {
  const { importId, filename } = await params;
  if (filename.includes("..") || importId.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  const filePath = path.join(uploadDir, importId, filename);

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    return new NextResponse(data, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
