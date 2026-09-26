# Örnek posta

Canlı bir IMAP kutusu olmadan çekme hattını denemek için `.eml` örnekleri.
Kural motorunun her dalını kapsar: geçen mailler, bülten, no-reply, otomatik
yanıt, iç yazışma, teslimat bildirimi.

Kullanımı:

```bash
POSTA_KAYNAGI=dosya:./ornek-posta npm run dev
```

Sonra operatör panelinde **Bağlantı Sağlığı → Çekimi çalıştır**.

Gerçek kutu bağlandığında bu klasör devreden çıkar: `POSTA_KAYNAGI` boş
bırakılırsa hat kutunun kendi IMAP bilgilerini kullanır.
