import Link from "next/link";
import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { GoalSheetEditor } from "./GoalSheetEditor";

export const dynamic = "force-dynamic";

/**
 * 目標管理シート 編集モード (/goal-sheet/edit)
 *
 * 設計元:
 *   - /tmp/goal_sheet_v3.html (Phase 2-7 モック)
 *
 * 構成:
 *   - Server Component で初期データ取得
 *   - Client Component (GoalSheetEditor) でフォーム + 保存処理
 */
export default async function GoalSheetEditPage() {
  const sheet = await getMyGoalSheet();
  const initialContent = sheet?.content ?? {};

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#e8ebec]">
      <div className="mx-auto w-full max-w-[460px]">
        {/* パンくず */}
        <nav className="text-xs text-zinc-500 mb-3 px-1">
          <Link href="/" className="underline hover:text-zinc-700">
            ホーム
          </Link>
          <span> / </span>
          <Link href="/goal-sheet" className="underline hover:text-zinc-700">
            目標管理シート
          </Link>
          <span> / 編集</span>
        </nav>

        <GoalSheetEditor initialContent={initialContent} />
      </div>
    </main>
  );
}
