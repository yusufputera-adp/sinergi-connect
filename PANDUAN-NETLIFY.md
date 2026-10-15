# Sinergi Connect — Panduan Deploy di Netlify

Portal Ekosistem Koperasi & UMKM · versi khusus Netlify

## Isi paket

| Berkas / folder | Fungsi |
|---|---|
| `public/index.html` | Halaman portal |
| `public/admin.html` | Panel admin berita (buka di `/admin`) |
| `public/ekosistem.json` | Data direktori mitra, peluang, dan agenda |
| `netlify/functions/berita.mjs` | `/api/berita`: berita trending (cache 6 jam) |
| `netlify/functions/berita-terjadwal.mjs` | Pembaruan berita trending otomatis setiap 6 jam |
| `netlify/functions/redaksi.mjs` | `/api/redaksi`: berita redaksi yang sudah tayang |
| `netlify/functions/interaksi.mjs` | `/api/interaksi`: suka/tidak suka dan komentar |
| `netlify/functions/gambar.mjs` | `/api/gambar/...`: menyajikan gambar berita |
| `netlify/functions/admin.mjs` | `/api/admin/...`: login, tulis/sunting/hapus berita, moderasi komentar |
| `netlify/lib/inti.mjs` | Pustaka bersama (penyimpanan, sesi, RSS) |
| `netlify.toml`, `package.json` | Konfigurasi Netlify dan dependensi |

Data (berita redaksi, gambar, komentar, reaksi, cache berita trending) disimpan di **Netlify Blobs**,
penyimpanan bawaan Netlify. Tidak perlu database terpisah.

## Langkah deploy

> Paket ini **tidak bisa** di-deploy dengan seret-lepas folder (drag & drop) karena berisi fungsi
> yang harus dibangun. Gunakan salah satu cara di bawah.

### Cara A — lewat GitHub (disarankan)

1. Buat repositori baru di GitHub, lalu unggah seluruh isi folder ini (termasuk `netlify/`, `netlify.toml`, `package.json`).
2. Di Netlify: **Add new site → Import an existing project → GitHub**, pilih repositori tersebut.
3. Pengaturan build: biarkan kosong/bawaan. Netlify membaca `netlify.toml`
   (publish = `public`, functions = `netlify/functions`).
4. Klik **Deploy**.

### Cara B — lewat Netlify CLI

```bash
npm install
npx netlify-cli login
npx netlify-cli init          # hubungkan ke situs baru/yang sudah ada
npx netlify-cli deploy --prod
```

## Wajib: atur variabel lingkungan

Netlify → situs Anda → **Site configuration → Environment variables → Add a variable**:

| Nama | Isi |
|---|---|
| `ADMIN_USER` | Nama pengguna admin |
| `ADMIN_PASS` | Kata sandi admin yang kuat |
| `SESSION_SECRET` | Teks acak minimal 16 karakter (mis. 40 karakter acak) |
| `REFRESH_KEY` | *(opsional)* kunci rahasia untuk paksa perbarui berita: `/api/berita?refresh=KUNCI` |

Setelah menambah atau mengubah variabel, lakukan **deploy ulang** (Deploys → Trigger deploy).

## Pengaturan lain di `public/index.html`

Cari baris `const DEPLOY=` di bagian atas skrip, lalu isi:

- `waAdmin:"6281234567890"`: nomor WhatsApp admin (tanpa +) untuk formulir Gabung.
- `emailAdmin:"admin@domain.id"`: opsional.

## Cara kerja berita trending otomatis

- Fungsi terjadwal berjalan setiap 6 jam (pukul 01.00, 07.00, 13.00, 19.00 WIB) dan menyimpan hasil ke cache.
- Saat halaman dibuka atau di-refresh, portal memanggil `/api/berita`. Bila cache lebih dari 6 jam,
  berita diambil ulang saat itu juga.
- Sumber: Google News (bahasa Indonesia) dan RSS ANTARA. Kuota: Koperasi 10, UMKM 10, Ekonomi 10,
  Keuangan 6, Bisnis 6, Teknologi 5, Nasional 5, Daerah 5, Gaya Hidup 5.
- Hanya berita 48 jam terakhir; berita ganda disaring. Yang ditampilkan hanya judul, media, waktu, dan tautan.
- Foto pratinjau diambil dari umpan RSS ANTARA (bila tersedia) dan ditampilkan dengan label nama media.
  Berita tanpa foto memakai ilustrasi khas rubrik buatan Sinergi Connect.
- Kunjungan pertama setelah deploy dapat memakan waktu beberapa detik karena cache belum terisi.

## Panel admin

Buka `https://SITUS-ANDA.netlify.app/admin`, lalu masuk dengan `ADMIN_USER` / `ADMIN_PASS`.

- Tulis berita: judul, rubrik, lokasi, **tanggal & jam terbit** (bisa tanggal lampau atau dijadwalkan),
  penulis, **gambar** (diperkecil otomatis di browser ke lebar 1600 px), keterangan gambar, isi, rujukan.
- Format isi: baris kosong = paragraf baru; `## Subjudul`; tautan `[teks](https://…)`.
- Daftar berita: status Tayang/Terjadwal, jumlah suka/tidak suka/komentar, tombol Sunting, Komentar, Lihat, Hapus.
- Sesi admin berlaku 12 jam.

## Suka, komentar, dan bagikan

- Setiap berita redaksi memiliki tombol Suka/Tidak suka, kolom komentar, dan tombol bagikan.
- Tautan bagikan: `https://SITUS-ANDA/#b-<kode berita>`.
- Batas: 5 komentar per 10 menit per pengunjung, maks. 1.000 karakter; filter bot tersembunyi.
- Kata terlarang dapat ditambahkan di `KATA_TERLARANG` pada `netlify/functions/interaksi.mjs`.

## Direktori, peluang, agenda

Edit `public/ekosistem.json` (format contoh ada di dalam berkas), lalu deploy ulang
(commit ke GitHub akan otomatis memicu deploy).

## Domain sendiri

Netlify → **Domain management → Add a domain**, misalnya `connect.sinergikopjas.com`,
lalu tambahkan record CNAME di pengelola DNS domain Anda sesuai petunjuk Netlify.

## Catatan

- Batas paket gratis Netlify (eksekusi fungsi, bandwidth, penyimpanan Blobs) perlu disesuaikan
  dengan jumlah pengunjung. Periksa halaman Usage di dasbor Netlify secara berkala.
- Ketersediaan berita trending bergantung pada layanan RSS pihak ketiga.
- Data tersimpan di Netlify Blobs milik situs. Menghapus situs di Netlify juga menghapus datanya.
