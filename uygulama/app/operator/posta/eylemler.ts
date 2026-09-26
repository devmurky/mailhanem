"use server";

import { revalidatePath } from "next/cache";
import { kutuEkle, kutuGetir, kutuDurumYaz } from "@/sunucu/db";
import { anahtarVarMi, KasaHatasi, zarfla } from "@/sunucu/kasa";
import { suankiKullanici } from "@/sunucu/oturum";
import { baglantiyiDene } from "@/sunucu/posta/imap";
import { hepsiniCek, kutuyuCek, type CekimSonucu } from "@/sunucu/posta/isci";
import { araligiYaz } from "@/sunucu/zamanlayici";
import { kutuSemasi } from "@/sunucu/dogrula";
import { hatalar } from "@/sunucu/dogrula";

async function operatorOl(): Promise<void> {
  const k = await suankiKullanici();
  if (!k || k.operator !== 1) throw new Error("Yetki yok.");
}

export type CekimDurumu = { sonuc?: CekimSonucu[]; hata?: string };

export async function cekimiCalistir(_onceki: CekimDurumu): Promise<CekimDurumu> {
  await operatorOl();
  try {
    const sonuc = await hepsiniCek();
    revalidatePath("/operator/posta");
    revalidatePath("/operator/saglik");
    revalidatePath("/operator");
    return { sonuc };
  } catch (e) {
    return { hata: e instanceof Error ? e.message : String(e) };
  }
}

export async function tekKutuyuCek(kutuId: number): Promise<void> {
  await operatorOl();
  await kutuyuCek(kutuId);
  revalidatePath("/operator/posta");
  revalidatePath("/operator/saglik");
}

export type KutuDurumu = {
  tamam?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

export async function kutuBagla(_onceki: KutuDurumu, veri: FormData): Promise<KutuDurumu> {
  await operatorOl();

  const sonuc = kutuSemasi.safeParse({
    firma_id: veri.get("firma_id"),
    adres: veri.get("adres"),
    saglayici: veri.get("saglayici"),
    imap_sunucu: veri.get("imap_sunucu"),
    imap_port: veri.get("imap_port"),
    smtp_sunucu: veri.get("smtp_sunucu"),
    smtp_port: veri.get("smtp_port"),
    kullanici_adi: veri.get("kullanici_adi"),
    parola: veri.get("parola"),
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };
  const k = sonuc.data;

  if (!anahtarVarMi()) {
    return {
      hata:
        "MAILHANEM_ANAHTAR tanımlı değil, parola şifrelenemez. Kutu bağlanmadı — " +
        "parolayı şifrelemeden kaydetmektense hiç kaydetmemek doğru.",
    };
  }

  /* Kurulumun "bağlantıyı birlikte test edelim" adımı: çalışmayan bilgiyi kaydetmiyoruz. */
  const deneme = await baglantiyiDene({
    sunucu: k.imap_sunucu,
    port: k.imap_port,
    kullanici: k.kullanici_adi || k.adres,
    parola: k.parola,
  });
  if (!deneme.tamam) {
    return { hata: `Bağlantı kurulamadı: ${deneme.hata}` };
  }

  try {
    const id = kutuEkle({
      firma_id: k.firma_id,
      adres: k.adres,
      saglayici: k.saglayici,
      imap_sunucu: k.imap_sunucu,
      imap_port: k.imap_port,
      smtp_sunucu: k.smtp_sunucu,
      smtp_port: k.smtp_port,
      kullanici_adi: k.kullanici_adi || k.adres,
      parola_sifreli: zarfla(k.parola),
    });
    kutuDurumYaz(id, "iyi");
    revalidatePath("/operator/saglik");
    revalidatePath("/operator/posta");
    return { tamam: `${k.adres} bağlandı · kutuda ${deneme.adet} mail görünüyor` };
  } catch (e) {
    if (e instanceof KasaHatasi) return { hata: e.message };
    return { hata: e instanceof Error ? e.message : String(e) };
  }
}

export async function kutuyuKopukIsaretle(kutuId: number): Promise<void> {
  await operatorOl();
  if (kutuGetir(kutuId)) kutuDurumYaz(kutuId, "kopuk");
  revalidatePath("/operator/saglik");
}

/** Zamanlayıcı aralığı. 0 verilirse otomatik çekim kapanır. */
export async function zamanlayiciAraligi(dakika: number): Promise<void> {
  await operatorOl();
  araligiYaz(dakika);
  revalidatePath("/operator/posta");
}
