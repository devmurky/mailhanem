/**
 * Tema geçişindeki açılma maskesinin geometrisi.
 *
 * İlk sürüm zarf biçiminde bir çokgendi: markaya bağlıydı ama köşeleri
 * ekranı süpürürken sertti, geçiş "silme" gibi görünüyordu. Yerine **daire**
 * geldi — kenarı tarayıcı tarafından yumuşatılıyor ve `clip-path: circle()`
 * doğrudan aradeğerleniyor, yani her karede yeniden çokgen kurmak yok.
 *
 * Ayrı dosyada, çünkü burada denenebilecek gerçek bir şey var: dairenin
 * ekranı tamamen yutup yutmadığı. Yutmazsa geçişin sonunda köşede eski
 * temadan bir hilal kalır.
 */

/** Dairenin `clip-path` yazımı. */
export function daire(mx: number, my: number, yaricap: number): string {
  return `circle(${Math.round(yaricap)}px at ${Math.round(mx)}px ${Math.round(my)}px)`;
}

/**
 * Verilen noktadan ekranın **en uzak köşesine** olan uzaklık.
 *
 * Daire bu yarıçapa ulaştığında ekranda kapanmadık yer kalmıyor. Köşelere
 * bakmak yeterli: dikdörtgenin bir noktaya en uzak yeri her zaman bir köşedir.
 */
export function kapsayanYaricap(mx: number, my: number, en: number, boy: number): number {
  const x = Math.max(mx, en - mx);
  const y = Math.max(my, boy - my);
  return Math.hypot(x, y);
}

/** Nokta dairenin içinde mi — testlerin sorduğu soru. */
export function icindeMi(mx: number, my: number, yaricap: number, nx: number, ny: number): boolean {
  return Math.hypot(nx - mx, ny - my) <= yaricap;
}
