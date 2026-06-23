import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { VimeoEmbed } from "@/components/VimeoEmbed";
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
      <MemberHeader title="目標管理シート 編集" fallbackHref="/goal-sheet" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px]">
          <VideoIntro />
          <div className="p-4 sm:p-6">
            <GoalSheetEditor initialContent={initialContent} gender={gender} />
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * 動画イントロセクション (= 編集画面 最上部 / 毎回表示 / スクロールでスキップ可)
 * きよむさん指示 (2026-06-23): モック /tmp/goal-sheet-edit-v3.html 準拠
 * のり氏の動画 (= 編集中) を載せる枠。 公開時に Vimeo ID を入れる。
 */
function VideoIntro() {
  return (
    <section className="px-4 pt-5 pb-4 border-b border-[#e7dcc9] bg-gradient-to-b from-[#fffdf8] to-[#f9f5ed]">
      <h2 className="text-[15px] font-bold text-[#2b2620] mb-1">
        目標管理シート編集画面
      </h2>
      <p className="text-[12px] text-[#6a6256] mb-3">
        まずこの動画を視聴してください。
      </p>
      {/* Vimeo 動画 (= のり氏 / 2026-06-23 きよむさん入稿) */}
      <VimeoEmbed url="https://vimeo.com/1203693478" />
    </section>
  );
}
