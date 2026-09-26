/**
 * Müşteri panelinin kapısı.
 *
 * Panelin her sayfası ve her yazma eylemi buradan geçer. Tek bir yerde
 * durmasının sebebi: firma sınırı unutulabilecek bir şey olmasın. Dönen
 * `firmaId` sorgulara elle yazılan bir sayı değil, oturumdan gelen değerdir;
 * URL'den gelen hiçbir firma numarasına güvenilmez.
 */
import { redirect } from "next/navigation";
import { firmaGetir, type Firma, type Kullanici, type Rol } from "@/sunucu/db";
import { suankiKullanici } from "@/sunucu/oturum";

export type PanelOturum = { kullanici: Kullanici; firma: Firma; firmaId: number };

/** Oturum yoksa girişe, operatörse kendi arka ofisine yollar. */
export async function panelOturumu(): Promise<PanelOturum> {
  const kullanici = await suankiKullanici();
  if (!kullanici) redirect("/giris");
  if (kullanici.operator === 1) redirect("/operator");
  if (kullanici.firma_id === null) redirect("/giris?durum=firmasiz");

  const firma = firmaGetir(kullanici.firma_id);
  if (!firma) redirect("/giris?durum=firmasiz");

  return { kullanici, firma, firmaId: firma.id };
}

export const ROL_AD: Record<Rol, string> = {
  sahip: "Sahip",
  yonetici: "Yönetici",
  personel: "Personel",
};

/** Rolleri yalnızca sahip değiştirir; yönetici ekibi görür ama yetki dağıtamaz. */
export function rolDagitabilir(k: Kullanici): boolean {
  return k.rol === "sahip";
}

/** Kutu ayarlarını görebilenler. Personel kendi işini yapar, kuruluma karışmaz. */
export function kurulumGorur(k: Kullanici): boolean {
  return k.rol === "sahip" || k.rol === "yonetici";
}
