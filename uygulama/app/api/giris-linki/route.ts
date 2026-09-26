/**
 * Sihirli bağlantı isteği.
 *
 * Tanımsız adres için de "gönderdik" deriz: kimin müşteri olduğunu bu uca
 * sorarak öğrenmek mümkün olmamalı. SMTP tanımlı değilse bağlantı sunucu
 * günlüğüne yazılır; dışarıya dönen cevap iki durumda da aynıdır.
 */
import { NextResponse } from "next/server";
import { kullaniciEpostaIle } from "@/sunucu/db";
import { girisSemasi } from "@/sunucu/dogrula";
import { girisPostasiGonder } from "@/sunucu/girisPostasi";
import { corsBasliklari, onIstek } from "@/sunucu/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(istek: Request) {
  const basliklar = corsBasliklari(istek);
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return NextResponse.json({ tamam: false, hata: "Gövde okunamadı." }, { status: 400, headers: basliklar });
  }

  const sonuc = girisSemasi.safeParse(govde);
  if (!sonuc.success) {
    return NextResponse.json(
      { tamam: false, hata: "Bu adres eksik görünüyor." },
      { status: 422, headers: basliklar },
    );
  }

  const kullanici = kullaniciEpostaIle(sonuc.data.eposta);
  if (kullanici) await girisPostasiGonder(kullanici);

  // Adres tanınsın tanınmasın aynı cevap.
  return NextResponse.json({ tamam: true }, { headers: basliklar });
}

export async function OPTIONS(istek: Request) {
  return onIstek(istek);
}
