"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  KATEGORILER,
  YONLENDIRME_TIPLERI,
  firmaKullanicilari,
  mailSinifla,
  sinifsizMailler,
  yonlendirmeEkle,
  yonlendirmeEslesti,
  yonlendirmeEtkin,
  yonlendirmeSil,
  yonlendirmeTasi,
  yonlendirmeleriGetir,
  type Kullanici,
} from "@/sunucu/db";
import { yonlendir } from "@/sunucu/posta/yonlendirme";
import { panelOturumu } from "../yetki";

/** Yönlendirme ekibin iş bölümünü değiştirir; yazma yetkisi yöneticide. */
async function yoneticiOl() {
  const oturum = await panelOturumu();
  if (oturum.kullanici.rol !== "sahip" && oturum.kullanici.rol !== "yonetici") {
    throw new Error("Yönlendirme kurallarını düzenlemek için yönetici olmanız gerekiyor.");
  }
  return oturum;
}

const idSemasi = z.coerce.number().int().positive();

export type KuralDurumu = {
  tamam?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

export async function kuralEkle(_onceki: KuralDurumu, veri: FormData): Promise<KuralDurumu> {
  const { firmaId } = await yoneticiOl();

  const tip = String(veri.get("tip") ?? "");
  const kalip = String(veri.get("kalip") ?? "").trim();
  const kategori = String(veri.get("kategori") ?? "");
  const sahip = String(veri.get("sahip_id") ?? "");

  if (!(YONLENDIRME_TIPLERI as readonly string[]).includes(tip)) {
    return { alanlar: { tip: "Kural tipini seçin." } };
  }
  if (kalip.length < 2 || kalip.length > 200) {
    return { alanlar: { kalip: "Eşleşecek metni yazın." } };
  }
  if (!kategori && !sahip) {
    return { hata: "Kuralın bir sonucu olmalı: kategori, kişi ya da ikisi." };
  }

  const kat = (KATEGORILER as readonly string[]).includes(kategori) ? kategori : null;

  let sahipId: number | null = null;
  if (sahip) {
    const n = Number(sahip);
    if (!firmaKullanicilari(firmaId, true).some((k: Kullanici) => k.id === n)) {
      return { alanlar: { sahip_id: "Bu kişi ekipte değil." } };
    }
    sahipId = n;
  }

  yonlendirmeEkle(firmaId, tip, kalip, kat, sahipId);
  revalidatePath("/panel/yonlendirme");
  return { tamam: "Kural eklendi. Bundan sonra gelen maillere uygulanacak." };
}

export async function kuralSil(hamId: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  yonlendirmeSil(idSemasi.parse(hamId), firmaId);
  revalidatePath("/panel/yonlendirme");
}

export async function kuralAcKapat(hamId: unknown, etkin: boolean): Promise<void> {
  const { firmaId } = await yoneticiOl();
  yonlendirmeEtkin(idSemasi.parse(hamId), firmaId, Boolean(etkin));
  revalidatePath("/panel/yonlendirme");
}

export async function kuralTasi(hamId: unknown, hamYon: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  const yon = z.enum(["yukari", "asagi"]).parse(hamYon);
  yonlendirmeTasi(idSemasi.parse(hamId), firmaId, yon);
  revalidatePath("/panel/yonlendirme");
}

/**
 * Kuralları **geçmişe** uygular.
 *
 * Yeni kural kurulduğunda "bundan sonrakilere geçerli" demek doğru ama eksik:
 * kutuda zaten yüzlerce sınıflandırılmamış mail duruyor olabilir. Bu eylem
 * onları tarar. Dolu alanın üstüne yazmaz — kimsenin elle yaptığı seçim
 * bozulmaz.
 */
export async function gecmiseUygula(): Promise<{ taranan: number; degisen: number }> {
  const { firmaId } = await yoneticiOl();
  const kurallar = yonlendirmeleriGetir(firmaId, true);
  const mailler = sinifsizMailler(firmaId);

  let degisen = 0;
  for (const m of mailler) {
    const sonuc = yonlendir(kurallar, { gonderen: m.gonderen, konu: m.konu });
    if (!sonuc) continue;

    /* Yalnızca boş olan alan dolacaksa "değişti" sayıyoruz; sayının anlamı
       "kaç mail etkilendi" olmalı, "kaç kural eşleşti" değil. */
    const kategoriDolacak = Boolean(sonuc.kategori) && m.kategori === null;
    const sahipDolacak = Boolean(sonuc.sahipId) && m.sahip_id === null;
    if (!kategoriDolacak && !sahipDolacak) continue;

    mailSinifla(m.id, firmaId, sonuc.kategori, sonuc.sahipId);
    yonlendirmeEslesti(sonuc.kuralId, firmaId);
    degisen++;
  }

  revalidatePath("/panel/yonlendirme");
  revalidatePath("/panel");
  return { taranan: mailler.length, degisen };
}
