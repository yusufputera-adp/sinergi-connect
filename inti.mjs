// Sinergi Connect — pustaka bersama untuk Netlify Functions
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const RUBRIK = ["Ekonomi","Koperasi","UMKM","Keuangan","Bisnis","Teknologi","Nasional","Daerah","Gaya Hidup"];
export const dataStore = () => getStore({ name: "sinergi-data", consistency: "strong" });
export const gambarStore = () => getStore({ name: "sinergi-gambar", consistency: "strong" });

export const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
});
export const gagal = (pesan, status = 400) => json({ error: pesan }, status);
export const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? "");

export async function bacaJSON(key, def) { const v = await dataStore().get(key, { type: "json" }); return v ?? def; }
export async function tulisJSON(key, v) { await dataStore().setJSON(key, v); }

export async function garam() {
  let g = await dataStore().get("garam");
  if (!g) { g = crypto.randomBytes(16).toString("hex"); await dataStore().set("garam", g); }
  return g;
}

// ---------- berita redaksi ----------
export const semuaRedaksi = async () => (await bacaJSON("redaksi.json", [])) || [];
export const simpanRedaksi = (arr) => tulisJSON("redaksi.json", arr);
export const urlGambar = (key) => (key ? `/api/gambar/${key}` : "");
export function publikRedaksi(b) {
  return { id: "r" + b.id, judul: b.judul, rubrik: b.rubrik, lokasi: b.lokasi, penulis: b.penulis, rujukan: b.rujukan || "",
    ketFoto: b.ketFoto || "", isi: b.isi, gambar: urlGambar(b.gambar), terbit: b.terbit };
}

