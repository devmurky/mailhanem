"use server";

import { revalidatePath } from "next/cache";
import { ayarYaz, talepDurumYaz, type TalepDurum } from "@/sunucu/db";
import { ayarSemasi, hatalar } from "@/sunucu/dogrula";
import { suankiKullanici } from "@/sunucu/oturum";

/** Her yazma işleminden önce: gerçekten operatör mü? */
async function operatorOl(): Promise<void> {
  const k = await suankiKullanici();
  if (!k || k.operator !== 1) throw new Error("Yetki yok.");
}

export async function talebiIsaretle(id: number, durum: TalepDurum): Promise<void> {
  await operatorOl();
  talepDurumYaz(id, durum);
  revalidatePath("/operator/talepler");
  revalidatePath("/operator");
}

export type AyarDurumu = { tamam?: boolean; alanlar?: Record<string, string> };

export async function ayarlariKaydet(
  _onceki: AyarDurumu,
  veri: FormData,
): Promise<AyarDurumu> {
  await operatorOl();

  const sonuc = ayarSemasi.safeParse({
    iletisim_eposta: veri.get("iletisim_eposta") ?? "",
    iletisim_telefon: veri.get("iletisim_telefon") ?? "",
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };

  ayarYaz("iletisim_eposta", sonuc.data.iletisim_eposta);
  ayarYaz("iletisim_telefon", sonuc.data.iletisim_telefon);
  revalidatePath("/operator/ayarlar");
  return { tamam: true };
}
