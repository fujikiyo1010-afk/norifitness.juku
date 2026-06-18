"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { calculatePfcCarb } from "@/lib/tools/calculations";
import { saveToolCalculation } from "@/lib/tools/actions";
import { readDraft } from "@/lib/goal-sheet/draft-storage";
import { WEEK_DAYS } from "@/lib/tools/types";
import type {
  FatRatio,
  PfcCarbInputs,
  PfcCarbOutputs,
  ToolCalculation,
  TrainingIntensity,
  WeekDay,
} from "@/lib/tools/types";

const DAY_LABELS: Record<WeekDay, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

const FAT_RATIOS: FatRatio[] = [0.2, 0.25, 0.3];

/**
 * PFC・カーボサイクル設定 Client UI (/tools/pfc-carb 単独モード)
 *
 * 仕様:
 *   - STEP 1: 体重 + 摂取カロリー + 脂質比率 (3 択) → PFC g/kcal/%
 *   - STEP 2: 月〜日 のトレ強度 (高/中/低) → 1 週間の糖質配分テーブル
 *   - P8 反映: 「今日の目安」表示は無し (週次表のみ)
 *   - P9 反映: たんぱく質係数 = 2g 固定 (内部実装)
 *   - P10 反映: STEP 1 折りたたみなし、常時表示
 *   - 警告: 高 7 日 / 高 5 日以上 / 低 7 日 で動的表示
 *   - 反映ボタンなし (単独モード、目標シート連携は Step 10f)
 *   - 保存ボタン: tool_calculations へ UPSERT
 */