// ---------- sesi admin ----------
const rahasia = () => env("SESSION_SECRET");
const tanda = (p) => crypto.createHmac("sha256", rahasia()).update(p).digest("hex");
export const adminSiap = () => !!(env("ADMIN_USER") && env("ADMIN_PASS") && rahasia().length >= 16);
export function buatSesi() { const exp = Date.now() + 12 * 3600e3; const p = `admin.${exp}`; return `${p}.${tanda(p)}`; }
export function cekSesi(req) {
  if (!adminSiap()) return false;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)sc_admin=([^;]+)/);
  if (!m) return false;
  const [a, exp, sig] = decodeURIComponent(m[1]).split(".");
  if (a !== "admin" || !(Number(exp) > Date.now()) || !sig) return false;
  const benar = tanda(`admin.${exp}`);
  return sig.length === benar.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(benar));
}
export const samaAman = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));
export const cookieSesi = (nilai, maxAge) =>
  `sc_admin=${encodeURIComponent(nilai)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// ---------- berita trending (RSS) ----------
export const TTL = 6 * 3600e3;
const MAKS_UMUR = 48 * 3600e3;
export const KUOTA = { Koperasi: 10, UMKM: 10, Ekonomi: 10, Keuangan: 6, Bisnis: 6, Teknologi: 5, Nasional: 5, Daerah: 5, "Gaya Hidup": 5 };
const gnews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=id&gl=ID&ceid=ID:id`;
export const SUMBER = [
  ["Koperasi", gnews("koperasi")],
  ["Koperasi", gnews('"Koperasi Desa Merah Putih" OR "Kopdes Merah Putih"')],
  ["Koperasi", gnews('"koperasi simpan pinjam" OR "Kementerian Koperasi"')],
  ["UMKM", gnews("UMKM")],
  ["UMKM", gnews('"KUR" UMKM OR "pelaku usaha mikro"')],
  ["UMKM", gnews('"Kementerian UMKM" OR "ekspor UMKM" OR "digitalisasi UMKM"')],
  ["Ekonomi", gnews("ekonomi Indonesia")],
  ["Ekonomi", gnews('inflasi OR rupiah OR "harga pangan"')],
  ["Ekonomi", "https://www.antaranews.com/rss/ekonomi.xml"],
  ["Bisnis", "https://www.antaranews.com/rss/ekonomi-bisnis.xml"],
  ["Keuangan", "https://www.antaranews.com/rss/ekonomi-finansial.xml"],
  ["Teknologi", "https://www.antaranews.com/rss/tekno.xml"],
  // Kanal terkini ANTARA: hanya judul yang memuat kata kunci (elemen ke-3)
  ["Koperasi", "https://www.antaranews.com/rss/terkini.xml", /koperasi|kopdes|\bksp\b/i],
  ["UMKM", "https://www.antaranews.com/rss/terkini.xml", /umkm|usaha mikro|\bukm\b|\bkur\b/i],
  ["Keuangan", gnews('OJK OR perbankan OR IHSG OR "Bank Indonesia"')],
  ["Bisnis", gnews("industri OR ritel OR investasi bisnis Indonesia")],
  ["Teknologi", gnews('"ekonomi digital" OR e-commerce OR "transformasi digital" usaha')],
  ["Nasional", gnews("pemerintah kebijakan ekonomi nasional")],
  ["Daerah", gnews("ekonomi daerah pemda UMKM")],
  ["Gaya Hidup", gnews('"ekonomi kreatif" OR kuliner OR pariwisata')],
];
const dekode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const ambilTag = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? dekode(m[1]) : ""; };
const ambilMentah = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? m[1] : ""; };
const dekodeMentah = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
export function uraiRss(xml) {
  const kanal = ambilTag(xml.split(/<item[\s>]/i)[0] || "", "title");
  const out = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0];
    let judul = ambilTag(it, "title");
    const url = ambilTag(it, "link");
    const terbit = Date.parse(ambilTag(it, "pubDate")) || 0;
    let media = ambilTag(it, "source");
    if (!media) media = /antaranews/i.test(url) ? "ANTARA" : kanal;
    if (media && judul.endsWith(" - " + media)) judul = judul.slice(0, -(media.length + 3));
    if (!judul || !/^https?:\/\//i.test(url)) continue;
    // Foto pratinjau dari umpan (enclosure / media:content / <img> di deskripsi)
    let thumb = (it.match(/<enclosure[^>]*\burl="([^"]+)"/i) || it.match(/<media:content[^>]*\burl="([^"]+)"/i) || [])[1] || "";
    if (!thumb) thumb = (dekodeMentah(ambilMentah(it, "description")).match(/<img[^>]+src=["']([^"']+)/i) || [])[1] || "";
    thumb = thumb.replace(/&amp;/g, "&");
    const item = { judul, url, media, terbit };
    if (/^https:\/\//i.test(thumb)) item.thumb = thumb;
    out.push(item);
  }
  return out;
}
const kunciJudul = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ")
  .filter((w) => w.length > 2 || /^\d+$/.test(w)).slice(0, 8).join(" ");
export async function bangunTrending() {
  const hasil = await Promise.all(SUMBER.map(async ([rubrik, url, saring]) => {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; SinergiConnectBot/1.0)" }, signal: AbortSignal.timeout(7000) });
      if (!r.ok) return [];
      return uraiRss(await r.text()).filter((i) => !saring || saring.test(i.judul)).map((i) => ({ ...i, rubrik }));
    } catch { return []; }
  }));
  const kini = Date.now();
  // Berita bergambar sedikit diutamakan (setara 3 jam lebih baru)
  const skor = (x) => x.terbit + (x.thumb ? 3 * 3600e3 : 0);
  const semua = hasil.flat().filter((x) => x.terbit >= kini - MAKS_UMUR && x.terbit <= kini + 3600e3).sort((a, b) => skor(b) - skor(a));
  const lihat = new Set(), hitung = {}, out = [];
  for (const r of Object.keys(KUOTA)) {
    for (const x of semua) {
      if (x.rubrik !== r) continue;
      if ((hitung[r] || 0) >= KUOTA[r]) break;
      const k = kunciJudul(x.judul);
      if (!k || lihat.has(k) || lihat.has(x.url)) continue;
      lihat.add(k); lihat.add(x.url); hitung[r] = (hitung[r] || 0) + 1;
      out.push({ ...x, id: sha(x.url).slice(0, 12) });
    }
  }
  return out.sort((a, b) => b.terbit - a.terbit);
}
export async function segarkanTrending(paksa = false) {
  const s = dataStore();
  const cache = await s.get("berita.json", { type: "json" });
  if (!paksa && cache && Date.now() - cache.updated < TTL) return cache;
  const kunci = await s.get("berita.lock", { type: "json" });
  if (!paksa && cache && kunci && Date.now() - kunci.t < 60000) return cache;
  await s.setJSON("berita.lock", { t: Date.now() });
  const items = await bangunTrending();
  if (!items.length) return cache || { updated: 0, items: [], error: "Sumber berita tidak dapat dihubungi." };
  const v = { updated: Date.now(), ttl: TTL, items };
  await s.setJSON("berita.json", v);
  return v;
}
