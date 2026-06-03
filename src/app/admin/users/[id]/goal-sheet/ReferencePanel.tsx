"use client";

import { useState } from "react";
import Link from "next/link";
import type { SeriesPoint } from "@/lib/monthly-audit/series";
import type { GoalProgress } from "@/lib/monthly-audit/series";
import type { BMICategory } from "@/lib/monthly-audit/series";
import {
  AUDIT_QUESTIONS,
  AUDIT_STATUS_LABELS_ADMIN,
  type AuditStatus,
  type MonthlyAuditItems,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
} from "@/lib/monthly-audit/types";
import { Sparkline } from "../_components/Sparkline";

/**
 * 目標シート添削画面の右サイドパネル (参考情報、常時表示)
 *
 * 構成 (上から):
 *   1. 体組成推移 (体重 / ウエスト sparkline + 体脂肪 + BMI)
 *   2. 達成度 (現在 → 目標、プログレスバー)
 *   3. 直近月次添削 (状態 + 平均スコア + リンク)
 *   4. 過去の添削履歴 (revisions の最新 N 件、添削件数つき)
 */
export type ReferenceData = {
  weightSeries: SeriesPoint[];
  waistSeries: SeriesPoint[];
  latestWeight: number | null;
  prevWeight: number | null;
  latestWaist: number | null;
  prevWaist: number | null;
  currentBodyFat: number | null;
  currentBMI: number | null;
  bmiCategory: BMICategory | null;
  weightProgress: GoalProgress | null;
  startWeight: number | null;
  targetWeight: number | null;
  auditStatus: AuditStatus;
  latestAuditTargetMonth: string | null;
  latestAuditId: string | null;
  latestAuditAvgScore: number | null;
  latestAuditItems: MonthlyAuditItems | null;
  revisions: Array<{
    created_at: string;
    edited_by: string | null;
    auditCount: number;
  }>;
};

