// /api/admin/* — panel admin berita (login, tulis/sunting/hapus berita + gambar, moderasi komentar)
import crypto from "node:crypto";
import { RUBRIK, dataStore, gambarStore, semuaRedaksi, simpanRedaksi, urlGambar, json, gagal, env,
  adminSiap, buatSesi, cekSesi, samaAman, cookieSesi } from "../lib/inti.mjs";

const MAX_MB = 5;
const teks = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

function jenisGambar(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["jpg", "image/jpeg"];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["png", "image/png"];
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return ["webp", "image/webp"];
  return null;
}
function waktuWIB(v) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || "")) return NaN;
  return Date.parse(v + ":00+07:00");
}
async function hitung(id) {
  const d = (await dataStore().get(`interaksi/r${id}.json`, { type: "json" })) || {};
  const r = Object.values(d.reaksi || {});
  return { komentar: (d.komentar || []).length, suka: r.filter((v) => v === 1).length, tidakSuka: r.filter((v) => v === -1).length };
}

export default async (req, context) => {
  const u = new URL(req.url);
  const rute = u.pathname.replace(/^\/api\/admin\/?/, "").replace(/\/$/, "");
  const m = req.method;

  if (rute === "sesi" && m === "GET") return json({ siap: adminSiap(), masuk: cekSesi(req) });

  if (rute === "masuk" && m === "POST") {
    if (!adminSiap()) return gagal("Panel admin belum dikonfigurasi. Atur ADMIN_USER, ADMIN_PASS, dan SESSION_SECRET di pengaturan Netlify.", 500);
    let b; try { b = await req.json(); } catch { return gagal("Permintaan tidak valid."); }
    const okUser = samaAman(b?.user || "", env("ADMIN_USER")), okPass = samaAman(b?.pass || "", env("ADMIN_PASS"));
    if (!(okUser && okPass)) { await new Promise((r) => setTimeout(r, 1200)); return gagal("Nama pengguna atau kata sandi salah.", 401); }
    return json({ ok: true }, 200, { "set-cookie": cookieSesi(buatSesi(), 12 * 3600) });
  }
  if (rute === "keluar" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookieSesi("", 0) });

  // ---- selain di atas: wajib sesi admin; aksi pengubah wajib header khusus (perlindungan CSRF)
  if (!cekSesi(req)) return gagal("Sesi berakhir. Silakan masuk kembali.", 401);
  if (m !== "GET" && req.headers.get("x-sc-admin") !== "1") return gagal("Permintaan ditolak.", 403);

  if (rute === "berita" && m === "GET") {
    const semua = (await semuaRedaksi()).sort((a, b) => b.terbit - a.terbit);
    const items = await Promise.all(semua.map(async (b) => ({ ...b, gambarUrl: urlGambar(b.gambar), ...(await hitung(b.id)) })));
    return json({ items, rubrik: RUBRIK });
  }

  if (rute === "berita" && m === "POST") {
    let f; try { f = await req.formData(); } catch { return gagal("Formulir tidak valid."); }
    const id = String(f.get("id") || "").replace(/[^a-f0-9]/g, "");
    const judul = teks(f.get("judul"), 160), lokasi = teks(f.get("lokasi"), 40);
    const rubrik = RUBRIK.includes(f.get("rubrik")) ? f.get("rubrik") : "Ekonomi";
    const penulis = teks(f.get("penulis"), 60) || "Redaksi Sinergi Connect";
    const ketFoto = teks(f.get("ket"), 160), rujukan = teks(f.get("rujukan"), 200);
    const isi = String(f.get("isi") || "").replace(/\r\n/g, "\n").trim();
    const terbit = waktuWIB(String(f.get("tanggal") || ""));
    if (!judul || !lokasi || !isi || !Number.isFinite(terbit)) return gagal("Lengkapi judul, lokasi, tanggal, dan isi berita.");
    if (isi.length > 30000) return gagal("Isi berita terlalu panjang.");

    const semua = await semuaRedaksi();
    const lama = id ? semua.find((b) => b.id === id) : null;
    if (id && !lama) return gagal("Berita yang disunting tidak ditemukan.", 404);
    let gambar = lama?.gambar || "";
    const berkas = f.get("gambar");
    if (f.get("hapus_gambar") && gambar) { await gambarStore().delete(gambar); gambar = ""; }
    if (berkas && typeof berkas === "object" && berkas.size > 0) {
      if (berkas.size > MAX_MB * 1048576) return gagal(`Ukuran gambar melebihi ${MAX_MB} MB.`);
      const buf = await berkas.arrayBuffer();
      const jenis = jenisGambar(buf);
      if (!jenis) return gagal("Format gambar harus JPG, PNG, atau WebP.");
      const baru = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(5).toString("hex")}.${jenis[0]}`;
      await gambarStore().set(baru, buf, { metadata: { contentType: jenis[1] } });
      if (gambar) await gambarStore().delete(gambar);
      gambar = baru;
    }
    if (!gambar) return gagal("Tambahkan gambar utama.");
    if (!ketFoto) return gagal("Tambahkan keterangan gambar.");
    const data = { id: lama ? lama.id : crypto.randomBytes(6).toString("hex"), judul, rubrik, lokasi, penulis, ketFoto, rujukan, isi, gambar, terbit, diubah: Date.now() };
    await simpanRedaksi(lama ? semua.map((b) => (b.id === data.id ? data : b)) : [...semua, data]);
    return json({ ok: true, item: data, terjadwal: terbit > Date.now() });
  }

  if (rute === "berita" && m === "DELETE") {
    const id = (u.searchParams.get("id") || "").replace(/[^a-f0-9]/g, "");
    const semua = await semuaRedaksi(); const b = semua.find((x) => x.id === id);
    if (!b) return gagal("Berita tidak ditemukan.", 404);
    if (b.gambar) await gambarStore().delete(b.gambar);
    await dataStore().delete(`interaksi/r${id}.json`);
    await simpanRedaksi(semua.filter((x) => x.id !== id));
    return json({ ok: true });
  }

  if (rute === "komentar") {
    const id = (u.searchParams.get("id") || "").replace(/[^a-f0-9]/g, "");
    const kunci = `interaksi/r${id}.json`;
    const d = (await dataStore().get(kunci, { type: "json" })) || { reaksi: {}, komentar: [] };
    if (m === "GET") return json({ komentar: (d.komentar || []).slice().reverse().map(({ id, nama, teks, waktu }) => ({ id, nama, teks, waktu })) });
    if (m === "DELETE") {
      const cid = (u.searchParams.get("cid") || "").replace(/[^a-f0-9]/g, "");
      d.komentar = (d.komentar || []).filter((k) => k.id !== cid);
      await dataStore().setJSON(kunci, d);
      return json({ ok: true });
    }
  }
  return gagal("Rute tidak dikenal.", 404);
};
export const config = { path: "/api/admin/*" };
