# Mailhanem — kaldığımız yer

_Son güncelleme: 2026-09-26 (dördüncü tur). Bu turda: **tek karakter**
— üç yüzeydeki yarıçap, düğme ve mikro tipografi ölçekleri tek sisteme indi,
ana sayfaya gece modu ve tema düğmesi geldi, geçiş animasyonu yumuşak
dairesel açılmayla yeniden yazıldı. Üçüncü turda: **gece modu**
(zarf maskeli geçiş, iki panelde), **pazar raporu** (`../PAZAR.md`) ve
rapordan çıkan **yeni özellik listesi**. İkinci turda: proje **git altına
alındı** (github.com/devmurky/mailhanem, private) ve memnuniyet listesinin
**6, 4, 8, 12**'si yapıldı — okundu/okunmadı, klavye kısayolları, "şu an bu
maile bakıyor", veri dışa aktarma. Aynı gün önce: **bilgi deposu** (firmanın karakteri +
bilgi kartları, çıkarım boru hattı anahtarsız hazır), **ticket arayüzü yeniden
dengelendi**, **panel genişlikleri adaptif oldu** (2K turu) ve **kapanış
turunda açık uçlar kapatıldı** (anahtarın iki adı, maliyet ekranı etiketleri,
operatör çekmecesi). Bir gün önce: imza kırpma, taslak otomatik kaydı, konuşma
görünümü, hesap kaydı. Turun sonunda liste bir kez daha tarandı:
dokuz **altyapı/güvenlik maddesi** (A-I) eklendi — kod değişmedi, yalnız bu
liste. Bu dosya yeni bir oturumun ilk okuyacağı şey._

## Durum özeti

| Dosya | Ne | Durum |
|---|---|---|
| `uygulama/` | **Next.js uygulaması** — site + iki panel, tek kökende | Çalışıyor, 34 rota, 265 test |
| `../PAZAR.md` | **Pazar raporu** — kaç firma aday, tutar mı, hangi sektör | 2026-09-26 |
| `site/index.html` | Tanıtım sayfası — **kaynak dosya**, uygulama `/` adresinde servis ediyor | Çalışıyor |
| `site/giris.html` | Giriş sayfası — **artık servis edilmiyor**, tasarımı `/giris`'e taşındı | Tasarım artefaktı |
| `tasarim/panel.html` | Müşteri paneli prototipi, 6 ekran | **Tamamı taşındı** |
| `tasarim/operator.html` | Operatör arka ofisi prototipi, 8 ekran | **Tamamı taşındı** |

Ayrıntılar `uygulama/README.md`'de. Özellik planı `~/.claude/plans/linked-spinning-newell.md`
(4 faz, 91 gün); ürün gerçeği `../PRODUCT.md`; sayfanın yön sözleşmesi
`../.impeccable/surfaces/mailhane-site-index-html.md`.

## ★★★ AÇIK KAPI — İŞ BİTİNCE KAPAT ★★★

Geliştirme sırasında panellere giriş maili beklemeden girmek için **geçici bir
kapı** açık. Kullanıcı istedi: "login isteme, direk girebileyim."

- **Operatör paneli:** `http://127.0.0.1:3100/giris/dev-kapi?panel=operator`
- **Müşteri paneli:** `http://127.0.0.1:3100/giris/dev-kapi?panel=musteri`

Tıklayınca mevcut hesaba (ilk etkin operatör / ilk etkin firma sahibi) oturum
açıp panele bırakıyor. Şifre yok, yeni kullanıcı yaratmıyor.

**Kapı yalnızca `.env.local`'de `DEV_KAPI=acik` varken çalışır** (o dosya sürüm
kontrolüne girmez, üretime taşınmaz). Bayrak yoksa 404.

**KAPATMAK İÇİN (en sonda):**
1. `uygulama/app/giris/dev-kapi/route.ts` dosyasını sil.
2. `uygulama/.env.local`'den `DEV_KAPI=acik` satırını (ve üstündeki ★ notunu) sil.
3. `npm run yap && npm run basla` ile yeniden derle.

---

## YARIN BURADAN DEVAM

**Ağaç temiz:** 224 test geçiyor, `npx tsc --noEmit` sessiz, `npm run yap` derliyor
(33 rota — biri geçici `/giris/dev-kapi`). Yarım kalan hiçbir şey yok.

### Nasıl çalıştırılır — TEK SUNUCU

```bash
cd mailhanem/uygulama          # klasör hâlâ "mailhane", aşağıya bak
npm run yap && npm run basla   # http://127.0.0.1:3100
```

**Ayrı statik sunucu yok.** `/` tanıtım sayfası, `/giris` giriş, `/panel` ve
`/operator` uygulama, `/api/*` uçlar — hepsi aynı kökende. Tanıtım sayfası
derleme öncesi `araclar/siteyi-kopyala.mjs` ile `site/index.html`'den
`public/tanitim/`'e kopyalanıyor; kaynak dosya yerinde duruyor.

### Panele nasıl girilir

**En hızlısı ★ açık kapı** (yukarıdaki yıldızlı bölüm): tek tık, giriş sormaz.

```
http://127.0.0.1:3100/giris/dev-kapi?panel=operator
http://127.0.0.1:3100/giris/dev-kapi?panel=musteri
```

Demo vitrini: `http://127.0.0.1:3100/demo` — örnek verilerle dolu müşteri paneli.

Kapı kapatıldıktan sonra normal yol: SMTP kapalı olduğu için giriş maili
gitmiyor; `/giris`'e adresi yaz, sonra **`uygulama/veri/giden-mailler.log`**
dosyasını aç — bağlantı en altta.

Kullanıcılar: `operator@mailhanem.app` (operatör) · `enes@arkunmobilya.com`
(sahip) · `elif@` (yönetici) · `ayse@`, `selin@` (personel).

### Sıradaki iş

14 maddelik listenin **tamamı bitti**. Memnuniyet listesinin de ilk dört maddesi
(1, 3, 2, 11) bitti — ayrıntı aşağıdaki "Memnuniyet listesi" bölümünde.
Sonra **bilgi deposu** ve **ticket arayüzü** yapıldı (hemen aşağıdaki bölüm).

**Bilgi deposunun beklediği tek şey anahtar.** `.env.local`'e
`ANTHROPIC_ANAHTAR` (ya da `ANTHROPIC_API_KEY` — ikisi de okunuyor) yazıldığı
an "Maillerden çıkar" düğmesi çalışmaya başlıyor, operatördeki entegrasyon
kartı "bağlı"ya dönüyor ve `/kvkk` sayfasındaki "dil modeline ne gidiyor"
bölümü kendiliğinden açılıyor. Kodda değişecek yer yok; ilk gerçek turda çıkan
önerilerin kalitesine bakılmalı (istem `sunucu/zeka/karakter.ts` içinde, tek
yerde). İsteğe bağlı: `ZEKA_MODEL` (varsayılan `claude-sonnet-5`),
`ZEKA_KURUS_1M_GIRDI` / `ZEKA_KURUS_1M_CIKTI` (girilmezse token sayılır, kuruş
sıfır yazılır — uydurma fiyatla marj hesaplatmıyoruz).

Memnuniyet listesinden **6, 4, 8 ve 12 bitti**; ayrıca **gece modu**
eklendi (ayrıntı aşağıdaki iki bölümde).

**Sıradaki iş artık pazar raporuna bağlı.** `../PAZAR.md` hedef sektörü
ihracatçı/B2B toptancı imalatçı ve lojistik-gümrük olarak işaret ediyor;
aşağıdaki "Yeni özellik listesi" o karara göre sıralandı. Önerilen sıra:

**A3 (cevapsız mail raporu) → B2 (kurulum sihirbazı) → A1 (çok dilli yanıt)
→ A2 (teklif takibi) → B1 (tahsilat) → C1 (yönlendirme modu).**

A3 yarım günlük iş ve satış görüşmesini baştan değiştiriyor: kutuyu bağla,
iki dakikada "şu 37 mail hiç cevaplanmamış" listesini göster. Veri zaten
duruyor, eksik olan tek ekran.

**Konuşma katlaması bir karar bekliyor.** Liste hâlâ mail başına bir satır;
konuşmalar tek satıra katlanmıyor. Sebebi sayaçlar: sekme rakamları
("sahipsiz", "geciken") mail üzerinden hesaplanıyor, konuşma katlanınca
"zincirin hangi maili sayılıyor" sorusunun cevabı belirsizleşiyor — filtreye
uyan eski mail yüzünden zincir listede kalır ya da uymayan yeni mail yüzünden
düşer. Katlama istenirse önce bu soru cevaplanmalı; benim önerim katlamamak.

Sırada duran işler listenin dışındakiler:

### Listenin dışında kalan eski işler

- **Logo.** İstendi, İngilizce prompt verildi, **logo henüz yok**. Geldiğinde
  `app/bilesenler/Ikon.tsx`'teki `zarf` amblemi iki yerde değişecek:
  `nav-marka .amblem` ve giriş sayfasındaki `.marka .im`.
- **Klasör adı.** Proje Mailhanem oldu ama klasör hâlâ `saas/mailhane/`.
  Dev sunucusu kapalıyken yeniden adlandırılmalı; sonra `.impeccable/`
  içindeki yol referansları ve DEVAM.md güncellenecek.
- **Microsoft OAuth.** Giriş sayfasında düğme var, tıklayınca "henüz
  bağlanmadı" diyor. Kutu bağlamada da aynı boşluk.
- **Tahsilat.** Abonelik ekranı ne anlaşıldığının kaydı; fatura kesmiyor.
- **Yapay zekâ adımı.** Anthropic anahtarı gerekiyor. Zemin hazır: kural
  motoru eliyor, yönlendirme kuralları elle sınıflandırıyor, `ai_kullanim`
  tablosu bekliyor. **Bağlandığı an** maliyet/marj kartları ve sağlık skorunun
  taslak bileşeni kendiliğinden dolar — o ekranlarda değişecek kod yok.

### Listeye yeni eklenenler — altyapı ve güvenlik (2026-09-26 taraması)

Ürün maddesi değil; ürün bittiğinde hâlâ eksik kalacak olanlar. Sıra kabaca
risk büyüklüğüne göre.

- ~~**A. Sürüm kontrolü yok.**~~ **Bitti (2026-09-26):** depo
  `github.com/devmurky/mailhanem` (private), ana dal `ana`. Ayrıntı aşağıdaki
  "Dört madde + sürüm kontrolü" bölümünde. **Klasör adı değişikliği artık
  güvenli** — kırılırsa dönecek yer var. Kalan parça: testleri otomatik koşan
  bir CI (şimdilik `npm run dene` elle çalıştırılıyor).
- **B. Giriş ucunda hız sınırı yok.** `app/api/giris-linki/route.ts` gövdeyi
  doğruluyor ama sayaç tutmuyor: bilinen bir adrese saniyede onlarca giriş
  maili tetiklenebilir. Sonuç sadece can sıkıcı değil — SMTP kotası ve
  gönderen itibarı yanar. Demo formunda Turnstile var, girişte yok. Gereken
  küçük: adres+IP başına pencere (ör. 5 dakikada 3) ve `/giris/dogrula`
  tarafında jeton deneme sınırı. Uygulamada `middleware.ts` yok, yani koruma
  uçlara tek tek yazılacak.
- **C. Yedek yok, WAL şişiyor.** `veri/mailhanem.db` 400 KB, yanındaki `-wal`
  4.2 MB: sunucu düzgün kapanmadığı için kontrol noktası alınmamış. Yedek
  betiği de yok. Zamanlayıcıya günlük bir iş: `VACUUM INTO` ile damgalı kopya,
  son yedi kopyayı tut, `veri/ekler/` de kapsansın. Geri dönüş adımları
  README'ye — denenmemiş yedek yedek değildir.
- **D. Yayına alma yolu tanımsız.** Dockerfile yok, servis dosyası yok, host
  kararı yok, alan adı bağlı değil, üretim SMTP/IMAP hesabı yok. "Üretim
  sunucusu oturum kapanınca ölüyor" notu bunun belirtisi. En az verilecek
  karar: nereye kurulacağı, süreç yöneticisi, TLS ve `MAILHANEM_ANAHTAR`ın
  nerede duracağı.