export function ReferencePanel({
  data,
  userId,
}: {
  data: ReferenceData;
  userId: string;
}) {
  return (
    <aside className="space-y-3 text-xs">
      <div className="text-[10px] font-bold text-zinc-500 tracking-widest">
        📊 参考情報
      </div>

      {/* 1. 体組成推移 */}
      <Card title="体組成推移">
        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            label="体重"
            value={data.latestWeight}
            prev={data.prevWeight}
            unit="kg"
          />
          <MiniStat
            label="ウエスト"
            value={data.latestWaist}
            prev={data.prevWaist}
            unit="cm"
          />
        </div>
        <div className="mt-2">
          <Sparkline series={data.weightSeries} unit="kg" width={240} height={40} />
        </div>
        <div className="mt-2 pt-2 border-t border-zinc-100 grid grid-cols-2 gap-3">
          <SmallValue
            label="体脂肪率"
            value={data.currentBodyFat !== null ? `${data.currentBodyFat.toFixed(1)} %` : "—"}
          />
          <SmallValue
            label="BMI"
            value={
              data.currentBMI !== null
                ? `${data.currentBMI.toFixed(1)}${data.bmiCategory ? ` (${data.bmiCategory})` : ""}`
                : "—"
            }
            tone={
              data.bmiCategory === "適正"
                ? "success"
                : data.bmiCategory === "低体重"
                  ? "warning"
                  : data.bmiCategory
                    ? "danger"
                    : undefined
            }
          />
        </div>
      </Card>

      {/* 2. 達成度 */}
      <Card title="達成度 (体重)">
        {data.weightProgress &&
        data.startWeight !== null &&
        data.targetWeight !== null &&
        data.latestWeight !== null ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="text-[11px]">
                現在{" "}
                <span className="font-bold font-mono">
                  {data.latestWeight.toFixed(1)}
                </span>
                <span className="text-[9px] text-zinc-500"> kg</span>{" "}
                <span className="text-zinc-400">→</span>{" "}
                <span className="font-bold font-mono text-[#00695c]">
                  {data.targetWeight.toFixed(1)}
                </span>
                <span className="text-[9px] text-[#00695c]"> kg</span>
              </div>
              <div className="text-[11px] font-bold">
                {Math.round(data.weightProgress.ratio * 100)}%
              </div>
            </div>
            <div className="relative h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-[#00897b]"
                style={{ width: `${data.weightProgress.ratio * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-0.5">
              <span>開 {data.startWeight.toFixed(1)}</span>
              <span>目 {data.targetWeight.toFixed(1)}</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            目標体重・開始体重が必要です
          </p>
        )}
      </Card>

      {/* 3. 直近月次添削 (アコーディオンで 17 項目展開可能) */}
      <LatestAuditCard data={data} userId={userId} />

      {/* 4. 過去の添削履歴 */}
      <Card title="編集・添削履歴">
        {data.revisions.length === 0 ? (
          <p className="text-[11px] text-zinc-500">履歴なし</p>
        ) : (
          <div className="space-y-1.5">
            {data.revisions.map((r, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between text-[10px] border-b border-zinc-100 last:border-b-0 pb-1.5 last:pb-0"
              >
                <span className="text-zinc-700 font-mono">
                  {formatShortDateTime(r.created_at)}
                </span>
                {r.auditCount > 0 ? (
                  <span className="text-[#00695c] font-bold">
                    添削 {r.auditCount}
                  </span>
                ) : (
                  <span className="text-zinc-400">受講生編集</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </aside>
  );
}

// =====================================================================
// 月次添削カード (アコーディオン展開で 17 項目)
// =====================================================================

function LatestAuditCard({
  data,
  userId,
}: {
  data: ReferenceData;
  userId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!data.latestAuditTargetMonth) {
    return (
      <Card title="直近月次添削">
        <p className="text-[11px] text-zinc-500">月次添削未提出</p>
      </Card>
    );
  }

  return (
    <Card title="直近月次添削">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono text-zinc-700">
          {data.latestAuditTargetMonth.slice(0, 7).replace("-", "/")}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${auditStatusStyle(
            data.auditStatus
          )}`}
        >
          {AUDIT_STATUS_LABELS_ADMIN[data.auditStatus]}
        </span>
      </div>
      {data.latestAuditAvgScore !== null && (
        <div className="text-[11px] mb-1">
          <span className="text-zinc-500">平均スコア:</span>{" "}
          <span className="font-bold font-mono">
            {data.latestAuditAvgScore.toFixed(1)}
          </span>
          <span className="text-zinc-400 text-[10px]"> / 10</span>
        </div>
      )}
      <div className="flex items-center gap-3 mt-1.5">
        {data.latestAuditId && (
          <Link
            href={`/admin/monthly-reviews/${data.latestAuditId}?from=hub&user_id=${userId}`}
            className="text-[10px] text-[#00695c] font-bold hover:underline"
          >
            添削画面 →
          </Link>
        )}
        {data.latestAuditItems && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-zinc-600 font-bold hover:text-zinc-900"
          >
            {expanded ? "閉じる ▲" : "内容を見る ▼"}
          </button>
        )}
      </div>

      {/* 17 項目展開 (折りたたみ) */}
      {expanded && data.latestAuditItems && (
        <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2.5 max-h-[400px] overflow-y-auto">
          {AUDIT_QUESTIONS.map((q) => {
            const answer = data.latestAuditItems?.[
              q.key as keyof MonthlyAuditItems
            ];
            return <AuditItemMini key={q.key} question={q} answer={answer} />;
          })}
        </div>
      )}
    </Card>
  );
}

function AuditItemMini({
  question,
  answer,
}: {
  question: (typeof AUDIT_QUESTIONS)[number];
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  const num = question.key.replace("q", "");
  return (
    <div className="text-[10px] leading-relaxed">
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-zinc-400 font-mono">Q{num}</span>
        <span className="font-bold text-zinc-700">{question.label}</span>
      </div>
      <div className="pl-5">
        {question.type === "body_measure" &&
          (() => {
            const a = answer as BodyMeasureAnswer | undefined;
            const cv = a?.current_value;
            const lv = a?.last_value;
            return (
              <>
                <div className="text-zinc-900 font-mono">
                  今月 {cv ?? "—"}
                  <span className="text-zinc-400"> {question.unit}</span>
                  {lv !== undefined && (
                    <span className="text-zinc-400 ml-2">
                      (先月 {lv} {question.unit})
                    </span>
                  )}
                </div>
                {a?.text && (
                  <div className="text-rose-600 mt-0.5">{a.text}</div>
                )}
              </>
            );
          })()}
        {question.type === "score" &&
          (() => {
            const a = answer as ScoreAnswer | undefined;
            return (
              <>
                <div className="text-zinc-900 font-mono font-bold">
                  {a?.score ?? "—"} / 10
                </div>
                {a?.text && (
                  <div className="text-rose-600 mt-0.5">{a.text}</div>
                )}
              </>
            );
          })()}
        {question.type === "text" &&
          (() => {
            const a = answer as TextAnswer | undefined;
            return a?.text ? (
              <div className="text-rose-600">{a.text}</div>
            ) : (
              <div className="text-zinc-400">—</div>
            );
          })()}
      </div>
    </div>
  );
}

// =====================================================================
// 補助コンポーネント
// =====================================================================

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#e8ebe9] bg-white p-3">
      <div className="text-[9px] font-bold text-zinc-500 tracking-widest mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  prev,
  unit,
}: {
  label: string;
  value: number | null;
  prev: number | null;
  unit: string;
}) {
  if (value === null) {
    return (
      <div>
        <div className="text-[9px] text-zinc-500 mb-0.5">{label}</div>
        <div className="text-[11px] text-zinc-400">—</div>
      </div>
    );
  }
  const diff = prev !== null ? value - prev : null;
  const color =
    diff === null
      ? "text-zinc-400"
      : diff < 0
        ? "text-emerald-700"
        : diff > 0
          ? "text-rose-600"
          : "text-zinc-500";
  return (
    <div>
      <div className="text-[9px] text-zinc-500 mb-0.5">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-zinc-900 font-mono">
          {value.toFixed(1)}
        </span>
        <span className="text-[9px] text-zinc-500">{unit}</span>
        {diff !== null && (
          <span className={`text-[10px] font-mono font-bold ${color}`}>
            {diff > 0 ? "+" : ""}
            {diff.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

function SmallValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-600"
          : "text-zinc-900";
  return (
    <div>
      <div className="text-[9px] text-zinc-500 mb-0.5">{label}</div>
      <div className={`text-[11px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

function auditStatusStyle(status: AuditStatus): string {
  switch (status) {
    case "a_empty":
      return "bg-zinc-100 text-zinc-600";
    case "b_in_progress":
      return "bg-amber-50 text-amber-800";
    case "c_submitted":
      return "bg-rose-500 text-white font-bold";
    case "d_replied":
      return "bg-emerald-50 text-emerald-800";
  }
}

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}/${m}/${day} ${hh}:${mm}`;
}
