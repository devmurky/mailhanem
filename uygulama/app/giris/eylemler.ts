"use server";

import { kullaniciEpostaIle } from "@/sunucu/db";
import { epostaSemasi } from "@/sunucu/dogrula";
import { cerezSil, oturumKapat } from "@/sunucu/oturum";
import { girisPostasiGonder } from "@/sunucu/girisPostasi";
import { postaAcikMi } from "@/sunucu/posta/gonderim";
import { turnstileAcikMi, turnstileDogrula } from "@/sunucu/turnstile";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CEREZ } from "@/sunucu/oturum";

export type GirisDurumu =
  | { asama: "form"; hata?: string }
  | { asama: "gonderildi"; eposta: string; postaAcik: boolean };

/**
 * Giriş linki ister. Adres tanınmasa da "gönderildi" der — kimin müşteri
 * olduğu bu formu deneyerek öğrenilememeli.
 *
 * Bot koruması **adres okunmadan önce** çalışıyor: doğrulama adresin kayıtlı
 * olup olmamasına göre farklı davranırsa, hata mesajının kendisi o bilgiyi
 * ele verirdi.
 */
export async function girisLinkiIste(
  _onceki: GirisDurumu,
  veri: FormData,
): Promise<GirisDurumu> {
  if (turnstileAcikMi()) {
    const basliklar = await headers();
    const ip =
      basliklar.get("cf-connecting-ip") ??
      basliklar.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined;

    const dogrulama = await turnstileDogrula(
      String(veri.get("cf-turnstile-response") ?? ""),
      ip,
    );
    if (!dogrulama.gecti) {
      console.warn(`[giris] bot doğrulaması geçilemedi: ${dogrulama.sebep}`);
      return {
        asama: "form",
        hata: "Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.",
      };
    }
  }

  const ham = String(veri.get("eposta") ?? "");
  const sonuc = epostaSemasi.safeParse(ham);
  if (!sonuc.success) {
    return {
      asama: "form",
      hata: "Bu adres eksik görünüyor. @ ve alan adıyla birlikte yazın, örnek: ayse@firmaniz.com",
    };
  }

  const kullanici = kullaniciEpostaIle(sonuc.data);
  if (kullanici) await girisPostasiGonder(kullanici);

  /* Bu bayrak kullanıcının kim olduğuna değil, sunucunun yapılandırmasına
     bakar; yoksa "posta gitti mi" cevabı adresin kayıtlı olduğunu ele verirdi. */
  return { asama: "gonderildi", eposta: sonuc.data, postaAcik: postaAcikMi() };
}

export async function cikisYap(): Promise<void> {
  const kutu = await cookies();
  oturumKapat(kutu.get(CEREZ)?.value);
  await cerezSil();
  redirect("/giris");
}
