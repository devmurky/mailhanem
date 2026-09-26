"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  KATEGORILER,
  OZEL_ONEK,
  bilgiKartiEkle,
  bilgiKartiSil,
  bilgiKartiYaz,
  bugunCikarimYapildi,
  karakterMaddeEkle,
  karakterMaddeSil,
  karakterYaz,
  oneriOnayla,
  oneriSil,
} from "@/sunucu/db";
import { KARAKTER_ALANLARI } from "@/sunucu/bilgiSabitleri";
import { karakterCikar } from "@/sunucu/zeka/karakter";
import { panelOturumu } from "../yetki";

/**
 * Bilgi deposunun yazma işleri.
 *
 * Depo, modelin yanıt yazarken okuyacağı metin: ekibin ortak diline karışmak
 * demek. O yüzden yazma yetkisi **sahip ve yöneticide** — şablonlardaki kuralın
 * aynısı. Personel depoyu görmüyor bile (sayfa `/panel`'e yönlendiriyor).
 */
async function yoneticiOl() {
  const oturum = await panelOturumu();
  if (oturum.kullanici.rol !== "sahip" && oturum.kullanici.rol !== "yonetici") {
    throw new Error("Bilgi deposunu düzenlemek için yönetici olmanız gerekiyor.");
  }
  return oturum;
}

function tazele(): void {
  revalidatePath("/panel/bilgi");
}

export type BilgiDurumu = {
  tamam?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

/**
 * Alan adı ya hazır beşlinin biri ya da yöneticinin eklediği bir madde
 * (`ozel:` öneki). İkisi de dışarıdan geliyor, ikisi de burada doğrulanıyor.
 */
const alanSemasi = z
  .string()
  .refine(
    (a) =>
      (KARAKTER_ALANLARI as readonly string[]).includes(a) ||
      (a.startsWith(OZEL_ONEK) && a.length <= 60),
    "Tanınmayan alan.",
  );

const karakterSemasi = z.object({
  alan: alanSemasi,
  deger: z.string().max(4000, "Bu alan en fazla 4000 karakter olabilir."),
});

export async function karakterKaydet(
  _onceki: BilgiDurumu,
  veri: FormData,
): Promise<BilgiDurumu> {
  const { firmaId, kullanici } = await yoneticiOl();

  const sonuc = karakterSemasi.safeParse({
    alan: veri.get("alan"),
    deger: veri.get("deger"),
  });
  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? "Alan okunamadı." };
  }

  karakterYaz(firmaId, sonuc.data.alan, sonuc.data.deger, kullanici.id);
  tazele();
  return { tamam: sonuc.data.deger.trim() ? "Kaydedildi." : "Alan boşaltıldı." };
}

const maddeSemasi = z.object({
  baslik: z.string().trim().min(2, "Başlık çok kısa.").max(80),
  deger: z.string().trim().max(4000),
});

/** Yöneticinin kendi karakter maddesi — hazır beşli her firmaya yetmiyor. */
export async function karakterMaddesiEkle(
  _onceki: BilgiDurumu,
  veri: FormData,
): Promise<BilgiDurumu> {
  const { firmaId, kullanici } = await yoneticiOl();

  const sonuc = maddeSemasi.safeParse({
    baslik: veri.get("baslik"),
    deger: veri.get("deger"),
  });
  if (!sonuc.success) {
    const alanlar: Record<string, string> = {};
    for (const h of sonuc.error.issues) {
      const ad = String(h.path[0] ?? "");
      if (ad && !alanlar[ad]) alanlar[ad] = h.message;
    }
    return { alanlar };
  }

  karakterMaddeEkle(firmaId, sonuc.data.baslik, sonuc.data.deger, kullanici.id);
  tazele();
  return { tamam: "Madde eklendi." };
}

export async function karakterMaddesiSil(hamAlan: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  karakterMaddeSil(firmaId, alanSemasi.parse(hamAlan));
  tazele();
}

