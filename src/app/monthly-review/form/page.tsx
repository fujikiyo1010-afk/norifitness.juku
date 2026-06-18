import Link from "next/link";
import { getMyCurrentMonthAudit, listMyAudits } from "@/lib/monthly-audit/queries";
import { MemberHeader } from "@/components/MemberHeader";
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
 *   - Server Component で当月の月次添削 + 前月の audit を取得
 *   - 案 3 (2026-06-03 きよむさん合意):
 *     - 初回受講生 (前月 audit なし) → Q1/Q2 の「先月」フィールド非表示
 *     - 2 回目以降 → 前月の「今月値」を今回の「先月」に自動入力 (編集可)
 *   - Client Component (MonthlyReviewForm) でフォーム + 保存処理
 */
export default async function MonthlyReviewFormPage() {
  const targetMonth = getCurrentTargetMonth();
  const [audit, recentAudits] = await Promise.all([
    getMyCurrentMonthAudit(),
    listMyAudits(3), // 当月 + 直近 2 件
  ]);

  // 当月以外で最新の audit を「前月候補」として扱う
  // (実際には先々月の可能性もあるが、現実運用では大体「前月」になる)
  const previousAudit = recentAudits.find(
    (a) => a.target_month !== targetMonth
  );
  const prevQ1Weight = previousAudit?.items?.q1?.current_value;
  const prevQ2Waist = previousAudit?.items?.q2?.current_value;

  // 既に提出済 (C 状態以降) なら、フォームは編集不可
  const submitted = !!audit?.submitted_at;

  return (
    <>
      <MemberHeader title="月次添削 記入" fallbackHref="/monthly-review" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#e8ebec]">
        <div className="mx-auto w-full max-w-[460px]">

        {submitted ? (
          // 提出済の場合は編集不可、履歴ページへ誘導
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-6 text-center space-y-3">
            <div className="text-base font-bold text-[#2b2620]">
              {formatTargetMonthLabel(targetMonth)} は提出済みです
            </div>
            <div className="text-sm text-zinc-600">
              提出後は編集できません。月次添削履歴で確認できます。
            </div>
            <Link
              href="/monthly-review"
              className="inline-block rounded-md bg-[#4a875b] hover:bg-[#34603f] text-white px-5 py-2.5 text-sm font-bold tracking-wide transition-colors"
            >
              履歴を見る
            </Link>
          </div>
        ) : (
          <MonthlyReviewForm
            targetMonth={targetMonth}
            initialItems={audit?.items ?? {}}
            initialLastSavedAt={audit?.last_saved_at ?? null}
            prevQ1Weight={prevQ1Weight}
            prevQ2Waist={prevQ2Waist}
          />
        )}
        </div>
      </main>
    </>
  );
}
