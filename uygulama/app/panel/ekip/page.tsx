import { firmaKullanicilari, gelenSay } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { panelOturumu, rolDagitabilir, ROL_AD } from "../yetki";
import { EkipDurumu, RolSecici } from "./RolSecici";
import { DavetFormu } from "./DavetFormu";

export const dynamic = "force-dynamic";

const ROLLER = [
  {
    rol: "sahip",
    ne: "Her şey. Firmanın tek sahibi olur; abonelik ve firma kaydı bu role bağlıdır.",
  },
  {
    rol: "yonetici",
    ne: "Ekibi ve kutu ayarlarını görür, mailleri yönetir. Sahipliğe dokunamaz.",
  },
  {
    rol: "personel",
    ne: "Mailleri okur, sahiplenir, kategori ve durum yazar. Kurulum ayrıntılarını görmez.",
  },
] as const;

export default async function Ekip() {
  const { kullanici, firma, firmaId } = await panelOturumu();
  const ekip = firmaKullanicilari(firmaId);
  const dagitabilir = rolDagitabilir(kullanici);
  const davetEdebilir = kullanici.rol === "sahip" || kullanici.rol === "yonetici";

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Ekip ve yetkiler</h1>
          <p>{firma.ad} adına panele kim girebilir, kim ne yapabilir.</p>
        </div>
        {davetEdebilir ? (
          <span className="ust-ekle">
            <DavetFormu />
          </span>
        ) : null}
      </div>

      <div className="liste">
        {ekip.map((k) => {
          const yuk = gelenSay(firmaId, { sahipId: k.id });
          return (
            <div className={k.durum === "kapali" ? "liste-satir kapali" : "liste-satir"} key={k.id}>
              <span className="av kare">
                {(k.ad || k.eposta).trim().charAt(0).toUpperCase()}
              </span>
              <span className="liste-ad">
                <b>
                  {k.ad || k.eposta}
                  {k.id === kullanici.id ? <span className="ben">siz</span> : null}
                  {k.durum === "kapali" ? <span className="ben kapali">ekipte değil</span> : null}
                </b>
                <small>
                  {k.eposta}
                  <span className="ayrac">·</span>
                  {yuk} mail üzerinde
                  <span className="ayrac">·</span>
                  {k.son_giris ? `son giriş ${k.son_giris.slice(0, 16)}` : "hiç girmedi"}
                </small>
              </span>
              {dagitabilir ? (
                <RolSecici
                  kisiId={k.id}
                  rol={k.rol}
                  kilitli={k.rol === "sahip" || k.id === kullanici.id || k.durum === "kapali"}
                  kilitSebep={ROL_AD[k.rol] ?? k.rol}
                />
              ) : (
                <span className="rol-kilit">{ROL_AD[k.rol] ?? k.rol}</span>
              )}
              {davetEdebilir && k.rol !== "sahip" && k.id !== kullanici.id ? (
                <EkipDurumu kisiId={k.id} kapali={k.durum === "kapali"} ad={k.ad || k.eposta} />
              ) : null}
            </div>
          );
        })}
      </div>

      <h2 className="bolum">Roller ne yapabilir</h2>
      <div className="izgara-uc">
        {ROLLER.map((r) => (
          <div className="kutu" key={r.rol}>
            <div className="kutu-ust">
              <span className="kutu-ad">{ROL_AD[r.rol]}</span>
              {kullanici.rol === r.rol ? <span className="rozet r-bilgi">sizin rolünüz</span> : null}
            </div>
            <p className="kutu-not-metin" style={{ marginTop: 0 }}>
              {r.ne}
            </p>
          </div>
        ))}
      </div>

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Davet edilen kişi şifre almaz.</b> Adresine tek kullanımlık bir giriş
          bağlantısı gider; bağlantıya tıkladığı an paneldedir. Ayrılan biri
          <b> çıkarılır, silinmez</b>: açık oturumu hemen düşer ve bir daha
          giremez, ama daha önce sahiplendiği maillerin geçmişi listede durmaya
          devam eder.
          {dagitabilir
            ? " Rolleri yalnızca siz değiştirebilirsiniz; sahiplik bu ekrandan devredilmez."
            : davetEdebilir
              ? " Rolleri yalnızca firma sahibi değiştirebilir."
              : " Davet ve rol değişimi yönetici yetkisi ister."}
        </span>
      </div>
    </div>
  );
}
