import { redirect } from "next/navigation";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import { isWeeklyPoolUser } from "@/lib/workout/pool-gate";
import { isCalendarUser } from "@/lib/auth/calendar-gate";
import { jstTodayStr } from "@/lib/date/jst";

export const dynamic = "force-dynamic";

/**
 * 過去日記録(バックデート)の入口ハブ(表なし・2026-07-31)。
 * メインの /workout/week から「週間表」と「推奨の配布を始める」を外した版。
 * 過去日は自分で決めて入力したいので、配布から選ぶ / 先週 / メニュー作成 / 保存メニュー を全部出す。
 * すべての入口に date(対象日) と from=list を持たせて、過去日として保存する。
 * ゲート=カレンダーと同じ(pool + calendar・月曜に全開放)。
 */
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, m - 1, day).getDay()];
  return `${m}月${day}日（${wd}）`;
}

export default async function WeekBackdateAddPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [isPool, isCal] = await Promise.all([isWeeklyPoolUser(), isCalendarUser()]);
  if (!isPool || !isCal) redirect("/workout/week");

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= jstTodayStr() ? sp.date : null;
  if (!date) redirect("/workout/week/history");
  const qs = `date=${date}`;

  return (
    <>
      <MemberHeader title={`${fmtDate(date)}のメニュー`} fallbackHref="/workout/week/history" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto flex max-w-[460px] flex-col gap-3 px-4 py-4">
          <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#cfe3d6] bg-[#eef4ec] px-3.5 py-2.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px] bg-[#4a875b] text-white">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
            </span>
            <div className="leading-tight">
              <b className="block text-[12.5px] font-extrabold text-[#2b5a3c]">{fmtDate(date)}に記録する</b>
              <span className="text-[10px] text-[#5b7a63]">過去の日として登録されます</span>
            </div>
          </div>

          <p className="text-[11.5px] font-bold leading-relaxed text-[#34603f]">
            この日にやったトレーニングを記録します。
            <br />
            配布メニューから選んでも、自分で作ってもOK。
          </p>

          {/* 配布系 */}
          <Link
            href={`/workout/week/select?${qs}`}
            className="block rounded-[10px] border-2 border-[#4a875b] bg-white py-3 text-center text-[13px] font-extrabold text-[#34603f]"
          >
            配布メニューから選ぶ
          </Link>
          <Link
            href={`/workout/week/last?${qs}`}
            className="-mt-1 block text-center text-[11.5px] font-extrabold text-[#34603f]"
          >
            先週から選ぶ →
          </Link>

          {/* じぶん系: 自分で決めて入力する */}
          <Link
            href={`/workout/week/edit?from=list&${qs}`}
            className="mt-1 block rounded-[10px] border-2 border-[#6d5a8e] bg-white py-3 text-center text-[13px] font-extrabold text-[#6d5a8e]"
          >
            メニューを作成する
            <span className="mt-0.5 block text-[10px] font-bold text-[#8a7ba5]">自分で種目を決めて入力する</span>
          </Link>
          <Link
            href={`/workout/week/menus?${qs}`}
            className="-mt-1 block text-center text-[11.5px] font-extrabold text-[#6d5a8e]"
          >
            保存したメニューから選ぶ →
          </Link>
        </div>
      </main>
    </>
  );
}
