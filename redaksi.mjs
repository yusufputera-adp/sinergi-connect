// GET /api/redaksi — berita redaksi yang sudah tayang (berita terjadwal disembunyikan)
// Sumber: (1) berita dari panel admin (Netlify Blobs) + (2) berkas berita-*.md di GitHub
import { semuaRedaksi, publikRedaksi, json } from "../lib/inti.mjs";
import statis from "../lib/berita-statis.mjs";

export default async () => {
  const kini = Date.now();
  const dariAdmin = (await semuaRedaksi()).map(publikRedaksi);
  const items = [...dariAdmin, ...statis].filter((b) => (b.terbit || 0) <= kini)
    .sort((a, b) => b.terbit - a.terbit).slice(0, 300);
  return json({ items }, 200, { "cache-control": "public, max-age=60" });
};
export const config = { path: "/api/redaksi" };
