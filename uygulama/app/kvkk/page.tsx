import type { Metadata } from "next";
import Link from "next/link";
import { ACIK_AYARLAR, ayarlariOku } from "@/sunucu/db";
import { zekaBagliMi } from "@/sunucu/zeka/istemci";

/**
 * KVKK aydınlatma metni.
 *
 * Neden yazıldı: site "KVKK uyumlu" diyor ve demo formu ad, firma, e-posta,
 * telefon topluyordu — ama toplandığı yerde tek satır aydınlatma yoktu ve
 * `/kvkk` 404 dönüyordu. Uyumlu olduğunu iddia edip temel yükümlülüğü atlamak,
 * hiç iddia etmemekten kötü.
 *
 * ── Metnin sınırı ─────────────────────────────────────────
 * Burada **yalnız bugün gerçekten yapılan işlemler** yazıyor. Yapılmayan bir
 * şeyi "yapmıyoruz" diye saymak kolay ve doğru; yapılmayan bir güvenceyi
 * "yapıyoruz" diye yazmak ise sonradan geri alınamayan bir söz olur.
 *
 * **Bu bir hukuk metni taslağıdır, hukuki görüş değildir.** Ticari unvan,
 * adres ve MERSİS numarası operatör panelindeki Site Ayarları'ndan geliyor;
 * girilmediği sürece o satırlar **hiç görünmüyor** — uydurma bir unvan
 * yayımlamaktansa satırı göstermemek doğru olan.
 */
export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni — Mailhanem",
  description:
    "Mailhanem'in kişisel verileri hangi amaçla işlediği, kimlerle paylaştığı ve veri sahibinin hakları.",
};

export const dynamic = "force-dynamic";

const GUNCELLEME = "22 Eylül 2026";

