import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyActions, getActionsStats } from "@/lib/practice/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { ActionsClient } from "./ActionsClient";

export const dynamic = "force-dynamic";

/**
 * 実践リスト 一覧 (/my-log/actions) ・ 2026-06-18 線① #5
 * Phase 2 (2026-06-18): 達成バンド + カード新形式 + 「← 学習に戻る」
 *
 * - タブ 「試してない / 試した」 (= Q3-A: 並び順 = 新しい順 / 試した日新しい順)
 * - チェック (□ → ✓) で即タブ移動 + 振り返りモーダル即出
 * - 振り返り任意、 削除可、 + 新規追加 (lesson_id=null) 可
 */
export default async function ActionsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-log/actions");

  const [{ untried, tried }, stats] = await Promise.all([
    listMyActions(),
    getActionsStats(),
  ]);

  return (
    <>
      <MemberHeader title="実践リスト" fallbackHref="/my-log" />
      <main className="min-h-screen bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          <p className="text-[12px] text-[#6a6256] mb-4">
            レッスンで学んだことを「今週これを試す」 と宣言し、 試したら振り返りを残しましょう。
          </p>

          {/* 達成バンド (Phase 2 ・モック準拠) */}
          <section className="mb-5">
            <div className="grid grid-cols-3 gap-2.5">
              <StatBox value={stats.triedTotal} label="試した (累計)" />
              <StatBox
                value={stats.triedThisWeek}
                label="今週試した"
                accent="coral"
              />
              <StatBox
                value={stats.implementationRate}
                suffix="%"
                label="宣言→実践率"
              />
            </div>
            <div className="mt-3.5 bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-3.5 py-3">
              <div className="flex justify-between text-[11px] text-[#6a6256] mb-2">
                <span>次の節目まで</span>
                <span>
                  あと{" "}
                  <b className="text-[#2b2620] font-mono">
                    {Math.max(0, stats.nextMilestone - stats.triedTotal)}件
                  </b>{" "}
                  で {stats.nextMilestone}件達成
                </span>
              </div>
              <div className="h-2 bg-[#ece3d3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4a875b] to-[#34603f] rounded-full transition-all"
                  style={{ width: `${stats.milestoneProgress}%` }}
                />
              </div>
            </div>
          </section>

          <ActionsClient untried={untried} tried={tried} />

          {/* 末尾 ・ 学習に戻る (Phase 2) */}
          <div className="mt-8 mb-2 flex justify-center">
            <Link
              href="/my-log"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#6a6256] hover:text-[#34603f] transition-colors"
            >
              ← 学習に戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function StatBox({
  value,
  label,
  suffix,
  accent,
}: {
  value: number;
  label: string;
  suffix?: string;
  accent?: "coral";
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-2 py-3 text-center shadow-sm">
      <div
        className={`font-mono font-bold text-[26px] leading-none ${
          accent === "coral" ? "text-[#d9743f]" : "text-[#34603f]"
        }`}
      >
        {value}
        {suffix && (
          <span className="text-[15px] ml-0.5">{suffix}</span>
        )}
      </div>
      <div className="text-[10.5px] text-[#6a6256] mt-1.5">{label}</div>
    </div>
  );
}
