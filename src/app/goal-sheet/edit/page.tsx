import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { getMyCarte } from "@/lib/workout/queries";
import type { Gender as CarteGender } from "@/lib/workout/types";
import type { Gender as ToolGender } from "@/lib/tools/types";
import { GoalSheetEditor } from "./GoalSheetEditor";

export const dynamic = "force-dynamic";

/**
 * カルテ側 Gender ("男"/"女"/"その他") → ツール側 Gender ("male"/"female"/"other") 変換。
 * 体脂肪率自動計算 (calculateBodyFat) に渡すため。
 */
function mapGender(g: CarteGender | undefined): ToolGender | null {
  if (g === "男") return "male";
  if (g === "女") return "female";
  if (g === "その他") return "other";
  return null;
}

/**
 * 目標管理シート 編集モード (/goal-sheet/edit)
 *
 * 設計元:
 *   - /tmp/goal_sheet_v3.html (Phase 2-7 モック)
 *
 * 構成:
 *   - Server Component で初期データ取得
 *   - Client Component (GoalSheetEditor) でフォーム + 保存処理
 *   - 体脂肪率自動計算用に カルテ から gender を取得して渡す
 */
export default async function GoalSheetEditPage() {
  const [sheet, carte] = await Promise.all([getMyGoalSheet(), getMyCarte()]);
  const initialContent = sheet?.content ?? {};
  const gender = mapGender(carte?.gender);

  return (
    <>
      <MemberHeader title="目標シート 編集" fallbackHref="/goal-sheet" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px]">
          <GoalSheetEditor initialContent={initialContent} gender={gender} />
        </div>
      </main>
    </>
  );
}
