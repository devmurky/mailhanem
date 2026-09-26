import { notFound } from "next/navigation";
import { mailGetir } from "@/sunucu/db";
import { panelOturumu } from "../../yetki";
import { MailDetay } from "../MailDetay";

export const dynamic = "force-dynamic";

/**
 * Mailin tam sayfası — paylaşılabilir adres.
 *
 * Gelen kutusu aynı detayı sağ sütununda gömülü gösteriyor; içerik tek yerde,
 * `MailDetay`'da. Burası yalnızca adresi doğruluyor ve tam sayfa olarak sarıyor.
 */
export default async function MailSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { firmaId } = await panelOturumu();
  const { id } = await params;

  const mailId = Number(id);
  if (!Number.isInteger(mailId) || !mailGetir(mailId, firmaId)) notFound();

  return <MailDetay mailId={mailId} />;
}
