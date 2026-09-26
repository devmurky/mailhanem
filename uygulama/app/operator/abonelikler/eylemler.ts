"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  FIRMA_DURUMLARI,
  PLANLAR,
  ayarYaz,
  firmaAboneligiYaz,
  firmaGetir,
  gunlukYaz,
} from "@/sunucu/db";
import { suankiKullanici } from "@/sunucu/oturum";

async function operatorOl(): Promise<void> {
  const k = await suankiKullanici();
  if (!k || k.operator !== 1) throw new Error("Yetki yok.");
}

export type AbonelikDurumu = { tamam?: string; hata?: string };

/**
 * Aylık ücret panelde lira olarak yazılır, veritabanında kuruş durur.
 * Virgül ve nokta ikisi de kabul ediliyor: "1.250,50" da "1250.5" da olur.
 */
function kurusaCevir(ham: string): number | undefined {
  const temiz = ham.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!temiz) return 0;
  const sayi = Number(temiz);
  if (!Number.isFinite(sayi) || sayi < 0 || sayi > 10_000_000) return undefined;
  return Math.round(sayi * 100);
}

export async function abonelikKaydet(
  _onceki: AbonelikDurumu,
  veri: FormData,
): Promise<AbonelikDurumu> {
  await operatorOl();

  const firmaId = z.coerce.number().int().positive().parse(veri.get("firma_id"));
  const plan = String(veri.get("plan") ?? "");
  const durum = String(veri.get("durum") ?? "");
  const kurus = kurusaCevir(String(veri.get("ucret") ?? ""));

  if (!(PLANLAR as readonly string[]).includes(plan)) return { hata: "Tanınmayan plan." };
  if (!(FIRMA_DURUMLARI as readonly string[]).includes(durum)) {
    return { hata: "Tanınmayan durum." };
  }
  if (kurus === undefined) return { hata: "Ücreti sayı olarak yazın." };

  const firma = firmaGetir(firmaId);
  if (!firma) return { hata: "Firma bulunamadı." };

  firmaAboneligiYaz(firmaId, plan, durum, kurus);
  gunlukYaz(
    "abonelik",
    `${firma.ad}: ${plan} · ${durum} · aylık ${(kurus / 100).toFixed(2)} TL`,
    firmaId,
  );
  revalidatePath("/operator/abonelikler");
  revalidatePath("/operator/maliyet");
  return { tamam: `${firma.ad} güncellendi.` };
}

/** Mail başına model maliyeti — operatörün elle girdiği varsayım. */
export async function maliyetKaydet(
  _onceki: AbonelikDurumu,
  veri: FormData,
): Promise<AbonelikDurumu> {
  await operatorOl();

  const ham = String(veri.get("mail_kurus") ?? "").trim().replace(",", ".");
  const sayi = Number(ham || "0");
  if (!Number.isFinite(sayi) || sayi < 0 || sayi > 10000) {
    return { hata: "Kuruş değerini sayı olarak yazın." };
  }

  ayarYaz("maliyet_mail_kurus", String(sayi));
  revalidatePath("/operator/maliyet");
  return { tamam: "Varsayım kaydedildi." };
}