export function PfcCarbToolClient({
  previous,
  calorieHint,
}: {
  previous: ToolCalculation<PfcCarbInputs, PfcCarbOutputs> | null;
  calorieHint: { maintenance: number; diet: number } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromGoalSheet = searchParams.get("return") === "goal-sheet";

  const prevInputs = previous?.inputs;
  const prevOutputs = previous?.outputs;

  // 入力 state (前回値を初期値に)
  const [weight, setWeight] = useState(
    prevInputs?.weight_kg?.toString() ?? ""
  );
  const [calorie, setCalorie] = useState(
    prevInputs?.target_calorie?.toString() ?? ""
  );
  const [fatRatio, setFatRatio] = useState<FatRatio | "">(
    prevInputs?.fat_ratio ?? 0.25
  );
  const [intensities, setIntensities] = useState<
    Record<WeekDay, TrainingIntensity | "">
  >(() => {
    const init = {} as Record<WeekDay, TrainingIntensity | "">;
    for (const d of WEEK_DAYS) {
      init[d] = prevInputs?.intensities?.[d] ?? "";
    }
    return init;
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) =>
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // 目標シート編集中のドラフトから体重・目標カロリーをプリセット
  // (?return=goal-sheet で来た時のみ)
  // B/C/D 修正: 「必要カロリー計算ツール」 の maintenance_kcal を最優先で
  // 反映する (= 同じ目標シート内の前段ツール結果を そのまま使う動線に統一)。
  // maintenance_kcal が未設定なら 入力欄下に赤い警告を出す (= hasMaintenanceKcal=false)。
  const [hasMaintenanceKcal, setHasMaintenanceKcal] = useState(false);
  useEffect(() => {
    if (!isFromGoalSheet) return;
    const draft = readDraft();
    if (!draft) return;
    const w = draft.current_status?.weight_kg;
    if (typeof w === "number") setWeight(w.toString());
    const mk = draft.current_status?.maintenance_kcal;
    const cal = draft.nutrition?.target_calorie;
    if (typeof mk === "number") {
      setCalorie(mk.toString());
      setHasMaintenanceKcal(true);
    } else if (typeof cal === "number") {
      setCalorie(cal.toString());
      // hasMaintenanceKcal = false のまま → 警告は出る (= 順序強制)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [result, setResult] = useState<PfcCarbOutputs | null>(
    prevOutputs ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  const clearMissing = (key: string) => {
    setMissingFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [, startTransition] = useTransition();

  const handleCalc = () => {
    setError(null);
    setSavedJustNow(false);

    const missing = new Set<string>();
    if (!weight) missing.add("weight");
    if (!calorie) missing.add("calorie");
    if (!fatRatio) missing.add("fat");
    // 強度未選択も missing 扱い
    for (const d of WEEK_DAYS) {
      if (!intensities[d]) missing.add(`int_${d}`);
    }

    if (missing.size > 0) {
      setMissingFields(missing);
      setError(
        missing.size === 7 &&
          ![...missing].some((m) => !m.startsWith("int_"))
          ? "月〜日 すべての曜日の強度を選んでください"
          : "未入力の項目があります"
      );
      return;
    }
    setMissingFields(new Set());

    const inputs: PfcCarbInputs = {
      weight_kg: parseFloat(weight),
      target_calorie: parseFloat(calorie),
      fat_ratio: fatRatio as FatRatio,
      intensities: intensities as Record<WeekDay, TrainingIntensity>,
    };

    try {
      const output = calculatePfcCarb(inputs);
      setResult(output);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setResult(null);
    }
  };

  const handleSave = () => {
    if (!result || !fatRatio) return;
    setSaving(true);
    setError(null);

    const inputs: PfcCarbInputs = {
      weight_kg: parseFloat(weight),
      target_calorie: parseFloat(calorie),
      fat_ratio: fatRatio as FatRatio,
      intensities: intensities as Record<WeekDay, TrainingIntensity>,
    };

    startTransition(async () => {
      const res = await saveToolCalculation("pfc_carb", inputs, result);
      setSaving(false);
      if (res.success) {
        setSavedJustNow(true);
        setTimeout(() => setSavedJustNow(false), 3000);
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  };

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
          <h2 className="text-lg font-bold text-[#1a237e] mb-1">
            PFC・カーボサイクル設定
          </h2>
          <p className="text-[11px] text-[#6a6256] leading-relaxed">
            栄養素の数値 + 1 週間の糖質配分 (統合ツール)
          </p>
          {previous && (
            <p className="text-[10px] text-[#283593] mt-2 font-mono">
              ✓ 前回 {formatDate(previous.calculatedAt)} 計算 (前回値で復元中)
            </p>
          )}
        </section>

        {/* STEP 1 見出し */}
        <StepLabel num={1} title="PFC を計算" />

        {/* STEP 1 入力カード */}
        <section className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl mx-4 mb-3 px-5 py-4">
          <h3 className="text-xs font-bold text-zinc-600 tracking-wide mb-3.5 pb-2.5 border-b border-[#e7dcc9]">
            入力
          </h3>

          <InputRow
            label="体重"
            value={weight}
            unit="kg"
            step="0.1"
            inputClass={inputClass("weight")}
            onChange={(v) => {
              setWeight(v);
              markTouched("weight");
              clearMissing("weight");
            }}
            hasError={missingFields.has("weight")}
          />
          <InputRow
            label="摂取カロリー"
            value={calorie}
            unit="kcal"
            step="1"
            inputClass={inputClass("calorie")}
            onChange={(v) => {
              setCalorie(v);
              markTouched("calorie");
              clearMissing("calorie");
            }}
            hasError={missingFields.has("calorie")}
          />

          {/* C/D 修正: ?return=goal-sheet で来てるのに maintenance_kcal 未設定なら赤警告。
              旧「目安が分からない時は /tools/calorie で計算 →」 リンクは削除
              (= 飛んで戻る動線がややこしいため、 順序強制 = 警告で誘導)。
              単独モード (= ?return=goal-sheet なし) では従来通り calorieHint で前回値表示。 */}
          {isFromGoalSheet && !hasMaintenanceKcal && (
            <div className="-mt-2.5 mb-3.5 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-[11px] text-red-700 font-bold leading-relaxed">
                ⚠️ セクション 1 の「必要カロリー計算ツール」 が未入力です
              </p>
              <p className="mt-0.5 text-[10px] text-red-600 leading-relaxed">
                目標シートに戻って 先に必要カロリー計算ツールを実行してください。
              </p>
            </div>
          )}
          {!isFromGoalSheet && calorieHint && (
            <div className="-mt-2.5 mb-3.5">
              <p className="text-[10px] text-[#a59b8c] font-mono leading-relaxed">
                前回計算: メンテ {calorieHint.maintenance.toLocaleString()}{" "}
                kcal / ダイエット時 {calorieHint.diet.toLocaleString()} kcal
              </p>
            </div>
          )}

          {/* 脂質比率 3 択 */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
              脂質比率
            </label>
            <div
              className={`grid grid-cols-3 gap-2 ${
                missingFields.has("fat")
                  ? "p-1.5 -m-1.5 bg-[#fef5f5] rounded-lg"
                  : ""
              }`}
            >
              {FAT_RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setFatRatio(r);
                    markTouched("fat");
                    clearMissing("fat");
                  }}
                  className={`py-2.5 rounded text-[13px] font-bold border transition-colors ${
                    fatRatio === r
                      ? "bg-[#3949ab] border-[#3949ab] text-white"
                      : "bg-[#fffdf8] border-[#e7dcc9] text-zinc-600 hover:border-[#3949ab]"
                  }`}
                >
                  {Math.round(r * 100)}%
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* STEP 2 見出し */}
        <StepLabel num={2} title="カーボサイクル配分" />

        {/* STEP 2 入力 (強度) */}
        <section className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl mx-4 mb-3 px-5 py-4">
          <h3 className="text-xs font-bold text-zinc-600 tracking-wide mb-3 pb-2.5 border-b border-[#e7dcc9]">
            トレーニング強度を選択
          </h3>

          <div className="flex flex-col gap-1.5">
            {WEEK_DAYS.map((d) => {
              const hasErr = missingFields.has(`int_${d}`);
              return (
                <div
                  key={d}
                  className={`grid grid-cols-[32px_1fr_1fr_1fr] gap-1.5 items-center ${
                    hasErr ? "bg-[#fef5f5] rounded p-0.5 -m-0.5" : ""
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-700 text-center">
                    {DAY_LABELS[d]}
                  </div>
                  {(["high", "mid", "low"] as TrainingIntensity[]).map((lv) => {
                    const sel = intensities[d] === lv;
                    const cls = sel
                      ? lv === "high"
                        ? "bg-[#e65100] border-[#e65100] text-white"
                        : lv === "mid"
                          ? "bg-[#b45309] border-[#b45309] text-white"
                          : "bg-[#f9f5ed]0 border-zinc-500 text-white"
                      : "bg-[#fffdf8] border-[#e7dcc9] text-[#6a6256] hover:border-[#3949ab]";
                    return (
                      <button
                        key={lv}
                        onClick={() => {
                          setIntensities((s) => ({ ...s, [d]: lv }));
                          markTouched(`int_${d}`);
                          clearMissing(`int_${d}`);
                        }}
                        className={`py-2 rounded text-xs font-bold border transition-colors ${cls}`}
                      >
                        {lv === "high" ? "高" : lv === "mid" ? "中" : "低"}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* 強度の目安 */}
          <div className="mt-3 px-3 py-2.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-700 leading-relaxed">
            <div className="font-bold text-zinc-800 mb-0.5">強度の目安</div>
            <span className="text-[#e65100] font-bold">高</span> → 脚・背中・全身トレなど (疲労大)
            <br />
            <span className="text-[#b45309] font-bold">中</span> → 腕・肩・有酸素・体幹 (疲労中)
            <br />
            <span className="text-[#6a6256] font-bold">低</span> → 休み・ストレッチ・散歩 (疲労なし)
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
            例: 75kg・2,000kcal・脂質25% → P150 / F56 / C225 g
          </p>
        )}

        {result && (
          <>
            {/* STEP 1 結果カード */}
            <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border border-[rgba(255,235,59,0.4)] rounded-xl mx-4 mb-3 px-5 py-4">
              <h3 className="text-xs font-bold text-[#283593] tracking-wide mb-3 pb-2.5 border-b border-[#e7dcc9]">
                ✓ STEP 1 結果
              </h3>

              <PfcRow
                badge="P"
                badgeColor="#004d40"
                name="たんぱく質"
                grams={result.protein_g}
                kcal={result.protein_kcal}
                pct={result.protein_pct}
              />
              <PfcRow
                badge="F"
                badgeColor="#e65100"
                name="脂質"
                grams={result.fat_g}
                kcal={result.fat_kcal}
                pct={result.fat_pct}
              />
              <PfcRow
                badge="C"
                badgeColor="#b45309"
                name="糖質"
                grams={result.carb_g}
                kcal={result.carb_kcal}
                pct={result.carb_pct}
              />

              {/* 合計カロリー */}
              <div className="flex items-center justify-between bg-[#e8eaf6] border border-[#3949ab]/20 rounded-lg px-3.5 py-2.5 mt-2">
                <div className="text-xs font-bold text-zinc-700">
                  合計カロリー
                </div>
                <div className="text-base font-mono font-bold text-[#1a237e]">
                  {(
                    result.protein_kcal +
                    result.fat_kcal +
                    result.carb_kcal
                  ).toLocaleString()}{" "}
                  kcal
                </div>
              </div>
            </section>

            {/* ブリッジ */}
            <div className="flex flex-col items-center gap-1 my-3 text-[#3949ab] text-[11px] font-bold">
              <span className="text-base opacity-70">↓</span>
              <span>糖質 {result.carb_g}g を 1 週間に配分</span>
              <span className="text-base opacity-70">↓</span>
            </div>

            {/* STEP 2 結果テーブル */}
            <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border border-[rgba(255,235,59,0.4)] rounded-xl mx-4 mb-3 px-5 py-4">
              <h3 className="text-xs font-bold text-[#283593] tracking-wide mb-3 pb-2.5 border-b border-[#e7dcc9]">
                ✓ STEP 2 結果 (1 週間の糖質配分)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center font-mono text-[11px] table-fixed bg-[#fffdf8] border border-[#e7dcc9] rounded-lg overflow-hidden">
                  <thead>
                    <tr>
                      <th className="px-1.5 py-2 bg-[#f8f9fa] text-zinc-700 font-bold text-[10px] border border-[#f0f2f1]" />
                      {WEEK_DAYS.map((d) => (
                        <th
                          key={d}
                          className="px-1.5 py-2 bg-[#f8f9fa] text-zinc-700 font-bold border border-[#f0f2f1]"
                        >
                          {DAY_LABELS[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1.5 py-2 text-[10px] text-zinc-700 font-bold bg-[#f8f9fa] border border-[#f0f2f1]">
                        強度
                      </td>
                      {WEEK_DAYS.map((d) => {
                        const lv = intensities[d];
                        return (
                          <td
                            key={d}
                            className={`px-1.5 py-2 font-bold border border-[#f0f2f1] ${intensityCellCls(lv)}`}
                          >
                            {lv === "high" ? "高" : lv === "mid" ? "中" : "低"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="px-1.5 py-2 text-[10px] text-zinc-700 font-bold bg-[#f8f9fa] border border-[#f0f2f1]">
                        糖質
                      </td>
                      {WEEK_DAYS.map((d) => {
                        const lv = intensities[d];
                        return (
                          <td
                            key={d}
                            className={`px-1.5 py-2 font-bold border border-[#f0f2f1] ${intensityCellCls(lv)}`}
                          >
                            {result.daily_carbs[d]}g
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 週合計 / 平均 */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-[#e8eaf6] border border-[#3949ab]/20 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-[10px] text-zinc-700 mb-0.5">週合計</div>
                  <div className="font-mono font-bold text-[15px] text-[#1a237e]">
                    {result.weekly_carb_total.toLocaleString()} g
                  </div>
                </div>
                <div className="bg-[#e8eaf6] border border-[#3949ab]/20 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-[10px] text-zinc-700 mb-0.5">平均</div>
                  <div className="font-mono font-bold text-[15px] text-[#1a237e]">
                    {result.daily_carb_avg} g/日
                  </div>
                </div>
              </div>

              {/* 警告 */}
              {result.warnings.map((msg, i) => (
                <div
                  key={i}
                  className="mt-2.5 px-3 py-2.5 bg-[rgba(230,81,0,0.08)] border-l-[3px] border-[#e65100] rounded text-[11px] text-[#7a3700] leading-relaxed"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5 inline-block align-middle mr-1.5 text-[#e65100]"
                  >
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {msg}
                </div>
              ))}
            </section>

            {/* 計算式 */}
            <div className="mx-4 mb-3 px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-700 leading-relaxed font-mono">
              <div className="font-sans text-zinc-800 font-bold text-[11px] mb-1">
                計算式
              </div>
              P (g) = 体重 × 2 ・ F (g) = カロリー × 脂質比率 / 9
              <br />
              C (g) = (カロリー − P kcal − F kcal) / 4
              <br />
              カーボサイクル: 高=1.85倍 / 中=1.0倍 / 低=0.5倍 → 週合計を正規化
            </div>

            {/* 目標シートに適用ボタン (?return=goal-sheet 時のみ) */}
            {isFromGoalSheet && (
              <div className="mx-4 mb-3">
                <button
                  onClick={() => {
                    // CarbCycleDay = "low" | "mid" | "high" (Training Intensity と同型)
                    const weekly = WEEK_DAYS.map(
                      (d) => intensities[d]
                    ) as Array<"low" | "mid" | "high">;
                    sessionStorage.setItem(
                      "goal-sheet-reflect-pfc-carb",
                      JSON.stringify({
                        target_calorie: parseFloat(calorie),
                        pfc: {
                          p: result.protein_g,
                          f: result.fat_g,
                          c: result.carb_g,
                        },
                        carb_cycle: { weekly_pattern: weekly },
                      })
                    );
                    router.push("/goal-sheet/edit");
                  }}
                  className="w-full py-3.5 bg-[#4a875b] text-white rounded text-sm font-bold hover:bg-[#34603f] transition-colors"
                >
                  目標シートに適用 →
                </button>
                <p className="text-[11px] text-zinc-600 text-center mt-2">
                  カロリー / PFC / カーボサイクルを反映して目標シート編集画面に戻ります
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

function StepLabel({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mx-4 mt-4 mb-3">
      <div className="w-6 h-6 rounded-full bg-[#3949ab] text-white font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
        {num}
      </div>
      <div className="text-sm font-bold text-[#1a237e]">{title}</div>
      <div className="flex-1 h-px bg-gradient-to-r from-[#e8eaf6] to-transparent" />
    </div>
  );
}

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

function PfcRow({
  badge,
  badgeColor,
  name,
  grams,
  kcal,
  pct,
}: {
  badge: string;
  badgeColor: string;
  name: string;
  grams: number;
  kcal: number;
  pct: number;
}) {
  return (
    <div className="flex items-center justify-between bg-[#fffdf8]/70 rounded-lg px-3 py-2.5 mb-2 last:mb-0">
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white font-mono font-bold text-[13px]"
          style={{ backgroundColor: badgeColor }}
        >
          {badge}
        </div>
        <div>
          <div className="text-[11px] text-[#6a6256]">{name}</div>
          <div className="text-base font-mono font-bold text-[#2b2620]">
            {grams} g
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[#6a6256] font-mono">
          {kcal.toLocaleString()} kcal
        </div>
        <div className="text-sm font-mono font-bold text-[#283593]">
          {pct.toFixed(0)} %
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 補助
// =====================================================================

function intensityCellCls(lv: TrainingIntensity | ""): string {
  if (lv === "high") return "bg-[rgba(230,81,0,0.1)] text-[#e65100]";
  if (lv === "mid") return "bg-[rgba(180,83,9,0.1)] text-[#b45309]";
  if (lv === "low") return "bg-[rgba(136,136,136,0.1)] text-[#6a6256]";
  return "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
