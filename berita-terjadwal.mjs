// Fungsi terjadwal: memperbarui berita trending setiap 6 jam (00, 06, 12, 18 UTC = 07, 13, 19, 01 WIB)
import { segarkanTrending } from "../lib/inti.mjs";

export default async () => {
  const v = await segarkanTrending(true);
  console.log(`Berita trending diperbarui: ${v.items?.length || 0} berita`);
};
export const config = { schedule: "0 */6 * * *" };
