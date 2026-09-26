# Mailhanem — uygulama

Panellerin ve tanıtım sayfasının arkasındaki sunucu. Next.js 16 (App Router),
TypeScript, `node:sqlite`, zod.

## Çalıştırma

```bash
npm install
cp .env.ornek .env.local   # MAILHANEM_ANAHTAR'ı doldurun
npm run dev                # http://127.0.0.1:3100
```

**Tek sunucu, tek köken.** Tanıtım sayfası da buradan çıkıyor: `/` tanıtım
sayfası, `/giris` giriş, `/panel` ve `/operator` uygulama. Ayrı bir statik
sunucu gerekmiyor.

Üretim gibi çalıştırmak için:

```bash
npm run yap && npm run basla   # http://127.0.0.1:3100
```

Diğer komutlar: `npm run kontrol` (tsc) · `npm run dene` (testler).

### Tanıtım sayfası nasıl servis ediliyor

Kaynak dosya yerinde duruyor: `mailhanem/site/index.html`. Yön sözleşmesi ve
yakalama aracı tam o yolu okuduğu için oradan taşınmadı. Onun yerine
`araclar/siteyi-kopyala.mjs` **derleme öncesi** (`predev` / `preyap`) dosyayı
`public/tanitim/index.html`'e kopyalıyor ve iki şeyi değiştiriyor:

1. `AYAR.koku` boşaltılıyor — uçlar artık aynı kökende, CORS'a gerek yok.
2. `giris.html` bağlantıları `/giris`'e dönüyor — uygulamanın kendi giriş
   sayfası gerçek olanı.

`next.config.ts`'deki `beforeFiles` yeniden yazımı `/` adresini o dosyaya
bağlıyor. `beforeFiles` seçilmesinin sebebi: dosya sisteminden ve sayfa
rotalarından önce çalışıyor.

Değişimlerden biri tutmazsa kopyalayıcı **patlar**; sessizce geçseydi yayına
çıkan sayfa yanlış kökene istek atardı.

`site/giris.html` artık servis edilmiyor — site ile uygulama ayrıyken
yazılmıştı, tek kökende uygulamanın `/giris` sayfası onun yerini alıyor.
Tasarım artefaktı olarak duruyor.

## Giriş

Giriş sayfası (`/giris`) tanıtım sayfasındaki tasarımın uygulama içindeki
karşılığı: solda pastel yıkama, marka ve iki güvence satırı; sağda kart içinde
form. Statik `site/giris.html` servis edilmiyor — üç davranış sunucu tarafında
yaşıyor ve statik dosyada olamazdı: oturumu açık olanı doğrudan paneline
göndermek, süresi dolmuş bağlantıyı bildirmek, ve SMTP kapalıyken bağlantının
maille gitmediğini söylemek.


Şifre yok. `/giris`'e adres yazılır, tek kullanımlık bağlantı üretilir ve
adrese mail olarak gider. `SMTP_SUNUCU` tanımlı değilse **mail gönderilmez**;
bağlantı sunucu günlüğüne yazılır — konsolda `[giris] ... → http://...`
satırını kopyalayıp tarayıcıya yapıştırın. Giriş ekranı bu durumu saklamaz,
"posta gönderimi tanımlı değil" diye yazar.

Adres tanınsın tanınmasın cevap aynıdır; kimin müşteri olduğu bu formu
deneyerek öğrenilemez. Gönderim hatası da dışarı yansıtılmaz (yansısaydı
hangi adresin kayıtlı olduğunu ele verirdi) — hata günlüğe ve operatör
panelindeki **Site Ayarları → Posta gönderimi** kartına düşer.

İlk açılışta veritabanı boşsa operatör kullanıcısı kendiliğinden oluşur
(varsayılan `operator@mailhanem.app`). Geliştirmede ayrıca bir örnek firma, iki
kutu ve beş demo talebi yazılır; **üretimde örnek veri yazılmaz.**

## Ortam değişkenleri

