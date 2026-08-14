import { redirect } from "next/navigation";
import { getMyCarte } from "@/lib/workout/queries";
import { RequestForm } from "../../_components/RequestForm";
import { MemberHeader } from "@/components/MemberHeader";
import { isServiceExpiredUser } from "@/lib/auth/service-expired";
import { ServiceExpiredNotice } from "@/components/ServiceExpiredNotice";

export const dynamic = "force-dynamic";

/**
 * カルテ更新リクエスト送信画面 (/workout/carte/request)
 *
 * 振る舞い:
 *   - カルテ未提出 → /workout/carte/new にリダイレクト
 *   - カルテあり → 現状カルテのサマリを表示 + リクエスト入力
 */
export default async function CarteRequestPage() {
  // サービス満了(180日)ユーザーは期間サポート機能を閉じる(2026-08-14)
  if (await isServiceExpiredUser()) {
    return <ServiceExpiredNotice title="カルテ更新リクエスト" />;
  }
  const carte = await getMyCarte();
  if (!carte) {
    redirect("/workout/carte/new");
  }

  const currentInfo = [
    { label: "性別", value: carte.gender },
    {
      label: "使える環境",
      value:
        carte.environments.length > 0 ? carte.environments.join("・") : "—",
    },
    { label: "理想の頻度", value: carte.frequency_wish ?? "—" },
    {
      label: "鍛えたい部位",
      value:
        carte.focus_body_parts.length > 0
          ? carte.focus_body_parts.join("・")
          : "—",
    },
  ];

  return (
    <>
      <MemberHeader title="カルテ 更新リクエスト" fallbackHref="/workout/carte" />
      <RequestForm type="carte" currentInfo={currentInfo} />
    </>
  );
}
