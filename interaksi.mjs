// /api/interaksi — suka/tidak suka dan komentar pembaca untuk berita redaksi
// GET  ?id=rXXXXXXXXXXXX&t=TOKEN
// POST {aksi:"reaksi", id, nilai:1|-1|0, token} | {aksi:"komentar", id, nama, teks, token, situs}
import crypto from "node:crypto";
import { dataStore, semuaRedaksi, garam, json, gagal, sha } from "../lib/inti.mjs";

const BATAS_KOMENTAR = 5, BATAS_MS = 10 * 60e3, PANJANG_MAKS = 1000;
const KATA_TERLARANG = []; // contoh: ["kata1","kata2"]

const kunciData = (id) => `interaksi/${id}.json`;
async function beritaAda(id) {
  const m = /^r([a-f0-9]{12})$/.exec(id || ""); if (!m) return false;
  return (await semuaRedaksi()).some((b) => b.id === m[1] && (b.terbit || 0) <= Date.now());
}
const token = (t, g) => (/^[a-f0-9]{32}$/.test(t || "") ? sha(t + g).slice(0, 20) : "");
const bersih = (s, max, satuBaris) => {
  s = String(s || "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = satuBaris ? s.replace(/\s+/g, " ") : s.replace(/\n{3,}/g, "\n\n");
  return s.trim().slice(0, max);
};
async function baca(id) { const d = (await dataStore().get(kunciData(id), { type: "json" })) || {}; return { reaksi: d.reaksi || {}, komentar: d.komentar || [] }; }
function publik(d, tok) {
  let like = 0, dislike = 0;
  for (const v of Object.values(d.reaksi)) { if (v === 1) like++; else if (v === -1) dislike++; }
  const komentar = d.komentar.slice().reverse().map((k) => ({ id: k.id, nama: k.nama, teks: k.teks, waktu: k.waktu }));
  return { like, dislike, mine: d.reaksi[tok] || 0, komentar };
}

export default async (req, context) => {
  const g = await garam();
  if (req.method === "GET") {
    const u = new URL(req.url); const id = u.searchParams.get("id");
    if (!(await beritaAda(id))) return gagal("Berita tidak ditemukan.", 404);
    return json(publik(await baca(id), token(u.searchParams.get("t"), g)));
  }
  if (req.method !== "POST") return gagal("Metode tidak didukung.", 405);
  let inp; try { inp = await req.json(); } catch { return gagal("Permintaan tidak valid."); }
  const id = inp?.id;
  if (!(await beritaAda(id))) return gagal("Berita tidak ditemukan.", 404);
  const tok = token(inp.token, g);
  if (!tok) return gagal("Muat ulang halaman lalu coba lagi.");
  const d = await baca(id);

  if (inp.aksi === "reaksi") {
    const nilai = Number(inp.nilai);
    if (![-1, 0, 1].includes(nilai)) return gagal("Nilai tidak valid.");
    if (nilai === 0) delete d.reaksi[tok]; else d.reaksi[tok] = nilai;
    await dataStore().setJSON(kunciData(id), d);
    return json(publik(d, tok));
  }
  if (inp.aksi === "komentar") {
    if (String(inp.situs || "").trim()) return json(publik(d, tok)); // jebakan bot
    const nama = bersih(inp.nama, 50, true), teks = bersih(inp.teks, PANJANG_MAKS, false);
    if (nama.length < 2) return gagal("Isi nama Anda.");
    if (teks.length < 3) return gagal("Komentar terlalu pendek.");
    const cek = (teks + " " + nama).toLowerCase();
    if (KATA_TERLARANG.some((k) => k && cek.includes(k.toLowerCase()))) return gagal("Komentar mengandung kata yang tidak diperbolehkan.");
    if ((teks.match(/https?:\/\//gi) || []).length > 2) return gagal("Komentar berisi terlalu banyak tautan.");
    const ip = sha((context?.ip || req.headers.get("x-nf-client-connection-ip") || "") + g).slice(0, 16);
    const batas = (await dataStore().get("batas-komentar.json", { type: "json" })) || {};
    const kini = Date.now();
    for (const k of Object.keys(batas)) { batas[k] = (batas[k] || []).filter((t) => t > kini - BATAS_MS); if (!batas[k].length) delete batas[k]; }
    if ((batas[ip] || []).length >= BATAS_KOMENTAR) return gagal("Terlalu banyak komentar dalam waktu singkat. Coba lagi beberapa menit lagi.", 429);
    (batas[ip] ||= []).push(kini);
    await dataStore().setJSON("batas-komentar.json", batas);
    d.komentar.push({ id: crypto.randomBytes(6).toString("hex"), nama, teks, waktu: kini, ip, tok });
    if (d.komentar.length > 2000) d.komentar = d.komentar.slice(-2000);
    await dataStore().setJSON(kunciData(id), d);
    return json(publik(d, tok));
  }
  return gagal("Aksi tidak dikenal.");
};
export const config = { path: "/api/interaksi" };