export default async function Kvkk() {
  const a = ayarlariOku(ACIK_AYARLAR);
  const eposta = a.iletisim_eposta ?? "";
  const telefon = a.iletisim_telefon ?? "";

  return (
    <div className="yasal">
      <div className="yasal-kap">
        <Link className="geri" href="/">
          ← Ana sayfa
        </Link>

        <h1>Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</h1>
        <p className="yasal-damga">Son güncelleme: {GUNCELLEME}</p>

        <section>
          <h2>Kısaca</h2>
          <p>
            Mailhanem iki ayrı yerde kişisel veri görüyor ve bunların{" "}
            <b>hukuki durumu farklı</b>:
          </p>
          <ol>
            <li>
              <b>Siteden bıraktığınız demo talebi.</b> Burada Mailhanem{" "}
              <b>veri sorumlusudur</b> — bilgiyi kendi adına, size dönüş yapmak
              için işler.
            </li>
            <li>
              <b>Panele bağladığınız posta kutusundaki yazışmalar.</b> Burada
              Mailhanem <b>veri işleyendir</b>; veri sorumlusu firmanızdır.
              Mailleriniz kendi sunucunuzda kalır, biz onları sizin talimatınızla
              işleriz.
            </li>
          </ol>
        </section>

        <section>
          <h2>1. Demo talebi formu</h2>

          <h3>Hangi veriler</h3>
          <p>
            Formda istenen alanlar: ad soyad, firma adı, e-posta adresi, telefon
            (isteğe bağlı), posta sağlayıcınız, kutuya bakan kişi sayısı ve
            yazdığınız serbest not. Bunların dışında bir veri toplanmaz.
          </p>

          <h3>Hangi amaçla</h3>
          <p>
            Yalnızca size dönüş yapmak ve kurulum görüşmesi için saat
            önerebilmek. Pazarlama listesine eklenmezsiniz, bülten gönderilmez.
          </p>

          <h3>Hukuki sebep</h3>
          <p>
            KVKK m.5/2-f: ilgili kişinin temel hak ve özgürlüklerine zarar
            vermemek kaydıyla, veri sorumlusunun meşru menfaati. Talebi siz
            bıraktığınız için iletişim beklentisi de sizde doğmuştur.
          </p>

          <h3>Ne kadar süreyle</h3>
          <p>
            Görüşme kurulmazsa <b>en çok bir yıl</b>, sonra silinir. Müşteri
            olursanız kayıt müşteri ilişkisi süresince ve ilgili mevzuatın
            öngördüğü saklama süresi boyunca tutulur.
          </p>

          <h3>Kime aktarılır</h3>
          <p>
            <b>Hiç kimseye.</b> Form verisi bizim sunucumuzdaki veritabanında
            durur; reklam ağlarına, analitik sağlayıcılarına ya da üçüncü
            taraflara aktarılmaz. Sitede izleme çerezi ve reklam pikseli yoktur.
          </p>
        </section>

        <section>
          <h2>2. Panele bağladığınız posta kutusu</h2>

          <p>
            Kurulumdan sonra panele bağlanan kutuda Mailhanem{" "}
            <b>veri işleyen</b> sıfatıyla çalışır. Kutunuza gelen maillerin
            asılları kendi sunucunuzda kalır; panelde işlenen kopya üzerinde
            şunlar yapılır: gönderen ve konu bilgisinin okunması, kural
            motorundan geçirilmesi, kategori ve sahiplik atanması, yanıt
            yazılması.
          </p>

          <h3>Bugün yapılanlar</h3>
          <ul>
            <li>
              Kutu kullanıcı adı ve parolası <b>AES-256-GCM zarf şifreleme</b>{" "}
              ile saklanır ve panele geri gösterilmez.
            </li>
            <li>
              Kutu <b>salt okunur</b> açılır: mailleriniz okundu işaretlenmez,
              taşınmaz, silinmez.
            </li>
            <li>
              Her firmanın verisi sorgu düzeyinde ayrılır; bir firmanın
              kullanıcısı başka firmanın mailine erişemez.
            </li>
            <li>
              Servis tarafının bir müşteri paneline yaptığı her giriş{" "}
              <b>silinemez şekilde</b> sistem günlüğüne yazılır.
            </li>
          </ul>

          {/* Bu paragraf **yapılandırmaya bakıyor**, yazana değil. Model
              bağlandığı an "hiçbir dil modeline gönderilmiyor" cümlesi yalan
              olurdu; metnin kendisi durumu okuyor ki hiçbir hâlde yanlış
              yazmasın. */}
          {zekaBagliMi() ? (
            <>
              <h3>Dil modeline ne gidiyor</h3>
              <p>
                Panelde <b>Bilgi Deposu</b> ekranından çalıştırılan çıkarım,
                firmanızın geçmiş yazışmalarını bir dil modeline okutur. Üç
                sınırı vardır:
              </p>
              <ul>
                <li>
                  <b>Kendiliğinden çalışmaz.</b> Yalnızca firmanın sahibi veya
                  yöneticisi düğmeye bastığında, en fazla günde bir kez çalışır.
                  Her tur hesap kaydınıza satır olarak düşer.
                </li>
                <li>
                  Gönderilen metinde mail gövdelerinin <b>imza ve alıntı
                  kuyruğu kırpılır</b>: telefon, adres ve alıntılanan eski
                  yazışmalar modele gitmez.
                </li>
                <li>
                  Sağlayıcı <b>Anthropic</b>&apos;tir. Gönderilen içerik model
                  eğitiminde kullanılmaz; çıkan öneriler onaylanana kadar hiçbir
                  yere yazılmaz ve istediğiniz an silinebilir.
                </li>
              </ul>
              <p>
                Bunun dışında mail içeriği hiçbir dil modeline gönderilmez:
                sınıflandırma ve yanıt taslağı adımları <b>henüz bağlı
                değildir</b>. Tahsilat sağlayıcısı da bağlı değildir; kart
                verisi hiç görülmemektedir.
              </p>
            </>
          ) : (
            <>
              <h3>Bugün yapılmayanlar</h3>
              <p>
                Açık olmak gerekirse: yapay zekâ adımı <b>henüz bağlı
                değildir</b>, yani mail içeriği bugün hiçbir dil modeline
                gönderilmemektedir. Bağlandığında bu metin güncellenecek ve
                hangi sağlayıcıya ne gönderildiği burada tek tek yazılacaktır.
                Tahsilat sağlayıcısı da bağlı değildir; kart verisi hiç
                görülmemektedir.
              </p>
            </>
          )}
        </section>

        <section>
          <h2>3. Haklarınız</h2>
          <p>KVKK m.11 uyarınca şunları talep edebilirsiniz:</p>
          <ul>
            <li>Kişisel verinizin işlenip işlenmediğini öğrenme</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme</li>
            <li>İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme</li>
            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
            <li>Silinmesini veya yok edilmesini isteme</li>
            <li>İşlemenin hukuka aykırılığı nedeniyle zarara uğramışsanız tazminat talep etme</li>
          </ul>

          {eposta || telefon ? (
            <p>
              Başvurularınızı{" "}
              {eposta ? (
                <>
                  <a href={`mailto:${eposta}`}>{eposta}</a>
                  {telefon ? " adresine ya da " : " adresine"}
                </>
              ) : null}
              {telefon ? <>{telefon} numarasına</> : null} iletebilirsiniz; en geç
              otuz gün içinde yanıtlanır.
            </p>
          ) : (
            <p className="yasal-eksik">
              Başvuru için iletişim bilgisi henüz yayımlanmadı. Bu satır, operatör
              panelindeki <b>Site Ayarları</b> doldurulduğunda kendiliğinden
              görünür — uydurma bir adres yazmaktansa boş bırakılmıştır.
            </p>
          )}
        </section>

        <section>
          <h2>4. Çerezler</h2>
          <p>
            Sitede <b>izleme çerezi yoktur</b>: analitik, reklam ve sosyal medya
            pikseli kullanılmaz. Panelde yalnızca oturumunuzu açık tutan tek bir
            zorunlu çerez (<code>mailhanem_oturum</code>) vardır; siz çıkış
            yapınca ya da süresi dolunca geçersizleşir. Zorunlu çerez için açık
            rıza gerekmez.
          </p>
          <p>
            Demo formunda bot koruması olarak Cloudflare Turnstile kullanılır;
            bu araç kullanıcıyı profillemez ve reklam amacıyla veri toplamaz.
          </p>
        </section>

        <div className="yasal-not">
          <b>Bu metin bir taslaktır.</b> Yürürlüğe girmeden önce bir hukukçu
          tarafından gözden geçirilmeli; ticari unvan, adres ve VERBİS kaydı
          bilgileri eklenmelidir. Metin bugün gerçekten yapılan işlemleri
          anlatır — yapılmayan bir güvence buraya yazılmamıştır.
        </div>
      </div>
    </div>
  );
}
