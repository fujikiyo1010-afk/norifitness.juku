import Link from "next/link";
import { getMyAudit, getMyCurrentCycle, listMyAudits } from "@/lib/monthly-audit/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { cycleLabel, cycleRangeLabel } from "@/lib/monthly-audit/cycle";
import { MonthlyReviewForm } from "./MonthlyReviewForm";
import { isServiceExpiredUser } from "@/lib/auth/service-expired";
import { ServiceExpiredNotice } from "@/components/ServiceExpiredNotice";

export const dynamic = "force-dynamic";

/**
 * 月次添削 記入フォーム (/monthly-review/form)
 *
 * 入会日起点サイクル(2026-07-30):
 *   - 「今の回」= getMyCurrentCycle (入会日 + 30×N)。入会30日未満(cycleNumber=0)は
 *     まだ第1回が無いので「もうしばらくお待ちください」を表示。
 *   - target_month = その回の起点日(anchor)。見出しは「第◯回月次添削 / 対象期間 M/D〜M/D」。
 *   - 案3(2026-06-03): 前回 audit の今回値を「先月」欄に自動入力(編集可)。
 */
export default async function MonthlyReviewFormPage() {
  // サービス満了(180日)ユーザーは期間サポート機能を閉じる(2026-08-14)
  if (await isServiceExpiredUser()) {
    return <ServiceExpiredNotice title="月次添削" />;
  }
  const cycle = await getMyCurrentCycle();

  // 入会30日未満 or 入会日不明 → まだ第1回無し
  if (!cycle || cycle.cycleNumber < 1) {
    return (
      <>
        <MemberHeader title="月次添削 記入" fallbackHref="/monthly-review" />
        <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-6 text-center space-y-3">
              <div className="text-base font-bold text-[#2b2620]">
                第1回の月次添削は、入会から30日後にご案内します
              </div>
              <div className="text-sm text-zinc-600">
                月次添削は、入会日を起点に「30日ごと」に振り返る形になりました。開く日に通知でお知らせします。
              </div>
              <Link
                href="/monthly-review"
                className="inline-block rounded-md btn3d text-white px-5 py-2.5 text-sm font-bold tracking-wide transition-colors"
              >
                月次添削トップへ
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const targetMonth = cycle.anchor;
  const [audit, recentAudits] = await Promise.all([
    getMyAudit(targetMonth),
    listMyAudits(3),
  ]);

  // 今回以外で最新の audit を「前回候補」として扱う(前回値の自動入力用)
  const previousAudit = recentAudits.find((a) => a.target_month !== targetMonth);
  const prevQ1Weight = previousAudit?.items?.q1?.current_value;
  const prevQ2Waist = previousAudit?.items?.q2?.current_value;

  const submitted = !!audit?.submitted_at;
  const cycleTitle = `${cycleLabel(cycle.cycleNumber)}月次添削`;
  const cycleSubtitle = `対象期間 ${cycleRangeLabel(cycle)}`;

  return (
    <>
      <MemberHeader title="月次添削 記入" fallbackHref="/monthly-review" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px]">
          {submitted ? (
            <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-6 text-center space-y-3">
              <div className="text-base font-bold text-[#2b2620]">
                {cycleTitle} は提出済みです
              </div>
              <div className="text-sm text-zinc-600">
                提出後は編集できません。月次添削履歴で確認できます。
              </div>
              <Link
                href="/monthly-review"
                className="inline-block rounded-md btn3d text-white px-5 py-2.5 text-sm font-bold tracking-wide transition-colors"
              >
                履歴を見る
              </Link>
            </div>
          ) : (
            <MonthlyReviewForm
              targetMonth={targetMonth}
              cycleTitle={cycleTitle}
              cycleSubtitle={cycleSubtitle}
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
