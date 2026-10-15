// GET /api/gambar/:key — menyajikan gambar berita dari Netlify Blobs
import { gambarStore } from "../lib/inti.mjs";

export default async (req, context) => {
  const key = context.params?.key || "";
  if (!/^[a-z0-9-]+\.(jpg|png|webp)$/.test(key)) return new Response("Tidak ditemukan", { status: 404 });
  const hasil = await gambarStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!hasil) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(hasil.data, { headers: {
    "content-type": hasil.metadata?.contentType || "image/jpeg",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  } });
};
export const config = { path: "/api/gambar/:key" };
