/** Dışarıdan gelen her şeyin şeması. Uçlar bunları geçmeden veriye dokunmaz. */
import { z } from "zod";

const kirp = (u: unknown) => (typeof u === "string" ? u.trim() : u);

export const epostaSemasi = z
  .preprocess(kirp, z.string().min(3).max(254).email())
  .transform((s) => s.toLowerCase());

export const talepSemasi = z.object({
  ad: z.preprocess(kirp, z.string().min(2, "Ad soyad eksik").max(120)),
  firma: z.preprocess(kirp, z.string().min(2, "Firma adı eksik").max(160)),
  eposta: epostaSemasi,
  telefon: z.preprocess(kirp, z.string().max(40)).default(""),
  saglayici: z.preprocess(kirp, z.string().max(80)).default(""),
  kisi: z.preprocess(kirp, z.string().max(40)).default(""),
  not: z.preprocess(kirp, z.string().max(2000)).default(""),
  kaynak: z.preprocess(kirp, z.string().max(120)).default(""),
});

export const girisSemasi = z.object({ eposta: epostaSemasi });

export const talepDurumSemasi = z.object({
  durum: z.enum(["yeni", "yazildi", "kuruldu", "kapandi"]),
});

export const ayarSemasi = z.object({
  iletisim_eposta: z.preprocess(kirp, z.union([z.literal(""), z.string().email()])).default(""),
  iletisim_telefon: z.preprocess(kirp, z.string().max(40)).default(""),
});

export const davetSemasi = z.object({
  eposta: epostaSemasi,
  ad: z.preprocess(kirp, z.string().min(2, "Ad soyad eksik").max(120)),
  rol: z.enum(["yonetici", "personel"], { message: "Rol seçin" }),
});

/**
 * Kutu bilgileri. `firma_id` yalnızca operatör formunda var; müşteri panelinde
 * firma oturumdan geliyor ve forma hiç bakılmıyor — o yüzden şema ikiye ayrık.
 */
export const panelKutuSemasi = z.object({
  adres: epostaSemasi,
  saglayici: z.preprocess(kirp, z.string().max(80)).default(""),
  imap_sunucu: z.preprocess(kirp, z.string().min(3, "IMAP sunucusu gerekli").max(160)),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993),
  smtp_sunucu: z.preprocess(kirp, z.string().max(160)).default(""),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(465),
  kullanici_adi: z.preprocess(kirp, z.string().max(160)).default(""),
  parola: z.preprocess(kirp, z.string().min(1, "Parola gerekli").max(400)),
});

export const kutuSemasi = panelKutuSemasi.extend({
  firma_id: z.coerce.number().int().positive("Firma seçin"),
});

export const sablonSemasi = z.object({
  id: z.coerce.number().int().nonnegative().default(0),
  ad: z.preprocess(kirp, z.string().min(2, "Şablona bir ad verin").max(80)),
  kategori: z.preprocess(kirp, z.string().max(20)).default(""),
  metin: z.preprocess(kirp, z.string().min(5, "Şablon metni çok kısa").max(8000)),
});

export const parolaSemasi = z.object({
  kutu_id: z.coerce.number().int().positive(),
  parola: z.preprocess(kirp, z.string().min(1, "Parola gerekli").max(400)),
});

/** zod hatasını alan → mesaj sözlüğüne çevirir; arayüz bunu doğrudan gösterebilir. */
export function hatalar(e: z.ZodError): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const sorun of e.issues) {
    const alan = String(sorun.path[0] ?? "_");
    if (!cikti[alan]) cikti[alan] = sorun.message;
  }
  return cikti;
}
