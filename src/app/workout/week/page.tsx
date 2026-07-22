import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining, type WeekCell } from "@/lib/workout/weekly";

export const dynamic = "force-dynamic";

const DOW = ["月", "火", "水", "木", "金", "土", "日"];

/**
 * 週間プール・メイン(モック画面2・藤田先行)。3行グリッド＋次のおすすめ＋ボタン群。
 * のりのおすすめ順(A〜G)／今週の実施(のり=緑・じぶん=紫★・休=金茶)／先週。
 */
export default async function WeekPoolPage() {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const wk = await getWeeklyTraining();

  return (
    <>
      <MemberHeader title={`今週のトレーニング ・ ${wk.weekNumber}週目`} fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          {!wk.hasMenu ? (
            <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-8 text-center text-[13px] leading-relaxed text-[#6a6256]">
              まだトレーニングメニューが届いていません。
              <br />
              のりが準備中です（通常1〜3日）。少しお待ちください。
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2.5 text-[12px] font-bold leading-relaxed text-[#34603f]">
                1週間で全部を1回ずつ、が目安です。順番も組み合わせも自由。迷ったら上から順でOK。
              </p>

              {/* 3行グリッド */}
              <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-3">
                <div className="flex gap-[3px] pl-[56px]">
                  {DOW.map((d) => (
                    <span key={d} className="flex-1 text-center text-[9px] font-extrabold text-[#a59b8c]">
                      {d}
                    </span>
                  ))}
                </div>
                <GridRow label="のりのおすすめ順" cells={wk.recRow} recommended />
                <GridRow label="今週の実施" cells={wk.thisRow} />
                <GridRow label="先週" cells={wk.lastRow} last />
                <div className="mt-1.5 text-right text-[10.5px] font-extrabold text-[#34603f]">
                  今週の残り {wk.remaining} メニュー
                </div>
              </div>

              {/* 次のおすすめ + そのまま始める */}
              {wk.nextRecommended ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3">
                    <span
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[13px] font-extrabold text-white"
                      style={{ background: wk.nextRecommended.color }}
                    >
                      {wk.nextRecommended.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9.5px] font-extrabold text-[#6a6256]">次のおすすめ</div>
                      <div className="text-[15px] font-extrabold text-[#2b2620]">
                        {wk.nextRecommended.name}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/workout/week/do?day=${wk.nextRecommended.index}`}
                    className="btn3d block rounded-xl py-3 text-center text-[14px] font-bold"
                  >
                    そのまま始める
                  </Link>
                </>
              ) : (
                <div className="rounded-2xl border border-[#cfe3d6] bg-[#eaf3ec] px-3.5 py-3 text-center text-[13px] font-bold text-[#34603f]">
                  今週のおすすめメニューは全部やりました。お疲れさまです。
                </div>
              )}

              <Link
                href="/workout/week/select"
                className="block rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f]"
              >
                別のメニューを選ぶ
              </Link>
              <Link
                href="/workout/week/custom"
                className="block rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-center text-[13px] font-extrabold text-[#34603f]"
              >
                自分のメニューを組む（1から）
              </Link>

              <div className="flex justify-center gap-6 py-1 text-[11.5px] font-extrabold text-[#34603f]">
                <Link href="/workout/week/menus">じぶんメニュー棚 →</Link>
                <Link href="/workout/week/last">先週から選ぶ →</Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function GridRow({
  label,
  cells,
  last,
  recommended,
}: {
  label: string;
  cells: WeekCell[];
  last?: boolean;
  recommended?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-[3px] py-1 ${last ? "" : "border-b border-dashed border-[#f0ead9]"}`}
    >
      <span className="w-[53px] flex-none text-[8.5px] font-extrabold text-[#6a6256]">{label}</span>
      {cells.map((c, i) => (
        <Cell key={i} c={c} recommended={recommended} />
      ))}
    </div>
  );
}

// モックの役割色: 推奨=グレー / 実施=緑 / じぶん=紫★ / 休=金茶(部位色はバッジ用でグリッドには使わない)
function Cell({ c, recommended }: { c: WeekCell; recommended?: boolean }) {
  if (c.kind === "dist") {
    if (recommended) {
      return (
        <span className="flex-1 rounded-md bg-[#f5f1e8] py-1 text-center text-[9.5px] font-extrabold text-[#6a6256]">
          {c.letter}
        </span>
      );
    }
    return (
      <span className="flex-1 rounded-md bg-[#eaf3ec] py-1 text-center text-[9.5px] font-extrabold text-[#34603f]">
        {c.letter}
      </span>
    );
  }
  if (c.kind === "custom") {
    return (
      <span className="flex-1 rounded-md bg-[#efeafd] py-1 text-center text-[9.5px] font-extrabold text-[#5b3fd6]">
        ★
      </span>
    );
  }
  if (c.kind === "rest") {
    return (
      <span className="flex-1 rounded-md bg-[#fbf2dd] py-1 text-center text-[9.5px] font-extrabold text-[#a5631f]">
        休
      </span>
    );
  }
  return <span className="flex-1 rounded-md bg-[#f5f1e8] py-1 text-center text-[9.5px] text-[#a59b8c]">—</span>;
}
