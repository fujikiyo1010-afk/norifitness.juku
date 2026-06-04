"use client";

import { useState } from "react";
import Link from "next/link";
import type { MenuCandidate, WorkoutTemplateRow } from "@/lib/workout/types";
import {
  cleanExerciseName,
  cleanDayLabel,
  cleanReps,
  getExerciseTarget,
} from "@/lib/workout/menu-display";

/**
 * マッチング結果リスト (Client Component)
 *
 * 案 C: 初期 3 件表示、「もっと見る」で 10 件まで展開。
 * 受け取る candidates は最大 10 件 (上位スコア順)。
 */
export function CandidatesList({
  candidates,
  userId,
  initialVisible = 3,
}: {
  candidates: MenuCandidate[];
  userId: string;
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? candidates : candidates.slice(0, initialVisible);
  const hasMore = candidates.length > initialVisible;

  if (candidates.length === 0) {
    return (
      <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="text-sm text-zinc-700">
          マッチング候補が見つかりませんでした。
          <br />
          「ゼロから手作り」で対応してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((c, idx) => (
        <article
          key={c.template.id}
          className="rounded-[14px] border border-[#e8ebe9] bg-white p-5"
        >
          {/* ランクヘッダー */}
          <div className="mb-3 flex items-start gap-3">
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                idx === 0
                  ? "bg-[#00897b]"
                  : idx === 1
                    ? "bg-zinc-500"
                    : "bg-zinc-400"
              }`}
            >
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-zinc-900">
                {c.template.source_name ?? "(名前なし)"} さんのメニュー
              </div>
              <div className="mt-0.5 text-xs text-zinc-600">
                {c.template.gender} / {c.template.age_band}
                {c.template.instrument && (
                  <>
                    <span className="text-zinc-300 mx-1.5">|</span>
                    {c.template.instrument}
                  </>
                )}
                {c.template.frequency && (
                  <>
                    <span className="text-zinc-300 mx-1.5">|</span>
                    {c.template.frequency}
                  </>
                )}
                {c.template.primary_body && (
                  <>
                    <span className="text-zinc-300 mx-1.5">|</span>
                    重点 {c.template.primary_body}
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500">スコア</div>
              <div className="text-lg font-bold text-[#00695c] font-mono leading-tight">
                {c.score}
              </div>
            </div>
          </div>

          {/* スコア内訳 */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <ScoreCell label="部位" value={c.breakdown.body_focus} max={100} />
            <ScoreCell label="年齢" value={c.breakdown.age} max={50} />
            <ScoreCell
              label="頻度"
              value={c.breakdown.frequency}
              max={30}
            />
            <ScoreCell
              label="環境"
              value={c.breakdown.environment}
              max={30}
            />
          </div>

          {/* メニュー構造 */}
          <div className="mb-4 rounded-lg bg-[#fafafa] border border-[#e8ebe9] p-3">
            <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-1.5">
              メニュー構造
            </div>
            <div className="text-xs text-zinc-900">
              <span className="font-bold">
                {c.template.cycle_count} 強度
              </span>
              <span className="text-zinc-300 mx-1.5">|</span>
              <span className="font-bold">
                全 {c.template.total_exercises} 種目
              </span>
            </div>
            {c.template.cycles && c.template.cycles.length > 0 && (
              <div className="mt-1.5 text-[11px] text-zinc-600">
                {c.template.cycles
                  .map(
                    (cy) => `${cy["段階"]} (${cy["週"]?.length ?? 0}日)`
                  )
                  .join(" → ")}
              </div>
            )}
          </div>

          {/* メニュー詳細アコーディオン (案 i: 1サイクル目のみフル展開) */}
          <MenuDetailAccordion template={c.template} />

          {/* CTA */}
          <Link
            href={`/admin/users/${userId}/menu/new?template=${c.template.id}`}
            className={`block w-full rounded-[4px] px-4 py-2.5 text-center text-sm font-bold transition-colors ${
              idx === 0
                ? "bg-[#00897b] text-white hover:bg-[#00695c]"
                : "border border-[#00897b] bg-white text-[#00695c] hover:bg-[rgba(0,137,123,0.08)]"
            }`}
          >
            {idx === 0 ? "★ 採用する (推奨)" : "採用する"}
          </Link>
        </article>
      ))}

      {/* 案 C: もっと見る */}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-[14px] border border-dashed border-zinc-300 bg-white px-4 py-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
        >
          もっと見る ({initialVisible + 1}-{candidates.length} 位を表示)
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded-[14px] border border-dashed border-zinc-300 bg-white px-4 py-3 text-xs font-bold text-zinc-500 hover:bg-zinc-50"
        >
          上位 {initialVisible} 件だけ表示
        </button>
      )}
    </div>
  );
}

function ScoreCell({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const positive = value >= 0;
  return (
    <div className="rounded-md bg-[#fafafa] border border-[#e8ebe9] px-2 py-1.5 text-center">
      <div className="text-[9px] text-zinc-500 font-bold">{label}</div>
      <div
        className={`text-sm font-bold font-mono ${
          positive ? "text-zinc-900" : "text-rose-600"
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] text-zinc-400 font-mono">/ {max}</div>
    </div>
  );
}

// =====================================================================
// メニュー詳細アコーディオン (案 i: 1 サイクル目のみフル展開)
//   - 閉じてる (デフォルト)
//   - 開いてる: 1 サイクル目だけを「日 → 種目」全展開で表示
//   - 残りサイクルは「採用後の編集画面で確認」と注記
// =====================================================================

function MenuDetailAccordion({ template }: { template: WorkoutTemplateRow }) {
  const [open, setOpen] = useState(false);
  const cycles = template.cycles ?? [];
  const firstCycle = cycles[0];
  const remainingCycles = cycles.length - 1;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 flex items-center justify-center gap-1"
      >
        <span>メニュー詳細を見る (最初の強度)</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-zinc-200 bg-[#fafafa] p-3">
      {/* ヘッダ */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50"
        >
          ▲ 閉じる
        </button>
        <span className="ml-auto text-[10px] text-zinc-500">
          全 {template.total_exercises} 種目 / {cycles.length} 強度
        </span>
      </div>

      {/* 1 サイクル目のみフル展開 */}
      {firstCycle ? (
        <div>
          <div className="mb-2 border-b border-zinc-200 pb-1.5 text-xs font-bold text-[#00695c] tracking-widest">
            ━━ 1: {firstCycle["段階"] || "強度1"} ━━
          </div>
          <div className="space-y-3">
            {(firstCycle["週"] ?? []).map((day, di) => (
              <DayRow key={di} day={day} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-zinc-500">強度が空です</div>
      )}

      {/* 残りサイクルの注記 */}
      {remainingCycles > 0 && (
        <div className="mt-3 border-t border-zinc-200 pt-2 text-[10px] text-zinc-500">
          他に {remainingCycles} 強度 (
          {cycles
            .slice(1)
            .map((cy, i) => `${i + 2}: ${cy["段階"] || `強度${i + 2}`}`)
            .join(" / ")}
          ) あり。採用後の編集画面で確認できます。
        </div>
      )}
    </div>
  );
}

function DayRow({
  day,
}: {
  day: {
    日: string;
    種目: Array<{
      種目名: string;
      回数: string;
      インターバル: string;
      主部位: string[];
    }>;
  };
}) {
  const dayLabel = cleanDayLabel(day["日"]) || "日";
  const exercises = day["種目"] ?? [];

  return (
    <div>
      <div className="mb-1 text-[10px] font-bold text-zinc-600 tracking-widest">
        ▽ {dayLabel}
      </div>
      <div className="space-y-0.5 pl-2">
        {exercises.length === 0 ? (
          <div className="text-[11px] text-zinc-400">(種目なし)</div>
        ) : (
          exercises.map((ex, ei) => (
            <div key={ei} className="text-[11px] text-zinc-800 leading-relaxed">
              <span className="font-mono text-zinc-400 mr-1.5">{ei + 1}.</span>
              <span className="font-bold">{cleanExerciseName(ex["種目名"])}</span>
              <span className="text-zinc-500 ml-1.5">
                {cleanReps(ex["回数"])}
                <span className="text-zinc-300 mx-1">|</span>
                休 {ex["インターバル"] || "—"}
                <span className="text-zinc-300 mx-1">|</span>
                <span className="text-[#00695c] font-bold">
                  {getExerciseTarget(ex["主部位"])}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
