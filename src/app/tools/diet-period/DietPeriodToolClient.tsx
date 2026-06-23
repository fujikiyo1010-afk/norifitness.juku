"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MILESTONE_WEEKS,
  calculateDietPeriod,
} from "@/lib/tools/calculations";
import { saveToolCalculation } from "@/lib/tools/actions";
import { readDraft } from "@/lib/goal-sheet/draft-storage";
import type {
  DietPeriodInputs,
  DietPeriodOutputs,
  PaceAdviceLevel,
  ToolCalculation,
} from "@/lib/tools/types";

/**
 * 減量期間逆算ツール Client UI (/tools/diet-period 単独モード)
 *
 * 仕様:
 *   - 入力: 現在体重 + 目標体重 + ペース (デフォルト 0.5) + 開始日 (デフォルト 今日)
 *   - 結果: 必要な減量 + 期間 + 目標到達予定日 + 進捗バー
 *   - アドバイス: ペース別 3 段階 (≤0.5 / ≤1.0 / >1.0)
 *   - タイムライン: P5 改善 案 α (節目週 + 開始 + 到達のみ、間は折りたたみ)
 *   - PDF ボタン: P6 改善 → 削除 (MVP では持たない)
 *   - 反映ボタン: なし (単独モード、目標シート連携は Step 10f で別 Client)
 *   - 保存ボタン: tool_calculations に UPSERT
 */
