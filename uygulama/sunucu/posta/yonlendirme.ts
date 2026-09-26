/**
 * Yönlendirme — gelen maili kategoriye ve kişiye bağlayan elle kurulmuş kurallar.
 *
 * `kural.ts` ile karıştırılmasın: o **eleme** yapar (bu mail hiç girmesin),
 * bu **sınıflandırma** yapar (giren mail kimin işi). İkisi arka arkaya çalışır.
 *
 * Bunun yapay zekâ sınıflandırmasıyla ilişkisi şu: model geldiğinde bu kurallar
 * yok olmayacak. Elle kurulmuş bir kural, modelin tahmininden daha kesindir —
 * "muhasebe@tedarikci.com'dan gelen her şey faturadır" bilgisini model değil
 * firma bilir. Model, kuralın tutmadığı maillerde devreye girecek.
 *
 * Saf fonksiyon: ağ yok, veritabanı yok.
 */

export type Kural = {
  id: number;
  tip: string;
  kalip: string;
  kategori: string | null;
  sahip_id: number | null;
  etkin: number;
};

export type Girdi = {
  gonderen: string;
  konu: string;
};

export type Sonuc = {
  kuralId: number;
  kategori: string | null;
  sahipId: number | null;
};

/** Türkçe büyük/küçük harf tuzağı: "İ" ve "ı" için yerel katlama gerekiyor. */
function kucult(s: string): string {
  return s.trim().toLocaleLowerCase("tr");
}

function alanAdi(adres: string): string {
  const i = adres.lastIndexOf("@");
  return i === -1 ? "" : kucult(adres.slice(i + 1));
}

/** Tek bir kuralın eşleşip eşleşmediği. */
export function esler(kural: Kural, girdi: Girdi): boolean {
  const kalip = kucult(kural.kalip);
  if (!kalip) return false;

  if (kural.tip === "gonderen") {
    /* Tam adres eşleşmesi; "murat@x.com" yazan "murat@xx.com"u yakalamasın. */
    return kucult(girdi.gonderen) === kalip;
  }
  if (kural.tip === "alan") {
    const alan = alanAdi(girdi.gonderen);
    /* Alt alan adı da sayılır: "firma.com" kuralı "posta.firma.com"u yakalar. */
    return alan === kalip || alan.endsWith("." + kalip);
  }
  if (kural.tip === "konu") {
    return kucult(girdi.konu).includes(kalip);
  }
  return false;
}

/**
 * Sıradaki **ilk** eşleşen kuralı uygular ve durur.
 *
 * "Hepsini uygula" değil, çünkü iki kural farklı kategori söylerse hangisinin
 * kazandığı belirsiz olurdu. İlk eşleşen kazanır; sıra da panelden ayarlanır.
 */
export function yonlendir(kurallar: Kural[], girdi: Girdi): Sonuc | undefined {
  for (const k of kurallar) {
    if (!k.etkin) continue;
    if (!esler(k, girdi)) continue;
    return { kuralId: k.id, kategori: k.kategori, sahipId: k.sahip_id };
  }
  return undefined;
}
