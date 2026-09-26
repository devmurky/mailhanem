"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  TICKET_KATEGORILERI,
  TICKET_ONCELIKLERI,
  db,
  ekEkle,
  mailGetir,
  ticketAc,
  ticketGetir,
  ticketMesajEkle,
  ticketDurumYaz,
} from "@/sunucu/db";
import { EK_SINIR, EK_TIPLERI, ekYaz } from "@/sunucu/ekDosya";
import { panelOturumu } from "../yetki";

/**
 * Formdan gelen dosyaları künyeye ve diske yazar (madde 5).
 *
 * Üç kapı: tip beyaz listede mi, boyut sınırın altında mı, ve dosya gerçekten
 * dolu mu. Reddedilen dosya **sessizce atlanmıyor** — çağırana sebep dönüyor,
 * çünkü "ekledim sandım ama gitmemiş" en kötü hâl.
 */
async function ekleriYaz(
  veri: FormData,
  firmaId: number,
  baglanti: { ticketId?: number; mailId?: number },
): Promise<string | null> {
  const dosyalar = veri.getAll("ek").filter((d): d is File => d instanceof File && d.size > 0);
  if (!dosyalar.length) return null;

  /* Önce hepsi denetleniyor, sonra hiçbiri yazılıyor ya da hepsi yazılıyor:
     üçüncü dosya reddedilirken ilk ikisinin diskte kalması, kullanıcının
     gördüğü hata ile gerçek durumu ayırırdı. */
  for (const d of dosyalar) {
    if (!EK_TIPLERI.has(d.type)) return `${d.name}: bu dosya türü kabul edilmiyor.`;
    if (d.size > EK_SINIR) return `${d.name}: dosya 10 MB sınırını aşıyor.`;
  }

  for (const d of dosyalar) {
    const icerik = new Uint8Array(await d.arrayBuffer());
    const dosyaAdi = ekYaz(icerik, d.type);
    ekEkle({
      firmaId,
      ticketId: baglanti.ticketId ?? null,
      mailId: baglanti.mailId ?? null,
      ad: d.name,
      tip: d.type,
      boyut: d.size,
      dosya: dosyaAdi,
    });
  }
  return null;
}

/**
 * Müşterinin destek talebi eylemleri.
 *
 * Firma sınırı burada da `panelOturumu()`nden geliyor; formdan gelen hiçbir
 * firma numarasına güvenilmiyor. Ticket numarası dışarıdan geldiği için her
 * okumada firma koşuluyla birlikte aranıyor — başka firmanın ticketına mesaj
 * yazılamaz.
 */

const acmaSemasi = z.object({
  konu: z.string().trim().min(3, "Konu en az üç karakter olmalı.").max(140),
  metin: z.string().trim().min(10, "Biraz daha ayrıntı yazın.").max(8000),
  kategori: z.enum(TICKET_KATEGORILERI),
  oncelik: z.enum(TICKET_ONCELIKLERI),
});

export type TicketDurumu = { hata?: string; tamam?: string; taslak?: string };

export async function ticketAcEylem(
  _onceki: TicketDurumu,
  veri: FormData,
): Promise<TicketDurumu> {
  const { kullanici, firmaId } = await panelOturumu();

  const sonuc = acmaSemasi.safeParse({
    konu: veri.get("konu"),
    metin: veri.get("metin"),
    kategori: veri.get("kategori"),
    oncelik: veri.get("oncelik"),
  });

  if (!sonuc.success) {
    return {
      hata: sonuc.error.issues[0]?.message ?? "Form eksik görünüyor.",
      taslak: String(veri.get("metin") ?? ""),
    };
  }

  const d = sonuc.data;

  /* Madde 3 — ticket bir maile bağlanabiliyor. Numara formdan geliyor, bu
     yüzden firma sınırıyla birlikte aranıyor: başka firmanın maili
     iliştirilemez. Tanınmayan numara sessizce boş bırakılıyor. */
  const mailNo = Number(veri.get("mail_id") ?? 0);
  const bagliMail = mailNo > 0 ? mailGetir(mailNo, firmaId) : undefined;

  const ticketId = ticketAc(firmaId, kullanici.id, d.konu, d.metin, d.kategori, d.oncelik);
  if (bagliMail) {
    db.prepare("UPDATE ticketlar SET mail_id = ? WHERE id = ?").run(bagliMail.id, ticketId);
  }

  const ekHatasi = await ekleriYaz(veri, firmaId, { ticketId });
  if (ekHatasi) {
    /* Ticket açıldı ama ek yazılamadı: talebi geri almıyoruz, kullanıcıya
       durumu olduğu gibi söylüyoruz. */
    revalidatePath("/panel/destek");
    return { tamam: `Talebiniz açıldı, ancak dosya eklenemedi — ${ekHatasi}` };
  }

  revalidatePath("/panel/destek");
  return { tamam: "Talebiniz açıldı. Yanıt geldiğinde bu ekranda görünecek." };
}

const mesajSemasi = z.object({
  ticketId: z.coerce.number().int().positive(),
  metin: z.string().trim().min(1, "Boş mesaj gönderilemez.").max(8000),
});

export async function ticketYanitla(
  _onceki: TicketDurumu,
  veri: FormData,
): Promise<TicketDurumu> {
  const { kullanici, firmaId } = await panelOturumu();

  const sonuc = mesajSemasi.safeParse({
    ticketId: veri.get("ticket_id"),
    metin: veri.get("metin"),
  });
  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? "Mesaj okunamadı." };
  }

  /* Firma koşuluyla aranıyor: başka firmanın ticketına yazılamaz. */
  const ticket = ticketGetir(sonuc.data.ticketId, firmaId);
  if (!ticket) return { hata: "Talep bulunamadı." };

  ticketMesajEkle(ticket.id, kullanici.id, false, sonuc.data.metin);

  const ekHatasi = await ekleriYaz(veri, firmaId, { ticketId: ticket.id });
  if (ekHatasi) {
    revalidatePath("/panel/destek");
    return { tamam: `Mesajınız iletildi, ancak dosya eklenemedi — ${ekHatasi}` };
  }

  revalidatePath("/panel/destek");
  return { tamam: "Mesajınız iletildi." };
}

/** Müşteri kendi talebini kapatabilir; çözülmüş saymak onun kararı. */
export async function ticketKapat(ticketId: number): Promise<void> {
  const { firmaId } = await panelOturumu();
  const ticket = ticketGetir(ticketId, firmaId);
  if (!ticket) throw new Error("Talep bulunamadı.");

  ticketDurumYaz(ticket.id, "kapandi");
  revalidatePath("/panel/destek");
}
