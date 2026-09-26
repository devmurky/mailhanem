/**
 * Tema geçişindeki zarf maskesinin geometrisi.
 *
 * Bileşenden ayrı bir dosyada, çünkü burada denenebilecek gerçek bir şey var:
 * maskenin ekranı **tam olarak** yutup yutmadığı. Yutmazsa geçişin sonunda
 * eski temadan bir şerit kalır ve kullanıcı bunu bir çizim hatası sanır.
 */

/** Zarfın yarım genişliğinin ölçeğe oranı — 1.4, kabaca gerçek zarf oranı. */
export const EN_ORAN = 1.4;
/** Üst kenarın ortadan içeri çöküşü (kapak), yarım yüksekliğin oranı. */
export const KAPAK_ORAN = 0.55;

export type Nokta = { x: number; y: number };

/**
 * Zarf biçiminde `clip-path: polygon(...)` üretir: üst kenarı ortadan içeri
 * çöken bir dikdörtgen. Küçükken amblem gibi okunuyor, büyüyünce ekranı
 * yutuyor.
 */
export function zarfMaskesi(mx: number, my: number, olcek: number): string {
  const en = EN_ORAN * olcek;
  const boy = olcek;
  const kapak = KAPAK_ORAN * boy;

  const noktalar: Nokta[] = [
    { x: mx - en, y: my - boy },
    { x: mx, y: my - boy + kapak },
    { x: mx + en, y: my - boy },
    { x: mx + en, y: my + boy },
    { x: mx - en, y: my + boy },
  ];

  return (
    "polygon(" +
    noktalar.map((n) => `${Math.round(n.x)}px ${Math.round(n.y)}px`).join(",") +
    ")"
  );
}

/**
 * Maskenin ekranı tamamen yutması için gereken ölçek.
 *
 * Yukarı yön ayrı hesaplanıyor: kapak yüzünden zarfın üst orta kısmı içeri
 * çöküyor, yani tepeye ulaşmak için köşelere ulaşmaktan **daha fazla** boy
 * gerekiyor. Yalnız köşelere bakan bir hesap, ekranın üst ortasında eski
 * temadan ince bir kama bırakırdı — hem de tam olarak gözün gittiği yerde.
 */
export function kapsayanOlcek(mx: number, my: number, en: number, boy: number): number {
  const yatay = Math.max(mx, en - mx) / EN_ORAN;
  /* Tepe noktası my - olcek + KAPAK_ORAN*olcek = my - olcek*(1 - KAPAK_ORAN) */
  const yukari = my / (1 - KAPAK_ORAN);
  const asagi = boy - my;
  /* %6 pay: kenar yuvarlama ve yarım piksel farkları için. */
  return Math.max(yatay, yukari, asagi, 1) * 1.06;
}

/** Maskenin verilen noktayı kapsayıp kapsamadığı — testlerin sorduğu soru. */
export function icindeMi(mx: number, my: number, olcek: number, nx: number, ny: number): boolean {
  const en = EN_ORAN * olcek;
  const boy = olcek;
  const kapak = KAPAK_ORAN * boy;

  if (nx < mx - en || nx > mx + en) return false;
  if (ny < my - boy || ny > my + boy) return false;

  /* Kapak üçgeni: üst kenarın ortasındaki çöküntü. Sol yarıda kenar
     (mx - en, my - boy) ile (mx, my - boy + kapak) arasında iniyor. */
  const yatayUzaklik = Math.abs(nx - mx);
  const kapakAltSinir = my - boy + kapak * (1 - yatayUzaklik / en);
  return ny >= kapakAltSinir;
}
