// GET /api/berita — berita trending (cache 6 jam; diperbarui ulang bila kedaluwarsa)
import { segarkanTrending, json, env } from "../lib/inti.mjs";

export default async (req) => {
  const kunci = new URL(req.url).searchParams.get("refresh");
  const paksa = !!(kunci && env("REFRESH_KEY") && kunci === env("REFRESH_KEY"));
  const v = await segarkanTrending(paksa);
  return json(v, v.items?.length ? 200 : 503, { "cache-control": "public, max-age=300" });
};
export const config = { path: "/api/berita" };
