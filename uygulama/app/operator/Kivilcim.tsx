/**
 * Kıvılcım çizgisi — prototipteki `kivilcim()` fonksiyonunun birebir karşılığı.
 *
 * Aynı geometri: kenarlardan 1px içeride, dikeyde 3px üstten ve 5px alttan
 * pay, son noktada 2.4 yarıçaplı bir işaret. Grafik kütüphanesi yok; tek bir
 * `polyline` yetiyor ve sunucuda çiziliyor.
 *
 * Dizi boşsa ya da tek elemanlıysa **hiçbir şey çizilmiyor**: iki noktası
 * olmayan bir eğilim çizgisi eğilim göstermez, düz bir çizgi uydurur.
 */
export function Kivilcim({
  dizi,
  renk = "var(--soluk)",
  genislik = 74,
  yukseklik = 26,
}: {
  dizi: number[];
  renk?: string;
  genislik?: number;
  yukseklik?: number;
}) {
  if (dizi.length < 2) return null;

  const enB = Math.max(...dizi);
  const enK = Math.min(...dizi);
  const aralik = enB - enK || 1;

  const nokta = dizi.map((v, i) => {
    const x = (i / (dizi.length - 1)) * (genislik - 2) + 1;
    const y = yukseklik - 3 - ((v - enK) / aralik) * (yukseklik - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const sonX = (genislik - 1).toFixed(1);
  const sonY = (
    yukseklik - 3 - ((dizi[dizi.length - 1]! - enK) / aralik) * (yukseklik - 8)
  ).toFixed(1);

  return (
    <svg
      width={genislik}
      height={yukseklik}
      viewBox={`0 0 ${genislik} ${yukseklik}`}
      aria-hidden="true"
    >
      <polyline
        points={nokta.join(" ")}
        fill="none"
        stroke={renk}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={sonX} cy={sonY} r="2.4" fill={renk} />
    </svg>
  );
}
