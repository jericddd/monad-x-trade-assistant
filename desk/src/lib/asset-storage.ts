import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

type R2Bucket = {
  put: (key: string, value: ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get: (key: string) => Promise<{ body: ReadableStream | null } | null>;
  createPresignedUrl?: (key: string, expiresIn: number) => Promise<string>;
};

async function getR2Bucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    return (env as { PACK_ASSETS?: R2Bucket }).PACK_ASSETS ?? null;
  } catch {
    return null;
  }
}

function publicAssetUrl(importId: string, filename: string): string {
  const base = process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (base) return `${base.replace(/\/$/, "")}/pack-imports/${importId}/${filename}`;
  return `/api/uploads/${importId}/${filename}`;
}

/**
 * Pack card images: local disk in dev, Cloudflare R2 in production.
 */
export async function storePackImage(
  importId: string,
  filename: string,
  data: Buffer,
): Promise<string> {
  const r2 = await getR2Bucket();
  if (r2) {
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    await r2.put(`pack-imports/${importId}/${filename}`, body as ArrayBuffer, {
      httpMetadata: { contentType },
    });
    return publicAssetUrl(importId, filename);
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  const dir = path.join(uploadDir, importId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, data);
  return `/api/uploads/${importId}/${filename}`;
}

export async function readPackImage(importId: string, filename: string): Promise<Buffer | null> {
  const r2 = await getR2Bucket();
  if (r2) {
    const obj = await r2.get(`pack-imports/${importId}/${filename}`);
    if (!obj?.body) return null;
    const ab = await new Response(obj.body).arrayBuffer();
    return Buffer.from(ab);
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
  const filePath = path.join(uploadDir, importId, filename);
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export function isRemoteStorage(): boolean {
  return Boolean(process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
}