export function DietPeriodToolClient({
  previous,
  todayISO,
}: {
  previous: ToolCalculation<DietPeriodInputs, DietPeriodOutputs> | null;
  todayISO: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromGoalSheet = searchParams.get("return") === "goal-sheet";

  const prevInputs = previous?.inputs;
  const prevOutputs = previous?.outputs;

  // 入力 state (前回値を初期値に。なければデフォルト: ペース 0.5 / 開始日 今日)
  const [currentWeight, setCurrentWeight] = useState(
    prevInputs?.current_weight_kg?.toString() ?? ""
  );
  const [targetWeight, setTargetWeight] = useState(
    prevInputs?.target_weight_kg?.toString() ?? ""
  );
  const [pace, setPace] = useState(
    prevInputs?.pace_kg_per_week?.toString() ?? "0.5"
  );
  const [startDate, setStartDate] = useState(
    prevInputs?.start_date ?? todayISO
  );

  // 触ったかどうか (前回値があれば薄色、触ったら通常色)
  // ※ ペース/開始日はデフォルト値を持つので、prev がなくても初期値が表示される。
  // → ペース/開始日は前回値かどうかではなく touched 単体で判定したいが、
  //   実用上は「prev がなければ最初から濃い」で問題ないので body-fat と同様に統一。
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) =>
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // 目標シート編集中のドラフトから現在体重・目標体重をプリセット
  // (?return=goal-sheet で来た時のみ)
  useEffect(() => {
    if (!isFromGoalSheet) return;
    const draft = readDraft();
    if (!draft) return;
    const cur = draft.current_status?.weight_kg;
    if (typeof cur === "number") setCurrentWeight(cur.toString());
    const tgt = draft.goal_selection?.target_weight_kg;
    if (typeof tgt === "number") setTargetWeight(tgt.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 結果 + エラー
  const [result, setResult] = useState<DietPeriodOutputs | null>(
    prevOutputs ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const clearMissing = (key: string) => {
    setMissingFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // 保存
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [, startTransition] = useTransition();

  // 計算
  const handleCalc = () => {
    setError(null);
    setSavedJustNow(false);
    setShowAllWeeks(false);

    const missing = new Set<string>();
    if (!currentWeight) missing.add("current");
    if (!targetWeight) missing.add("target");
    if (!pace) missing.add("pace");
    if (!startDate) missing.add("start");

    if (missing.size > 0) {
      setMissingFields(missing);
      setError("未入力の項目があります");
      return;
    }
    setMissingFields(new Set());

    const inputs: DietPeriodInputs = {
      current_weight_kg: parseFloat(currentWeight),
      target_weight_kg: parseFloat(targetWeight),
      pace_kg_per_week: parseFloat(pace),
      start_date: startDate,
    };

    try {
      const output = calculateDietPeriod(inputs);
      setResult(output);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setResult(null);
    }
  };

  const handleSave = () => {
    if (!result) return;
    setSaving(true);
    setError(null);

    const inputs: DietPeriodInputs = {
      current_weight_kg: parseFloat(currentWeight),
      target_weight_kg: parseFloat(targetWeight),
      pace_kg_per_week: parseFloat(pace),
      start_date: startDate,
    };

    startTransition(async () => {
      const res = await saveToolCalculation("diet_period", inputs, result);
      setSaving(false);
      if (res.success) {
        setSavedJustNow(true);
        setTimeout(() => setSavedJustNow(false), 3000);
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  };

  // タイムライン用の週リスト
  const timeline = useMemo(() => {
    if (!result) return [];
    return buildTimeline({
      currentWeight: parseFloat(currentWeight),
      targetWeight: parseFloat(targetWeight),
      pace: parseFloat(pace),
      startDateISO: startDate,
      totalWeeks: result.weeks,
      showAll: showAllWeeks,
    });
  }, [result, currentWeight, targetWeight, pace, startDate, showAllWeeks]);

  // 入力 className (前回値で薄色、触ったら通常色)
  const inputClass = (key: string) =>
    `flex-1 border-none outline-none py-2.5 text-base bg-transparent font-mono ${
      touched[key] || !prevInputs ? "text-[#2b2620]" : "text-[#a59b8c]"
    }`;

  return (
    <main className="min-h-screen bg-[#f9f5ed] flex flex-col">
      <div className="flex-1 max-w-[460px] mx-auto w-full pb-10">
        {/* ヒーロー帯 */}
        <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border-b border-[#e7dcc9] px-6 py-5">
          <h2 className="text-xl font-bold text-[#1a237e] mb-1">減量期間逆算</h2>
          <p className="text-[11px] text-[#6a6256] leading-relaxed">
            目標体重まで何週間? いつ達成?
          </p>
          {previous && (
            <p className="text-[10px] text-[#283593] mt-2 font-mono">
              ✓ 前回 {formatDate(previous.calculatedAt)} 計算 (前回値で復元中)
            </p>
          )}
        </section>

        {/* 入力カード */}
        <section className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl mx-4 my-4 px-5 py-4">
          <h3 className="text-xs font-bold text-zinc-600 tracking-wide mb-3.5 pb-2.5 border-b border-[#e7dcc9]">
            目標設定
          </h3>

          <InputRow
            label="現在体重"
            value={currentWeight}
            unit="kg"
            step="0.1"
            inputClass={inputClass("current")}
            onChange={(v) => {
              setCurrentWeight(v);
              markTouched("current");
              clearMissing("current");
            }}
            hasError={missingFields.has("current")}
          />
          <InputRow
            label="目標体重"
            value={targetWeight}
            unit="kg"
            step="0.1"
            inputClass={inputClass("target")}
            onChange={(v) => {
              setTargetWeight(v);
              markTouched("target");
              clearMissing("target");
            }}
            hasError={missingFields.has("target")}
          />
          <InputRow
            label={
              <>
                1 週間の減量ペース{" "}
                <span className="text-[#6a6256] text-[10px] font-normal">
                  (推奨 0.5)
                </span>
              </>
            }
            value={pace}
            unit="kg / 週"
            step="0.1"
            inputClass={inputClass("pace")}
            onChange={(v) => {
              setPace(v);
              markTouched("pace");
              clearMissing("pace");
            }}
            hasError={missingFields.has("pace")}
          />

          {/* 開始日 (date input) */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
              開始日
            </label>
            <div
              className={`flex items-center gap-2.5 border rounded-lg px-3 transition-colors ${
                missingFields.has("start")
                  ? "border-[#d32f2f] bg-[#fef5f5] focus-within:border-[#d32f2f]"
                  : "border-[#e7dcc9] bg-[#fffdf8] focus-within:border-[#3949ab]"
              }`}
            >
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  markTouched("start");
                  clearMissing("start");
                }}
                className={`flex-1 border-none outline-none py-2.5 text-sm bg-transparent ${
                  touched["start"] || !prevInputs
                    ? "text-[#2b2620]"
                    : "text-[#a59b8c]"
                }`}
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="mx-4 mb-3 px-3.5 py-2.5 bg-[#fef5f5] border border-[#d32f2f]/30 text-[#d32f2f] text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* 計算ボタン */}
        <button
          onClick={handleCalc}
          className="w-[calc(100%-32px)] mx-4 mt-1 mb-4 py-3.5 bg-[#3949ab] text-white rounded text-sm font-bold hover:bg-[#283593] transition-colors"
        >
          計算する
        </button>

        {/* 計算前の例示 */}
        {!result && (
          <p className="-mt-3 mb-4 mx-4 text-center text-[10px] text-[#283593]/70 font-mono leading-relaxed">
            例: 75 → 68kg・0.5kg/週 → 14 週 (98 日)
          </p>
        )}

        {result && (
          <>
            {/* アドバイス */}
            <AdviceCard level={result.pace_advice_level} pace={parseFloat(pace)} />

            {/* 結果カード */}
            <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border border-[rgba(255,235,59,0.4)] rounded-xl mx-4 mb-3 px-5 py-4">
              <h3 className="text-xs font-bold text-[#283593] tracking-wide mb-3 pb-2.5 border-b border-[#e7dcc9]">
                ✓ 計算結果
              </h3>

              {/* 3 項目を 1 ブロックに統合 (A-1 罫線あり / B-1 均一スタイル / C-2 日数のみ / D-3 到達日アイコンのみ) */}
              <div className="bg-[#fffdf8]/80 rounded-lg mb-3.5 divide-y divide-[#e7dcc9]">
                <ResultRow label="必要な減量">
                  {result.needed_kg.toFixed(1)} kg
                </ResultRow>
                <ResultRow label="期間">{result.days} 日</ResultRow>
                <ResultRow
                  label={
                    <span className="flex items-center gap-1.5">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3.5 h-3.5 text-[#283593]"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      目標到達予定日
                    </span>
                  }
                >
                  {formatDateJP(result.end_date)} ごろ
                </ResultRow>
              </div>

              {/* 進捗カード */}
              <div className="bg-[#fffdf8]/80 rounded-lg px-3.5 py-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[11px] font-bold text-zinc-600">
                    1 週間あたりの進捗
                  </div>
                  <div className="text-xs font-bold text-[#283593] font-mono">
                    {result.weekly_progress_pct.toFixed(1)} %
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[#e7dcc9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#3949ab] to-[#283593] rounded-full"
                    style={{
                      width: `${Math.min(100, result.weekly_progress_pct)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-[#6a6256]">
                  1 週間 {parseFloat(pace).toFixed(1)} kg ずつ、目標まで{" "}
                  {result.needed_kg.toFixed(1)} kg の進み方
                </p>
              </div>
            </section>

            {/* タイムライン */}
            <section className="mx-4 mb-4">
              <h4 className="text-sm font-bold text-[#2b2620] mb-2.5 pl-1 flex items-center gap-1.5">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                週ごとのタイムライン
              </h4>

              <div className="space-y-2">
                {timeline.map((row) => (
                  <WeekCard key={row.week} row={row} />
                ))}
              </div>

              {/* 「すべての週を見る」トグル (節目モード時のみ) */}
              {result.weeks > 6 && (
                <button
                  onClick={() => setShowAllWeeks((v) => !v)}
                  className="w-full mt-2 py-2.5 bg-[#fffdf8] border border-[#e7dcc9] rounded text-xs font-bold text-[#283593] hover:bg-[#3949ab]/5 transition-colors"
                >
                  {showAllWeeks
                    ? "節目だけ表示する"
                    : `すべての週を見る (全 ${Math.ceil(result.weeks)} 週)`}
                </button>
              )}
            </section>

            {/* 計算式 */}
            <div className="mx-4 mb-3 px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-700 leading-relaxed font-mono">
              <div className="font-sans text-zinc-800 font-bold text-[11px] mb-1">
                計算式
              </div>
              必要な減量 = 現在体重 − 目標体重
              <br />
              期間 (週) = 減量 / ペース ・ 期間 (日) = 週 × 7
              <br />
              到達日 = 開始日 + 日数
            </div>

            {/* 目標シートに適用ボタン (?return=goal-sheet 時のみ) */}
            {isFromGoalSheet && (
              <div className="mx-4 mb-3">
                <button
                  onClick={() => {
                    sessionStorage.setItem(
                      "goal-sheet-reflect-diet-period",
                      JSON.stringify({ target_date: result.end_date })
                    );
                    router.push("/goal-sheet/edit#tool-diet-period");
                  }}
                  className="w-full py-3.5 bg-[#4a875b] text-white rounded text-sm font-bold hover:bg-[#34603f] transition-colors"
                >
                  目標シートに適用 →
                </button>
                <p className="text-[11px] text-zinc-600 text-center mt-2">
                  到達予定日 {result.end_date} を反映して目標シート編集画面に戻ります
                </p>
              </div>
            )}

            {/* 保存ボタン (単独モードのみ) */}
            {!isFromGoalSheet && (
              <div className="mx-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3.5 bg-[#fffdf8] border border-[#3949ab] text-[#3949ab] rounded text-sm font-bold hover:bg-[#3949ab]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving
                    ? "保存中..."
                    : savedJustNow
                      ? "✓ 保存しました"
                      : "この計算を保存する"}
                </button>
                <p className="text-[11px] text-zinc-600 text-center mt-2 leading-relaxed">
                  保存すると次回開いた時に前回値が復元されます
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// =====================================================================
// 子コンポーネント
// =====================================================================

function InputRow({
  label,
  value,
  unit,
  step,
  inputClass,
  onChange,
  hasError = false,
}: {
  label: React.ReactNode;
  value: string;
  unit: string;
  step: string;
  inputClass: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  return (
    <div className="mb-3.5">
      <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 border rounded-lg px-3 transition-colors ${
          hasError
            ? "border-[#d32f2f] bg-[#fef5f5] focus-within:border-[#d32f2f]"
            : "border-[#e7dcc9] bg-[#fffdf8] focus-within:border-[#3949ab]"
        }`}
      >
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <span
          className={`text-xs flex-shrink-0 ${
            hasError ? "text-[#d32f2f]" : "text-[#6a6256]"
          }`}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs text-zinc-600">{label}</span>
      <span className="font-mono font-bold text-[15px] text-[#1a237e] text-right">
        {children}
      </span>
    </div>
  );
}

function AdviceCard({
  level,
  pace,
}: {
  level: PaceAdviceLevel;
  pace: number;
}) {
  const message = ADVICE_MESSAGES[level];
  return (
    <div className="mx-4 mb-3 px-3.5 py-3 bg-[#e8eaf6] border-l-[3px] border-[#3949ab] rounded text-xs text-zinc-700 leading-relaxed">
      <div className="flex items-start gap-1.5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#1a237e]"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
        <div>
          <b className="text-[#1a237e] font-bold">
            ペース {pace.toFixed(1)} kg / 週
          </b>{" "}
          — {message.summary}
          <br />
          <span className="text-zinc-600">{message.detail}</span>
        </div>
      </div>
    </div>
  );
}

const ADVICE_MESSAGES: Record<
  PaceAdviceLevel,
  { summary: string; detail: string }
> = {
  moderate: {
    summary: "無理の少ない、続けやすいペースです。",
    detail: "食事・睡眠・軽い運動を整えながら、安定して続けることを大切に。",
  },
  intense: {
    summary: "ややしっかりめのペースです。",
    detail:
      "体調を見ながら進めましょう。疲れや停滞を感じたらペースを落とす選択肢を。",
  },
  extreme: {
    summary: "かなり速いペースです、計画見直しを推奨します。",
    detail:
      "リバウンドや栄養不足のリスクが上がります。0.5〜1.0 kg/週 が目安です。",
  },
};

// =====================================================================
// タイムライン構築
// =====================================================================

type WeekRow = {
  week: number;
  date: string; // ISO yyyy-mm-dd
  weight: number; // kg
  kind: "start" | "milestone" | "goal" | "normal";
  label?: string; // 節目ラベル
};

function buildTimeline({
  currentWeight,
  targetWeight,
  pace,
  startDateISO,
  totalWeeks,
  showAll,
}: {
  currentWeight: number;
  targetWeight: number;
  pace: number;
  startDateISO: string;
  totalWeeks: number;
  showAll: boolean;
}): WeekRow[] {
  const start = new Date(`${startDateISO}T00:00:00`);
  const goalWeek = Math.ceil(totalWeeks);

  const buildWeek = (weekNum: number): WeekRow => {
    const date = new Date(start);
    date.setDate(date.getDate() + (weekNum - 1) * 7);
    const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // 1 週目はスタート時点 (current)、最終週は target、その間は線形
    let weight: number;
    let kind: WeekRow["kind"] = "normal";
    let label: string | undefined;

    if (weekNum === 1) {
      weight = currentWeight;
      kind = "start";
      label = "スタート時点";
    } else if (weekNum === goalWeek) {
      weight = targetWeight;
      kind = "goal";
      label = "目標到達の目安";
    } else {
      weight =
        Math.round((currentWeight - pace * (weekNum - 1)) * 10) / 10;
      const milestone = MILESTONE_WEEKS.find((m) => m.week === weekNum);
      if (milestone) {
        kind = "milestone";
        label = milestone.label;
      }
    }

    return { week: weekNum, date: dateISO, weight, kind, label };
  };

  // 短い期間 (6 週以下) は常に全週、それ以外は節目のみ + showAll で全週
  const showAllMode = totalWeeks <= 6 || showAll;

  if (showAllMode) {
    const rows: WeekRow[] = [];
    for (let w = 1; w <= goalWeek; w++) {
      rows.push(buildWeek(w));
    }
    return rows;
  }

  // 節目モード: 1 (start) + 節目 + goal
  const weeks = new Set<number>([1, goalWeek]);
  MILESTONE_WEEKS.forEach((m) => {
    if (m.week < goalWeek) weeks.add(m.week);
  });

  return Array.from(weeks)
    .sort((a, b) => a - b)
    .map(buildWeek);
}

function WeekCard({ row }: { row: WeekRow }) {
  const cardCls =
    row.kind === "milestone"
      ? "bg-[#e8eaf6] border-[#3949ab]/25"
      : row.kind === "goal"
        ? "bg-[#fff9e6] border-[#f5c842]"
        : "bg-[#fffdf8] border-[#e7dcc9]";
  const weightCls =
    row.kind === "goal"
      ? "text-[#b8860b]"
      : "text-[#1a237e]";

  return (
    <div className={`rounded-lg px-3.5 py-3 border ${cardCls}`}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-bold text-[#2b2620]">
            {row.week} 週目
          </div>
          <div className="text-[10px] text-[#6a6256] font-mono">
            {formatDateShort(row.date)}
          </div>
        </div>
        <div className={`text-base font-mono font-bold ${weightCls}`}>
          {row.weight.toFixed(1)} kg
        </div>
      </div>
      {row.label && (
        <div className="mt-1.5 text-[10px] text-zinc-600 flex items-center gap-1">
          {row.kind === "goal" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-2.5 h-2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          ) : row.kind === "milestone" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-2.5 h-2.5"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ) : null}
          {row.label}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 補助
// =====================================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateShort(iso: string): string {
  return iso.replace(/-/g, "/");
}

function formatDateJP(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(d, 10)} 日`;
}
