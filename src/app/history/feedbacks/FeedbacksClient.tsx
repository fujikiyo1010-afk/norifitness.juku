"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { FeedbackItem, FeedbackTimeline } from "@/lib/history/feedbacks";
import { toggleFeedbackBookmark } from "@/lib/history/actions";

function dateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}
function monthChipLabel(key: string): string {
  return `${Number(key.slice(5, 7))}月`;
}

export function FeedbacksClient({
  timeline,
  initialTab,
}: {
  timeline: FeedbackTimeline;
  initialTab: "all" | "saved";
}) {
  const [tab, setTab] = useState<"all" | "saved">(initialTab);
  const [month, setMonth] = useState<string | null>(null);
  // しおり状態をローカルに保持(即時反映)
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const it of timeline.items) if (it.kind === "daily") m[it.date] = it.saved;
    return m;
  });
  const [, startTransition] = useTransition();

  const savedCount = Object.values(savedMap).filter(Boolean).length;

  function toggle(date: string) {
    setSavedMap((prev) => ({ ...prev, [date]: !prev[date] }));
    startTransition(async () => {
      const r = await toggleFeedbackBookmark(date);
      if (!r.ok) setSavedMap((prev) => ({ ...prev, [date]: !prev[date] })); // 失敗時ロールバック
    });
  }

  const items = timeline.items.filter((it) => {
    if (month && it.monthKey !== month) return false;
    if (tab === "saved") return it.kind === "daily" && savedMap[it.date];
    return true;
  });

  return (
    <div className="space-y-3">
      {/* タブ */}
      <div className="flex gap-1.5 rounded-2xl bg-[#f0ece2] p-1.5">
        {(["all", "saved"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors ${
              tab === t ? "bg-[#4a875b] text-white" : "text-[#6a6256]"
            }`}
          >
            {t === "all" ? "すべて" : `保存済み${savedCount > 0 ? ` ${savedCount}` : ""}`}
          </button>
        ))}
      </div>

      {/* 月チップ */}
      {timeline.months.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={month === null} onClick={() => setMonth(null)} label="すべての月" />
          {timeline.months.map((mk) => (
            <Chip key={mk} active={month === mk} onClick={() => setMonth(mk)} label={monthChipLabel(mk)} />
          ))}
        </div>
      )}

      {/* リスト */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] p-8 text-center text-[13px] leading-relaxed text-[#6a6256]">
          {tab === "saved"
            ? "心に残った言葉を、しおりでとっておけます。"
            : "まだのりからのコメントはありません。"}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i}>
              {it.kind === "daily" ? (
                <DailyRow
                  item={it}
                  saved={!!savedMap[it.date]}
                  onToggle={() => toggle(it.date)}
                />
              ) : (
                <MonthlyRow item={it} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
        active ? "bg-[#4a875b] text-white" : "bg-[#fffdf8] border border-[#e7dcc9] text-[#6a6256]"
      }`}
    >
      {label}
    </button>
  );
}

function DailyRow({
  item,
  saved,
  onToggle,
}: {
  item: Extract<FeedbackItem, { kind: "daily" }>;
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3.5">
      <div className="mb-1 flex items-center justify-between">
        <Link
          href={`/meals?date=${item.date}`}
          className="flex items-center gap-2 text-[12px] font-bold text-[#34603f]"
        >
          <span className="rounded-full bg-[#4a875b] px-2 py-0.5 text-[9px] text-white">のり</span>
          {dateLabel(item.date)}
          <span className="text-[#c9bfa9]">›</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label="しおり"
          className={saved ? "text-[#4a875b]" : "text-[#c9bfa9]"}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      <Link href={`/meals?date=${item.date}`} className="block">
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#2b2620]">{item.body}</p>
      </Link>
    </div>
  );
}

function MonthlyRow({ item }: { item: Extract<FeedbackItem, { kind: "monthly" }> }) {
  const ym = item.date.slice(0, 7);
  return (
    <Link
      href={`/monthly-review/detail/${ym}`}
      className="flex items-center justify-between rounded-2xl border border-[#e7dcc9] bg-[#faf7f0] p-3.5"
    >
      <span className="flex items-center gap-2 text-[12.5px] font-bold text-[#2b2620]">
        <span className="rounded-full bg-[#b0870f] px-2 py-0.5 text-[9px] text-white">月次</span>
        {item.monthLabel}の月次添削（動画返信）
      </span>
      <span className="text-[#c9bfa9]">›</span>
    </Link>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
