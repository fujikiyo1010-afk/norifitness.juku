import Link from "next/link";
import { listAuditsForUser } from "@/lib/monthly-audit/queries";
import { formatTargetMonthLabel } from "@/lib/monthly-audit/types";

export const dynamic = "force-dynamic";

/**
 * 受講生ハブ ・ 月次添削履歴タブ
 *
 * 既存月次添削データを時系列リスト表示。
 * 個別作業画面へのリンクは /admin/monthly-reviews/[id]
 */
export default async function UserMonthlyAuditsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const audits = await listAuditsForUser(userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h2 className="text-base font-bold text-zinc-900 mb-4">
        月次添削履歴 ({audits.length} 件)
      </h2>

      {audits.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#e8ebe9] bg-white px-6 py-10 text-center">
          <div className="text-sm text-zinc-500">月次添削の履歴がありません</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {audits.map((audit) => {
            const submitted = !!audit.submitted_at;
            const replied = !!audit.nori_video_published_at;
            return (
              <Link
                key={audit.id}
                href={`/admin/monthly-reviews/${audit.id}`}
                className="rounded-[10px] border border-[#e8ebe9] bg-white px-4 py-3.5 flex items-center gap-4 hover:border-[#00897b] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-zinc-900">
                    {formatTargetMonthLabel(audit.target_month)}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {audit.submitted_at
                      ? `提出: ${new Date(audit.submitted_at).toLocaleDateString("ja-JP")}`
                      : "未提出"}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {submitted ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-700 border-zinc-200">
                      提出済
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                      未提出
                    </span>
                  )}
                  {replied ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                      返信済
                    </span>
                  ) : submitted ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                      未返信
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
