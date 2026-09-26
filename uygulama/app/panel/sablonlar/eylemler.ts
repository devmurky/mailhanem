"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  KATEGORILER,
  sablonEkle,
  sablonKullanildi,
  sablonSil,
  sablonYaz,
  sablonlariGetir,
} from "@/sunucu/db";
import { hatalar, sablonSemasi } from "@/sunucu/dogrula";
import { panelOturumu } from "../yetki";

/**
 * Yanıt şablonları.
 *
 * Şablon yazmak ekibin ortak diline karışmak demek; bu yüzden yazma yetkisi
 * yöneticide. Personel şablonları görür ve kullanır, değiştiremez.
 */
async function yoneticiOl() {
  const oturum = await panelOturumu();
  if (oturum.kullanici.rol !== "sahip" && oturum.kullanici.rol !== "yonetici") {
    throw new Error("Şablonları düzenlemek için yönetici olmanız gerekiyor.");
  }
  return oturum;
}

export type SablonDurumu = {
  tamam?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

export async function sablonKaydet(
  _onceki: SablonDurumu,
  veri: FormData,
): Promise<SablonDurumu> {
  const { firmaId } = await yoneticiOl();

  const sonuc = sablonSemasi.safeParse({
    id: veri.get("id") ?? 0,
    ad: veri.get("ad"),
    kategori: veri.get("kategori") ?? "",
    metin: veri.get("metin"),
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };

  const k = sonuc.data;
  const kategori = (KATEGORILER as readonly string[]).includes(k.kategori) ? k.kategori : null;

  if (k.id) {
    /* Firma sınırı sorgunun içinde; başka firmanın şablonu güncellenemez. */
    if (!sablonlariGetir(firmaId).some((v) => v.id === k.id)) {
      return { hata: "Şablon bulunamadı." };
    }
    sablonYaz(k.id, firmaId, k.ad, kategori, k.metin);
  } else {
    sablonEkle(firmaId, k.ad, kategori, k.metin);
  }

  revalidatePath("/panel/sablonlar");
  return { tamam: k.id ? "Şablon güncellendi." : "Şablon eklendi." };
}

export async function sablonuSil(hamId: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  const id = z.coerce.number().int().positive().parse(hamId);
  sablonSil(id, firmaId);
  revalidatePath("/panel/sablonlar");
}

/** Şablon yanıta eklendiğinde çağrılır; hangisinin işe yaradığı görünsün diye. */
export async function sablonSayaci(hamId: unknown): Promise<void> {
  const { firmaId } = await panelOturumu();
  const id = z.coerce.number().int().positive().parse(hamId);
  sablonKullanildi(id, firmaId);
}
