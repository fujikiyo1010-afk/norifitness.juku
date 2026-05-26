import Link from "next/link";
import { getMyCurrentMonthAudit } from "@/lib/monthly-audit/queries";
import {
  getCurrentTargetMonth,
  formatTargetMonthLabel,
} from "@/lib/monthly-audit/types";
import { MonthlyReviewForm } from "./MonthlyReviewForm";

export const dynamic = "force-dynamic";

/**
 * 月次添削 記入フォーム (/monthly-review/form)
 *
 * 設計元: /tmp/monthly_review_form.html (Phase 2-7 モック)
 *
 * 構成:
 *   - Server Component で当月の月次添削を取得 (途中保存があれば復元)
 *   - Client Component (MonthlyReviewForm) でフォーム + 保存処理
 */
export default async function MonthlyReviewFormPage() {
  const targetMonth = getCurrentTargetMonth();
  const audit = await getMyCurrentMonthAudit();

  // 既に提出済 (C 状態以降) なら、フォームは編集不可
  const submitted = !!audit?.submitted_at;

  return (
    <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#e8ebec]">
      <div className="mx-auto w-full max-w-[460px]">
        {/* パンくず */}
        <nav className="text-xs text-zinc-500 mb-3 px-1">
          <Link href="/" className="underline hover:text-zinc-700">
            ホーム
          </Link>
          <span> / </span>
          <Link href="/monthly-review" className="underline hover:text-zinc-700">
            月次添削
          </Link>
          <span> / 記入</span>
        </nav>

        {submitted ? (
          // 提出済の場合は編集不可、履歴ページへ誘導
          <div className="bg-white border border-[#e8ebe9] rounded-2xl p-6 text-center space-y-3">
            <div className="text-base font-bold text-zinc-900">
              {formatTargetMonthLabel(targetMonth)} は提出済みです
            </div>
            <div className="text-sm text-zinc-600">
              提出後は編集できません。月次添削履歴で確認できます。
            </div>
            <Link
              href="/monthly-review"
              className="inline-block rounded-md bg-[#00897b] hover:bg-[#00695c] text-white px-5 py-2.5 text-sm font-bold tracking-wide transition-colors"
            >
              履歴を見る
            </Link>
          </div>
        ) : (
          <MonthlyReviewForm
            targetMonth={targetMonth}
            initialItems={audit?.items ?? {}}
            initialLastSavedAt={audit?.last_saved_at ?? null}
          />
        )}
      </div>
    </main>
  );
}
