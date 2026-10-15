// GET /api/redaksi — berita redaksi yang sudah tayang (berita terjadwal disembunyikan)
import { semuaRedaksi, publikRedaksi, json } from "../lib/inti.mjs";

export default async () => {
  const kini = Date.now();
  const items = (await semuaRedaksi()).filter((b) => (b.terbit || 0) <= kini)
    .sort((a, b) => b.terbit - a.terbit).slice(0, 300).map(publikRedaksi);
  return json({ items }, 200, { "cache-control": "public, max-age=60" });
};
export const config = { path: "/api/redaksi" };
