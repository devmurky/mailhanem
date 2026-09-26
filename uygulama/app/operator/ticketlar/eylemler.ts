"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import {
  TICKET_DURUMLARI,
  TICKET_ONCELIKLERI,
  db,
  destekKaydiEkle,
  ticketGetir,
  ticketMesajEkle,
  ticketDurumYaz,
} from "@/sunucu/db";
import { suankiKullanici } from "@/sunucu/oturum";

/**
 * Operatörün ticket eylemleri.
 *
 * Müşteri tarafındakilerden farkı: burada firma sınırı yok — servis sahibi
 * bütün firmaların taleplerini görür ve yanıtlar. Onun yerine **operatör
 * sınırı** var: her eylem `operator = 1` kontrolünden geçiyor.
 */
async function operatorSart() {
  const kullanici = await suankiKullanici();
  if (!kullanici || kullanici.operator !== 1) redirect("/giris");
  return kullanici;
}

export type OpTicketDurumu = { hata?: string; tamam?: string };

const yanitSemasi = z.object({
  ticketId: z.coerce.number().int().positive(),
  metin: z.string().trim().min(1, "Boş mesaj gönderilemez.").max(8000),
});

export async function operatorYanitla(
  _onceki: OpTicketDurumu,
  veri: FormData,
): Promise<OpTicketDurumu> {
  const kullanici = await operatorSart();

  const sonuc = yanitSemasi.safeParse({
    ticketId: veri.get("ticket_id"),
    metin: veri.get("metin"),
  });
  if (!sonuc.success) return { hata: sonuc.error.issues[0]?.message ?? "Mesaj okunamadı." };

  const ticket = ticketGetir(sonuc.data.ticketId);
  if (!ticket) return { hata: "Talep bulunamadı." };

  ticketMesajEkle(ticket.id, kullanici.id, true, sonuc.data.metin);
  revalidatePath("/operator/ticketlar");
  return { tamam: "Yanıt iletildi." };
}

const durumSemasi = z.enum(TICKET_DURUMLARI);

export async function operatorDurumYaz(ticketId: number, durum: string): Promise<void> {
  await operatorSart();
  const d = durumSemasi.safeParse(durum);
  if (!d.success) throw new Error("Tanınmayan durum.");

  const ticket = ticketGetir(ticketId);
  if (!ticket) throw new Error("Talep bulunamadı.");

  ticketDurumYaz(ticket.id, d.data);
  revalidatePath("/operator/ticketlar");
}

const oncelikSemasi = z.enum(TICKET_ONCELIKLERI);

/**
 * Önceliği operatör de değiştirebiliyor: müşteri her talebi "acil"
 * işaretlerse kuyruğun sırası anlamını yitirir.
 */
export async function operatorOncelikYaz(ticketId: number, oncelik: string): Promise<void> {
  await operatorSart();
  const o = oncelikSemasi.safeParse(oncelik);
  if (!o.success) throw new Error("Tanınmayan öncelik.");

  const ticket = ticketGetir(ticketId);
  if (!ticket) throw new Error("Talep bulunamadı.");

  db.prepare("UPDATE ticketlar SET oncelik = ? WHERE id = ?").run(o.data, ticket.id);
  revalidatePath("/operator/ticketlar");
}

const zamanSemasi = z.object({
  ticketId: z.coerce.number().int().positive(),
  dakika: z.coerce.number().int().min(1, "En az bir dakika.").max(600, "En çok 600 dakika."),
});

/**
 * Bu talebe harcanan zamanı firmanın hesabına yazar (madde 2).
 *
 * Kayıt **firmaya** bağlanıyor, ticketa değil: net marj firma başına
 * hesaplanıyor ve aynı iş için açılan ikinci ticket zamanı bölmemeli. Konu
 * alanına talebin başlığı yazılıyor ki kaydın nereden geldiği kaybolmasın.
 */
export async function destekZamaniEkle(
  _onceki: OpTicketDurumu,
  veri: FormData,
): Promise<OpTicketDurumu> {
  await operatorSart();

  const sonuc = zamanSemasi.safeParse({
    ticketId: veri.get("ticket_id"),
    dakika: veri.get("dakika"),
  });
  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? "Süre okunamadı." };
  }

  const ticket = ticketGetir(sonuc.data.ticketId);
  if (!ticket) return { hata: "Talep bulunamadı." };

  destekKaydiEkle(ticket.firma_id, sonuc.data.dakika, `Talep #${ticket.id}: ${ticket.konu}`);

  /* Genel Bakış ve Müşteriler de bu sayıdan besleniyor. */
  revalidatePath("/operator/ticketlar");
  revalidatePath("/operator");
  revalidatePath("/operator/musteriler");
  return { tamam: `${sonuc.data.dakika} dakika ${ticket.firma_ad} hesabına yazıldı.` };
}
