import { redirect } from "next/navigation";
import { getMyCurrentMenu, getMyCarte } from "@/lib/workout/queries";
import { formatDistributionDate } from "@/lib/workout/menu-display";
import { RequestForm } from "../../_components/RequestForm";

export const dynamic = "force-dynamic";

/**
 * メニュー変更リクエスト送信画面 (/workout/menu/request)
 *
 * 振る舞い:
 *   - メニュー未配布 → /workout にリダイレクト (作成中バナー表示へ)
 *   - メニューあり → 現状メニュー情報を表示 + リクエスト入力
 */
export default async function MenuRequestPage() {
  const [menu, carte] = await Promise.all([getMyCurrentMenu(), getMyCarte()]);
  if (!menu) {
    redirect("/workout");
  }

  const cycleCount = (menu.cycles || []).length;
  const envDisplay =
    carte && carte.environments.length > 0
      ? carte.environments.join("・")
      : "—";
  const freqDisplay = carte?.frequency_wish ?? "—";

  const currentInfo = [
    { label: "配布日", value: formatDistributionDate(menu.effective_from) },
    { label: "強度", value: `全 ${cycleCount} 強度` },
    { label: "環境", value: envDisplay },
    { label: "頻度", value: freqDisplay },
  ];

  return <RequestForm type="menu" currentInfo={currentInfo} />;
}
