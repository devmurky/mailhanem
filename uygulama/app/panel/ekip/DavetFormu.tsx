"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { ekibeDavet, type DavetDurumu } from "../eylemler";

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? "Gönderiliyor…" : "Davet gönder"}
    </button>
  );
}

/**
 * Davet formu kapalı başlar: ekip listesi asıl iş, davet ara sıra yapılan bir
 * şey. Açık form her seferinde ekranın yarısını doldururdu.
 */
export function DavetFormu() {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<DavetDurumu, FormData>(ekibeDavet, {});

  if (!acik && !durum.tamam) {
    return (
      <button className="dugme" type="button" onClick={() => setAcik(true)}>
        <Ikon ad="kisiler" boyut={15} />
        Ekip üyesi davet et
      </button>
    );
  }

  return (
    <div className="kutu davet-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Ekibe davet</span>
        <button
          className="dugme sade ufak"
          type="button"
          style={{ marginLeft: "auto" }}
          onClick={() => setAcik(false)}
        >
          Kapat
        </button>
      </div>

      {durum.tamam ? (
        <>
          <p className="sonuc iyi">
            <Ikon ad="onay" boyut={16} />
            <span>{durum.tamam}</span>
          </p>
          {durum.baglanti ? (
            <div className="kutu-uyari" style={{ marginTop: 14 }}>
              <span className="ikn">
                <Ikon ad="uyari" boyut={16} />
              </span>
              <span>
                <b>Bu sunucuda posta gönderimi tanımlı değil.</b> Kişi ekibe eklendi ama
                daveti siz iletmelisiniz. Tek kullanımlık giriş bağlantısı:
                <br />
                <code style={{ wordBreak: "break-all" }}>{durum.baglanti}</code>
                <br />
                Bağlantı 15 dakika geçerli; süresi geçerse kişi giriş sayfasından kendi
                adresiyle yeni bir tane isteyebilir.
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <form action={eylem}>
          {durum.hata ? (
            <p className="sonuc kotu" style={{ marginBottom: 14 }}>
              <Ikon ad="uyari" boyut={16} />
              <span>{durum.hata}</span>
            </p>
          ) : null}

          <div className="ikili">
            <div className={durum.alanlar?.ad ? "form-satir hata" : "form-satir"}>
              <label htmlFor="davet-ad">Ad soyad</label>
              <input id="davet-ad" name="ad" required maxLength={120} />
              <span className="alan-hata">{durum.alanlar?.ad}</span>
            </div>

            <div className={durum.alanlar?.eposta ? "form-satir hata" : "form-satir"}>
              <label htmlFor="davet-eposta">İş e-postası</label>
              <input id="davet-eposta" name="eposta" type="email" required maxLength={254} />
              <span className="alan-hata">{durum.alanlar?.eposta}</span>
            </div>

            <div className="form-satir tam">
              <label htmlFor="davet-rol">Rol</label>
              <select id="davet-rol" name="rol" defaultValue="personel">
                <option value="personel">Personel — mailleri işler, ayarlara giremez</option>
                <option value="yonetici">Yönetici — kutu ayarlarını görür, ekip davet eder</option>
              </select>
              <span className="alan-hata">{durum.alanlar?.rol}</span>
            </div>
          </div>

          <div className="form-alt-satir">
            <Gonder />
            <span className="ipuc">
              Kişiye tek kullanımlık giriş bağlantısı gider. Şifre yok, ayrı bir kabul
              adımı da yok — bağlantıya tıkladığı an paneldedir.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
