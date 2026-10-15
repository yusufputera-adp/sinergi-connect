// Sinergi Connect — menyusun berita dari berkas berita-*.md di GitHub.
// Dijalankan otomatis oleh Netlify saat build (lihat netlify.toml).
// Format berkas: lihat CONTOH-BERITA.md
import fs from "node:fs";
import path from "node:path";

const RUBRIK = ["Ekonomi","Koperasi","UMKM","Keuangan","Bisnis","Teknologi","Nasional","Daerah","Gaya Hidup"];
const akar = process.cwd();
const folderBerita = [akar, path.join(akar, "berita")].filter((d) => fs.existsSync(d));
const folderGambar = [akar, path.join(akar, "gambar"), path.join(akar, "berita")];
fs.mkdirSync(path.join(akar, "public", "gambar"), { recursive: true });
fs.mkdirSync(path.join(akar, "netlify", "lib"), { recursive: true });

function waktuWIB(t) {
  t = String(t || "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})[:.](\d{2}))?$/);
  if (m) return Date.parse(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T${(m[4] || "08").padStart(2, "0")}:${m[5] || "00"}:00+07:00`);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(?:pukul\s+)?(\d{1,2})[:.](\d{2}))?$/i);
  if (m) return Date.parse(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${(m[4] || "08").padStart(2, "0")}:${m[5] || "00"}:00+07:00`);
  return NaN;
}

const hasil = [];
for (const dir of folderBerita) {
  for (const nama of fs.readdirSync(dir).filter((f) => /^berita-.*\.md$/i.test(f)).sort()) {
    const mentah = fs.readFileSync(path.join(dir, nama), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
    const m = mentah.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) { console.warn(`[lewati] ${nama}: bagian --- di awal berkas tidak ditemukan`); continue; }
    const meta = {};
    for (const baris of m[1].split("\n")) {
      const i = baris.indexOf(":"); if (i < 1) continue;
      meta[baris.slice(0, i).trim().toLowerCase().replace(/\s+/g, "_")] = baris.slice(i + 1).trim();
    }
    const terbit = waktuWIB(meta.tanggal);
    const isi = m[2].trim();
    if (!meta.judul || !isi || !Number.isFinite(terbit)) { console.warn(`[lewati] ${nama}: judul, tanggal, atau isi belum benar`); continue; }
    let gambar = "";
    if (meta.gambar) {
      const sumber = folderGambar.map((d) => path.join(d, meta.gambar)).find((p) => fs.existsSync(p));
      if (sumber && /\.(jpe?g|png|webp)$/i.test(sumber)) {
        fs.copyFileSync(sumber, path.join(akar, "public", "gambar", path.basename(sumber)));
        gambar = "/gambar/" + encodeURIComponent(path.basename(sumber));
      } else console.warn(`[peringatan] ${nama}: gambar "${meta.gambar}" tidak ditemukan, memakai ilustrasi rubrik`);
    }
    const slug = nama.replace(/^berita-/i, "").replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    hasil.push({
      id: "s-" + slug, judul: meta.judul,
      rubrik: RUBRIK.find((r) => r.toLowerCase() === (meta.rubrik || "").toLowerCase()) || "Ekonomi",
      lokasi: meta.lokasi || "JAKARTA", penulis: meta.penulis || "Redaksi Sinergi Connect",
      ketFoto: meta.keterangan_gambar || "", rujukan: meta.rujukan || "", isi, gambar, terbit,
    });
    console.log(`[ok] ${nama} → ${meta.judul}`);
  }
}
fs.writeFileSync(path.join(akar, "netlify", "lib", "berita-statis.mjs"),
  "// Dibuat otomatis oleh susun-berita.mjs — jangan disunting manual\nexport default " + JSON.stringify(hasil) + ";\n");
console.log(`Berita dari GitHub: ${hasil.length}`);