- **E. Ana anahtar kaybı ve döndürme.** `kasa.ts` zarf şifrelemeyi döndürmeye
  hazır tasarlamış (yalnız DEK'ler yeniden sarılır) ama çalıştıracak araç yok,
  anahtarın nerede yedeklendiği de yazılı değil. Anahtar kaybolursa kayıtlı
  bütün kutu parolaları çözülemez hale gelir. Küçük bir
  `araclar/anahtar-dondur.mjs` + iki satır belge.
- **F. Günlük ve ekler sınırsız büyüyor.** `veri/giden-mailler.log` 137 KB ve
  hiç dönmüyor, üstelik içinde giriş bağlantıları var. `veri/ekler/` için de
  saklama süresi yok. Bu aslında memnuniyet listesindeki 13. madde (veri imha)
  ile aynı karar: ek kaç gün saklanacak, o süre KVKK metnine yazılacak.
- **G. Hata görünürlüğü yok.** İşçi patlarsa, IMAP oturumu düşerse ya da
  zamanlayıcı turu hata alırsa bunu gören bir ekran yok; operatördeki Sağlık
  ekranı müşterinin sağlığını gösteriyor, sistemin değil. Küçük bir
  `sistem_olaylari` tablosu + Sağlık ekranında "son 20 hata" şeridi.
- **H. Dev kapısı sessizce açık kalabilir.** Kapatma listesi yukarıda duruyor
  ama unutulursa kimse uyarmıyor. `instrumentation.ts`'e tek koşul:
  `NODE_ENV=production` iken `DEV_KAPI` doluysa açılışta gürültülü uyarı — ya
  da doğrudan durdurma.
- **I. `.env.ornek` üç değişkeni yazmıyor:** `ALTYAPI_KURUS` (operatör maliyet
  ekranı okuyor), `DB_YOLU`, `EK_KLASORU`. Beş dakikalık iş; ama üretime
  kurarken eksik ortam değişkeni en can sıkıcı hata türü.

### Bilinmesi gereken beş kural

1. **`"use client"` taşıyan hiçbir dosya `sunucu/db.ts` import etmeyecek** —
   `node:sqlite` tarayıcı grafiğine girer ve Turbopack derlemeyi kırar.
   Sabitler ayrı dosyalarda: `ticketSabitleri.ts`, `kategoriler.ts`, `koku.ts`,
   `bilgiSabitleri.ts`. (Sunucu tarafı gerekirse oradan **yeniden dışa
   aktarıyor**: `OZEL_ONEK` böyle tek kaynakta duruyor.)
2. **Panel ekranları mail hattını import etmeyecek** (aynı sebep, eski kural).
3. **Ters bölü taşıyan yama heredoc ile yazılmayacak.** Python ya da Write
   kullan; `ESCAPE ''` tırnak kaçışına dönüşüp SQLite'ı düşürmüştü.
4. **`db.ts`teki SQL yorumlarına ters tırnak (`` ` ``) yazma.** Şema tek bir
   template literal'ın içinde; yorumdaki backtick literal'ı kapatıp dosyayı
   sözdizimi hatasına düşürüyor. Bu oturumda **iki kez daha** ısırdı. Tablo
   adını yorumda düz yaz.
5. **Geri doldurmalar (`konusmalariGeriDoldur`, `ozetleriTazele`) dosyanın
   sonunda çağrılıyor** — kullandıkları `const`lar kendi bölümlerinde ve
   yukarıdan çağrılınca "Cannot access ... before initialization" ile sessizce
   patlıyorlardı. Yeni bir geri doldurma da oraya eklenmeli.

---

## Tek karakter turu (2026-09-26, dördüncü tur)

Kullanıcı şunu söyledi: *"tüm panellerinde ana sayfada dahil tasarım olarak bir
karmaşıklık, sabit bir karakterde olmalı."* Haklıydı ve ölçülebilirdi.

### Ölçüm — aynı ürün üç ağızdan konuşuyordu

Hesaplanmış değerler (tahmin değil, tarayıcıdan okundu):

| | Ana sayfa | Müşteri paneli | Operatör |
|---|---|---|---|
| `--r` (kart) | 14px | 12px | 11px |
| `--r2` | 10px | 9px | 8px |
| Düğme | **hap (999px)** | 9px | 8px |
| Düğme ölçüsü | 15px / 14·24 | 13.5px / 9·15 | 13px / 7·13 |
| Sekme | — | **6px** (dördüncü yarıçap) | — |
| Mikro etiket | 11px | **10.5px** | **10.5px** |

Üç yarıçap ailesi, üç düğme türü, dördüncü bir sekme yarıçapı. Üstelik mikro
etiketler 10.5px'ti — PRODUCT.md'nin kendi taahhüdü **"işlevsel metin 11px'in
altına inmez"** diyor.

### Karar: sabitlenen yön kazanır

`.impeccable/surfaces/` içindeki yön sözleşmesi bileşen dilini zaten
yazmış: *"hap rozet, hap düğme, saç teli çerçeveli kart."* Yani karakter
tanıtım sayfasının dili; paneller ona uyacak, tersi değil.

- **Tek yarıçap ölçeği:** `--r:14px`, `--r2:10px`, `--r3:999px` — üç yüzeyde de.
  Operatör kendi kopyasını tutuyordu, kaldırıldı; kökten miras alıyor.
- **Düğme hap oldu**, üç ölçü kademesiyle. Sekmeler ve segment düğmeleri de hap.
- **Mikro tipografi 11px tabanına çekildi** (18 yer).
- **`--ayrac` 2.1:1 → 3.2:1.** Nokta ve eğik çizgi ayraçlar grafik tabanının
  (3:1) altındaydı. Adım rakamları (`#A5B8CB`) 2.0:1 → 3.1:1 oldu: DEVAM'da
  "bilinçli seçim" diye duruyordu ama PRODUCT.md'nin kendi tabanını deliyordu.
- **`.kuyruk-metin` sol çizgisi 2px → 1px** — kalite tabanının açık yasağı
  ("1px üstü renkli yan çizgi").

### Ana sayfada gece modu

Tanıtım sayfası kendi dosyası (`site/index.html`) ve kendi CSS'i olduğu için
gece modu oraya ayrıca kuruldu — ama **jeton adları ve değerleri panelinkiyle
birebir aynı**, iki dosyada tek palet var. Seçim de aynı anahtarda
(`mailhanem-tema`): siteden panele geçerken tema bozulmuyor.

Sabit renkler jetona bağlandı (`--ana-metin`, `--metin-uzeri`, `--ray-arka`,
`--golge`). `theme-color` meta etiketi de temayla değişiyor — telefonda
tarayıcı çubuğu sayfayla aynı renkte.

Gece temasında ana sayfada **düşük kontrastlı metin yok** (ölçüldü, 0 bulgu).

### Animasyon yeniden yazıldı

Zarf biçimli çokgen maske gitti. Kullanıcı sevmedi ve haklıydı: çokgenin
köşeleri ekranı süpürürken sert görünüyor, geçiş "açılma" değil "silme" gibi
okunuyordu. Yerine:

- **Daire** (`clip-path: circle()`) — kenarını tarayıcı yumuşatıyor, üstelik
  doğrudan aradeğerleniyor.
- **Üstel yavaşlama** `cubic-bezier(.22,1,.36,1)`, 620 ms. Öncekinin
  `.65,0,.35,1` eğrisi ortada hızlanıp sonda frene basıyordu.
- **İki katman birlikte oynuyor:** yeni katman ilk 240 ms'de saydamdan geliyor
  (açılan kenar sert bir çizgi olmuyor), eski katman %3 büyüyüp soluyor.

Geometri `app/bilesenler/temaAcilma.ts` içinde, 7 testle çivili (dört ekran
ölçüsü × beş düğme konumu: daire her durumda ekranı tam kapatıyor).

### Bu turda bulunan dört gerçek hata

1. **Gündüz temasında iki ikon birden görünüyordu.** `.tema-dugme span`
   seçicisi `.tema-gunes`ten daha özgüldü ve `display:none`u eziyordu.
   Kullanıcı ekran görüntüsüyle gösterdi.
2. **Geçiş hiç başlamazsa tema değişmiyordu.** Tarayıcı kare üretmiyorsa
   (arka plan sekmesi, küçültülmüş pencere) `startViewTransition`a verilen
   geri çağrı **hiç çalışmıyor** — ölçüldü. Kullanıcı düğmeye basıyor, hiçbir
   şey olmuyordu. 300 ms'lik güvenlik ağı eklendi.
3. **Her sayfa açılışında hydration uyarısı.** Tema betiği `data-tema`yı
   React'ten önce yazıyor. `suppressHydrationWarning` ile susturuldu.
4. **Operatör panelinde tema düğmesi yoktu.** O panel `YanNav` değil kendi
   `layout.tsx`ini kullanıyor; düğme oraya ayrıca eklendi.

### Detektör: kalan bulgular ve gerekçeleri

`impeccable detect` üç dosyada 19 bulgu veriyor. Kapatılmayanlar ve sebepleri:

- **Ayraç glifleri 3.2:1** — detektör bunları metin sayıp 4.5:1 istiyor. `·` ve
  `/` ayraç; bilgi taşımıyorlar, grafik tabanı (3:1) geçerli. 2.1:1'den
  çıkarıldılar, daha fazla koyulaştırmak ayraçları ayırdıkları metin kadar
  baskın yapardı.
- **Büyük harf mikro etiketler** — yön sözleşmesinin kendisi ("bütün mikro
  etiketler IBM Plex Mono, büyük harf").
- **Kayan yetenek şeridi (marquee)** — sözleşmede yazılı imza etkileşimi.
- **Instrument Sans "çok kullanılan font"** — sözleşmede sabitlenmiş.
- **`.ray-panel` dar dolgu** — yanlış pozitif: çocuklar `.kap` ile içeriden
  boşluklu (`width:min(1200px,100% - 56px)`).

---

## Yeni özellik listesi — pazar raporundan (2026-09-26)

Bu liste `../PAZAR.md`'deki analizden çıktı ve eski listelerin **yerine
geçmiyor**, onların üstüne bir öncelik koyuyor. Sıralamanın tek ölçütü var:
**hedef sektörün (ihracatçı/B2B toptancı imalatçı, lojistik-gümrük) bir mailin
parasını kaybetmesini engelliyor mu.**

Efor tahminleri bir oturumluk çalışma birimiyle: **S** yarım gün, **M** 1–2
gün, **L** 3+ gün.

### A. Hedef sektörü kazandıran üç madde

- **A1. Çok dilli yanıt — `M`.** Gelen İngilizce/Almanca/Rusça mail Türkçe
  özetlensin; yanıt taslağı **alıcının dilinde** çıksın. İhracatçının günlük
  derdi tam bu: alıcının dilinde hızlı ve düzgün cevap. `sunucu/zeka/` altyapısı
  hazır, istem ve bir alan eklemesi yetiyor. **Anahtar bağlanınca ilk yapılacak
  iş bu olmalı** — taslak özelliğini rakiplerden ayıran şey burası.
- **A2. Teklif takibi — `L`.** Maile "teklif verildi" damgası, tutar ve para
  birimi, hatırlatma tarihi, sonuç (kazanıldı / kaybedildi / cevapsız). Gelen
  kutusunu hafif bir satış hattına çeviriyor. İhracatçıya "kaç teklif verdim,
  kaçı cevapsız kaldı" sorusunun cevabını veren ekran, abonelik ücretini tek
  başına haklı çıkarır. Madde 5 ("bana hatırlat") bunun içinde eriyor.
- **A3. Cevapsız mail raporu (satış öncesi silahı) — `S`.** Kutuyu bağla, iki
  dakikada "şu 37 mail hiç cevaplanmamış, en eskisi 11 gün" listesi. Demo
  görüşmesinin ilk beş dakikasında gösterilecek şey bu; veri zaten var, ekran
  yok. **En ucuz ve en etkili madde.**

### B. Ürünün para kazanmasını sağlayan

- **B1. Tahsilat — `L`.** iyzico ya da PayTR ile abonelik, otomatik fatura.
  Abonelik ekranı bugün "ne anlaşıldığının kaydı"; para almıyor. Ürün ne kadar
  iyi olursa olsun bu olmadan gelir yok.
- **B2. Kurulum sihirbazı — `M`.** Kutu bağla → kural kur → ekip davet et →
  bilgi deposunu doldur, tek akışta. KOBİ kayıplarının **%43'ü ilk 90 günde**
  oluyor; bu madde hem tutma oranı hem de firma başına 2–4 saatlik kurulum
  emeğini (yani marjı) kurtarıyor.
- **B3. Kendi kendine kayıt — `M`.** Bugün firmayı operatör açıyor. 100 firmaya
  kadar sürdürülebilir, sonrası tıkanır. Demo talebinden otomatik firma açma +
  deneme süresi.

### C. Güveni satın alınabilir yapan

- **C1. Yönlendirme modu (IMAP'siz başlangıç) — `M`.** "Kutumun parolasını
  vermem" en sık duyulacak itiraz. Alternatif: firma `info@` kutusunda bir
  kopya yönlendirmesi açsın, biz yalnız kopyayı okuyalım. Yanıt kendi
  sunucularından gitmeye devam eder. Satışın önündeki en büyük psikolojik engeli
  kaldırıyor.
- **C2. Kutu bazında yetki — `S`.** "Muhasebe kutusunu sadece muhasebe görsün."
  Bugün firmanın bütün kutuları bütün ekibe açık; üç kutulu bir firmada bu
  satışı durdurur.
- **C3. Durum sayfası + kesinti kaydı — `S`.** Memnuniyet listesi 14. Mailini
  emanet eden firma "bugün çalışıyor mu" sorusunu soracak.

### D. Günlük işi hafifleten (memnuniyet listesinden devam)

- **D1. `5` Bana hatırlat — A2'ye bağlandı, ayrı yapılmayacak.**
- **D2. `7` @bahsetme — `S`.** Not sistemi hazır, üstüne küçük bir iş.
- **D3. `9` Devretme gerekçesi — `S`.** "Elif'e attım" değil, "çünkü fatura
  sorusu". Devretme eylemine tek alan.
- **D4. `10` Haftalık özet maili — `M`.** Pazartesi sabahı: kaç mail geldi, kaçı
  cevapsız, kim ne kadar baktı. **Ayrıca churn sinyali:** özet mailini açmayan
  firma gitmek üzeredir.
- **D5. `17` Kural şablonları — `S`.** "Fatura maillerini muhasebeye", tek tık.
  Kurulum sihirbazının içine girmeli.
- **D6. Ekip performans ekranı — `M`.** Kişi başına yanıt sayısı ve ortalama
  ilk yanıt süresi. Patronun görmek istediği ekran; yenilemeyi o karar veriyor.

### E. Sonraya — kararı ertelenen

- **E1. WhatsApp Business API — `L`+.** E-ticarete gidilecekse zorunlu, B2B
  ihracatta opsiyonel. Meta onayı, şablon mesaj süreci ve ayrı maliyet getiriyor;
  **hedef sektör netleşmeden başlanmamalı.**
- **E2. Mobil uygulama / PWA + bildirim — `L`.** Lojistikte değerli (saha),
  imalatta değil. Önce web panelin mobil hâli ölçülsün.
- **E3. Basit CRM / müşteri kartı — `M`.** Gönderen alan adına göre firma
  gruplama, geçmiş yazışma tek ekranda. Teklif takibi (A2) yapıldıktan sonra
  doğal devamı.
- **E4. Muhasebe entegrasyonu (Paraşüt/Logo) — `L`.** Gelen faturaların otomatik
  ayıklanıp aktarılması. Güçlü ama ayrı bir ürün; erken.
- **E5. Microsoft OAuth — `M`.** Giriş sayfasındaki düğme hâlâ boş. Hedef
  sektörün büyük kısmı cPanel/Turhost kullanıyor; Microsoft'çu firmalar
  gelmeye başlayınca yapılmalı, önce değil.

### Önerilen sıra

**A3 → B2 → A1 → A2 → B1 → C1**

Gerekçe: A3 yarım günlük iş ve satış görüşmesini değiştiriyor; B2 hem tutma
hem marj; A1 anahtar geldiği an farkı yaratan şey; A2 hedef sektörün asıl
derdi; B1 olmadan gelir yok; C1 satışın önündeki en büyük itirazı kaldırıyor.

---

## Dört madde + sürüm kontrolü (2026-09-26, ikinci tur)

Memnuniyet listesinin **6, 4, 8 ve 12**'si yapıldı ve proje artık **git
altında**. Her özellik ayrı commit; testler 224 → **257**.

### Depo — github.com/devmurky/mailhanem (private)

`saas/mailhane/` bir git deposu oldu, ana dal **`ana`**. `uygulama/.gitignore`
zaten doğruydu (`veri/`, `.env.local`, `node_modules/`, `.next/`,
`public/tanitim/`); köke `.gitattributes` eklendi (depoda LF, çalışma
kopyasında CRLF) ve `tsconfig.tsbuildinfo` izlenenlerden çıkarıldı. İlk commit
163 dosya. Commit öncesi sızıntı taraması yapıldı: dosya listesinde `.env.local`,
`veri/` ya da veritabanı yok — yalnız boş şablon `.env.ornek` var.

**GitHub CLI winget ile kuruldu:** `C:\Program Files\GitHub CLI\gh.exe`.
**PATH'te görünmüyor**, tam yolla çağır. Hesap `devmurky`, kimlik doğrulama
tarayıcıdan yapıldı (`gh auth login --web`), git kimlik yöneticisi bağlı.

`../PRODUCT.md` ve `../.impeccable/` depoya **girmedi**: `saas/` kökünde
duruyorlar, depo yalnız `mailhane/`. İstenirse taşınır ya da ikinci bir depo
açılır — taşımak `yakala.py` ve DEVAM'daki `../` yollarını kırar, o yüzden
kendiliğinden yapılmadı.

### Madde 6 — okundu/okunmadı

Listedeki kalın satır **durumu** okuyordu (`durum === "yeni"`). Yanlış cevap:
biri maili açıp kapatınca satır herkes için sönüyordu, oysa ortak kutuda okuma
kişiseldir.

- `mail_okumalari` — satır **yalnız okunmuşlar** için var; okunmamışlık kaydın
  yokluğu. Yeni mail hiçbir şey yazılmadan herkes için okunmamış, ekibe yeni
  katılan kuyruğu okunmamış görüyor, "okunmadı işaretle" satırı silmek demek.
- **"Okunmamış" sekmesi** — kişiye göre değişen tek sekme; sayacı da öyle.
- Mail detayında **okuma şeridi**: kim baktı (avatar + ad) ve "Okunmadı
  işaretle". Ekipten çıkarılan kişinin izi kalıyor (kullanıcı silinmiyor,
  kapatılıyor).
- **İşaret tarayıcıdan düşüyor** (`app/panel/mail/Okuma.tsx`). Sunucuda çizim
  sırasında yazmak en kısa yoldu ama Next bağlantıları önceden getiriyor:
  fareyi satırın üstünden geçirmek hiç bakılmamış maili okunmuş yapardı.
- Gelen kutusunda **kendiliğinden açılan önizleme okundu sayılmıyor** — yalnız
  kullanıcı bir satıra tıklayınca (`acikSecim`). Sayılsaydı panele her girişte
  en yeni mail sessizce okunurdu.
- Eylem yalnız **ilk** okumada `revalidatePath` çağırıyor; ikinci bakışta
  sayfayı yeniden kurmak boşuna göz kırpması olurdu.

### Madde 4 — klavye kısayolları

`j`/`k` sonraki-önceki mail, `r` yanıt kutusuna odak, `e` maili kapandı
işaretle, `/` aramaya geç, `?` kısayol penceresi, `Esc` çık.
(`app/panel/Kisayollar.tsx`.)

Üç kural: (1) **girdi alanlarında dinleyici hiç çalışmıyor** — yanıt
kutusundaki "e" harfi maili kapatmaz, tek istisna Esc; (2) her kısayol mevcut
bir düğmenin işini yapıyor, klavyeye özel yeni yetenek yok; (3) **görünmeyen
kısayol yok sayılır** — listenin başındaki `?` düğmesi pencereyi açıyor.

Klavyeyle seçilen satır `scrollIntoView({block:"nearest"})` ile görünür alana
çekiliyor. Kısayollar yalnız gelen kutusunda; `/panel/mail/[id]` paylaşılabilir
adres, triyaj akışı değil.

### Madde 8 — "şu an bu maile bakıyor"

- `mail_bakanlar` — cevabı satırın **varlığı** değil damganın **tazeliği**
  veriyor (`BAKIS_SANIYE = 45`): sekmesi kapanan kişi haber veremez. Bayat
  satırlar her bildirimde siliniyor, ayrı temizlik işi yok.
- Tarayıcı 20 saniyede bir haber veriyor (pencerenin yarısı, bir haber kaçsa da
  kimse kaybolmuyor); **arka plandaki sekme hiç vermiyor**. Yanıt kutusuna
  girip çıkmak anında bildiriliyor — uyarının değeri hızında.
- **İki ton:** "bakıyor" bilgi, "yanıt yazıyor" uyarı. Şerit **yanıt kutusunun
  hemen üstünde**: uyarının işe yaradığı an yazmaya başlamadan önceki an,
  ekranın tepesindeki bir bant o noktada kaydırılıp gitmiş olurdu.
- Eylem `revalidatePath` **çağırmıyor**: her 20 saniyede sayfayı yeniden
  çizmek, yazılan yanıtın ortasında olurdu. Cevap doğrudan çağırana dönüyor.
- **Demo vitrinine eklenmedi:** iki canlı kişi gerektiriyor, uydurma bir
  "bakıyor" satırı ürünün kendi kuralına aykırı olurdu.

### Madde 12 — veri dışa aktarma

Hesap Kaydı sayfasına (`/panel/gunluk`) üç indirme geldi: mailler (CSV),
destek talepleri (CSV), tüm veri (JSON). Uç: `app/api/disa-aktar/route.ts`,
gövde `sunucu/disaAktar.ts`.

- **CSV noktalı virgül ayraçlı ve BOM'lu.** Türkçe Windows'ta Excel'in
  varsayılan liste ayracı `;` ve BOM'suz UTF-8'i Latin-1 sanıyor: virgüllü
  "standart" CSV müşterinin ekranında tek sütunda bozuk karakter demekti.
  Makine tarafı için JSON var.
- Mail **gövdesi de dosyada** — eksik kopya kopya değildir. Tırnak ikileniyor,
  satır sonu tırnak içinde korunuyor.
- JSON künyesi **ne olmadığını** da yazıyor: kutu parolaları (kasada şifreli
  kalır, çözülüp dosyaya yazılmaz), oturum jetonları, eklerin kendisi.
  `kutular` sorgusunda `parola_sifreli` sütunu hiç seçilmiyor.
- **Yetki uçta kesiliyor:** personel alamıyor, operatör bu uçtan indiremiyor
  (servis sahibinin bütün firmaları tek tıkla dosyalaması, müşterinin hesap
  kaydında görünmeyen bir yetki olurdu), firma sınırı oturumdan geliyor.
- Her indirme hesap kaydına **"Veri kopyası"** olarak düşüyor — yeni günlük
  tipi `veri`, iki panelde de etiketlendi.

### Bu turda çıkan tuzak

**Test dosyasındaki statik import gerçek veritabanını açtı.** `disaAktar.test.ts`
modülü tepeden `import` edince `db.ts` ortam değişkenleri kurulmadan yüklendi
ve testler `veri/mailhanem.db`'ye bağlandı; ilk `INSERT` benzersizlik kuralına
takılıp durdu (veri yazılmadı, kontrol edildi). Kural: **test dosyaları
`sunucu/` altındaki hiçbir modülü statik import etmeyecek** — `DB_YOLU`
satırından sonra `await import()` ile yüklenecek. `konusma.test.ts` bunu zaten
doğru yapıyordu; saf modüller (`posta/konusma.ts` gibi) istisna.

İkinci küçük tuzak: JSX'i import'tan önce eklemek Fast Refresh'i
"X is not defined" ile düşürüyor ve hata tarayıcı günlüğünde asılı kalıyor.
Önce import, sonra kullanım.

---

## Ana sayfa: KVKK, paylaşım görseli ve temizlik

Ana sayfa gerçekten tarandı (kırık çapa, etiketsiz alan, alt metin, mobil
taşma, meta etiketler, detektör). Bulunan gerçek boşluklar kapatıldı.

### KVKK aydınlatma metni — en sert boşluktu

Site kayan şeritte **"KVKK uyumlu"** diyordu ve demo formu ad, firma, e-posta,
telefon topluyordu; ama toplandığı yerde tek satır aydınlatma yoktu ve
`/kvkk` **404** dönüyordu. Uyumlu olduğunu iddia edip temel yükümlülüğü
atlamak, hiç iddia etmemekten kötü.

Eklendi: **`/kvkk` sayfası** (`app/kvkk/page.tsx`) + **formun içinde**, gönder
düğmesinin hemen üstünde bir aydınlatma satırı + footer'da bağlantı.

Metnin kendi kuralı: **yalnız bugün gerçekten yapılan işlemler yazıyor.**
- Ayrım net: siteden gelen demo talebinde Mailhanem **veri sorumlusu**, panele
  bağlanan kutuda **veri işleyen**. İkisinin hukuki durumu farklı.
- "Yapay zekâ adımı henüz bağlı değildir, mail içeriği hiçbir dil modeline
  gönderilmemektedir" **açıkça yazıyor** — bağlanınca metin güncellenecek.
- Ticari unvan/adres/iletişim Site Ayarları'ndan geliyor; **girilmediği sürece
  o satırlar hiç görünmüyor** ve yerine "uydurma adres yazmaktansa boş
  bırakıldı" notu çıkıyor.
- Sayfanın dibinde **"bu bir taslaktır, hukukçu görmeli"** uyarısı var.

### Paylaşım görseli (og:image)

`og:title` ve `og:description` vardı ama **`og:image` yoktu**: WhatsApp,
LinkedIn ve X'te bağlantı görselsiz çıkıyordu. B2B'de site çoğunlukla
WhatsApp'tan paylaşılıyor, yani bu eksik doğrudan tıklanmayı düşürüyordu.

Çözüm diskte dosya değil, **`app/og.png/route.tsx`** — `next/og` ile çalışma
anında üretiliyor (1200×630, ~77 KB PNG, Türkçe karakterler yerinde).
Sebebi: başlık değişince birinin Photoshop açıp yeniden dışa aktarması
gerekmesin. `twitter:card` ve `og:locale` de eklendi.

### Küçük temizlik

- **`robots.txt`** ve **`sitemap.xml`** eklendi. Panel, giriş, `/api/`, `/ek/`
  ve `/demo` dizine girmiyor — demo vitrini her ziyarette sıfırlanan uydurma
  veri, arama sonucuna düşmemeli.
- **Kendi soktuğum kicker kaldırıldı.** Demo bandına "Denemesi bedava"
  eyebrow'u koymuşum; kalite tabanının kesin yasağı. Detektör 23 → 22.
- **İki ölü dosya silindi:** `site/artefakt.html` ve
  `site/_eski-kutu-duvari.html` (127 KB, vazgeçilen konseptin kalıntısı).

### Bir hata: footer bağlantısı yanlış yere gitti

Betik `Panele giriş` satırının **ilk** eşleşmesini değiştirdi; o da footer
değil **mobil menüydü**. Düzeltildi — KVKK bağlantısı artık footer'da, mobil
menü temiz. İki yerde aynı metin varken "ilk eşleşme" yeterli bir ölçüt değil.

### Kapatılmayan iki şey

1. **Kontrast:** adım rakamları (`01/02/03`) `#A5B8CB`, ölçülen **2.0:1** —
   büyük metin için 3:1 gerekiyor. DEVAM'a göre bu renk dört seçenek
   karşılaştırılarak **bilinçli** seçilmiş, o yüzden tek taraflı
   değiştirilmedi. Karar kullanıcının.
   (`--ayrac` #A8B3BE de düşük ama yalnız `·` ve `/` ayraçlarında kullanılıyor —
   dekoratif, anlam taşımıyor; sorun sayılmadı.)
2. **Kurumsal kimlik:** ticari unvan, adres, MERSİS. Mesafeli satış mevzuatı
   açısından gerekli; Site Ayarları'na alan eklenip KVKK sayfasına ve footer'a
   bağlanmalı.

---

## Müşteri memnuniyeti listesi — 1, 2, 3, 4, 6, 8, 11 ve 12 BİTTİ

Sıralama etki/maliyet oranına göre. Önerilen öncelik 1 → 3 → 2 → 11'di;
**dördü de yapıldı** (aşağıda "Bu turda yapılanlar"). Kalanlar numaraları
korunarak duruyor.

### Müşterinin doğrudan hissedeceği
1. ~~**Mail imzalarını otomatik kırp**~~ — **bitti.** `sunucu/posta/imza.ts`.
2. ~~**Konuşma görünümü (thread)**~~ — **bitti** (liste katlaması hariç;
   yukarıdaki karar notuna bak). `sunucu/posta/konusma.ts` + `mailler.konusma`.
3. ~~**Taslak otomatik kaydı**~~ — **bitti.** `yanit_taslaklari` tablosu.
4. ~~**Klavye kısayolları** (`j/k`, `e`, `r`)~~ — **bitti.**
   `app/panel/Kisayollar.tsx`; `/` ve `?` de var.
5. **"Bana hatırlat"** — maile kişisel takip koyabilmek.
6. ~~**Okundu/okunmadı ayrımı**~~ — **bitti.** `mail_okumalari` +
   "Okunmamış" sekmesi + detaydaki okuma şeridi.

### Ekip çalışması
7. **@bahsetme** (ekip notunda) — not sistemi hazır, üstüne küçük bir iş.
8. ~~**"Şu an bu maile bakıyor"**~~ — **bitti.** `mail_bakanlar`, 20 sn'de
   bir yoklama, yanıt kutusunun üstünde iki tonlu şerit.
9. **Devretme gerekçesi** — "Elif'e attım" değil, "çünkü fatura sorusu".
10. **Haftalık özet maili** — pazartesi sabahı ekip özeti.

### Güven ve şeffaflık
11. ~~**Müşteri kendi denetim kaydını görsün**~~ — **bitti.** `/panel/gunluk`.
    Üstelik ortaya çıkan asıl boşluk kapandı: **hiçbir giriş kaydı
    yazılmıyordu**, oysa operatör ekranı "her giriş bu listede" diyordu.
12. ~~**Veri dışa aktarma** (mail + ticket, CSV/JSON)~~ — **bitti.**
    `/panel/gunluk` altında; her indirme hesap kaydına düşüyor.
13. **Hesap silme / veri imha** — KVKK'nın da gereği.
14. **Durum sayfası** (uptime, son kesinti).

### Kurulum ve ilk gün
15. **Kurulum sihirbazı** — kutu bağla → kural kur → ekip davet et.
16. **Boş ekran rehberliği** — boş gelen kutusunda "İlk çekimi başlat".
17. **Kural şablonları** — "Fatura maillerini muhasebeye", tek tıkla.

---

## Bilgi Deposu + ticket arayüzü (2026-09-26)

### Bilgi Deposu — `/panel/bilgi`

Yanıt taslağı adımının eksik yarısı: modelin **firmayı tanıması**. Ne sattığı,
nasıl konuştuğu, kargonun kaç günde gittiği hiçbir yerde durmuyordu.

**Üç tablo, tek sebep — modelin ürettiği hiçbir şey onaylanmadan depoya
girmiyor:**

- `karakter_alanlari` — hazır beş alan (tanım, ses tonu, hitap, yanıt kuralları,
  imza) **artı yöneticinin kendi eklediği maddeler** (anahtar `ozel:<slug>`,
  başlık ayrı sütunda). Sütun değil **satır** olarak: her alan kendi kaynağını
  ve damgasını taşıyor, yeni alan eklemek şema göçü istemiyor. Hazır beşli
  silinmiyor (boşaltılınca yerinde duruyor), özel madde silinebiliyor.
- `bilgi_kartlari` — tekrar eden gerçekler; kategorileri mailin kategorileriyle
  aynı sözlükten.
- `bilgi_onerileri` — modelin çıktısı, onay bekliyor. Onaylanınca ilgili
  tabloya "çıkarımdan onaylandı" damgasıyla geçiyor; **elle düzenlenince damga
  "elle"ye dönüyor** — kaynak yalan söylemesin.

Ayrıca `bilgi_cikarimlari`: her tur (hatalı olan dahil) kim başlattı, neye
bakıldı, ne çıktı diye yazılıyor. Günde bir kez sınırının dayanağı da bu tablo —
ve **hatalı tur sınırı doldurmuyor**, model bir kez patladı diye kullanıcı
ertesi güne kilitlenmesin.

**Çıkarım (`sunucu/zeka/`):** giden yanıtlar firmanın sesini (karakter), gelen
mailler müşterinin ne sorduğunu (kartlar) veriyor. Gövdelerin imza/alıntı
kuyruğu `imzaAyir` ile kırpılıyor — bir gün önce yazılan modül burada ikinci kez
işe yaradı: hem gürültü hem gereksiz kişisel veri (telefon, adres) modele
gitmiyor. Testte bu **çivilenmiş** durumda ("modele giden metinde imza kuyruğu yok").

SDK eklenmedi; Anthropic Messages API'sine düz `fetch`. Model `ZEKA_MODEL` ile
ayarlanıyor (varsayılan `claude-sonnet-5`). Maliyet `ai_kullanim`a yazılıyor,
birim fiyat girilmemişse kuruş sıfır kalıyor ama **token yine kaydediliyor** —
uydurma fiyatla marj hesaplatmaktansa "fiyat girilmemiş" demek doğru.

**Anahtar yokken:** ağa hiç çıkılmıyor, ekranda düğme yerine "model bağlı
değil — ANTHROPIC_ANAHTAR tanımlı olmadığı için çıkarım çalışmıyor" satırı var
ve depo elle doldurulabiliyor. Bu, çalışmayan bir düğme koymaktan iyi.

**KVKK metni artık yapılandırmaya bakıyor.** Sayfa "mail içeriği hiçbir dil
modeline gönderilmemektedir" diyordu; anahtar eklendiği an bu cümle yalan
olacaktı. Paragraf `zekaBagliMi()`ye bağlandı: anahtar varken hangi sağlayıcıya
ne gittiği, neyin kırpıldığı ve kimin başlattığı yazıyor.

**Yetki:** sahip + yönetici (`kurulumGorur`). Personel nav'da görmüyor, sayfa
`/panel`'e yönlendiriyor — `/panel/gunluk` ile aynı desen. Nav'daki rozet onay
bekleyen öneri sayısı.

Demo vitrini de dolduruldu: dört karakter alanı (ikisi "çıkarımdan onaylandı"),
üç kart ve **onay bekleyen iki öneri** — akışın kendisi de vitrinde görünsün.

### Kapanış turu: eksik uçlar

İş bittikten sonra bir tarama daha yapıldı; yeni özellik değil, **açık kalmış
uçlar**:

- **Anahtarın iki adı vardı.** Operatördeki "Sistem ve Anahtarlar" ekranı
  `ANTHROPIC_API_KEY`e bakıyordu (bu iş yazılmadan önce oradaydı), yeni kod ise
  `ANTHROPIC_ANAHTAR` okuyordu. Anahtar girilene kadar kimse fark etmezdi:
  ekran "bağlı" der, çıkarım çalışmazdı. **İkisi de kabul ediliyor artık**
  (Türkçe ad öncelikli) ve ekran aynı kapıdan (`zekaBagliMi`) okuyor.
- **Test yalıtımı.** `zeka.test.ts` yalnız `ANTHROPIC_ANAHTAR`ı siliyordu;
  geliştirme makinesinde `ANTHROPIC_API_KEY` tanımlı olduğu için "anahtar
  yokken" testleri yanlış dalı deneyebilirdi. İkisi de siliniyor; iki adın da
  çalıştığını çiviliyen test eklendi.
- **Maliyet ekranı ham slug yazıyordu** (`karakter`, `siniflandirma`). Okunur
  ad sözlüğü eklendi (`AI_IS_TURU_AD`); tanınmayan tür ham yazılmaya devam
  ediyor — sessizce "diğer" demek yeni bir iş türünü görünmez yapardı. "Model
  bağlı değil" paragrafı da güncellendi: ilk satırın bilgi deposu çıkarımıyla
  düşeceğini ve kuruş için birim fiyat gerektiğini söylüyor.
- **Operatör müşteri çekmecesine "Bilgi deposu" bölümü** eklendi: kaç dolu
  madde, kaç kart, kaç öneri bekliyor, son çıkarım ne zaman. Operatörün sorusu
  "bu müşteri taslak adımına hazır mı" — cevabı artık çekmecede.
- **Genel Bakış'taki taslak kartı** Bilgi Deposu'na bağlandı (yalnız
  sahip/yönetici görüyor; personelde sayfa kapalı).
- `OZEL_ONEK` tek yerde (`bilgiSabitleri.ts`); düzenleme ekranı `"ozel:"`
  dizgisini elle taşıyordu.

### Geniş ekran turu (2K dizüstü) ve yakalanan üç hata

Kullanıcı 2K 17" ekranda baktı, üç şey çıktı:

1. **Ekleme formları sağ üstte asılı kalıyordu.** "Kart ekle", "Şablon ekle",
   "Kutu bağla", "Kural ekle", "Ekip üyesi davet et" — beşinde de form,
   düğmenin yerinde (`margin-left:auto` ile sağa yaslı) açılıyordu. Dar ekranda
   fark edilmiyor; 1900 pikselde form sağ yarıda asılı duruyor ve başlıkla
   arasında kocaman bir boşluk kalıyordu. Düzeltme tek kural: `.ust-ekle`
   kapalıyken sağda küçük düğme, `:has(.kutu)` ile açılınca tam genişliğe inip
   başlığın altına geçiyor. Bilgi deposunda bölüm başlığı bileşenin içine
   alındı (`KartBolumu`, `KarakterBolumu`).
2. **Dosya ekleme satırı savruluyordu.** Bir tur önce ipucu metnini satır içine
   almıştım; geniş ekranda formun sağ ucuna uçup alanla ilgisi kopuyordu.
   Satır artık 680 pikselle sınırlı, üçü bir arada duruyor.
3. **Panel genişlikleri sabitti.** `.sayfa` 1180px'te kalıyor, 2K'da ekranın
   üçte biri boş duruyordu. Artık `clamp(1180px, 92vw, 1920px)`; operatörde
   `clamp(1320px, 88vw, 1860px)`. Gelen kutusunda liste sütunu
   `clamp(392px, 22vw, 520px)`, detay gövdesi `clamp(840px, 58vw, 1280px)` ve
   sütunun ortasında. **Okuma ölçüsü bozulmuyor:** mail gövdesi 70ch, açıklama
   78ch, ticket formu 860px ile sınırlı kalıyor — genişleyen şey kabuk, satır
   değil. 1500 pikselin üstünde bilgi deposu kartları, karakter maddeleri ve
   öneriler iki sütuna açılıyor.

**Bir de istenen özellik:** karakter artık hazır beş alanla sınırlı değil;
yönetici kendi maddesini ekleyebiliyor ("Kampanya dili", "Bayi yazışması").
Anahtar `ozel:<slug>`, başlık ayrı sütunda; aynı başlık ikinci kez eklenirse
anahtara sayı ekleniyor. Hazır beşli silinmiyor (boşaltılınca yerinde duruyor),
özel madde silinebiliyor — başlık yöneticinin emeği, boşaltmak silmek değil.

### Ticket arayüzü yeniden dengelendi

Kullanıcı "orantısız" dedi; ölçüldü, haklıydı. 1440px'te sağ sütunun 642
pikselinin yalnız **100'ü yazışmaydı (%15)**, 364'ü yanıt formu (%57). Ekranın
asıl işi en küçük bloktu.

Yapılanlar (iki panelde de, ortak CSS paylaşıldığı için tek iş):

- **Başlık kart olmaktan çıktı**, tek şeride indi (`.t-ust`) — mail
  detayındaki triyaj şeridiyle aynı karar.
- **Operatörün kolları tek satırda** (`.t-serit`): durum, öncelik, harcanan
  zaman. Üçü ayrı bloktayken yazışmadan çok yer tutuyordu.
- **Yanıt kutusu etek oldu**: dosya alanı tek satıra indi, metin kutusu kısaldı.
- **Dört büyük sayı kartı** ince varyanta geçti (`.kartlar.ince`): dört rakam da
  duruyor, 108px → 66px.
- Liste sütunu daraldı, yoğunlaştı ve yapışkan oldu (dar ekranda değil —
  orada yazışmanın üstüne binerdi).

Sonuç: müşteri tarafında sağ sütun 642 → 458px, yanıt kutusu 364 → 268px;
operatörde 732 → 492px. Yazışma artık başlığın hemen altında.

**Küçük bir hata da düzeldi:** liste başlığı ("Talepleriniz · 1 açık") gelen
kutusundan gelen `flex-direction:column` yüzünden dar sütunda ortalanıyordu.

---

## Bu turda yapılanlar (memnuniyet listesi 1, 3, 2, 11)

### Madde 1 — İmza ve alıntı kuyruğu ayrıldı

`sunucu/posta/imza.ts` (saf modül, veritabanı yok): gövdeyi asıl mesaj ve
kuyruk diye ikiye ayırıyor. **Özete yalnız asıl mesaj giriyor** — listede alt
alta duran on mailin önizlemesi "Tel: 0212 … · www…" diye başlayınca hiçbiri
ayırt edilemiyordu. Mail detayında kuyruk katlanmış duruyor ("İmza · 6 satır").

İki kural, ikisi de bilinçli:

- **Kuyruk silinmiyor, ayrılıyor.** Gövde veritabanında tam; ayırma her
  gösterimde yeniden yapılıyor, yani kural düzelince eski mailler de düzeliyor.
- **Şüphedeyse kesmiyor.** Yanlış kesme mesajın son paragrafını gizler; kesmemek
  yalnızca özeti kirletir. Her kesme kuralının testte bir de "kesmemeli"
  örneği var.

Kesme işaretleri sırayla: RFC ayracı (`--`), alıntı başlıkları ("… şunu yazdı:",
"On … wrote:", Outlook'un `From:/Sent:/Subject:` bloğu), yasal uyarı, kapanış
cümlesi + kısa blok, son çare olarak iletişim izi taşıyan son blok.

**Bir tuzak:** ilk `>` satırında kesmiyoruz. Alıntının *altına* yazan insanlar
var; orada kesseydik onların kendi cümlesi kaybolurdu. Alıntı satırları
eskiden olduğu gibi yalnız özetten eleniyor.

**Katlama eşiği ekranda, kuralda değil:** iki satırlık imza ("Teşekkürler, /
Ayşe Demir") katlanmıyor — düğme kazandığından fazla yer tutuyor. Alıntı ve
yasal uyarı her boyda katlanıyor.

**Eski özetler de tazelendi.** Özet çekim anında yazılıyor; kural sonradan
değişince eski satırlar eski hâliyle kalıyordu, yani yeni mail gelene kadar
listede hiçbir şey düzelmiş görünmüyordu. `ozetleriTazele()` gövdesi saklanan
her mailin özetini bir kez yeniden üretiyor (canlı veritabanında 56 mail) ve
arama dizinini de yazıyor. Damga `ayarlar.ozet_imza_surumu`: kural değişirse
numara artırılıp pas bir kez daha atılır.

Kırpmanın **bilerek kesmediği** bir örnek canlı veride duruyor: "Murat Sen /
Satinalma" — iletişim izi (telefon, site, adres) taşımayan ad+unvan bloğu imza
sayılmıyor. Kesseydik "Ahmet Bey'i arayın" diye biten bir mailin son satırını
da keserdik.

### Madde 3 — Taslak otomatik kaydı

`yanit_taslaklari` tablosu, anahtar **(mail, kullanıcı)**. Yazma durduktan 1,2
saniye sonra kaydediliyor; sekme arkaya atılınca (`visibilitychange`) ve başka
maile geçilince (bileşen kapanırken) bekleyen metin hemen gidiyor.

- **Taslak kişiye ait.** Aynı maile yazan iki kişi birbirinin metnini ezmiyor,
  kimse başkasının yarım yazısını görmüyor.
- **Kayıt eylemi `revalidatePath` çağırmıyor.** Çağırsaydı her birkaç saniyede
  bir sayfa yeniden çizilir, yazarken imleç oynardı.
- **Satır ne olduğunu olduğu gibi yazıyor:** "Taslak kaydedildi · 14:32",
  kaydedilemezse "metni kopyalayıp saklayın". Kaydedilmemiş metni kaydedilmiş
  göstermek, hiç göstermemekten kötü.
- Gelen kutusunda **"taslak" rozeti** — yalnız kendi taslağınız için.
- Yanıt gidince taslak siliniyor.

**Bir tuzak:** `<YanitFormu key={mail.id}>` şart. Gömülü kullanımda maildan
maile geçerken React bileşeni aynı yerde yeniden kullanıyor ve `defaultValue`
güncellenmiyordu — anahtar olmadan bir mailin taslağı ötekinin kutusunda
görünürdü.

### Madde 2 — Konuşma zinciri

`mailler.konusma` sütunu: zincirin ilk mailinin Message-ID'si. Çözüm iki yoldan
(`sunucu/posta/konusma.ts` + `konusmaCoz`):

1. **Başlık zinciri** (`In-Reply-To` / `References`). **Bizim gönderdiğimiz
   yanıtların** Message-ID'lerine de bakılıyor — yoksa zincir tam bizim
   yazdığımız yerde kopuyordu: müşteri bizim cevabımıza cevap verince yeni bir
   konuşma açılırdı.
2. **Konu + gönderen**, aynı kutuda, 60 gün içinde. Konu kökü Re:/Ynt:/Fwd:
   kırpılarak ve Türkçe harfler katlanarak karşılaştırılıyor.

"Aynı gönderen" şartı bilinçli: "Merhaba" konulu iki müşteriyi tek konuşmada
birleştirmek, ayrı bırakmaktan **çok daha ağır** bir hata — biri ötekinin
yazışmasını okurdu.

Ekranda: mail detayında gövdenin üstünde **Konuşma şeridi** (gelen mailler +
giden yanıtlar tek akışta, eskiden yeniye, okunan işaretli), listede **"3
mesaj" rozeti**. "Giden yanıtlar" bölümü artık konuşmanın tamamının yanıtlarını
gösteriyor; "Aynı gönderenden" bölümünden bu konuşmanın mailleri düşülüyor.

**Eski mailler geri dolduruluyor** (`konusmalariGeriDoldur`): `In-Reply-To`
başlıkları hiç saklanmadığı için yalnız yedek kural çalışıyor. Zinciri
bulunamayan mail kendi kimliğini alıyor — "konuşması olmayan mail" diye bir
durum bırakılmadı.

**Dört tuzak çıktı, ikisi tarayıcıda doğrulama sırasında:**

- `CREATE INDEX ... ON mailler(konusma)` şema bloğunda duramıyor: o blok sütunu
  henüz olmayan eski bir veritabanında da çalışıyor ve "no such column" ile
  açılışı düşürüyordu. Dizin `sutunEkleGerekirse`'den **sonra** kuruluyor.
  Bunu `ftsGoc.test.ts` yakaladı — tam bu iş için yazılmış test.
- SQL yorumundaki ters tırnak (`` ` ``) template literal'ı kapattı ve db.ts'i
  sözdizimi hatasına düşürdü. DEVAM'daki üçüncü kural yine ısırdı.
- **Geri doldurma bütün maillere boş zincir yazdı** ve üstelik "22 mail
  konuşma zincirine bağlandı" diye başarı bildirdi. Sebep: geri doldurma
  sırasında bütün satırların `konusma` sütunu boş, yedek kural o satırlardan
  birini aday bulup **boş dizgi** döndürüyor ve `??` boş dizgiyi yakalamıyor.
  İki yerden düzeltildi: aday sorgusuna `konusma <> ''` koşulu, ve `??` yerine
  `||`. Testi `konusma.test.ts` içinde ("zinciri kurulmamış aday eşleşmeyi
  bozmaz") — düzeltmeyi geri alınca gerçekten kırılıyor, denendi.
- **Geri doldurma çağrıları dosyanın sonuna taşındı.** `konusmaCoz`, bölümünün
  başındaki `const KONUSMA_PENCERE_GUN`u okuyor; dosyanın ortasından çağrılınca
  sabit henüz tanımlı olmuyor ve "Cannot access ... before initialization" ile
  patlıyordu. Hata yutulup günlüğe yazılıyordu, yani **sessizce** her açılışta
  başarısız oluyordu. `function` bildirimleri yukarı taşınır, `const` taşınmaz.

Bu ikisinin ortak dersi: geri doldurmanın "başarılı" günlük satırı yazması, işi
yaptığı anlamına gelmiyor. İkisi de yalnız **veritabanına bakınca** görüldü —
kod ve testler yeşildi.

### Madde 11 — Müşterinin kendi denetim kaydı

`/panel/gunluk` — **Hesap Kaydı**. Sahip ve yönetici görüyor, personel
görmüyor. Firmanın kendi satırları; sistem satırları (firma_id boş) ve başka
firmanın satırları sorgunun koşulunda eleniyor.

**Asıl boşluk buradaydı:** operatör ekranı "bir müşteri paneline yapılan her
giriş bu listede sarı zeminle işaretli" diyordu ama **hiçbir yerde `giris`
türünde satır yazılmıyordu.** Artık her oturum açılışı bir satır bırakıyor
(`girisKaydiYaz`, `oturumAc` içinden). Operatörün girişi firmaya bağlanmıyor —
arka ofise girmek müşterinin hesabına girmek değil; müşteri paneline giriş yolu
açıldığında o satır firma numarasıyla yazılacak.

Kural `db.ts`te duruyor, `oturum.ts`te değil: o dosya `next/headers` import
ettiği için düz Node'da açılamıyor ve testle çivilenemiyordu.

### Demo vitrini de güncellendi

Üç şey vitrinde görünsün diye: Kemal Arslan'ın mailine gerçek bir kurumsal imza
(altı satır + yasal uyarı), Ayça Tuncel'in yazışmasına ikinci bir mesaj ve
araya bizim gönderdiğimiz yanıt — yani üç mesajlık bir konuşma.

---

## 14 maddelik özellik listesi — TAMAMI BİTTİ

Kullanıcı önerilen 14 özelliğin tamamını istedi. Bitenler aşağıda; kalanlar
listenin sonunda, numaraları korunarak.

### Biten 1 — Demo formuna Turnstile

Asıl açık buydu: giriş formu korunuyordu ama demo formu **veritabanına yazıyor
ve operatöre iş çıkarıyordu**. Artık `/api/demo-talebi` jeton doğruluyor.

- Jeton **başlıkta** (`x-turnstile`), gövdede değil: uç gövdeyi hiç
  ayrıştırmadan karar veriyor, sahte istek veritabanına yaklaşmıyor.
- Site anahtarı sayfaya gömülü değil, `/api/site-ayar`'dan geliyor ve
  **yalnız iki anahtar birden varken** gönderiliyor — yarım kurulumda widget
  çizip doğrulanamayan jeton üretilmesin.
- Widget açık (explicit) çiziliyor çünkü anahtar sonradan geliyor.
  `interaction-only`, yani çoğu ziyaretçide hiç görünmüyor.
- Başarısız denemede widget **sıfırlanıyor**: jeton tek kullanımlık, yoksa
  ikinci deneme kesin reddedilirdi.

**Denendi:** jetonsuz istek **403**, deneme jetonuyla **201**.

### Biten 2 — Destek dakikası girişi

Net marjın eksik yarısı buydu: `destek_kayitlari` tablosu vardı ama yazan yoktu.
Ticket ekranına "Harcanan zaman" bloğu eklendi — 5/15/30/60 dk hazır düğmeler
ve serbest alan.

Kayıt **firmaya** yazılıyor, ticketa değil: marj firma başına hesaplanıyor ve
aynı iş için açılan ikinci ticket zamanı bölmemeli.

**Denendi ve boru hattı çalıştı:** 30 dk girildi → Genel Bakış'taki "Destek
yükün" kartı `—` yerine **0,5 sa · ₺375 karşılığı** oldu, müşteri tablosundaki
"Destek sa." sütunu **0,5** oldu, sağlık skoru 100 → 98'e düştü (destek
bileşeni artık ölçülebiliyor). Net marj hâlâ `—` — yapay zekâ tarafı eksik,
doğru davranış.

### Biten 14 — Ekip içi not

Mailin altında, yanıt kutusundan **ayrı** bir kutu. Bu metin hiçbir zaman
gönderilmiyor; ikisini karıştırmak iç konuşmayı yanlışlıkla müşteriye
göndermek demek olurdu. O yüzden zemin uyarı tonunda ve düğme "Not ekle",
"Gönder" değil. Silme yalnız kendi notunda — başkasınınkini silmek geçmişi
bozar.

### Bu turda açılan şema

| Tablo / sütun | Ne için | Bugün |
|---|---|---|
| `ekler` | mail ekleri **ve** ticket dosyaları (madde 5, 10) | boş, yazan yok |
| `mail_notlari` | ekip içi notlar (madde 14) | **kullanımda** |
| `ticketlar.mail_id` | ticket ↔ mail bağı (madde 3) | sütun var, arayüz yok |

`ekler` tek tablo çünkü ikisi de "bir kayda bağlı ikili dosya" ve saklama
kuralı aynı. İçerik veritabanında değil diskte (`veri/ekler/`) — SQLite'a
megabaytlık blob koymak dosyayı şişirir ve yedeklemeyi ağırlaştırır.

### Biten 3 — Ticket ↔ mail bağı

Yeni talep formunda "İlgili mail" seçicisi (son 25 mail). Numara formdan
geldiği için **firma sınırıyla birlikte** aranıyor: başka firmanın maili
iliştirilemez. Bağlıysa iki panelde de mavi bir kart olarak görünüyor;
müşteri tarafında tıklanınca maile gidiyor.

### Biten 5 — Ticket eki

Hem yeni talepte hem yanıtta dosya eklenebiliyor. `sunucu/ekDosya.ts`:

- **Beyaz liste** tip kontrolü — çalıştırılabilir bir şeyin sunucuya inip
  indirilebilir olması istenmiyor.
- 10 MB sınır; aşan dosya **sessizce kesilmiyor**, reddediliyor ve sebebi
  yazılıyor.
- Önce hepsi denetleniyor, sonra hepsi yazılıyor: üçüncü dosya reddedilirken
  ilk ikisinin diskte kalması, görülen hata ile gerçek durumu ayırırdı.
- Disk adı **veritabanından üretiliyor**, kullanıcının verdiği addan değil —
  `..\..\etc\passwd` gibi bir ad yolu kırardı. Görünen ad ayrı sütunda.
- İçerik diskte (`veri/ekler/`), künye veritabanında.

**İndirme ucu `/ek/[id]` yetkiyi kendisi kesiyor:** operatör hepsini, müşteri
yalnız kendi firmasının ekini alabiliyor. Erişilemeyen ek **404** dönüyor,
403 değil — 403 o numarada bir ek olduğunu ele verirdi. `Content-Disposition:
attachment` + `nosniff`: yüklenen bir HTML/SVG bizim kökenimizde çalışmasın.

### Biten 7 — Operatörden kutu yeniden bağlama

Kopuk/yavaş kutu satırında "Yeniden dene" düğmesi. Çekim işi (`tekKutuyuCek`)
zaten tek kutuya inebiliyordu; eksik olan düğmeydi. Başarılıysa satır
kendiliğinden "İyi"ye dönüyor, ayrıca "oldu" denmiyor.

### Biten 9 — Operatör araması

`/operator/ara` dört kaynakta birden arıyor: firma, posta kutusu, destek
talebi (konu **ve mesaj gövdesi**), demo talebi. Sonuçlar türe göre öbekli.

Sorgu adreste (`?q=`), form JS'siz gönderiliyor. LIKE jokerleri kaçırılıyor —
`%` yazan biri bütün tabloyu getirmesin (denendi: `%%` → "Sonuç yok").

### Biten 12 — Toplu işlem

Gelen kutusu satırlarında kutucuk; seçim varken üstte çubuk beliriyor:
Sahiplen · İşleme al · Sahipliği bırak · Kapat · kategori uygula.

**Kısayol yazılmadı:** her mail tek tek `mailGetir(id, firmaId)`den geçiyor.
"Hepsini güncelle" diye tek SQL yazmak, listeye başka firmanın numarasını
sıkıştıran birine bütün tabloyu açardı. Bulunamayan mail atlanıyor ve sayısı
sonuçta yazılıyor.

Kutucuk bağlantının **dışında** — içine koymak, seçmek isterken maili açardı.
Seçim liste değişince sıfırlanıyor.

**Denendi:** 2 mail seçildi → "2 mail güncellendi", seçim temizlendi.

### Biten 13 — Geciken mail bildirimi

`sunucu/bildirim.ts`, zamanlayıcının nabzından **çekimden sonra** çağrılıyor
(az önce gelen mail de sayıma girsin).

- **Firma başına tek özet**, mail başına değil: on bildirim, maillerin kendisi
  gibi göz ardı edilen bir yığın olurdu.
- **Günde bir kez** (damga `ayarlar`da); zamanlayıcı saatte bir dönse de
  ikinci mail çıkmıyor.
- **SMTP kapalıysa damga atılmıyor** — atılsaydı, SMTP açıldığında ilk
  bildirim sessizce atlanırdı.
- Alıcı yalnız **etkin** kullanıcılar; kapatılmış kişiye gitmiyor.
- Bildirim hatası çekimi düşürmüyor.

**7 test** (`test/bildirim.test.ts`): taze mail bildirim üretmiyor, sahiplenmiş
/ kapanmış / yanıtlanmış / elenmiş mail sayılmıyor, kapalı kullanıcı alıcı
değil, damga varken ikinci bildirim çıkmıyor, sessizlik dolunca yeniden
çıkıyor, ekipsiz firma atlanıyor.

### Bu turda çıkan iki tuzak

1. **`ESCAPE ''` template literal'da tırnak kaçışına dönüştü** ve SQLite
   "ESCAPE expression must be a single character" ile düştü. Dosyada çift ters
   bölü olmalı ki JS tek ters bölü üretsin. Hafızadaki heredoc tuzağının
   kardeşi — yamayı Python ile yazınca çözüldü.
2. **`bildirim.ts` → `girisPostasi.ts` → `oturum.ts` → `next/headers`** zinciri
   düz Node testini kırdı. `uygulamaKoku()` tek satırlık ve yan etkisiz;
   `sunucu/koku.ts`e ayrıldı. Aynı kural: yan etkisiz olan, yan etkiliden
   ayrılır (`ticketSabitleri.ts`, `kategoriler.ts`, şimdi `koku.ts`).

Bu arada `KATEGORILER`/`DURUMLAR` da `sunucu/kategoriler.ts`e ayrıldı — toplu
işlem çubuğu (client) onları `db.ts`ten alamazdı.

### Biten 10 — Gelen mailin ekleri

`HamMail`e `ekler` alanı eklendi; tek bir `ayristir()` iki kaynağı da
(IMAP ve dosya) beslediği için değişiklik tek yerde.

**Satır içi görseller ek sayılmıyor.** İmzadaki logo da teknik olarak bir ek;
listelenseydi her mailin altına üç anlamsız dosya asılırdı. Ölçüt
`contentDisposition !== "inline"` ya da dosya adı olması.

**Ekler yalnız geçen mailde saklanıyor:** elenen mail bülten ya da otomatik
yanıt, eki kimsenin işine yaramaz ve diski boşuna doldururdu.

Bir ekin yazılamaması maili düşürmüyor — mail elde, eksik olan yalnız dosya;
atlanan ek **günlüğe** yazılıyor ("ek nerede" sorusunun cevabı bir yerde dursun).

**Uçtan uca denendi:** iki gerçek ek + bir satır içi imza logosu taşıyan
`ornek-posta/11-ekli-teklif.eml` yazıldı, hat çalıştırıldı, künye ve disk
doldu, panelde "EKLER · 2 dosya" göründü, indirme ucu doğru tip ve boyutla
dosyayı verdi.

**Yetki ölçüldü:** oturumsuz **401**, başka firmanın eki **404** (403 değil —
403 o numarada bir ek olduğunu ele verirdi), olmayan ek de **404**. İkisi
ayırt edilemiyor.

### Biten 11 — FTS5 mail araması

Eski arama `LIKE`'dı ve **gövdeyi hiç taramıyordu**. Artık `mail_fts`.

**Türkçe burada iki kez ısırdı, ikisi de ölçülerek bulundu:**

1. **Tam eşleşme yetmiyor.** "şikayet" araması "şikayetim"i bulamıyordu —
   Türkçe eklemeli bir dil. Her kelimeye yıldız ekleniyor; önek araması
   tercih değil zorunluluk.
2. **ı ile i birleşmiyor.** `unicode61 remove_diacritics 2` ç/ş/ö/ü/ğ'yi
   katlıyor ama noktasız ı'yı katlamıyor — Unicode'da ı aksanlı bir i değil,
   kendi harfi. Ölçüldü: "çalışma" araması "calisma" yazan maili bulamıyordu.
   Bu yüzden tablo `content=mailler` olmaktan çıkarılıp **bağımsız** yapıldı
   ve metin `turkceKatla()` ile normalleştirilerek yazılıyor; aynı işlev
   sorgu tarafında da çağrılıyor.

**Kullanıcı girdisi doğrudan MATCH'e verilmiyor:** tek bir çift tırnak sorguyu
"unterminated string" ile düşürüyor, OR/NEAR operatör oluyor. Kelimeler
ayrıştırılıp her biri tırnaklanıyor, operatörler sıradan kelimeye dönüyor.
Aranabilir hiçbir karakter yoksa sonuç **boş** — eskiden `%` bütün kutuyu
getiriyordu.

**Yol boyunca bir tuzak:** `content=` tablosunda `SELECT COUNT(*) FROM mail_fts`
dizini değil **içerik tablosunu** sayıyor. Geri doldurma kontrolüm bu yüzden
hep eşit çıkıyor, rebuild hiç çalışmıyor ve arama sessizce boş dönüyordu.
Sayaç artık `ayarlar`da. Eski şema için de göç var (`ftsSemasiniDenkle`).

**11 test** (`test/arama.test.ts`): gövdede arama, ı/i katlaması, büyük-küçük,
ek almış kelime, çok kelimeli VE, gönderen adresi, bozuk girdinin
patlatmaması, silinen mailin dizinden düşmesi.

Bu arada `test/ek.test.ts` (7 test) de eklendi ve iki eski test güncellendi:
örnek kutuya 11. mail girdiği için sayılar, ve `%` aramasının artık her şeyi
getirmemesi.

### Biten 6 — Operatör ekranları

**Maliyet ve Marj.** Prototipin dört paneli aynen: yapay zekâ iş türüne göre,
aylık maliyet tablosu, 1000 mail başına maliyet, plan bazlı net marj.

Tasarruf bandı prototipte tutar yazıyordu; burada **adet** yazıyor. Kural
motorunun elediği mail sayısı ölçülüyor ve gerçek, ama parasal karşılığı için
mail başına model maliyeti gerekiyor — o da model bağlanınca bilinecek.
Uydurma bir tasarruf rakamı yazmaktansa ölçülen adedi yazmak doğru olan.

**Net hiçbir yerde eksik giderle hesaplanmıyor.** Bir gider ölçülmüyorsa net
tire gösteriyor ve hangisinin eksik olduğunu yazıyor; eksik gideri sıfır
saymak marjı olduğundan yüksek gösterirdi.

**Abonelikler.** Dört kart, gelir şelalesi, yaklaşan yenilemeler, plan
dağılımı. Mevcut plan/durum/ücret düzenleme korundu — prototipte yoktu ama
gerçek bir iş yapıyor.

**Sistem ve Anahtarlar.** Kilit uyarısı, altı servis kartı (Anthropic, posta,
kasa, Turnstile, zamanlayıcı, tahsilat), "sır nerede durur" bölümü, altında
Site Ayarları formu. Ekranın tek kuralı: **anahtar değeri gösterilmiyor ve
kabul edilmiyor**; görünen tek şey tanımlı olup olmadığı ve o servisin ne
yaptığı. Ölçümler gerçek sorgudan (kayıtlı kutu, şifreli parola, işlenen mail).

**Sistem Günlüğü.** Prototipin kilit uyarısı ve olay satırları; giriş kayıtları
vurgulu.

**Posta Akışı** prototipte yok — uygulamaya sonradan eklenmiş bir ekran ve
zaten operatör dilinde yazılmıştı; dokunulmadı.

### Biten 4 — Gelir şelalesi

`abonelik_gecmisi`den hesaplanıyor: her firmanın dönem başındaki ve bugünkü
aboneliği karşılaştırılıp fark dört kaleme ayrılıyor — yeni müşteri, plan
yükseltme, plan düşürme, ayrılan.

Toplam gelir tek başına "arttı" der; bu ayrım **neden** arttığını söyler.
Geçmiş kaydı yoksa şelale çizilmiyor ve sebebi yazılıyor.

Denendi: dönem başı ₺99 → yeni müşteri +₺2.490 → plan yükseltme +₺2.352 →
bugün ₺4.941. Toplam tutuyor.

**Yaklaşan yenilemeler** aboneliğin başladığı günün aylık yıldönümünden
türetiliyor — ayrı bir tarih alanı yok ve uydurulmadı.

### Biten 8 — Firma detay çekmecesi

Müşteriler ekranında satırın sağındaki "Detay" bağlantısı sağdan bir panel
açıyor: sağlık skoru **kırılımıyla**, aylık mail hacmi, "bu müşteri gerçekten
ne kazandırıyor" hesabı ve kısayollar.

**Skor artık kara kutu değil.** Dört bileşenin her biri kaç puan getirdi
yazıyor, ve ölçülemeyen bileşen **sıfır puan değil "ölçülmüyor"** diyor.

Satırın kendisi kategoriyi açıyor, "Detay" çekmeceyi — ikisini tek tıklamaya
bindirmek, kutulara bakmak isteyene her seferinde paneli açardı. Açık çekmece
adreste (`?cekmece=`), perde de bir bağlantı: kapatmak JS istemiyor.

### Bu turda çıkan gerçek hata

**Sistem Günlüğü ekranı, kurulduğu anda kendi işini yaptı.** Ekranı açar açmaz
sekiz satır hata göründü:

> `satis@vadimobilya.com çekilemedi: table mail_fts has no column named konu`

Sebep FTS şema göçüydü: göç yalnız **tabloyu** bırakıyordu, `mailler` üstündeki
eski tetikleyiciler yerinde kalmıştı ve artık var olmayan sütunlara yazmaya
çalışıp **her mail yazmasını düşürüyordu**. `CREATE TRIGGER IF NOT EXISTS`
eskisini değiştirmediği için yeni tanım da devreye girmemişti.

Göç artık üç tetikleyiciyi de açıkça bırakıyor. Ayrıca geri doldurma kontrolü
sağlamlaştırıldı: yalnız damgaya değil **dizinin kendi satır sayısına** da
bakıyor, böylece şema göçü ya da elle müdahale sonrası arama sessizce çalışmaz
kalmıyor.

**`test/ftsGoc.test.ts` (5 test)** bunu çiviliyor: eski sürüm elle kuruluyor,
`db.ts` import edilince göç çalışıyor, sonra üç şey doğrulanıyor — tetikleyiciler
bırakıldı mı, mail yazılabiliyor mu, arama çalışıyor mu.

---

## Ticket sistemi + firma kategorileri + demo talebi penceresi

Kullanıcının üç isteği, üçü de bitti.

### 1. Demo talebi penceresi

*"Pop up şeklinde tıklayayım, bilgiler ekrana gelsin, ben ona göre cep veya
mailden dönüş sağlayayım."*

Kuyruk satırı artık **özet** (firma, kişi, iletişim, durum); ayrıntının tamamı
tıklayınca açılan pencerede. Pencerenin en üstünde **dönüş yolları** bandı var:
"Mail ile dön" (hazır taslakla) ve telefon numarası (tıklanabilir). Altında
siteden gelen yedi alanın tamamı, en altta kaynak ve durum düğmeleri.

Escape kapatıyor, perdeye tıklamak kapatıyor, açılışta odak pencereye giriyor,
açıkken arkadaki sayfa kaymıyor.

### 2. Ticket sistemi

Müşteri panelinde **Destek** (`/panel/destek`), operatör panelinde **Destek
Talepleri** (`/operator/ticketlar`). İki tablo: `ticketlar` ve
`ticket_mesajlari`.

- Müşteri konu, kategori (kurulum/hata/soru/fatura/özellik), öncelik ve
  ayrıntı yazıp açıyor. Talep operatöre **tamamıyla** düşüyor: hangi firma,
  kim açtı (adresi tıklanabilir), kategori, öncelik, yazışmanın tamamı.
- **Durum yazan tarafa göre dönüyor**: müşteri yazdıysa "Bizde", operatör
  yazdıysa "Yanıt bekliyor". Kapalı ticketa yazılan mesaj onu yeniden açıyor —
  kapalıya yazılan mesajın görünmez kalması en kötü hâl olurdu.
- **Önceliği operatör de değiştirebiliyor**: müşteri her talebi "acil"
  işaretlerse kuyruğun sırası anlamını yitirir.
- Firma sınırı müşteri tarafında `panelOturumu()`nden; ticket numarası
  dışarıdan geldiği için her okuma firma koşuluyla birlikte yapılıyor.
  Operatör tarafında firma sınırı yok, onun yerine `operator = 1` kontrolü var.
- Mail kanalından **ayrı tutuldu**: gelen kutusu müşterinin kendi müşterisiyle
  yazışması, ticket müşterinin Mailhanem ile yazışması. Aynı tabloda tutmak
  firma sınırını ve "bu kimin işi" sorusunu karıştırırdı.

**Uçtan uca denendi:** müşteri panelinden talep açıldı, operatör panelinde
firma adı, açan kişi ve mesajıyla birlikte göründü.

### 3. Firma kategorileri

*"Her yeni firma operatör panelde kategori olsun, o firmanın bağlı hesapları
o firmayı genişlettiğimde ekrana gelsin, böylece karmaşıklığı önleriz."*

`/operator/musteriler` yeniden kuruldu: her firma bir kategori. Kapalıyken tek
satır (plan, durum, kopuk kutu ve açık talep rozetleri, kutu/kişi/mail
sayıları); açınca **Bağlı hesaplar** (adres, sağlayıcı, IMAP sunucusu,
gelen/elenen, son çekim) ve **Ekip** (rol, durum, son giriş).

Açık/kapalı durumu **adreste** (`?acik=`): yenilenince kaybolmuyor,
paylaşılabiliyor, JS'siz çalışıyor. Ayrıntı yalnız açılan firma için
sorgulanıyor — yirmi firma için yirmi gereksiz sorgu atılmıyor.

### Yol boyunca çıkan tuzak

`node:sqlite` tarayıcı grafiğine sızdı ve Turbopack derlemeyi kırdı. Sebep:
destek formu ve denetim seçicileri (`"use client"`) sabit listeleri almak için
`db.ts`i import ediyordu; `db.ts` yüklenir yüklenmez veritabanını açıyor.
Çözüm `zamanlayici.ts`teki ile aynı: sabitler `sunucu/ticketSabitleri.ts`e
ayrıldı, `db.ts` onları yeniden dışa aktarıyor.

**Kural: `"use client"` taşıyan hiçbir dosya `sunucu/db.ts` import etmeyecek.**

---

## Operatör paneli prototiple birebir kuruldu

Kullanıcı: *"bu operatör panel artifakttaki panelle bir mi, ben birebir o paneli
istiyorum"* ve ardından *"her şeyin gerçek verilerle dönmesini istiyorum; şu an
veri akışı yok biliyorum, akış başladığında gerçek veriler gelecek şekilde yap."*

**Cevap: bir değildi.** Müşteri paneli `tasarim/panel.html`'e göre kurulmuştu,
operatör tarafı için bu karşılaştırma hiç yapılmamıştı.

### Biten

- **Prototipin CSS'i birebir taşındı** → `app/operator/operator.css` (517 satır).
  Tek değişiklik: her seçici `.op` altına **kapsamlandı**. Zorunluydu —
  `.serit`, `.sayfa`, `.bolum`, `.triyaj`, `.av`, `.dugme`, `.rozet`,
  `.nav-oge`, `.yannav`, `.sahne` gibi onlarca ad hem prototipte hem
  `globals.css`te var ve ayrı şeyler çiziyor; kapsamlanmasa müşteri paneli
  bozulurdu. Dönüşümü yapan betik: scratchpad'deki `kapsamla.py`.
- **Kabuk birebir** (`layout.tsx` + `OpNav.tsx`): koyu üst şerit, 232px yan
  menü, "Servis" başlığı, prototipin sırasıyla ekranlar, altta kimlik + çıkış.
- **Genel Bakış birebir** (`page.tsx`): prototipin dört kartı aynı adlarla,
  İş kuyruğu, dokuz sütunlu müşteri tablosu, dipnot.

### Veri boru hattı — asıl karar

Sahte değer yok. **Her sayı gerçek bir tabloyu sorguluyor**; bugün boş
görünenler "ölçülmüyor" değil, *o tabloda henüz satır yok*. Akış başladığı an
ekranlar kendiliğinden dolar, kodda değişecek bir şey yok.

Bunun için üç tablo açıldı (`db.ts` şeması):

| Tablo | Ne yazacak | Bugün |
|---|---|---|
| `ai_kullanim` | model çağrısı: iş türü, model, token, kuruş | boş — model bağlı değil |
| `destek_kayitlari` | firmaya harcanan dakika | boş — operatör henüz girmiyor |
| `abonelik_gecmisi` | abonelik her değiştiğinde damga | `firmaAboneligiYaz` artık yazıyor |

Okuyan yardımcılar: `aiMaliyet` · `aiMaliyetToplam` · `aiIsTurleri` ·
`destekDakika` · `destekDakikaToplam` · `gelirSerisi` · `saglikSkoru` ·
`firmaHacimSerisi`. **Kayıt yoksa `null` dönüyorlar, sıfır değil** — "gider yok"
ile "ölçülmedi" ayrı şeyler.

**Sağlık skoru şimdiden çalışıyor.** Prototipin dört bileşeni (hacim eğilimi 35,
aktif kullanıcı 30, taslak onayı 20, destek yükü 15) gerçek sorgulardan
hesaplanıyor. Ölçülemeyen bileşen **sıfır sayılmıyor**, skordan çıkarılıyor ve
`kapsam` kaç puanlık bölümün ölçüldüğünü söylüyor — veri yokluğunu kötü
performans gibi göstermek yanlış olurdu. Panelde Arkun 100, Vadi 54 çıkıyor;
ikisi de gerçek hesap.

**İş kuyruğu da gerçek:** kopuk kutu (acil), cevapsız demo talebi (fırsat),
denemedeki firma (risk). Satır yoksa kuyruk boş görünüyor, iş uydurulmuyor.

### Sırada — 7 ekran

Demo Talepleri · Müşteriler · Bağlantı Sağlığı · Maliyet ve Marj · Abonelikler ·
Sistem ve Anahtarlar · Sistem Günlüğü. Hepsi aynı kalıpla: prototipin markup'ı
birebir, sayılar yukarıdaki yardımcılardan.

**Prototipe nasıl bakılır:** 8792'de bir sunucu zaten ayakta
(`http://127.0.0.1:8792/` → Operatör paneli → "Giriş yap"). Ekranlar arası geçiş
konsoldan: `document.querySelector('[data-sayfa="maliyet"]').click()`.

---

## Mail detayı baştan kuruldu

Kullanıcı "çok kullanışsız" dedi, haklıydı: ekranın ilk **~420 pikseli** turuncu
sahiplik bandı + iki dev ayar kartıyla doluydu, **mail dördüncü bloktu**, yanıt
kutusu katlanmanın çok altındaydı.

Kullanıcı iki kararı kendi verdi: **önce triyaj** (ama sıkı) ve **notlar
silinmesin, sıkışıp ait oldukları yere taşınsın**.

**Üç hamle:**
1. **Triyaj tek şeritte.** Sahip · kategori · durum üç ayrı kart değil, saç
   teliyle bölünmüş tek şeridin üç satırı; sabit genişlikte etiket sütunu
   sayesinde üç değer aynı hizada okunuyor. Sahipsizlik ayrı bir turuncu bant
   istemiyor, satırın kendisi yanıyor.
2. **Gövde hemen altında**, 70ch okuma ölçüsüyle.
3. **Notlar satır içine indi ve koşullu oldu.** Kategori notu yalnız kategori
   boşken, durum notu yalnız henüz yanıtlanmamışken çıkıyor — seçiliyken o
   cümle her mailde tekrarlanan mobilyaya dönüşüyordu. "Gönderilmiş Öğeler"
   bandı yanıt formunun eteğine tek satır oldu. Bilgi duruyor, mobilyası gitti.

**Ölçüldü (1440px):** triyaj şeridi 420 → **149px**, mail gövdesi sütun
başından **280px**, yanıt kutusu **551px** — yani 900px'lik ekranda *yanıt
kutusu kaydırmadan görünüyor*. Eskiden görünmüyordu.

**Konteyner sorgusu:** gömülü detay sütunu ekran 1440px olsa bile ~400px
olabiliyor; viewport medya sorgusu bunu göremiyordu. `.detay-sutun`
`container-type:inline-size` taşıyor, dar düzen `@container`'a bakıyor.

**Aynı gönderenden** listesi `<details>` içine alındı — bağlam, ana olay değil.

**Detektör temiz.** Tek bulgu `.yanit-satir`'daki 3px'lik renkli yan şeritti
(kalite tabanının açık yasağı, kodda eskiden beri duruyordu): kalktı, başarı/hata
ayrımı artık zeminle söyleniyor.

**Demo kutularına SMTP eklendi** — yanıt kutusu demoda da görünsün diye. Parola
uydurma ama kasadan geçiyor; gerçekten gönderilmeye çalışılırsa bağlantı kurulamaz
ve ekran bunu dürüstçe söyler.

---

## Demo vitrini — sitedeki "Demoda deneyimleyin"

Ziyaretçi giriş istemeden dolu bir müşteri paneline giriyor. Düğme **üç yerde**:
üst rayda (yapışkan, sayfanın her yerinde görünür), **"Ürünün içi" bölümünün
sonundaki demo bandında** ve mobil menüde. Üçünün hedefi de `AYAR.demoUcu`
üzerinden kuruluyor.

**Yeri iki kez değişti.** Önce hero'da formun altındaydı: orada "Demo talebi
gönder" ile yarışıyor ve mono açıklamasıyla birlikte dengesiz duruyordu.
Sonra `#icerde` bölümünün sonuna, çerçeveli bir banda taşındı — bölümün başında
zaten "bunlar çizim değil, panelin kendi arayüzü" yazıyor, ziyaretçi tam orada
içine girmek istiyor. Hero'dan uzakta olduğu için bandda **koyu** düğme
kullanılabiliyor: o bölümün asıl eylemi bu.

`GET /demo` → `sunucu/demo.ts` vitrini kurar → oturum açılır → `/panel/ozet`.

**Uydurma ama gerçekçi:** Vadi Mobilya, 2 kutu, 15 mail (11 gelen + 4 elenen),
3 kişi, 3 şablon, 4 yönlendirme kuralı, 2 VIP gönderen. Sayılar demoda dolu
çıksın diye ayarlandı: 5 sahipsiz · 4 geciken · 2 bana atanan · 11 son 24 saat.

**Üç kural:**
- Firma `demo=1` bayraklı (`firmalar` tablosuna eklendi). Panel bu bayrağı
  görünce tepeye "örnek verilerle çalışıyor" şeridi koyuyor — ziyaretçi gerçek
  bir müşterinin kutusuna baktığını sanmasın.
- **Her ziyarette sıfırlanıyor**: firma silinip yeniden yazılıyor, CASCADE
  kullanıcıları/mailleri/oturumları da götürüyor. Bir öncekinin sahiplendiği
  mailler sonrakine kalmıyor.
- Silme yalnız `WHERE demo = 1`. **`test/demo.test.ts` bunu çiviliyor** (4 test):
  gerçek firma, kullanıcısı ve maili duruyor; demo kullanıcısı firma sınırını
  aşamıyor.

**Bilinen sınır:** tek demo firma var, aynı anda iki ziyaretçi birbirini
sıfırlar. Ziyaretçi başına ayrı vitrin gerekirse bölünecek yer `demo.ts`.

**Yol boyunca çıkan iki şey düzeltildi:**
1. **Üst şeritler yapışkan değildi.** Sayfa kaydırılınca demo şeridi ekrandan
   çıkıyor, yan menü `top:36px`'te asılı kalıp üstünde boş bir bant bırakıyordu.
   İkisi de `position:sticky` oldu; demo şeridi 0'da, üst şerit 38'de, yan menü
   74'te. Demo uyarısının kaybolmaması ayrıca önemliydi.
2. **Şerit dar ekranda taşıyordu.** Yüksekliği sabit (38px) çünkü ofsetler ona
   bağlı; metin sarınca üst şeridin üstüne biniyordu. Artık tek satır: uzun
   cümle 1150px altında, ikincil bağlantı 760px altında düşüyor, "Siteye dön"
   her zaman kalıyor. 375/800/1280'de ölçüldü — taşma yok.

---

## Bu oturumda yapılanlar

### 1. Mailhane → Mailhanem

141 değişiklik, 35 dosya. Marka adı, alan adı (`mailhanem.app`), ortam
değişkeni (`MAILHANEM_ANAHTAR`), çerez (`mailhanem_oturum`), veritabanı dosyası
(`veri/mailhanem.db` — dosya taşındı, veri duruyor).

`kasa.ts` eski `MAILHANE_ANAHTAR` adını da okuyor ve uyarı basıyor: o anahtarı
kaybetmek kayıtlı kutu parolalarını çözülemez yapar.

**Gözden kaçan yüz:** kod değişti ama veritabanındaki satır eski adreste
kalmıştı; operatör `operator@mailhane.app` olduğu için giriş bağlantısı
üretilemedi. Dev veritabanındaki adres elle taşındı.

**Türkçe ek tuzağı:** ekli biçimleri (`Mailhane'nin`) önce çevirince çıplak ad
kuralı onların içindeki `Mailhane`'yi de yakalayıp `Mailhanemm'in` üretti.
Doğru sıra: önce çıplak ad, sonra ek.

### 2. Tek sunucu, tek köken

Site ayrı statik sunucudaydı (8791). Artık uygulamanın içinden servis ediliyor;
CORS bu üç uç için devreye girmiyor. `next.config.ts`'de `beforeFiles` yeniden
yazımı `/` adresini `public/tanitim/index.html`'e bağlıyor.

Kopyalama betiği iki şeyi çeviriyor: `AYAR.koku` boşalıyor, `giris.html`
bağlantıları `/giris`'e dönüyor. Değişimlerden biri tutmazsa betik **patlıyor**.

### 3. Giriş sayfası tasarıma geçti

`site/giris.html`'deki iki yarımlı tasarım uygulamanın `/giris` rotasına
taşındı (statik dosya servis edilmiyor). Sebebi: üç davranış sunucu tarafında
— oturumu açık olanı panele gönderme, süresi dolmuş bağlantı uyarısı, SMTP
kapalıyken "mail gitmedi" bildirimi.

Instrument Serif fontu uygulamaya eklendi (`--serif` jetonu).

**Soldaki beş simge tıklanabilir:** o ekrana gitmiyorlar (giriş yapmamış birini
`/panel`'e yollamak kısır döngü olurdu), altındaki açıklamayı değiştiriyorlar.

### 4. Gelen kutusu iki sütuna döndü

Prototipteki triyaj düzeni: solda liste (316–392px) ve süzgeçler, sağda seçili
mailin tamamı, ikisi ayrı ayrı kayıyor. Ölçüldü: 1400px'te `392px 760px`.

Detay **tek yerde**: `app/panel/mail/MailDetay.tsx`. Hem sağ sütunda gömülü
hem `/panel/mail/[id]` tam sayfasında aynı bileşen.

Süzgeçler adreste (`?sekme=&kategori=&kutu=&q=&mail=`): JS'siz çalışıyor,
paylaşılabiliyor, satıra tıklamak süzgeci bozmuyor.

**İki soru ayrıldı:** sağ sütunda ne gösterilecek (adreste mail yoksa ilk satır)
ve kullanıcı seçim yaptı mı (yalnız adresteki `mail`). Dar ekranda liste
ikincisine göre gizleniyor; yoksa telefonda hiç liste görülemiyordu.

`.sahne` dolgusu bu sayfada `:has()` ile sıfırlanıyor.

### 5. Prototipten atlananlar eklendi

Kullanıcı "boş dursun, veri girdikçe dolar" dedi; ayrım yapıldı.

**Eklendi, gerçek veriyle doluyor:**
- **Genel Bakış** (`/panel/ozet`) — durum halkası (sunucuda çiziliyor, grafik
  kütüphanesi yok), kategori dağılım çubukları, dört sayaç, son mailler.
- **Geciken / bekleme** — mailin kendi tarihinden (`GECIKME_SAAT`, şu an 24).
  Gelen kutusunda sekme + satır rozeti. Bunu atlamak hataydı, modele bağlı
  değildi.
- **VIP** — maile değil **gönderenin adresine** bağlı (`vip_gonderenler`).
  Aynı kişinin bütün mailleri yıldızlanıyor.

**Eklenmedi, kendiliğinden dolmaz:** onay bekleyen/gönderilen/reddedilen taslak
sayıları ve güven yüzdesi. Taslak kaydı yok — sütunu, tablosu, hiçbiri. Genel
Bakış'ta kesikli çerçeveli bir yer tutucu ne göstereceğini yazıyor. "0 taslak
bekliyor" yazmak "özellik çalışıyor, bekleyen yok" demek olurdu.

### 6. Cloudflare Turnstile

Giriş formuna bot koruması. WAF/Bot Management DNS seviyesinde çalışır, koda
eklenmez — forma gömülebilen tek Cloudflare aracı Turnstile.

- **İki anahtar birden yoksa koruma kapalı**, giriş çalışmaya devam ediyor.
- Doğrulama **adres okunmadan önce**; sonra olsaydı hata mesajı adresin kayıtlı
  olduğunu ele verirdi.
- **Ağ hatasında reddediliyor**; tersi korumayı isteğe bağlı hale getirirdi.
- `interaction-only`: widget normalde **hiç çizilmiyor** (ölçüldü — yükseklik 0,
  iframe yok) ama jeton üretiliyor. Altında tek satır mono not.
- Widget'ın içi biçimlendirilemez (çapraz kökenli iframe).

`.env.local`'de Cloudflare'in "her zaman geçer" deneme anahtarları var. Deneme
anahtarıyla widget göründüğünde kırmızı "sadece test için" şeridi taşır;
gerçek anahtarda çıkmaz.

### 7. Tanıtım sayfasındaki adım rakamları

`01/02/03` içi boş çiziliyordu ve `2` ile `3`'te dolu bir kama görünüyordu.
Sebep harf aralığı değil **fontun kendi glifi**: Instrument Sans'ın bu
rakamları kendi üstüne binen konturlarla kurulmuş, `-webkit-text-stroke` o
kesişmeyi dolu çiziyordu. Dört seçenek gerçek boyutta karşılaştırıldı; kontur
bırakıldı, rakamlar **dolu** ve mürekkebin açık tonunda (`#A5B8CB`).

---

## Kutu bağlama müşteriye açıldı

**Ürün kararı:** kutu bağlamayı firma sahibi ve yöneticisine açtım. Sunucu tarafı
zaten hazırdı, eksik olan tek şey yetkiydi; firma her yeni kutu için kurulum
ekibini beklemesin. Personel bu ekranı kullanamıyor — kutu parolası kurulum
bilgisidir.

- Firma numarası **formdan değil oturumdan** geliyor; başka firmaya kutu yazılamaz.
- Bağlantı önce deneniyor; tutmazsa **hiçbir şey kaydedilmiyor** (tarayıcıda
  doğrulandı: kapalı bir porta bağlanmaya çalışıldı, kayıt açılmadı).
- Kopuk kutular için ayrı bir "parolayı güncelle" formu var; yeni parola da önce
  deneniyor, tutmazsa eskisi bozulmuyor.
- Sağlayıcı seçilince sunucu adresleri doluyor. Google ve Microsoft için uyarı
  metni var: Google uygulama parolası istiyor, Microsoft çoğu kiracıda parolayla
  IMAP'i kapattı ve bizim OAuth bağlantımız yok. **Olmayan yetenek uydurulmadı.**
- Kutuyu **kaldırma** yok: kutuyla birlikte o kutunun bütün mail kaydı silinir,
  o yüzden operatörde bırakıldı ve ekranda böyle yazıyor.

**Kutuya SMTP alanları eklendi** (`smtp_sunucu`, `smtp_port`). Sebebi yanıtlama:
müşteriye cevap veren firma, Mailhanem değil.

---

## Mail yanıtlama yazıldı

Panelden mail yanıtlanıyor. Yanıt **müşterinin kendi kutusundan** çıkıyor:
`From` kutunun adresi (görünen ad yazan kişi), kimlik kutunun SMTP kimliği,
parola kutu bağlanırken şifrelenen parola. `In-Reply-To` ve `References` gelen
mailin Message-ID'sine bakıyor — yanıt karşı tarafta aynı konuşmanın altına düşüyor.

- Gönderilen yanıt **veritabanına da yazılıyor** (`yanitlar` tablosu). Kutuyu salt
  okunur açtığımız için "Gönderilmiş Öğeler"e koyamıyoruz; ekip kendi yazdığını
  görebilsin diye kaydı panelde tutuyoruz. Başarısız denemeler de yazılıyor.
- Gönderim başarılıysa mail durumu kendiliğinden **"Yanıtlandı"** oluyor ve
  sahipsiz mail yanıtlayana atanıyor. Başarısızsa durum değişmiyor, yazılan metin
  formda kalıyor.
- `DURUMLAR`'a `yanitlandi` eklendi. Önceki turda "yanıtlandı diye bir durum yok,
  çünkü panel mail göndermiyor" yazmıştım; artık gönderiyor, o cümle de düzeltildi.
- Onay basamağı **kurulmadı**: yazan ile gönderen aynı kişi, araya girecek bir
  model taslağı yok. Onay şartı model geldiğinde anlam kazanacak.

**Uçtan uca denendi:** sahte SMTP'ye gönderildi, mail doğru `From`
(`satis@arkunmobilya.com`), `In-Reply-To`, `Re:` konusu ve alıntı bloğuyla
teslim alındı; Mailhanem adresi mailde hiç görünmedi.

---

## Yanıt şablonları ve yönlendirme

**Şablonlar** (`/panel/sablonlar`) — sık yazılan cevaplar. Yanıt kutusundaki
seçiciyle **imlecin olduğu yere** ekleniyor, yazılmış metnin üstüne yazmıyor.
Beş yer tutucu var (`{ad}`, `{eposta}`, `{konu}`, `{ben}`, `{firma}`) ve eklenirken
doldurulyor; **tanımadığımız bir yer tutucu olduğu gibi bırakılıyor** — sessizce
silmek, yazanın fark etmediği bir boşluk üretirdi. Kategoriye bağlı şablon o
kategorideki mailde önce görünüyor. Yazma yetkisi yöneticide; personel kullanır.

**Yönlendirme** (`/panel/yonlendirme`) — gelen maili kategoriye ve kişiye bağlayan
elle kurulmuş kurallar. Üç tip: gönderen adresi (tam eşleşme), alan adı (alt alan
adları dahil), konuda geçen kelime. **İlk eşleşen kazanır ve durur**; iki kural
farklı şey söylerse belirsizlik olmasın diye. Sıra panelden ayarlanıyor.

- Kural **dolu alanın üstüne yazmıyor**: insanın seçtiği kategori kural yüzünden
  değişmiyor, yalnızca boş bırakılan doluyor.
- Çekim sırasında uygulanıyor; "Kutudakilere de uygula" düğmesi zaten duran
  maillere de geçiriyor (tarayıcıda denendi: 7 mail tarandı, 3'ü sınıflandı).
- **`kural.ts` ile karıştırılmasın:** o eleme yapar, bu sınıflandırma. Model
  geldiğinde bu kurallar kalacak — elle kurulmuş kural tahminden kesindir.
- 12 test: Türkçe büyük/küçük harf ("İADE" ↔ "iade"), benzeyen alan adı
  (`sahtefirma.com` ≠ `firma.com`), boş kalıbın hiçbir şeyi yakalamaması, sıra.

---

## Ekipten çıkarma

Silmiyor, **kapatıyor**. Silseydik o kişinin sahiplendiği maillerin geçmişi
"kimse"ye dönerdi. Kapatılan kişinin açık oturumları anında düşüyor, bekleyen
giriş bağlantıları iptal oluyor, `oturumCoz` ve `girisLinkiHarca` kapalı hesabı
geri çeviriyor. Kaydı listede sönük duruyor, geçmiş sahiplik görünmeye devam
ediyor. Sahip kapatılamıyor, kimse kendini kapatamıyor.

---

## Operatörün kalan üç ekranı

**Abonelikler** — firma planı, durumu, aylık ücreti. Ücret **kuruş** olarak
saklanıyor; ondalıklı para toplamada kuruş kaybettirir. Panelde lira yazılıyor ve
"2.450,50" gibi Türkçe ondalık ayracı kabul ediliyor (denendi).

**Maliyet ve Marj** — burada dikkatli olmak gerekiyordu. **Ölçülen tek şey hacim:**
son 30 günde kaç mail geçti, kaçı elendi. Maliyet ölçülmüyor çünkü ölçülecek bir
şey yok — model bağlı değil, bir maili işlemenin bugün ek maliyeti sıfır. O yüzden
operatör "mail başına kaç kuruş" varsayımını **kendi giriyor** ve ekran bunu
ölçüm değil **varsayım** diye adlandırıyor. Uydurma bir maliyet rakamı yazmaktansa
hesabın girdisini görünür kılmak doğru olan.

**Sistem Günlüğü** — kutu bağlandı, parola güncellendi, çekim düştü, yanıt
gönderilemedi, ekip değişti, abonelik güncellendi. **Hata izleyici değil**, olay
kaydı: her istek yazılsaydı önemli satır görünmez olurdu. Satırlar gerçek
eylemlerden yazılıyor, üretilmiyor.

---

## Bu turda çıkan üç gerçek hata

1. **`nodemailer` kurulumu `mailparser`'ı kırdı.** npm, mailparser'ın iç
   nodemailer'ını tepedekiyle birleştirdi; Turbopack tarayıcı katmanında
   `nodemailer/lib/addressparser` alt yolunu çözemeyip derlemeyi kırdı. Asıl sebep
   zincirin sayfaya sızmasıydı — `zamanlayici.ts` ikiye ayrıldı (ayar tarafı /
   çekim tarafı). **Kural: panel ekranları mail hattını import etmeyecek.**
2. **`next build` "duplicate column name" ile düştü.** `sutunEkleGerekirse`
   "bak, yoksa ekle" yapıyordu; 19 derleme işçisi aynı anda bakıp aynı anda
   ekledi. Artık yalnız bu hata yutuluyor; sütunun sonuçta var olması önemli.
3. **Heredoc tuzağına iki kez daha düşüldü** — biri de tam o tuzağı anlatan
   hafıza notunu yazarken. Not sertleştirildi: ters bölü taşıyan yamada heredoc
   yok, doğrudan Edit.

---

---

## Zamanlayıcı kuruldu

Çekim artık periyodik. Aralık **Posta Akışı** ekranından seçiliyor (kapalı · 5 · 15 ·
30 · 60 · 180 dakika) ve `ayarlar` tablosunda duruyor. `instrumentation.ts` sunucu
açılışında zamanlayıcıyı kuruyor, dakikada bir nabız atıyor, aralık dolduysa
`hepsiniCek()` çağırıyor. Son çalışma damgası veritabanında: sunucu yeniden
başlayınca sıfırdan saymıyor, kaldığı yerden devam ediyor.

**Kuyruk ya da cron servisi kurulmadı** ve bu bilinçli: bugün tek süreç, tek haneli
müşteri var. İki sonucu README'de yazıyor — uygulama kapalıyken tur atlanır, iki
kopya çalıştırılırsa iki zamanlayıcı olur (mail mükerrer yazılmaz, IMAP'e boşuna
yük biner). Ölçek büyürse dışarı taşınacak yer burası.

**Bir derleme tuzağı çıktı ve çözüldü.** Operatör genel bakışı zamanlayıcının
durumunu okuyunca `zamanlayici → isci → mailparser` zinciri sayfanın modül grafiğine
girdi ve Turbopack tarayıcı katmanında `nodemailer/lib/addressparser`'ı çözemeyip
derlemeyi kırdı. Modül ikiye ayrıldı: `zamanlayici.ts` yalnız ayar ve durum
(yalnızca `db`'ye bakar, sayfalar bunu import eder), `zamanlayiciCekirdek.ts` nabız
ve çekim (yalnız `instrumentation.ts` yükler). **Kural:** panel ekranları mail
hattını import etmeyecek.

---

## Posta gönderimi bağlandı

Uygulama artık mail gönderebiliyor: `sunucu/posta/gonderim.ts` (nodemailer).
`SMTP_SUNUCU` boşsa hiçbir şey gönderilmiyor, mesaj konsola yazılıyor ve çağıran
`gercek: false` alıyor — yani kimseye "gönderdim" denmiyor. Giriş ekranı da bunu
saklamıyor.

**Gönderim hata fırlatmıyor.** Giriş akışı bir posta sunucusu yüzünden yarıda
kalmamalı; hatalar günlüğe ve `ayarlar` tablosuna yazılıyor, operatör panelindeki
**Site Ayarları → Posta gönderimi** kartında görünüyor.

**Sızıntıya dikkat edildi:** giriş formu adres tanınsın tanınmasın aynı cevabı
veriyor. "Posta açık mı" bayrağı kullanıcıya değil **sunucu yapılandırmasına**
bakıyor; gönderim hatası da dışarı yansıtılmıyor. Yansısaydı hangi adresin kayıtlı
olduğu bu formla öğrenilebilirdi.

### Bunun açtığı iş: ekibe davet

`/panel/ekip` ekranına davet formu eklendi. Sahip ve yönetici davet edebiliyor;
kişi kaydediliyor ve adresine tek kullanımlık giriş bağlantısı gidiyor. Şifre yok,
ayrı bir kabul adımı yok. SMTP kapalıysa davet yine oluşuyor ve **bağlantı davet
edene gösteriliyor** — elden iletsin diye.

`kullaniciEkle` sistemde kayıtlı adresi reddediyor: başka firmanın kullanıcısını
kendi ekibine çekmek ya da operatörün adresini ele geçirmek mümkün değil. Dördü de
testli.

**Uçtan uca denendi:** süreç içinde sahte bir SMTP sunucusu kuruldu, davet gönderildi,
mail doğru başlıklarla (`To`, `From`, UTF-8 konu) teslim alındı, gelen bağlantıyla
giriş yapıldı ve davet edilen kişi panele düştü. `test/gonderim.test.ts` aynı el
sıkışmayı testte de yapıyor — kapalıyken, açıkken ve sunucuya ulaşılamazken.

---

---

## Müşteri paneli yazıldı — `/panel`

Prototipteki altı ekrandan **gerçek olabilecek üçü** taşındı. Diğer üçü (Kategoriler,
Yanıt Şablonları ve prototipin "Mail Akışı" taslak kuyruğu) yapay zekâ adımına
yaslandığı için yazılmadı — boş kabuk taşımak olurdu.

**Yazılan ekranlar:**

- **Gelen Kutusu** (`/panel`) — kuraldan geçen mailler. Sekmeler: Tümü · Sahipsiz ·
  Bana atanan · İşlemde · Kapandı. Yanlarındaki rakam **faceted**: kategori, kutu ve
  arama süzgeçleri sayıma da uygulanıyor, yani "o sekmeye geçince göreceğin sayı".
  Kategori hapları, kutu seçimi ve metin araması URL'de duruyor (paylaşılabilir,
  JS'siz de çalışır). Sahipsiz satırlar tek bir kenar işaretiyle ayrılıyor — önce
  bütün satırı sarıya boyamıştım, liste zaten tamamen sahipsizken vurgu anlamını
  yitiriyordu.
- **Mail detayı** (`/panel/mail/[id]`) — gövde, sahiplenme/devretme, kategori ve
  durum seçimi, aynı gönderenin diğer mailleri.
- **Mail Hesapları** (`/panel/hesaplar`) — kutular, bağlantı durumu, gelen/elenen
  sayıları, son çekimler. IMAP sunucu ayrıntısını yalnız sahip ve yönetici görür.
- **Ekip ve Yetkiler** (`/panel/ekip`) — kim girebilir, kim ne yapabilir, kim kaç
  mail üstünde. Rol değişimi yalnız sahipte.

**Firma sınırı tek kapıdan:** `app/panel/yetki.ts`. Firma numarası URL'den değil
**oturumdan** geliyor; `db.ts`'deki panel sorgularının hepsi `firma_id`'yi koşulun
içinde taşıyor. Sunucu eylemlerinin argümanları da dışarıdan sayılıyor: her biri
zod'dan geçiyor, mail firma sınırıyla birlikte aranıyor, devretme hedefi ekipte mi
diye kontrol ediliyor.

**Yeni: `mailler.govde`.** Panelde mail okunamıyordu — elde yalnız 180 karakterlik
özet vardı. Gövde artık saklanıyor (20 000 karakter sınırı, kesilen yerde bunu
söylüyor). Sütun sonradan eklendiği için `db.ts`'ye küçük bir göç yardımcısı kondu:
eksikse `ALTER TABLE` ile ekliyor. O tarihten önce çekilmiş maillerde gövde yok ve
detay ekranı bunu saklamıyor, açıkça yazıyor.

**Uydurulmayanlar.** Yanıt yazma yok (posta gönderimi yok), kategori önerisi yok
(model yok), kutu bağlama ve ekibe davet yok (biri operatör işi, öteki mail
gönderimi istiyor). Dördü de ilgili ekranda tek cümleyle söyleniyor. Mail durumu
üç değerle sınırlı — `yeni · islemde · kapandi`; **"yanıtlandı" yok**, çünkü panel
henüz kimsenin adına mail göndermiyor.

**19 yeni test** (`test/panel.test.ts`): iki firma kurup sınırı zorluyor — başka
firmanın maili listede çıkmıyor, `mailGetir` sınırı aşmıyor, başka firmanın mailine
sahip/kategori/durum yazılamıyor, başka firmanın kullanıcısının rolü
değiştirilemiyor. Ayrıca süzgeçler, faceted sayaçlar, `%` gibi LIKE jokerlerinin
kaçırılması ve tekrar koruması.

**Yol boyunca düzeltilen üç şey:**
- `YanNav` operatöre sabitlenmişti; `app/bilesenler/YanNav.tsx`'e taşındı, üç prop
  aldı (`kok`, `altBaslik`, `bolum`) ve alttaki kimlik satırı artık rolü gösteriyor.
- **`next build` "database is locked" ile düşüyordu.** Next rotaları 19 ayrı işçide
  topluyor, hepsi aynı anda şemayı kuruyor. `DatabaseSync`'e `timeout` ve şemanın
  başına `PRAGMA busy_timeout` eklendi.
- Operatör genel bakışındaki "Mail hattı henüz bağlanmadı, son çekim boş" notu
  artık yalandı (hat bağlı, damgalar dolu). Not ikiye ayrıldı: hiç çekim yoksa
  "henüz çekim yapılmadı", varsa "çekim otomatik değil".

**Giriş akışındaki boşluk kapandı:** `/giris/dogrula` operatör olmayanı `/panel`'e
yolluyordu ama o rota yoktu. Artık var; firmasız bir kullanıcı da sessizce
düşmüyor, `/giris?durum=firmasiz` ile açık bir mesaj alıyor.

**Tarayıcıda uçtan uca denendi:** sahiplenme (durum kendiliğinden "İşlemde" oluyor),
devretme, kategori ve durum seçimi, sekme ve arama süzgeçleri, personel olarak giriş
(rol seçicileri ve IMAP ayrıntısı gizleniyor), operatör olarak `/panel` denemesi
(`/operator`'e dönüyor). 375 pikselde yatay taşma yok, konsolda hata yok.

---

---

## Mail hattı kuruldu

Kullanıcı sırayı bana bıraktı; mail hattından başladım çünkü ürünün çekirdeği o ve
müşteri panelini ondan önce taşımak boş ekran taşımak olurdu.

**Kurulan zincir:** `kaynak → ayrıştırma → kural motoru → SQLite`

- **`sunucu/kasa.ts`** — kutu parolaları için AES-256-GCM **zarf şifreleme**. Ana
  anahtar ortamda (`MAILHANEM_ANAHTAR`), her parola için ayrı veri anahtarı, veritabanına
  yalnızca şifreli hâli. Anahtar yoksa kod sessizce düz metne düşmüyor, patlıyor.
- **`sunucu/posta/kural.ts`** — modelden **önce** çalışan eleme. Bülten
  (`List-Unsubscribe`/`List-Id`), no-reply gönderenler, otomatik yanıtlar
  (`Auto-Submitted`, `Precedence: bulk`, boş `Return-Path`) ve kendi alan adından gelen
  iç yazışma. Saf fonksiyon, ağ yok, veritabanı yok.
- **`sunucu/posta/kaynak.ts`** — mail kaynağı arayüzü. İki uygulaması var:
  **`imap.ts`** (gerçek, `imapflow`, kutuyu **salt okunur** açıyor — okundu işareti
  koymuyor) ve **`dosya.ts`** (diskteki `.eml`). İkincisi oyuncak değil: hattın tamamı
  canlı kutu olmadan denenebilsin diye var, ayrıştırma ikisinde de aynı kodla yapılıyor.
- **`sunucu/posta/isci.ts`** — çekme işçisi. Elenen mail de kaydediliyor ama `elendi`
  sütunu dolu; "bu mail neden gelmedi" sorusunun cevabı görünür olsun diye.

**Yeni ekran: Posta Akışı.** Çekimi elle tetikliyor, her mailin yanında kural
motorunun kararını gösteriyor, Gelen/Elenen/Tümü diye süzülüyor. Eleme oranı da
orada — "bu kadarı ücretlendirilmez".

**Uçtan uca çalıştırıldı:** `ornek-posta/` klasöründeki on `.eml` ile iki kutudan
20 mail çekildi, 8'i geçti, 12'si doğru gerekçeyle elendi.

**32 test geçiyor** (`npm run dene`): kasa (kurcalama, yanlış anahtar, anahtar
yokluğu), kural motoru (her dal ve sınır durumu — "adında reply geçen gerçek kişi
elenmez", "benzeyen alan adı iç yazışma değildir" dahil), ve hattın tamamı.

### Önceki teşhisim yanlıştı — düzeltildi

Geçen turda "bu makinedeki kum havuzu WebSocket'i engelliyor, o yüzden dev
hidrate olmuyor" demiştim. **Doğru değilmiş.** Gerçek sebep Next 16'nın
`allowedDevOrigins` ayarı: sayfayı `127.0.0.1` üzerinden açınca Next kendi dev
kaynaklarını çapraz köken sayıp engelliyor, HMR kurulamayınca sayfa hiç hidrate
olmuyor ve **hata da vermiyor**. `next.config.ts`'e `allowedDevOrigins:
["127.0.0.1","localhost"]` eklendi; **dev artık sorunsuz çalışıyor.**

Aynı sessiz kırılmanın ikinci sebebi kök düzende elle yazılan `<head>` etiketiydi
(o da düzeltilmişti). App Router'da `<head>` elle yazılmaz.

---

## Arka taraf başladı — `mailhane/uygulama/`

Kullanıcının kararı: **panelleri Next.js'e taşı, backend'i kur, her şeyi bağla.**
Ayrıca net bir uyarı geldi: *"wp asistanı felan katma buraya, buranın onlarla bağı
yok — 0'dan bir proje bu."* Mailhanem bağımsız bir projedir; `saas` altındaki diğer
işlerin stack'i buraya emsal değildir.

**Kurulan:** Next.js 16 (App Router, Turbopack), TypeScript, `node:sqlite`, zod.
SQLite seçildi çünkü Windows'ta native derleme istemiyor ve ilk müşteriler tek
haneli; bütün SQL `sunucu/db.ts`'de toplandı, Postgres'e geçilirse değişecek tek
dosya orası. Ayrıntılar: `uygulama/README.md`.

**Bağlanan üç halka — üçü de uçtan uca denendi:**

1. **Demo talebi.** Sitedeki form → `POST /api/demo-talebi` → SQLite → operatör
   panelindeki **Demo Talepleri** kuyruğu. Kuyruk akışı gerçek: Yeni → Saat öner
   (hazır mailto) → Yazıldı → Görüşme kuruldu → Kapandı, geri açma dahil.
2. **Site ayarları.** Panelde yeni **Site Ayarları** ekranı → `GET /api/site-ayar`
   → sitenin footer'ındaki iletişim satırı. Boş bırakılırsa satır **hiç görünmüyor**;
   siteye hâlâ hiçbir adres gömülü değil.
3. **Giriş.** Sitedeki `giris.html` → `POST /api/giris-linki` → tek kullanımlık
   bağlantı → `/giris/dogrula` oturumu açıp panele bırakıyor. Şifre yok. Jetonlar
   veritabanında **yalnızca SHA-256 özetiyle** duruyor.

**Operatör panelinde çalışan ekranlar:** Genel Bakış, Demo Talepleri, Müşteriler,
Bağlantı Sağlığı, Site Ayarları. Hepsi gerçek veriyi okuyor. Eski prototipteki
maliyet/marj, abonelik ve sistem günlüğü ekranları henüz taşınmadı.

**Uydurma veri yok.** Mail hattı bağlanmadığı için "son çekim" boş ve ekranlar bunu
saklamıyor, açıkça yazıyor. Üretimde örnek veri hiç yazılmıyor; yalnız ilk operatör
kullanıcısı oluşuyor.

**Yol boyunca çözülen üç gerçek hata:**
- `node:sqlite` satırları null prototiple dönüyor, React onları Client Component'e
  geçirmiyordu. Bütün okumalar `db.ts`'de düz nesneye çevriliyor.
- Giriş yönlendirmesi host'u `localhost`'a çevirip az önce yazılan oturum çerezini
  düşürüyordu. Yönlendirme artık tarayıcının kullandığı `Host` başlığından kuruluyor.
- **Kök düzende elle yazılmış `<head>` etiketi hidrasyonu kırıyordu.** Fontlar
  `next/font`'a, favicon `metadata.icons`'a taşındı. App Router'da `<head>` elle
  yazılmayacak.

**Bilinen ortam sorunu:** bu makinedeki geliştirme kumandası WebSocket yükseltmelerini
engelliyor (Node'un kendi istemcisi bile bağlanamıyor), o yüzden ajanın test
tarayıcısında `next dev`'in HMR'ı kurulamadı ve sayfalar hidrate olmadı.
**Üretim derlemesinde sorun yok**, uçtan uca oradan doğrulandı. Kendi tarayıcında
`next dev` muhtemelen sorunsuz; şüphelenirsen `npm run yap && npm run basla`.

---

## ÖNEMLİ: tanıtım sayfası baştan yazıldı

Kullanıcı oturumun sonunda **posta kutusu duvarı konseptinden vazgeçti**:

> "https://www.leafer.io/ o konsepten vaz geçtim bu linkteki gibi bir site istiyorum"
> ve ardından "bunu birazda bizim konsepte uygun hale getir"

Pirinç kapaklar, emaye tabela, çekilen sürgü — **hepsi elendi.** Yeni sayfa referansın
görsel dilinde: beyaz zemin, pastel bant yıkaması, iri grotesk başlık + **serif italik
son satır**, hap düğmeler, saç teli çerçeveli kartlar, köşe kesim işaretli gri panolar,
mono mikro etiketler, kayan yetenek şeridi, sekmeli S.S.S.

**"Bizim konsept" nasıl yorumlandı:** posta kutusu benzetmesi olarak değil, **ürünün
kendi sistemi** olarak. Sayfa artık panellerin tipografisini (Instrument Sans +
IBM Plex Mono) ve renk jetonlarını (`--murekkep:#1D4E7C`, `--olumlu:#0F7154`) birebir
kullanıyor; referansın yeşili taklit edilmedi. Sayfadaki "canlı önizleme" panelleri
gerçekten panelin arayüzü. Yön sözleşmesi tamamen yenilendi:
`../.impeccable/surfaces/mailhane-site-index-html.md`.

**Eski sürüm silinmedi:** `site/_eski-kutu-duvari.html`. Vazgeçilen konsept ama
87 KB'lık çalışma; geri dönmek istenirse duruyor. İstenmezse silinebilir.

**Korunanlar:** bütün ürün gerçeği ve dürüstlük kuralları. Fiyat rakamı yok (paket
kartlarında rakam yerine ölçek yazıyor: Tek kutu / Çok kutu / Sınırsız + "Fiyat
görüşmede"). Müşteri referansı yok. Sayaçlar kullanım istatistiği değil ürün gerçeği
(0 onaysız giden mail · 45 dakika kurulum · 3 rol · firma başına). Demo talep formu ve
operatör paneline düşme akışı aynen duruyor.

**Ölçüm:** detektör 46 → 19 (kalanlar referansın kendi dili: mono mikro etiketler,
kayan şerit, ayraç noktaları, bilinçli yükselti). Yatay taşma yok, JS hatası yok,
kontrast tabanı tutuyor. S.S.S. sekmeleri, hero formunun adresi alt forma taşıması,
sayaçlar ve doğrulama tarayıcıda çalıştırılarak denendi.

**Bitiş incelemesi yapılmadı** — eski dünyanın incelemesi konusuz kalınca durduruldu,
yenisi henüz çalıştırılmadı. `DESIGN.md` de hâlâ yazılmadı.

## Giriş sayfası — `site/giris.html`

Referansın `/sign-up` düzeninde: solda tanıtım yarısı (pastel yıkama, marka, rozet,
serif italik biten başlık, özellik simgeleri, iki güvence satırı), sağda beyaz form
yarısı, aralarında saç teli çizgi. Üst rayda ve footer'da "Giriş" bağlantısı var.

**Önemli ayrım:** referanstaki sayfa bir *kayıt* sayfası (kart isteyip hesap açıyor).
Mailhanem'de **self-servis kayıt yok** — kurulum 45 dakikalık görüşmede birlikte
yapılıyor. O yüzden bu bir *giriş* sayfası; hesabı olmayanı demo talebine yönlendiren
bir satır ve bunu açıkça söyleyen bir not var.

**Giriş akışı `panel.html`'deki gerçek akışla aynı:** şifre yok, tek kullanımlık link.
İki hâl: adres gir → "Linki gönderdik" (15 dakika geçerli, farklı adres kullan).
Uçlar `AYAR.girisUcu` (`/api/giris-linki`) ve `AYAR.msUcu`. Arka taraf yokken dürüstçe
düşüyor: "Kurulumunuz henüz tamamlanmadıysa bu normal — demo talebi bırakın."
Microsoft düğmesi duruyor ama ucu bağlanmadığını söylüyor.

Ölçüldü: iki genişlikte de yatay taşma yok, kontrast ıskası yok, JS hatası yok.
Boş gönderim, bozuk adres, arka taraf yokken düşme ve başarı hâli tarayıcıda denendi.

**Google SSO eklenmedi** — Google Workspace desteklenen bir sağlayıcı ama `panel.html`
yalnızca Microsoft SSO tasarlamış; olmayan bir yetenek uydurulmadı. İsteniyorsa eklenir.

---

## Bir önceki turda ne yapılmıştı (artık geçersiz kısımlar var)

**Kullanıcının iki talebi:**

1. *"sayfa sadece sayfa, hiçbir sitenin ana sayfası hissiyatını vermiyo"* → üst ray
   (yapışkan, mobil menü, bulunduğun bölümü yakan scroll-spy), gerçek dört sütunlu
   footer, bağlanabilen posta sağlayıcıları levha şeridi, sekiz soruluk **S.S.S.**
   (açılan pirinç kapaklar), skip-link, favicon, OG etiketleri.
2. *"sağdaki demo panel görüntüsü soldaki karenin altında dursun, yandan ince posta
   kutusu kapağı gibi bişey olsun, onu çekince gözükmeye başlasın"* → **çekmece**.
   Kompozisyon sol sütuna indi: emaye tabela, altında duvara oturmuş pirinç çerçeveli
   bir bölüm. Sağ kenardaki tutamak sola çekilince duvarın o bölümü (kendi numaralı
   kapakları, 201+) yana kayıyor ve panel açıldıkça görünüyor. Sürükleme analog,
   bırakınca en yakın uca oturuyor; tıklama/Enter/boşluk/ok tuşları da çalışıyor.
   Sayfa açılabildiğini bir kez kendisi gösteriyor (kapak aralanıp kapanıyor).

**Gözden geçiricinin sekiz maddesi — hepsi kapandı:**
`ÇOK SEÇİLEN` rozeti silindi (Pro artık cam şeridindeki ışıkla + olgusal bir satırla
vurgulanıyor) · `GÜVEN %97` → `ONAY BEKLİYOR` · birincil eylemin gerçek hedefi var
(aşağıya bak) · imza etkileşimi kuruldu (`title` ipucu gitti; kategori+gönderen camın
üzerinde beliriyor, duvar imlece uyanıyor) · mobil ilk görüş alanında duvar tabelanın
üstünde/yanında/altında okunuyor · tabela küçüldü, başlık iki genişlikte de iki satır ·
yanan kapaklar içeriden ışıyor · `config.json` `code` oldu, gerekçesi sözleşmede.

**Ayrıca düzeltildi:** tabelanın tepesindeki kicker silindi (kalite tabanının kesin
yasağı) · duvar fazla parlaktı, yaşlanmış pirince indi ve ışıklı kapak sayısı azaldı ·
`#randevu` bölümünde başlık duvarın üstünde çıplak duruyordu, hero'yla aynı emaye
tabelaya oturdu · mobil menüdeki CTA soluk gri yazıyordu (CSS kuralı düğmeyi de
yakalıyordu) · 26 uzun tire 12'ye indi · metin taşıyan pirinç yüzeylerin koyu ucu
kontrast için açıldı.

Mekanik detektör **30 → 11**. Kalan 11: 8 `cramped-padding` (önceki gözden geçirici
piksele bakıp "kusur değil" dedi), 2 `dark-glow` (sözleşme "durum ışıkla söylenir"
diyor; ikisi de ofsetli+bulanık), 1 `clipped-overflow-container` (çekmecenin mekanizması).
**Yeniden kovalanmayacak.**

## Demo talebi nereye düşüyor

Kullanıcının kararı: **takvim aracı yok, talep operatör paneline düşsün.** İletişim
bilgileri de panelden yönetilsin.

- Sitede `#randevu` bölümü artık gerçek bir **form**: ad, firma, e-posta, telefon,
  posta sağlayıcısı, kutuya bakan kişi sayısı, serbest not. Türkçe doğrulama, hata
  durumları, başarı ekranı, odak yönetimi — hepsi çalışıyor.
- Form `AYAR.talepUcu` (`/api/demo-talebi`) adresine POST eder.
- `operator.html`'e **Demo Talepleri** ekranı eklendi (nav'da yeni talep sayısı rozeti).
  Alanlar sitedeki formla birebir. Kuyruk akışı: Yeni → Saat öner (hazır mailto) →
  Yazıldı → Görüşme kuruldu → Kapandı, geri açma dahil.
- **Hiçbir adres sayfaya elle gömülmedi.** `AYAR.eposta` / `AYAR.telefon` boş; sayfa
  `/api/site-ayar`'dan çekmeye çalışıyor, gelmezse iletişim satırını **hiç göstermiyor**.
  Uydurma adres yayınlamaktansa satırı göstermemek doğru olan.
- Arka taraf yokken form dürüstçe düşüyor: `AYAR.eposta` doluysa hazır bir mail taslağı
  öneriyor, boşsa "şu an gönderilemedi" diyor. Yalan söylemiyor.

## Sırada bekleyenler

_(Bu liste önceki turlardan kalma; üstteki "YARIN BURADAN DEVAM" güncel olanıdır.)_

- **Bitiş incelemesi** yeni sayfa için çalıştırılacak (eski dünyanınki durduruldu).
- `DESIGN.md` — belgeleyici yazacak. Sözleşmenin bitiş koşulu: *incelenmemiş ve
  belgelenmemiş olan bitmemiştir.*
- Demo paneline şerit: "örnek verilerle çalışıyor" + siteye dönüş. `operator.html`'e
  eklenmeyecek.
- **Yapay zekâ adımı:** geçen maillerin sınıflandırması (satış/destek/fatura/şikayet)
  ve yanıt taslağı. Kural motoru hazır, model adımı yok. Anthropic anahtarı gerekiyor.
- Outreach için ayrı alan adı (`mailhanem.net`).

## Ortam notları

- **Sürüm kontrolü:** depo `saas/mailhane/` kökünde, ana dal `ana`, uzak
  `github.com/devmurky/mailhanem` (private). `gh` PATH'te yok:
  `"C:\Program Files\GitHub CLI\gh.exe"` diye tam yolla çağır.

- Yakalama: `../.impeccable/yakala.py`. Site artık uygulamanın içinden
  (`http://127.0.0.1:3100/`) servis ediliyor; aracın adresi ona göre verilmeli.
  Ayrı 8791 sunucusu **yok**. `file://` çöküyor. Dört dosyayı `../.impeccable/review/`
  içine yazar; **adlar değişmeyecek** — gözden geçirici tam o yolları yeniden okuyor.
  Yeni sayfaya göre güncellendi: sayaçlar bitsin diye sayfayı bir kez sonuna kadar
  kaydırıyor, ve `scroll-behavior:smooth` yakalamayı kaydırmanın ortasına düşürdüğü
  için geçici olarak kapatıyor.
- **Heredoc kullanılmayacak.** Bu kabukta `<<'EOF'` içindeki `\n` gerçek satır sonuna
  dönüşüp JS dizgilerini kırıyor — bu oturumda da operator.html'i bir kez kırdı. Ters
  bölü içeren yamalar Write ile dosyaya yazılıp öyle çalıştırılacak; mailto gövdeleri
  gibi yerlerde `%0A` kullanmak daha temiz.
- `operator.html` ve `panel.html` birer **Artifact gövdesi**: kendi `<head>`'leri yok,
  charset'i Artifact sarmalayıcısı veriyor. Düz HTTP ile servis edilirlerse Türkçe
  karakterler bozuk çıkar. Yerelde bakmak için `<!doctype html><html><head>
  <meta charset="utf-8">` + gövde + `</head><body></body></html>` diye sarıp ayrı bir
  klasöre yaz, oradan servis et. (Bu oturumda 8792'de böyle açıldı; geçici klasördeydi,
  kalıcı değil. Prototipler giriş ekranıyla açılıyor, "Girişi simüle et (demo)"
  düğmesi panele sokuyor.)
- JS sözdizimi kontrolü: script bloğunu ayıklayıp `node --check`.
- **Kabuk her zaman aynı gelmiyor.** Bir oturumda Bash aracının PATH'i eksik
  geldi: `grep`, `sed`, `head`, `python`, hatta `npm` "command not found"
  dönüyordu. Böyle bir durumda PowerShell aracına geç (`npm run dene`,
  `Select-String`, `Get-Content -Tail`) ve dosya değişikliklerini Edit/Write
  ile yap. Testlerin çalışmaması kodun bozuk olduğu anlamına gelmiyordu.
- **Üretim sunucusu oturum kapanınca ölüyor.** Arka planda başlatılan
  `npm run basla` süreç kapanınca duruyor; yeni oturumda 3100 boşsa
  `npm run yap && npm run basla` ile geri kaldır.

## Yayındaki kopyalar

| | |
|---|---|
| Tanıtım sayfası | https://claude.ai/code/artifact/57663730-46d7-4ac3-a1fe-32dfdbfddfff |
| Müşteri paneli | https://claude.ai/code/artifact/98d61e35-2fe2-4c39-b6b6-78159ef4ed56 |
| Operatör paneli | https://claude.ai/code/artifact/e34d0be6-fd1f-4eac-b3a9-131048b8d46f |

**Üçü de çok bayat** — eski "Mailhane" adını taşıyorlar ve o tarihten sonra hem
tanıtım sayfası hem paneller baştan yazıldı. Kullanıcı istemeden yayınlanmayacak.
`site/artefakt.html` ve `site/_eski-kutu-duvari.html` de bayat kopyalar; yeniden
adlandırmada bilerek dokunulmadı.