| Değişken | Varsayılan | Ne işe yarar |
|---|---|---|
| `DB_YOLU` | `./veri/mailhanem.db` | SQLite dosyası |
| `OPERATOR_EPOSTA` | `operator@mailhanem.app` | İlk açılışta oluşan operatör |
| `OPERATOR_AD` | `Operatör` | Onun görünen adı |
| `UYGULAMA_KOKU` | `http://127.0.0.1:3100` | Giriş bağlantısındaki kök |
| `SITE_KAYNAKLARI` | 127.0.0.1:8791, localhost:8791, mailhanem.app | CORS listesi |
| `MAILHANEM_ANAHTAR` | — | **Zorunlu.** Kutu parolalarının ana anahtarı, 32 bayt base64 |
| `POSTA_KAYNAGI` | (boş) | `dosya:./ornek-posta` derseniz IMAP yerine `.eml` okunur |
| `SMTP_SUNUCU` | (boş) | **Boşsa uygulama mail göndermez**, günlüğe yazar |
| `SMTP_PORT` | 587 | 465 verilirse örtük TLS varsayılır |
| `SMTP_GUVENLI` | porta göre | `1`/`0` ile elle belirlenir |
| `SMTP_KULLANICI` · `SMTP_PAROLA` | (boş) | Boşsa kimlik doğrulamasız bağlanır |
| `SMTP_GONDEREN` | `Mailhanem <bildirim@mailhanem.app>` | `From` başlığı |
| `NEXT_PUBLIC_TURNSTILE_SITE` | (boş) | Turnstile site anahtarı — tarayıcıya gider |
| `TURNSTILE_GIZLI` | (boş) | Turnstile gizli anahtarı. **İkisi birden boşsa koruma kapalı** |
| `ANTHROPIC_ANAHTAR` | (boş) | **Boşsa bilgi deposu çıkarımı çalışmaz**, panel bunu açıkça yazar. `ANTHROPIC_API_KEY` adı da okunur |
| `ZEKA_MODEL` | `claude-sonnet-5` | Çıkarımın kullandığı model |
| `ZEKA_KURUS_1M_GIRDI` · `ZEKA_KURUS_1M_CIKTI` | (boş) | Milyon token başına kuruş; boşsa maliyet sıfır yazılır, token yine kaydedilir |

## Kutu parolaları

Parolalar AES-256-GCM **zarf şifreleme** ile saklanır: ana anahtar ortamda durur,
her parola için ayrı bir veri anahtarı üretilir, veritabanına yalnızca şifreli
hâlleri yazılır. Ana anahtar yoksa kod sessizce düz metne düşmez — patlar.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Çıkanı `MAILHANEM_ANAHTAR` olarak verin. **Anahtarı kaybederseniz kayıtlı
parolalar çözülemez**, kutuların yeniden bağlanması gerekir.

## Mail hattı

```
kaynak (IMAP ya da .eml)  →  ayrıştırma (mailparser)  →  kural motoru  →  SQLite
```

Kural motoru **modelden önce** çalışır: bülten (`List-Unsubscribe`), no-reply
gönderenler, otomatik yanıtlar (`Auto-Submitted`, `Precedence: bulk`, boş
`Return-Path`) ve kendi alan adınızdan gelen iç yazışma elenir. Elenen mail de
kaydedilir ama `elendi` sütunu dolu olur — "bu mail neden gelmedi" sorusunun
cevabı görünür olsun diye. Modele giden yalnızca geçenlerdir.

Çekilen her mailin **gövdesi de saklanıyor** (`mailler.govde`, 20 000 karakterle
sınırlı) — panelde mail okunabilsin diye. Bu sütun sonradan eklendi; eski bir
veritabanı açıldığında `db.ts` sütunu kendiliğinden ekler, o tarihten önce
çekilmiş maillerde yalnızca özet kalır.

### İmza ve alıntı kuyruğu

`sunucu/posta/imza.ts` gövdeyi ikiye ayırıyor: asıl mesaj ve kuyruk (imza,
alıntılanan yazışma, yasal uyarı). Özete yalnız asıl mesaj giriyor — listede
alt alta duran on mailin özeti "Tel: 0212 … · www…" diye başlayınca hiçbiri
ayırt edilemiyordu.

**Kuyruk silinmiyor, ayrılıyor.** Gövde veritabanında tam duruyor; mail
detayında kuyruk katlanmış bir satırın arkasında ("İmza · 6 satır"). Ayırma
her gösterimde yeniden yapılıyor, yani kural değişince eski mailler de düzeliyor.

