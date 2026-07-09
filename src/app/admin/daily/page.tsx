import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getDailyQueue,
  getDailyDetail,
  jstToday,
  type DailyQueueItem,
} from "@/lib/admin/daily";
import { DailyPanel } from "./DailyPanel";

export const dynamic = "force-dynamic";

/**
 * デイリー添削（P2a v1）・管理画面。モック: M2「提案_管理_デイリー添削_A3_今日重視.html」。
 * 左=キュー（今日捌く受講生）／右=パネル（4カード＋タブ＋下部固定FBバー）。
 * v1では 体組成・学習・カルテ・目標シート・日次FB が実データ。食事/トレ/生活はP4-P6。
 */

function addDays(dateStr: string, delta: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}
function weekdayLabel(dateStr: string): string {
  const wd = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return wd[d] ?? "";
}

export default async function AdminDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; date?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const date =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : jstToday();

  const queue = await getDailyQueue(date);

  // 選択中ユーザー: 指定がなければ 要対応→未処理→処理済み の先頭
  const ordered = [...queue.attention, ...queue.pending, ...queue.done];
  const selectedUserId =
    (typeof sp.user === "string" && sp.user) || ordered[0]?.userId || null;

  // 「送信して次へ」用の次の未処理者（自分より後の 要対応→未処理）
  const workList = [...queue.attention, ...queue.pending];
  const idx = workList.findIndex((u) => u.userId === selectedUserId);
  const nextUserId =
    idx >= 0
      ? workList.slice(idx + 1).find((u) => u.userId !== selectedUserId)
          ?.userId ?? workList.find((u) => u.userId !== selectedUserId)?.userId ?? null
      : workList[0]?.userId ?? null;

  const detail = selectedUserId
    ? await getDailyDetail(selectedUserId, date)
    : null;

  const remaining = workList.length;

  return (
    <div className="flex min-h-screen">
      {/* キュー */}
      <aside className="w-[236px] flex-shrink-0 bg-white border-r border-[#e8ebe9] sticky top-0 h-screen overflow-y-auto">
        <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#e8ebe9]">
          <h1 className="text-[15px] font-bold">デイリー添削</h1>
          <div className="flex items-center justify-between mt-1 text-[10.5px] text-zinc-500">
            <Link
              href={`/admin/daily?date=${addDays(date, -1)}`}
              className="hover:text-zinc-800"
            >
              ◀ 前日
            </Link>
            <span className="font-mono">
              {date}（{weekdayLabel(date)}）
            </span>
            <Link
              href={`/admin/daily?date=${addDays(date, 1)}`}
              className="hover:text-zinc-800"
            >
              翌日 ▶
            </Link>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="px-3.5 py-2.5 border-b border-[#e8ebe9]">
          <div className="flex justify-between text-[11px] font-bold mb-1.5">
            <span>進捗</span>
            <span className="font-mono">
              {queue.doneCount} / {queue.total}
            </span>
          </div>
          <div className="h-[5px] bg-[#eef1f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00897b] to-[#00695c]"
              style={{
                width: `${queue.total ? (queue.doneCount / queue.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <QueueGroup
          label="要対応"
          count={queue.attention.length}
          danger
          items={queue.attention}
          selectedId={selectedUserId}
          date={date}
        />
        <QueueGroup
          label="未処理"
          count={queue.pending.length}
          items={queue.pending}
          selectedId={selectedUserId}
          date={date}
        />
        <QueueGroup
          label="処理済み"
          count={queue.done.length}
          items={queue.done}
          selectedId={selectedUserId}
          date={date}
          dim
        />
      </aside>

      {/* パネル */}
      {detail ? (
        <DailyPanel
          detail={detail}
          date={date}
          remaining={remaining}
          nextUserId={nextUserId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
          {queue.total === 0
            ? "受講生がいません"
            : "左のキューから受講生を選んでください"}
        </div>
      )}
    </div>
  );
}

function QueueGroup({
  label,
  count,
  items,
  selectedId,
  date,
  danger,
  dim,
}: {
  label: string;
  count: number;
  items: DailyQueueItem[];
  selectedId: string | null;
  date: string;
  danger?: boolean;
  dim?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="px-3.5 pt-2.5 pb-1 text-[10.5px] font-bold text-zinc-500">
        {label}{" "}
        <span className={danger ? "text-red-500" : ""}>{count}</span>
      </div>
      {items.map((u) => {
        const sel = u.userId === selectedId;
        return (
          <Link
            key={u.userId}
            href={`/admin/daily?user=${u.userId}&date=${date}`}
            className={`flex items-center gap-2 px-3.5 py-2 border-l-[3px] transition-colors ${
              sel
                ? "bg-[#e6f4f2] border-[#00897b]"
                : "border-transparent hover:bg-[#f4faf9]"
            } ${dim ? "opacity-60" : ""}`}
          >
            <span className="w-7 h-7 rounded-full bg-[#00897b] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {u.initial}
            </span>
            <span className="text-[12px] font-semibold flex-1 min-w-0 truncate">
              {u.name}
            </span>
            {!u.done && u.topSeverity && (
              <span
                className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${
                  u.topSeverity === "urgent" ? "bg-red-500" : "bg-orange-500"
                }`}
              />
            )}
            <span
              className={`w-[15px] h-[15px] rounded-full flex-shrink-0 flex items-center justify-center text-[9px] text-white ${
                u.done ? "bg-[#00897b]" : "border-[1.5px] border-zinc-300"
              }`}
            >
              {u.done ? "✓" : ""}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
