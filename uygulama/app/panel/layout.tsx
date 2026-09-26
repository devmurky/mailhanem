import {
  gelenSay,
  kutulariGetir,
  firmaKullanicilari,
  oneriSayisi,
  sablonlariGetir,
  ticketlariGetir,
  yonlendirmeleriGetir,
} from "@/sunucu/db";
import { YanNav, type NavOge } from "../bilesenler/YanNav";
import { demoMu } from "@/sunucu/demo";
import { kurulumGorur, panelOturumu, ROL_AD } from "./yetki";

export const dynamic = "force-dynamic";

export default async function PanelDuzeni({ children }: { children: React.ReactNode }) {
  const { kullanici, firma, firmaId } = await panelOturumu();

  const sahipsiz = gelenSay(firmaId, { sahipsiz: true });
  /* Yanıtı müşteride olmayan, yani hâlâ açık sayılan talepler. */
  const acikTicket = ticketlariGetir(firmaId, false).length;
  const kutuAdedi = kutulariGetir(firmaId).length;
  const kisiAdedi = firmaKullanicilari(firmaId).length;
  /* Onay bekleyen çıkarım önerisi: rozetle görünsün, kimse öneriyi kaçırmasın. */
  const bekleyenOneri = kurulumGorur(kullanici) ? oneriSayisi(firmaId) : 0;

  const ogeler: NavOge[] = [
    { yol: "/panel/ozet", ad: "Genel Bakış", ikon: "pano" },
    {
      yol: "/panel",
      ad: "Gelen Kutusu",
      ikon: "zarf",
      sayi: sahipsiz,
      dikkat: sahipsiz > 0,
    },
    { yol: "/panel/hesaplar", ad: "Mail Hesapları", ikon: "sunucu", sayi: kutuAdedi },
    {
      yol: "/panel/yonlendirme",
      ad: "Kategoriler",
      ikon: "liste",
      sayi: yonlendirmeleriGetir(firmaId).length,
    },
    {
      yol: "/panel/sablonlar",
      ad: "Yanıt Şablonları",
      ikon: "kalem",
      sayi: sablonlariGetir(firmaId).length,
    },
    { yol: "/panel/ekip", ad: "Ekip ve Yetkiler", ikon: "kisiler", sayi: kisiAdedi },
    {
      yol: "/panel/destek",
      ad: "Destek",
      ikon: "soru",
      sayi: acikTicket,
      dikkat: acikTicket > 0,
    },
  ];

  /* Yönetim ekranları: depo firmanın ortak dili, hesap kaydı denetim izi.
     İkisi de yönetim bilgisi; personel görmüyor. */
  if (kurulumGorur(kullanici)) {
    ogeler.push({
      yol: "/panel/bilgi",
      ad: "Bilgi Deposu",
      ikon: "bilgi",
      sayi: bekleyenOneri,
      dikkat: bekleyenOneri > 0,
    });
    ogeler.push({ yol: "/panel/gunluk", ad: "Hesap Kaydı", ikon: "kilit" });
  }

  return (
    <>
      {demoMu(firma) && (
        <div className="demo-serit">
          <b>Demo</b>
          <span className="ayr">|</span>
          <span className="demo-mesaj">
            Bu panel <b>örnek verilerle</b> çalışıyor — firma da, mailler de uydurma.
            <span className="demo-uzun">
              {" "}
              Yaptığınız değişiklikler yalnızca burada kalır ve bir sonraki ziyarette
              sıfırlanır.
            </span>
          </span>
          <span className="sag">
            <a className="demo-talep" href="/#talep">
              Kendi kutunuz için demo talep edin
            </a>
            <a href="/">Siteye dön</a>
          </span>
        </div>
      )}
      <div className="serit-ust">
        <b>{firma.ad}</b>
        <span className="ayr">|</span>
        <span>Mailhanem · ortak posta kutusu</span>
        <span className="sag">
          <span className="nb" />
          {firma.alan_adi}
        </span>
      </div>
      <div className="uygulama">
        <YanNav
          ogeler={ogeler}
          kullanici={{
            ad: kullanici.ad,
            eposta: kullanici.eposta,
            rol: ROL_AD[kullanici.rol] ?? kullanici.rol,
          }}
          kok="/panel"
          altBaslik={firma.alan_adi}
          bolum="Firmanız"
        />
        <main className="sahne">{children}</main>
      </div>
    </>
  );
}