Kesme kuralları sırayla: RFC ayracı (`--`), alıntı başlıkları ("… şunu yazdı:",
"On … wrote:", Outlook'un `From:/Sent:/Subject:` bloğu), yasal uyarı kalıpları,
kapanış cümlesi + kısa blok ("Teşekkürler, / Ayşe Demir"), ve son çare olarak
iletişim izi taşıyan son blok. Her kuralın koşulu var; **şüphedeyse kesmiyor**,
çünkü yanlış kesme mesajın son paragrafını gizler.

Özet ise gövdenin aksine **saklanıyor** (çekim anında yazılıyor), o yüzden
kural değişince eski satırlar eski hâlinde kalırdı. `ozetleriTazele()` açılışta
bir kez gövdesi olan bütün maillerin özetini yeniden üretiyor ve arama dizinini
de yazıyor; damgası `ayarlar.ozet_imza_surumu`. Kırpma kuralı değişirse sürüm
numarası artırılır, pas bir kez daha atılır.

### Konuşma zinciri

Her mail bir `konusma` değeri taşıyor: zincirin ilk mailinin Message-ID'si.
Zincir iki yoldan kuruluyor (`sunucu/posta/konusma.ts` + `konusmaCoz`):

1. **Başlık zinciri** — `In-Reply-To` / `References`. Bizim gönderdiğimiz
   yanıtların Message-ID'lerine de bakılıyor; yoksa müşteri bizim cevabımıza
   cevap verdiğinde zincir tam orada kopardı.
2. **Konu + gönderen** — başlık yoksa aynı kutuya, aynı adresten, aynı konu
   köküyle (Re:/Ynt:/Fwd: kırpılarak) 60 gün içinde gelen mail.

Yedek yolun "aynı gönderen" şartı bilinçli: "Merhaba" konulu iki müşteriyi tek
konuşmada birleştirmek, ayrı bırakmaktan çok daha ağır bir hata olurdu.

Sütun sonradan eklendi; açılışta eski mailler yedek kurala göre bir kez geri
dolduruluyor (`konusmalariGeriDoldur`). Zinciri bulunamayan mail kendi
kimliğini alıyor — "konuşması olmayan mail" diye bir durum yok, tek mesajlık
konuşma var.

Canlı kutu olmadan denemek için:

```bash
POSTA_KAYNAGI=dosya:./ornek-posta npm run dev
```

Sonra **Posta Akışı → Çekimi çalıştır**. `ornek-posta/` klasöründe kural
motorunun her dalını kapsayan on `.eml` var.

### Zamanlayıcı

Çekim elle tetiklenebildiği gibi periyodik de çalışır. Aralık **Posta Akışı**
ekranından seçilir (kapalı · 5 · 15 · 30 · 60 · 180 dakika) ve `ayarlar`
tablosunda durur. Zamanlayıcıyı sunucu açılışında `instrumentation.ts` kuruyor;
dakikada bir nabız atıp aralık dolduysa `hepsiniCek()` çağırıyor.

Ayrı bir kuyruk ya da cron servisi **yok** — bugünkü ölçek (tek süreç, tek
haneli müşteri) için ikinci bir sistem kurmaya değmezdi. Bunun iki sonucu var:
uygulama kapalıyken tur atlanır, ve uygulama **iki kopya** halinde
çalıştırılırsa iki zamanlayıcı olur (mail mükerrer yazılmaz ama IMAP'e boşuna
yük biner). Ölçek büyürse burası dışarı taşınacak yerdir.

## Testler

```bash
npm run dene
```

224 test: kasa (zarf şifreleme, kurcalama, anahtar yokluğu), kural motoru (her
dal ve sınır durumu), hattın tamamı (on bir `.eml` → ayrıştırma → karar),
imza/alıntı ayırma (her kesme kuralının bir de "kesmemeli" örneğiyle), konuşma
zinciri (birleşmesi ve **ayrı kalması** gerekenler), müşteri panelinin veri
katmanı (firma sınırı, süzgeçler, sayaçlar, davet, yanıt taslakları, hesap
kaydı), bilgi deposu (öneri akışı ve firma sınırı), çıkarım boru hattı
(anahtarsızken ağa çıkmama, imza kırpma, bozuk çıktıda hiçbir şey yazmama),
zamanlayıcı ayarı, giden posta ve yanıtlama (sahte bir SMTP sunucusuyla
gerçek el sıkışma) ve yönlendirme motoru.

## Yapı

```
sunucu/
  db.ts        şema + bütün SQL. Postgres'e geçilirse değişecek tek dosya.
  oturum.ts    sihirli bağlantı, oturum, çerez. Jetonlar özet olarak saklanır.
  dogrula.ts   dışarıdan gelen her şeyin zod şeması
  cors.ts      dışa açık üç ucun kaynak listesi
  tohum.ts     ilk açılış: operatör (her ortam) + örnek veri (yalnız geliştirme)
  kasa.ts      AES-256-GCM zarf şifreleme (kutu parolaları)
  posta/
    kural.ts   modelden önceki eleme — saf fonksiyon, testli
    kaynak.ts  mail kaynağı arayüzü + özet çıkarma
    dosya.ts   .eml klasöründen okuyan kaynak (+ ortak ayrıştırma)
    imap.ts    gerçek IMAP kaynağı (salt okunur) + bağlantı denemesi
    isci.ts    çekme işçisi: kaynak → kural → veritabanı
app/
  giris/       giriş sayfası + /giris/dogrula (bağlantıyı harcayıp oturumu açar)
  operator/    genel bakış, demo talepleri, posta akışı, müşteriler, bağlantı
               sağlığı, abonelikler, maliyet ve marj, sistem günlüğü, site ayarları
  panel/       müşteri paneli: gelen kutusu, mail detayı, mail hesapları,
               yönlendirme, yanıt şablonları, ekip.  yetki.ts panelin kapısıdır.
  bilesenler/  iki panelin paylaştığı parçalar (Ikon, YanNav)
  api/         demo-talebi · site-ayar · giris-linki   (dışa açık, CORS'lu)
```

## Müşteri paneli (`/panel`)

Firma kullanıcısının gördüğü yer. Üç ekran:

| Ekran | Ne yapar |
|---|---|
| Genel Bakış | Durum halkası, kategori dağılımı, bekleyen/geciken sayıları, son mailler |
| Gelen Kutusu | **İki sütunlu triyaj**: solda liste ve süzgeçler, sağda seçili mailin tamamı |
| Mail detayı | Gövde, sahiplenme ve devretme, kategori, durum, **yanıt yazıp gönderme**, giden yanıtların kaydı |
| Mail Hesapları | Kutular, bağlantı durumu, sayılar; **kutu bağlama ve parola güncelleme** |
| Kategoriler ve Yönlendirme | Gelen maili kategoriye ve kişiye bağlayan kurallar |
| Yanıt Şablonları | Sık yazılan cevaplar; yanıt kutusuna tek tıkla eklenir |
| Ekip ve Yetkiler | Davet, rol değişimi, ekipten çıkarma |

**Firma sınırı tek yerde:** `app/panel/yetki.ts`. Sayfalar ve sunucu eylemleri
firma numarasını URL'den değil oturumdan alır; `db.ts`'deki panel sorgularının
hepsi `firma_id`'yi koşulun içinde taşır. `test/panel.test.ts` bu sınırı iki
firmayla birlikte zorluyor.

**Roller:** `sahip` rol dağıtır (sahipliği devredemez), `yonetici` kutu
ayrıntılarını görür, `personel` mailleri işler ama kurulum ayrıntılarını
görmez.

**Davet:** eklenen kişiye tek kullanımlık giriş bağlantısı mail olarak gider.
Ayrı bir "kabul" adımı yok — bağlantıya tıkladığı an paneldedir. SMTP kapalıysa
davet yine oluşur ve bağlantı davet edene gösterilir, elden iletsin diye.

**Ekipten çıkarma silmez, kapatır.** Silseydik o kişinin sahiplendiği maillerin
geçmişi "kimse"ye dönerdi. Kapatılan kişinin açık oturumları anında düşer,
bekleyen giriş bağlantıları iptal olur, bir daha giremez; kaydı listede kalır.

### Gelen kutusunun düzeni

Tasarım prototipindeki (`tasarim/panel.html`) triyaj düzeni: solda 316–392px
genişliğinde liste, sağda seçili mailin tamamı, **ikisi ayrı ayrı kayıyor**.
Tek sütunda liste ile detay arasında gidip gelmek her mailde bir sayfa yükü
demekti.

Detay tek bir yerde duruyor — `app/panel/mail/MailDetay.tsx`. Hem sağ sütunda
gömülü, hem `/panel/mail/[id]` tam sayfasında aynı bileşen çiziliyor; iki ayrı
kopya tutmak, birinde düzeltilen şeyin ötekinde kalmasına yol açardı.

Süzgeçler adreste: `?sekme=&kategori=&kutu=&q=&mail=`. Böylece JavaScript
olmadan da çalışıyor, paylaşılabiliyor ve satıra tıklamak süzgeci bozmuyor.

**İki ayrı soru bilinçli olarak ayrıldı:** sağ sütunda ne gösterilecek (adreste
mail yoksa ilk satır — geniş ekranda sağ sütun boş durmasın diye) ve kullanıcı
bir mail *seçti* mi (yalnızca adresteki `mail` söyler). Dar ekranda liste
ikincisine göre gizleniyor; kendiliğinden seçilen mail listeyi gizleseydi
telefonda hiç liste görülemezdi.

`.sahne`nin dolgusu bu sayfada `:has()` ile sıfırlanıyor — düzen dosyasına
dokunmadan yalnızca bu sayfayı etkiliyor.

### Prototipten gelen geri kalan parçalar

Bunlar sonradan eklendi; hepsi **veri girdikçe kendiliğinden doluyor**:

- **Durum halkası** (`/panel/ozet`) — prototipteki "onay durumu" halkasının
  yerinde ama başka bir şeyi gösteriyor: taslakların onay durumu yerine
  **mailin ekipteki durumu**. Taslak diye bir kayıt yok; olmayan şeyin grafiği
  çizilmez. Halka sunucuda çiziliyor, grafik kütüphanesi yok.
- **Kategori dağılımı** — kategorisiz de bir satır; listeden düşürmek onu
  görünmez yapar ve "toplam neden tutmuyor" sorusunu doğururdu.
- **Geciken / bekleme süresi** — mailin kendi tarihinden hesaplanıyor
  (`GECIKME_SAAT`, şu an 24). Kapanmış ya da yanıtlanmış mailde bekleme yok.
  Gelen kutusunda hem sekme hem satır rozeti olarak var.
- **VIP** — maile değil **gönderenin adresine** bağlı (`vip_gonderenler`).
  Aynı kişiden gelen bütün mailler, bundan sonrakiler dahil, yıldızlanıyor.
  Ekipteki herkes işaretleyebiliyor.

**Hâlâ yok ve kendiliğinden dolmayacak:** onay bekleyen/gönderilen/reddedilen
**taslak sayıları** ve **güven yüzdesi**. Ortada taslak kaydı yok — sütunu,
tablosu, hiçbiri. Genel Bakış'ta bunun yerine ne olacağını söyleyen kesikli
çerçeveli bir yer tutucu duruyor. Oraya "0 taslak bekliyor" yazmak "özellik
çalışıyor, bekleyen yok" demek olurdu; boş değil, yanlış olurdu.

### Yönlendirme kuralları

`sunucu/posta/yonlendirme.ts` — saf fonksiyon, testli. Üç tip kural var:
gönderen adresi (tam eşleşme), gönderenin alan adı (alt alan adları dahil),
konuda geçen kelime. **İlk eşleşen kazanır ve durur**; iki kural farklı kategori
söylerse hangisinin kazandığı belirsiz olmasın diye. Sıra panelden ayarlanır.

Kural **dolu alanın üstüne yazmaz**: insanın seçtiği kategori ya da sahiplendiği
mail kural yüzünden değişmez. Kurallar çekim sırasında uygulanır; "Kutudakilere
de uygula" düğmesi zaten duran maillere de geçirir.

`kural.ts` ile karıştırılmasın: o **eleme** yapar (mail panele hiç girmesin),
bu **sınıflandırma** yapar (giren mail kimin işi). Model adımı geldiğinde bu
kurallar kalacak — elle kurulmuş bir kural modelin tahmininden kesindir.

### Yanıtlama

Yanıt **müşterinin kendi kutusundan** çıkar (`sunucu/posta/yanit.ts`), Mailhanem'in
sistem SMTP'sinden değil: müşteriye cevap veren firma, Mailhanem değil. `From`
kutunun adresi, kimlik kutunun SMTP kimliği, parola kutu bağlanırken şifrelenen
parola. `In-Reply-To` ve `References` gelen mailin Message-ID'sine bakar, böylece
yanıt karşı tarafta aynı konuşmanın altına düşer.

Gönderilen yanıt **veritabanına da yazılır** (`yanitlar`): kutuyu salt okunur
açtığımız için "Gönderilmiş Öğeler" klasörüne koyamıyoruz, ekip kendi yazdığını
görebilsin diye kaydı panelde tutuyoruz. Başarısız denemeler de yazılır.

Onay basamağı yok: yazan ile gönderen aynı kişi. Araya girecek bir yapay zekâ
taslağı olmadan onay şartı uydurma olurdu.

**Taslak kendiliğinden kaydediliyor.** Yazma durduktan 1,2 saniye sonra metin
`yanit_taslaklari` tablosuna yazılıyor; sekme arkaya atılınca ve başka maile
geçilince bekleyen metin hemen gönderiliyor. Kutunun altındaki satır ne
olduğunu olduğu gibi söylüyor ("Taslak kaydedildi · 14:32"), kaydedilemezse
bunu da söylüyor. Yanıt gidince taslak siliniyor.

Taslak **kişiye ait**: anahtar (mail, kullanıcı). Aynı maile yazan iki kişi
birbirinin metnini ezmiyor ve kimse başkasının yarım yazısını görmüyor. Gelen
kutusundaki satırda "taslak" rozeti yalnız kendi taslağınız için çıkıyor.

Bu tablo **yapay zekâ taslağı değil**: Genel Bakış'taki "yanıt taslakları"
kartı modelin üreteceği önerileri anlatıyor, burası insanın yarım bıraktığı
metin.

### Konuşma görünümü

Mail detayında, çok mesajlı bir yazışmada gövdenin üstünde **Konuşma** şeridi
var: zincirdeki gelen mailler ve giden yanıtlar tek bir akışta, eskiden yeniye,
şu an okunan işaretli. Gelen kutusu satırında da "3 mesaj" rozeti duruyor.

Liste hâlâ mail başına bir satır; konuşmalar tek satıra **katlanmıyor**. Sebebi
sayaçlar: sekme rakamları ("sahipsiz", "geciken") mail üzerinden hesaplanıyor
ve konuşma katlanınca "hangi mail sayılıyor" sorusunun cevabı belirsizleşiyor.
Katlama istenirse önce o soru cevaplanmalı.

**Panelde henüz olmayanlar:** kategori önerisi (model adımı yok), ek dosya
gönderme, kutu kaldırma (kutuyla birlikte bütün mail kaydı silineceği için
operatörde).

## Tanıtım sayfasıyla bağı

| Sitedeki şey | Uç | Panelde nerede |
|---|---|---|
| Demo formu | `POST /api/demo-talebi` | Demo Talepleri kuyruğu |
| "Demoda deneyimleyin" düğmesi | `GET /demo` | Dolu müşteri paneli (aşağı bak) |
| Footer iletişim satırı | `GET /api/site-ayar` | Site Ayarları |
| `giris.html` formu | `POST /api/giris-linki` | — |

Site artık uygulamayla **aynı kökende** servis ediliyor, bu yüzden `AYAR.koku`
kopyalama adımında boşaltılıyor ve bu üç uç için CORS devreye girmiyor.
`sunucu/cors.ts` yine de duruyor: site ileride ayrı bir alan adına taşınırsa
gereken tek şey `SITE_KAYNAKLARI` listesi.

**Hiçbir iletişim bilgisi siteye gömülü değil.** Site Ayarları boş bırakılırsa
sayfa iletişim satırını hiç göstermez.

## Demo vitrini (`/demo`)

Sitedeki **"Demoda deneyimleyin"** düğmesi (üst ray, hero ve mobil menü — üçü de
`AYAR.demoUcu`'ndan besleniyor) ziyaretçiyi giriş istemeden dolu bir müşteri
paneline bırakır: `sunucu/demo.ts` vitrini kurar, oturum açılır, `/panel/ozet`.

Boş panel ürünü anlatmaz — gelen kutusu boşken sekmeler, süzgeçler, geciken
rozeti ve genel bakış halkası hiçbir şey söylemez. O yüzden gerçekçi ama
**tamamen uydurma** bir firma yazılıyor: 2 kutu, 15 mail (4'ü kural motorundan
elenmiş), 3 kişi, 3 şablon, 4 yönlendirme kuralı, 2 VIP gönderen.

Üç kural:

1. **Veri demo olduğunu saklamıyor.** Firma `demo=1` bayrağı taşır; panel tepeye
   "örnek verilerle çalışıyor" şeridi koyar (`demoMu()` → `app/panel/layout.tsx`).
   Ziyaretçi gerçek bir müşterinin kutusuna baktığını sanmamalı.
2. **Her ziyarette sıfırlanır.** Firma silinip yeniden yazılır; `ON DELETE
   CASCADE` kullanıcıları, mailleri ve oturumları da götürür. Önceki ziyaretçinin
   sahiplendiği mail sonrakine kalmaz.
3. **Gerçek veriye dokunmaz.** Silme yalnız `WHERE demo = 1`. `test/demo.test.ts`
   bunu doğruluyor: gerçek firma, kullanıcısı ve maili yerinde kalıyor, demo
   kullanıcısı firma sınırını aşamıyor.

**Bilinen sınır:** tek bir demo firma var; aynı anda iki ziyaretçi girerse ikincisi
birincinin panelini sıfırlar. Tek haneli müşteri sayısında sorun değil, ziyaretçi
başına ayrı vitrin gerekirse bölünecek yer burası.

## Bot koruması (Cloudflare Turnstile)

Giriş formu tanınan bir adrese mail gönderiyor; koruma olmadan biri bu ucu
döngüye sokup bir müşteriyi mail yağmuruna tutabilirdi. Adres sayımına karşı
zaten korunuyor — cevap adres tanınsın tanınmasın aynı.

Cloudflare'in WAF / Bot Management katmanı DNS seviyesinde çalışır, koda
eklenmez; alan adı Cloudflare'in arkasına geçtiğinde kendiliğinden devreye
girer. Forma gömülebilen tek Cloudflare aracı **Turnstile**, o yüzden bu
seçildi.

- **İki anahtar birden yoksa koruma kapalıdır** ve giriş çalışmaya devam eder.
  Yalnız site anahtarı verilirse tarayıcıda bulmaca çıkar ama sunucu onu
  doğrulayamaz; böyle bir yarı kurulum "açık" sayılmıyor — güvenlik hissi verip
  hiçbir şey yapmayan bir durum olurdu.
- Doğrulama **adres okunmadan önce** yapılıyor. Doğrulama adresin kayıtlı olup
  olmamasına göre farklı davransaydı, hata mesajının kendisi o bilgiyi ele
  verirdi.
- **Ağ hatasında istek reddediliyor.** Tersi — hata olunca geçirmek — koruma
  duvarını, Cloudflare'e erişimi kesebilen birinin isteğiyle indirilebilir hale
  getirirdi.

**Bulmaca çoğu ziyaretçide hiç görünmüyor.** Widget `interaction-only` ile
çiziliyor: Cloudflare kararı arka planda veriyor, kutuyu yalnızca gerçekten
şüphelendiğinde gösteriyor. Ölçüldü — normal yüklemede yükseklik 0, iframe hiç
oluşmuyor, ama jeton üretiliyor ve doğrulama çalışıyor.

Widget'ın **içi biçimlendirilemez**: çapraz kökenli bir iframe, içi
Cloudflare'in kendi arayüzü. Bizim denetimimizdeki tek şey ne zaman ve ne
boyutta çizileceği (`appearance`, `size`, `theme`) ve nereye konacağı.
Göründüğünde `flexible` ile kartın genişliğine oturuyor. Kutu gizli olduğu için
altında tek satır mono not duruyor — Cloudflare de gizlendiğinde bunun
belirtilmesini istiyor.

Yerelde denemek için Cloudflare'in belgelediği "her zaman geçer" anahtarları
`.env.ornek` içinde yazılı. **Deneme anahtarı kullanılırken** widget göründüğü
durumlarda kırmızı bir "sadece test için" şeridi taşır; gerçek anahtarda o
şerit yoktur.

**Demo talebi formunda henüz yok.** Site tarafındaki o form da aynı ölçüde
hedef; eklenmesi gereken ikinci yer orası.

## Giden posta

Uygulamanın kendi gönderdiği mailler — **giriş bağlantısı** ve **ekip daveti** —
`sunucu/posta/gonderim.ts` üzerinden çıkar. `SMTP_SUNUCU` boşsa hiçbir şey
gönderilmez: mesaj konsola yazılır ve çağıran taraf `gercek: false` alır, yani
kimseye "gönderdim" denmez.

Gönderim **hata fırlatmaz**; giriş akışı bir posta sunucusu yüzünden yarıda
kalmamalı. Hatalar günlüğe ve `ayarlar` tablosuna yazılır, operatör panelinde
**Site Ayarları → Posta gönderimi** kartında görünür.

Müşterinin kendi mail yanıtları buradan geçmiyor — mail yanıtlama henüz yok.

## Operatör tarafı

| Ekran | Ne yapar |
|---|---|
| Genel Bakış · Demo Talepleri · Posta Akışı · Müşteriler · Bağlantı Sağlığı | Servisin günlük hâli |
| Abonelikler | Firma planı, durumu ve aylık ücreti. Ücret **kuruş** olarak saklanır |
| Maliyet ve Marj | Son 30 günün hacmi × operatörün girdiği maliyet varsayımı |
| Sistem Günlüğü | Kutu bağlandı, çekim düştü, ekip değişti, abonelik güncellendi |
| Site Ayarları | Sitenin okuduğu iletişim satırı + posta gönderimi durumu |

**Maliyet ekranında ölçülen tek şey hacimdir.** Model adımı bağlı olmadığı için
bir maili işlemenin bugün ek maliyeti yok; marj, operatörün girdiği "mail başına
kaç kuruş" varsayımıyla hesaplanır ve ekran bunu varsayım diye adlandırır.

**Sistem günlüğü bir hata izleyici değil**, olay kaydı. Her istek yazılmıyor;
yalnızca anlamı olan olaylar — yoksa önemli satır görünmez olurdu.

## Bilgi deposu (`/panel/bilgi`)

Firmanın **karakteri** (ne iş yapıyoruz, ses tonu, hitap, yanıt kuralları, imza)
ve tekrar eden **gerçekleri** (kargo süresi, iade koşulu, toplu alım). Yanıt
taslağı adımı bağlandığında model önce buradan okuyacak; depo boşken model
firmayı tanımadan yazar ve çıkan taslak kimsenin gönderemeyeceği bir metin olur.

Sahip ve yönetici görür ve düzenler; personel için nav'da yok ve sayfa
`/panel`'e yönlendirir.

Karakter hazır beş alanla sınırlı değil: yönetici kendi maddesini ekleyebilir
("Kampanya dili", "Bayi yazışması" gibi). Onların anahtarı `ozel:<slug>`,
başlıkları ayrı sütunda durur. Hazır beşli silinmez — boşaltılınca "henüz
yazılmadı" olarak yerinde kalır; özel madde silinebilir.

### Çıkarım: model önerir, insan onaylar

`sunucu/zeka/karakter.ts` geçmiş yazışmaları okuyup öneri üretir:

- **Giden yanıtlar** (son 40) firmanın kendi sesi → karakter alanları.
- **Gelen mailler** (son 60) müşterinin ne sorduğu → bilgi kartları.
- Gövdelerin imza/alıntı kuyruğu `imzaAyir` ile kırpılır: hem gürültü hem
  gereksiz kişisel veri (telefon, adres) modele gitmez.

Çıkan hiçbir şey doğrudan depoya girmez; `bilgi_onerileri` tablosuna düşer ve
yönetici onaylayınca karaktere ya da karta dönüşür (Ürün İlkesi 1). Onaylanan
satır "çıkarımdan onaylandı" damgasını taşır, elle düzenlenince damga "elle"ye
döner — kaynak yalan söylemesin.

Çıkarım **kendiliğinden çalışmaz**: firmanın sahibi ya da yöneticisi düğmeye
basar, günde en fazla bir kez (token maliyeti). Her tur `bilgi_cikarimlari`'na,
maliyeti `ai_kullanim`'a, olayı da hesap kaydına (`zeka` türü) yazılır.

`ANTHROPIC_ANAHTAR` yokken ağa hiç çıkılmaz; ekran "model bağlı değil" der ve
depo elle doldurulmaya açık kalır. `/kvkk` sayfasındaki "dil modeline ne
gidiyor" bölümü de anahtarın varlığına bakar — metin hiçbir hâlde yanlış
yazmaz.

### Aynı kayıt müşteride de var

Sistem Günlüğü ekranı "firmanın yöneticisi de aynı kayıtları görür" diyordu;
artık gerçekten görüyor: müşteri panelinde **Hesap Kaydı** (`/panel/gunluk`)
firmanın kendi satırlarını gösteriyor — sahip ve yönetici için, personele
kapalı. Satırlar aynı satırlar; müşteriye ayrı, süzülmüş bir kopya
hazırlanmıyor. Firmaya bağlı olmayan sistem satırları (firma_id boş) oraya hiç
gitmiyor.

Aynı ekran "bir müşteri paneline yapılan her giriş bu listede" diyordu ama
**hiçbir giriş kaydı yazılmıyordu**. Artık her oturum açılışı `giris` türünde
bir satır bırakıyor (`girisKaydiYaz`, `oturumAc` içinden çağrılıyor).

## Henüz yapılmadı

- **Yapay zekâ sınıflandırma ve taslak.** Kural motoru ve elle kurulan yönlendirme
  çalışıyor, model adımı yok: kategori önerisi ve yanıt taslağı üretilmiyor.
- **Yanıta ek.** Gelen mailin ekleri okunuyor ve panelde indirilebiliyor; giden
  yanıta dosya eklenemiyor.
- **Microsoft SSO.** Sitedeki giriş sayfasında düğme var, ucu bağlanmadı.
- **Tahsilat.** Abonelik ekranı ne anlaşıldığının kaydı; fatura kesmiyor, ödeme almıyor.

## Panel genişlikleri

Kabuk ekrana göre büyüyor: `.sayfa` `clamp(1180px, 92vw, 1920px)`, operatörde
`clamp(1320px, 88vw, 1860px)`, gelen kutusunda liste sütunu
`clamp(392px, 22vw, 520px)` ve detay gövdesi `clamp(840px, 58vw, 1280px)`.
Sabit 1180'de kalınca 2K dizüstünde ekranın üçte biri boş kalıyordu.

**Okuma ölçüsü kabuktan bağımsız:** mail gövdesi 70ch, açıklama metinleri 78ch,
ticket formu ve yanıt kutusu 860px ile sınırlı. Genişleyen şey kabuk, satır
değil — 1900 piksellik bir metin alanı yazmayı kolaylaştırmıyor.

1500 pikselin üstünde bilgi deposu kartları, karakter maddeleri ve öneriler iki
sütuna açılıyor.

**Sayfa başlığındaki "ekle" düğmesi** kapalıyken sağda durur, form açılınca
`.ust-ekle:has(.kutu)` kuralıyla başlığın altına inip tam genişliğe yayılır.
Eskiden form da düğmenin yerinde açılıyordu ve geniş ekranda sağ yarıda asılı
kalıyordu.

## Çözülmüş bir tuzak: `allowedDevOrigins`

Sayfayı `127.0.0.1:3100` üzerinden açarsanız Next 16 kendi geliştirme
kaynaklarını (HMR dahil) çapraz köken sayıp engelliyor. Bağlantı kurulamayınca
sayfa **hiç hidrate olmuyor**: düğmeler çalışmıyor, hata da vermiyor. Çözümü
`next.config.ts` içindeki `allowedDevOrigins` listesi — `127.0.0.1` ve
`localhost` ikisi de tanıtıldı. Yeni bir host eklerseniz oraya da yazın.

Benzer bir sessiz hidrasyon kırılması, kök düzende elle `<head>` yazılırsa da
oluyor. App Router'da `<head>` elle yazılmaz; fontlar `next/font`'a, ikonlar
`metadata.icons`'a.
