import { redirect } from "next/navigation";
import {
  KATEGORILER,
  KATEGORI_AD,
  OZEL_ONEK,
  bilgiKartlari,
  bugunCikarimYapildi,
  karakterGetir,
  onerileriGetir,
  sonCikarim,
  type Kategori,
} from "@/sunucu/db";
import {
  KARAKTER_ALANLARI,
  KARAKTER_AD,
  type KarakterAlani,
} from "@/sunucu/bilgiSabitleri";
import { zekaBagliMi, zekaModeli } from "@/sunucu/zeka/istemci";
import { Ikon } from "../../bilesenler/Ikon";
import { kurulumGorur, panelOturumu } from "../yetki";
import {
  CikarimDugmesi,
  KarakterAlaniKutusu,
  KarakterBolumu,
  KartBolumu,
  KartKutusu,
  OneriKutusu,
} from "./BilgiDuzenle";

export const dynamic = "force-dynamic";

/**
 * Bilgi Deposu — firmanın karakteri ve tekrar eden gerçekleri.
 *
 * Yanıt taslağı adımı bağlandığında model önce buradan okuyacak: kim olduğumuz,
 * nasıl konuştuğumuz, kargonun kaç günde gittiği. Depo boşken model firmayı
 * tanımadan yazar ve çıkan taslak kimsenin gönderemeyeceği bir metin olur.
 *
 * Üç karar:
 *
 * 1. **Çıkarım önerir, insan onaylar.** Modelin çıkardığı hiçbir şey doğrudan
 *    depoya girmiyor; öneri olarak düşüyor ve onaylanınca karaktere/karta
 *    dönüşüyor. Ürün İlkesi 1'in bu ekrandaki karşılığı.
 * 2. **Kaynak her satırda yazıyor.** "Elle yazıldı" mı, "çıkarımdan onaylandı"
 *    mı — modelin yanlış bir çıkarımı sessizce firmanın sözüne dönüşmesin.
 * 3. **Model bağlı değilse bu açıkça yazıyor.** Düğme görünüp hiçbir şey
 *    yapmıyor gibi durmuyor; depo elle doldurulmaya tamamen açık kalıyor.
 */