const kartSemasi = z.object({
  id: z.coerce.number().int().min(0),
  baslik: z.string().trim().min(2, "Başlık çok kısa.").max(120),
  icerik: z.string().trim().min(2, "İçerik çok kısa.").max(4000),
  kategori: z.string().refine(
    (k) => k === "" || (KATEGORILER as readonly string[]).includes(k),
    "Tanınmayan kategori.",
  ),
});

export async function kartKaydet(_onceki: BilgiDurumu, veri: FormData): Promise<BilgiDurumu> {
  const { firmaId, kullanici } = await yoneticiOl();

  const sonuc = kartSemasi.safeParse({
    id: veri.get("id") ?? 0,
    baslik: veri.get("baslik"),
    icerik: veri.get("icerik"),
    kategori: veri.get("kategori") ?? "",
  });
  if (!sonuc.success) {
    const alanlar: Record<string, string> = {};
    for (const h of sonuc.error.issues) {
      const ad = String(h.path[0] ?? "");
      if (ad && !alanlar[ad]) alanlar[ad] = h.message;
    }
    return { alanlar };
  }

  const { id, ...kart } = sonuc.data;
  if (id) bilgiKartiYaz(id, firmaId, kart, kullanici.id);
  else bilgiKartiEkle(firmaId, kart, kullanici.id);

  tazele();
  return { tamam: id ? "Kart güncellendi." : "Kart eklendi." };
}

export async function kartiSil(hamId: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  bilgiKartiSil(z.coerce.number().int().positive().parse(hamId), firmaId);
  tazele();
}

export async function oneriyiOnayla(hamId: unknown): Promise<void> {
  const { firmaId, kullanici } = await yoneticiOl();
  oneriOnayla(z.coerce.number().int().positive().parse(hamId), firmaId, kullanici.id);
  tazele();
}

export async function oneriyiSil(hamId: unknown): Promise<void> {
  const { firmaId } = await yoneticiOl();
  oneriSil(z.coerce.number().int().positive().parse(hamId), firmaId);
  tazele();
}

export type CikarimDurumu = { tamam?: string; hata?: string; bilgi?: string };

/**
 * Çıkarımı başlatır.
 *
 * Kendiliğinden çalışmıyor: müşterinin mailleri bir dil modeline ancak
 * firmanın yöneticisi istediğinde gidiyor. Günde bir kez sınırı token
 * maliyeti için — depo her saat tazelenecek bir şey değil.
 */
export async function cikarimiBaslat(): Promise<CikarimDurumu> {
  const { firmaId, firma, kullanici } = await yoneticiOl();

  if (bugunCikarimYapildi(firmaId)) {
    return { bilgi: "Bugün bir çıkarım zaten yapıldı; yarın yeniden çalıştırabilirsiniz." };
  }

  const sonuc = await karakterCikar({
    firmaId,
    firmaAd: firma.ad,
    kullaniciId: kullanici.id,
  });
  tazele();

  if (sonuc.durum === "bagli-degil") {
    return { hata: "Model bağlı değil; çıkarım çalıştırılamadı." };
  }
  if (sonuc.durum === "veri-yok") {
    return {
      bilgi:
        "Okunacak mail bulunamadı. Kutu bağlanıp ilk çekim yapıldığında çıkarım " +
        "anlamlı olur.",
    };
  }
  if (sonuc.durum === "hata") return { hata: sonuc.hata };

  return sonuc.oneri
    ? {
        tamam:
          `${sonuc.okunanMail} mail ve ${sonuc.okunanYanit} yanıt okundu, ` +
          `${sonuc.oneri} öneri çıktı. Aşağıdan tek tek onaylayın.`,
      }
    : {
        bilgi:
          `${sonuc.okunanMail} mail okundu ama depoya eklenecek yeni bir şey ` +
          "bulunamadı.",
      };
}
