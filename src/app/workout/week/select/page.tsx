import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { getWeeklyTraining } from "@/lib/workout/weekly";
import { jstTodayStr } from "@/lib/date/jst";
import { WeekGridCard } from "../WeekGridCard";

export const dynamic = "force-dynamic";

/** "YYYY-MM-DD" → "M月D日（曜）"。曜日はローカル日付から算出。 */
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, day).getDay()];
  return `${m}月${day}日（${wd}）`;
}

/**
 * 「今日のメニューを選ぶ」(モック画面3)。済みは非表示にせず薄く残す(2回目可)。カード→セット表直行。
 * 過去日記録(バックデート): ?date=YYYY-MM-DD が来たら、その日のメニュー選択として振る舞い、
 * 各リンクに date と from=list を持たせる。戻り先は記録の一覧。
 */
export default async function WeekSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const isPool = await isWeeklyPoolUser();
  if (!isPool) redirect("/workout/today");
  const sp = await searchParams;
  const targetDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= jstTodayStr() ? sp.date : null;
  const dateQS = targetDate ? `&date=${targetDate}` : "";
  const wk = await getWeeklyTraining();

  const train = wk.distMenus.filter((m) => m.kind === "train");
  const remaining = train.filter((m) => !m.doneThisWeek).length;

  return (
    <>
      <MemberHeader
        title={targetDate ? `${fmtDate(targetDate)}の配布メニュー` : "今日のメニューを選ぶ"}
        fallbackHref={targetDate ? `/workout/week/add?date=${targetDate}` : "/workout/week"}
      />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
          {targetDate ? (
            /* 過去日記録: 週間表は出さず、対象日バナー */
            <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#cfe3d6] bg-[#eef4ec] px-3.5 py-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px] bg-[#4a875b] text-white">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
              </span>
              <div className="leading-tight">
                <b className="block text-[12.5px] font-extrabold text-[#2b5a3c]">{fmtDate(targetDate)}に記録するメニューを選ぶ</b>
                <span className="text-[10px] text-[#5b7a63]">過去の日として登録されます</span>
              </div>
            </div>
          ) : (
            <>
              {/* 一番上に週間表(メインと同じ) */}
              <WeekGridCard recRow={wk.recRow} thisRow={wk.thisRow} lastRow={wk.lastRow} today={wk.today} remaining={wk.remaining} />
              <p className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2.5 text-[11.5px] font-bold text-[#34603f]">
                どのメニューを選んでもOK。体調や気分に合わせてどうぞ。
              </p>
            </>
          )}
          <div className="px-0.5 text-[10px] font-extrabold text-[#6a6256]">
            {targetDate ? "配布メニュー" : `今週のメニュー（残り${remaining}）`}
          </div>

          {train.map((m) => (
            <Link
              key={m.index}
              href={`/workout/week/edit?day=${m.index}&from=${targetDate ? "list" : "select"}${dateQS}`}
              className={`flex items-center gap-3 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5 ${
                !targetDate && m.doneThisWeek ? "opacity-50" : ""
              }`}
            >
              <span
                className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[9px] px-1.5 text-[11px] font-extrabold text-white"
                style={{ background: m.color }}
              >
                {m.abbr}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-[13px] text-[#2b2620]">{m.name}</b>
                <span className="text-[10px] font-bold text-[#6a6256]">
                  {!targetDate && m.doneThisWeek ? "今週 実施済み ✓" : `${m.exCount}種目`}
                </span>
              </div>
              <span className="text-[#a59b8c]">›</span>
            </Link>
          ))}

          {train.length === 0 && (
            <div className="rounded-2xl border border-[#cfe3d6] bg-[#eaf3ec] px-3.5 py-4 text-center text-[12.5px] font-bold text-[#34603f]">
              配布メニューがまだありません。
            </div>
          )}

          {/* 休養日(常設・点線カード)→ 表紙直行(§2-8) */}
          <Link
            href={`/workout/week/confirm?rest=1${dateQS}`}
            className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-[#ebc9a6] bg-[#fffbe6] px-3 py-2.5"
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#c9a227] text-[12px] font-extrabold text-white">
              休
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-[13px] text-[#2b2620]">休養日・ストレッチ</b>
              <span className="text-[10px] font-bold text-[#6a6256]">疲労回復も大事なトレーニングです</span>
            </div>
            <span className="text-[#a59b8c]">›</span>
          </Link>

          {/* 一番下: のりの配布メニュー原本(MenuView)への出口 */}
          <Link
            href="/workout"
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#4a875b] bg-[#fffdf8] py-3 text-[13px] font-extrabold text-[#34603f]"
          >
            配布メニューを見る →
          </Link>
          <p className="-mt-1 text-center text-[10px] text-[#a59b8c]">のりが組んだメニュー全体を、参考に見られます</p>
        </div>
      </main>
    </>
  );
}