export default async function BilgiDeposu() {
  const { kullanici, firma, firmaId } = await panelOturumu();
  /* Depo firmanın ortak dili; personel görür değil, yönetim yazar. */
  if (!kurulumGorur(kullanici)) redirect("/panel");

  const karakter = karakterGetir(firmaId);
  const kartlar = bilgiKartlari(firmaId);
  const oneriler = onerileriGetir(firmaId);
  const son = sonCikarim(firmaId);
  const bagli = zekaBagliMi();
  const bugunYapildi = bugunCikarimYapildi(firmaId);

  const kategoriler = KATEGORILER.map((k) => ({ deger: k as string, ad: KATEGORI_AD[k] }));
  /* Yöneticinin kendi eklediği maddeler: hazır beşlinin dışında kalanlar. */
  const ozelMaddeler = [...karakter.values()].filter((k) => k.alan.startsWith(OZEL_ONEK));
  const doluAlan = [...karakter.values()].filter((k) => k.deger.trim()).length;

  const engel = !bagli
    ? "Model bağlı değil — ANTHROPIC_ANAHTAR tanımlı olmadığı için çıkarım çalışmıyor. " +
      "Depoyu aşağıdan elle doldurabilirsiniz; anahtar eklendiği gün çıkarım da çalışır."
    : bugunYapildi
      ? "Bugün bir çıkarım yapıldı. Depo her saat tazelenecek bir şey değil; yarın " +
        "yeniden çalıştırabilirsiniz."
      : undefined;

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Bilgi Deposu</h1>
          <p>
            {firma.ad} nasıl konuşuyor, neyi tekrar tekrar anlatıyor. Yanıt taslağı
            adımı bağlandığında model önce buradan okuyacak.
          </p>
        </div>
      </div>

      {/* Çıkarım şeridi: ne olduğu, en son ne zaman çalıştığı, düğme. */}
      <div className="kutu bd-serit">
        <div className="kutu-ust">
          <span className="kutu-ad">Maillerden çıkarım</span>
          <span className="kutu-not">
            {bagli ? `model: ${zekaModeli()}` : "model bağlı değil"}
          </span>
        </div>

        <p className="bd-aciklama">
          Geçmiş <b>giden yanıtlarınız</b> firmanın sesini, <b>gelen mailleriniz</b>
          {" "}müşterilerin tekrar eden sorularını gösteriyor. Çıkarım bu ikisini
          okuyup öneri üretiyor — <b>hiçbiri onaylamadan depoya girmiyor.</b> Modele
          giden metinlerde imza ve alıntı kuyruğu kırpılıyor.
        </p>

        <CikarimDugmesi engel={engel} />

        {son ? (
          <p className="bd-son">
            Son tur: {son.olusma.slice(0, 16)} · {son.okunan_mail} mail,{" "}
            {son.okunan_yanit} yanıt okundu · {son.oneri} öneri
            {son.baslatan_ad ? ` · ${son.baslatan_ad} başlattı` : ""}
            {son.hata ? (
              <>
                {" "}
                · <span className="bd-hata">{son.hata}</span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="bd-son">Henüz çıkarım yapılmadı.</p>
        )}
      </div>

      {oneriler.length ? (
        <>
          <h2 className="bolum">
            Onay bekleyenler
            <span className="sayi">{oneriler.length}</span>
          </h2>
          <div className="bd-oneri-liste">
            {oneriler.map((o) => (
              <OneriKutusu
                key={o.id}
                oneri={{
                  id: o.id,
                  tur: o.tur,
                  alan: o.alan,
                  baslik: o.baslik,
                  icerik: o.icerik,
                  kategori: o.kategori,
                  dayanak: o.dayanak,
                }}
                baslik={
                  o.tur === "karakter"
                    ? (KARAKTER_AD[o.alan as KarakterAlani] ?? o.alan)
                    : o.baslik
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <KarakterBolumu dolu={doluAlan} toplam={KARAKTER_ALANLARI.length + ozelMaddeler.length} />
      <div className="bd-alanlar">
        {/* Önce hazır beşli, sonra yöneticinin kendi maddeleri — sıra sabit
            kalsın ki ekran her açılışta aynı görünsün. */}
        {KARAKTER_ALANLARI.map((alan) => {
          const satir = karakter.get(alan);
          return (
            <KarakterAlaniKutusu
              key={alan}
              satir={{
                alan,
                baslik: "",
                deger: satir?.deger ?? "",
                kaynak: satir?.kaynak ?? "elle",
                guncelleme: satir?.guncelleme ?? "",
                guncelleyen_ad: satir?.guncelleyen_ad ?? null,
              }}
            />
          );
        })}
        {ozelMaddeler.map((satir) => (
          <KarakterAlaniKutusu
            key={satir.alan}
            satir={{
              alan: satir.alan,
              baslik: satir.baslik,
              deger: satir.deger,
              kaynak: satir.kaynak,
              guncelleme: satir.guncelleme,
              guncelleyen_ad: satir.guncelleyen_ad,
            }}
          />
        ))}
      </div>

      <KartBolumu sayi={kartlar.length} kategoriler={kategoriler} />

      {kartlar.length ? (
        <div className="bd-kart-liste">
          {kartlar.map((k) => (
            <KartKutusu
              key={k.id}
              kart={{
                id: k.id,
                baslik: k.baslik,
                icerik: k.icerik,
                kategori: k.kategori,
                kaynak: k.kaynak,
                dayanak: k.dayanak,
                guncelleme: k.guncelleme,
                guncelleyen_ad: k.guncelleyen_ad,
              }}
              kategoriAd={
                k.kategori ? (KATEGORI_AD[k.kategori as Kategori] ?? k.kategori) : ""
              }
              kategoriler={kategoriler}
            />
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="bilgi" boyut={22} />
          <b>Henüz kart yok</b>
          <span>
            Müşterilerinizin tekrar tekrar sorduğu şeyler buraya yazılır: kargo
            süresi, iade koşulu, garanti, çalışma saatleri.
          </span>
        </div>
      )}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Depo bugün taslak üretmiyor.</b> Yanıt taslağı adımı henüz bağlı değil;
          burada biriken metin o gün modelin okuyacağı zemindir. Şimdiden
          doldurulması, özelliğin bağlandığı gün taslakların firmanızın diliyle
          çıkması demek. Depodaki her satırı sahip ve yönetici değiştirebilir —
          model yazdı diye kalıcı olan bir şey yok.
        </span>
      </div>
    </div>
  );
}
