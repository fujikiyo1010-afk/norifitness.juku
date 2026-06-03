"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ACTIVITY_LABELS,
  calculateCalorie,
} from "@/lib/tools/calculations";
import { saveToolCalculation } from "@/lib/tools/actions";
import type {
  ActivityLevel,
  CalorieInputs,
  CalorieOutputs,
  Gender,
  ToolCalculation,
} from "@/lib/tools/types";

const ACTIVITY_ORDER: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

/**
 * 必要カロリー計算ツール Client UI (/tools/calorie 単独モード)
 *
 * 仕様:
 *   - 性別 3 択 (男性/女性/その他)、その他は男性式/女性式を選択 (BMR 計算式が男女で違う)
 *   - 入力: 身長 + 体重 + 年齢 + 運動量レベル (5 段階)
 *   - 運動量レベルは説明文のみ表示、係数 (1.2 等) は非表示 (P3)
 *   - 結果: 4 セル (基礎代謝 / メンテナンス / ダイエット時 / 増量時)
 *   - 前回値プリセット: 薄色 → 編集で通常色
 *   - 保存ボタン: tool_calculations に UPSERT
 *   - 反映ボタンなし (目標シート連携は Step 10f の別 Client で対応)
 */
export function CalorieToolClient({
  previous,
}: {
  previous: ToolCalculation<CalorieInputs, CalorieOutputs> | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFromGoalSheet = searchParams.get("return") === "goal-sheet";

  const prevInputs = previous?.inputs;
  const prevOutputs = previous?.outputs;

  // 入力 state (前回値を初期値に)
  const [gender, setGender] = useState<Gender | "">(prevInputs?.gender ?? "");
  const [formula, setFormula] = useState<"male" | "female" | "">(
    prevInputs?.formula ?? ""
  );
  const [height, setHeight] = useState(prevInputs?.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(prevInputs?.weight_kg?.toString() ?? "");
  const [age, setAge] = useState(prevInputs?.age?.toString() ?? "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">(
    prevInputs?.activity_level ?? ""
  );

  // 「触ったかどうか」フラグ (前回値のままなら薄色、触ったら通常色)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) =>
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // 結果 + エラー
  const [result, setResult] = useState<CalorieOutputs | null>(
    prevOutputs ?? null
  );
  const [error, setError] = useState<string | null>(null);
  // 未入力で計算ボタンを押した時に赤枠表示するフィールド
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

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

    if (!gender) {
      setError("性別を選んでください");
      setMissingFields(new Set());
      return;
    }
    if (gender === "other" && !formula) {
      setError("男性式 または 女性式 を選んでください");
      setMissingFields(new Set());
      return;
    }

    const missing = new Set<string>();
    if (!height) missing.add("height");
    if (!weight) missing.add("weight");
    if (!age) missing.add("age");
    if (!activityLevel) missing.add("activity");

    if (missing.size > 0) {
      setMissingFields(missing);
      setError("未入力の項目があります");
      return;
    }
    setMissingFields(new Set());

    const inputs: CalorieInputs = {
      gender: gender as Gender,
      formula: gender === "other" ? (formula as "male" | "female") : undefined,
      height_cm: parseFloat(height),
      weight_kg: parseFloat(weight),
      age: parseFloat(age),
      activity_level: activityLevel as ActivityLevel,
    };

    try {
      const output = calculateCalorie(inputs);
      setResult(output);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setResult(null);
    }
  };

  // 保存
  const handleSave = () => {
    if (!result || !gender || !activityLevel) return;
    setSaving(true);
    setError(null);

    const inputs: CalorieInputs = {
      gender: gender as Gender,
      formula: gender === "other" ? (formula as "male" | "female") : undefined,
      height_cm: parseFloat(height),
      weight_kg: parseFloat(weight),
      age: parseFloat(age),
      activity_level: activityLevel as ActivityLevel,
    };

    startTransition(async () => {
      const res = await saveToolCalculation("calorie", inputs, result);
      setSaving(false);
      if (res.success) {
        setSavedJustNow(true);
        setTimeout(() => setSavedJustNow(false), 3000);
      } else {
        setError(res.error ?? "保存に失敗しました");
      }
    });
  };

  // input の className (前回値で薄色、触ったら通常色)
  const inputClass = (key: string) =>
    `flex-1 border-none outline-none py-2.5 text-base bg-transparent font-mono ${
      touched[key] || !prevInputs ? "text-zinc-900" : "text-zinc-400"
    }`;

  // select の className (前回値で薄色、触ったら通常色)
  const isActivityTouched = touched["activity"] || !prevInputs;
  const useFemaleFormula =
    gender === "female" || (gender === "other" && formula === "female");

  return (
    <main className="min-h-screen bg-[#fafbfa] flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[#e8ebe9] px-4 py-3.5 flex items-center sticky top-0 z-10">
        <Link
          href={isFromGoalSheet ? "/goal-sheet/edit" : "/tools"}
          className="w-8 h-8 flex items-center justify-center text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors"
          aria-label={isFromGoalSheet ? "目標シート編集に戻る" : "ツール一覧に戻る"}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 pointer-events-none"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-zinc-900 -ml-8 pointer-events-none">
          必要カロリー計算
        </h1>
      </header>

      <div className="flex-1 max-w-md mx-auto w-full pb-10">
        {/* ヒーロー帯 */}
        <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border-b border-[#e8ebe9] px-6 py-5">
          <h2 className="text-xl font-bold text-[#1a237e] mb-1">
            必要カロリー計算
          </h2>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            ハリスベネディクト式 (改訂版) ・ 基礎代謝 + 4 パターン算出
          </p>
          {previous && (
            <p className="text-[10px] text-[#283593] mt-2 font-mono">
              ✓ 前回 {formatDate(previous.calculatedAt)} 計算 (前回値で復元中)
            </p>
          )}
        </section>

        {/* 入力カード */}
        <section className="bg-white border border-[#e8ebe9] rounded-xl mx-4 my-4 px-5 py-4">
          <h3 className="text-xs font-bold text-zinc-600 tracking-wide mb-3.5 pb-2.5 border-b border-[#e8ebe9]">
            あなたの情報
          </h3>

          {/* 性別 3 択 */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
              性別
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["male", "female", "other"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    markTouched("gender");
                    if (g !== "other") setFormula("");
                  }}
                  className={`py-3 px-1 rounded text-[13px] font-bold border transition-colors ${
                    gender === g
                      ? "bg-[#3949ab] border-[#3949ab] text-white"
                      : "bg-white border-[#e8ebe9] text-zinc-600 hover:border-[#3949ab]"
                  }`}
                >
                  {g === "male" ? "男性" : g === "female" ? "女性" : "その他"}
                </button>
              ))}
            </div>
          </div>

          {/* その他選択時の formula 選択 */}
          {gender === "other" && (
            <div className="mb-3.5 bg-[#e8eaf6] border-l-[3px] border-[#3949ab] rounded px-3.5 py-3">
              <p className="text-[11px] text-zinc-600 leading-relaxed mb-2.5">
                ※ 基礎代謝の計算式は身体構造に基づくため、
                <br />
                男性式 / 女性式 のどちらかをお選びください。
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setFormula(f);
                      markTouched("formula");
                    }}
                    className={`py-2.5 rounded text-xs font-bold border transition-colors ${
                      formula === f
                        ? "bg-[#3949ab] border-[#3949ab] text-white"
                        : "bg-white border-[#e8ebe9] text-zinc-600 hover:border-[#3949ab]"
                    }`}
                  >
                    {f === "male" ? "男性式で計算" : "女性式で計算"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <InputRow
            label="身長"
            value={height}
            unit="cm"
            inputClass={inputClass("height")}
            onChange={(v) => {
              setHeight(v);
              markTouched("height");
              clearMissing("height");
            }}
            hasError={missingFields.has("height")}
          />
          <InputRow
            label="体重"
            value={weight}
            unit="kg"
            inputClass={inputClass("weight")}
            onChange={(v) => {
              setWeight(v);
              markTouched("weight");
              clearMissing("weight");
            }}
            hasError={missingFields.has("weight")}
          />
          <InputRow
            label="年齢"
            value={age}
            unit="歳"
            inputClass={inputClass("age")}
            onChange={(v) => {
              setAge(v);
              markTouched("age");
              clearMissing("age");
            }}
            hasError={missingFields.has("age")}
          />

          {/* 運動量レベル */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
              運動量レベル
            </label>
            <div
              className={`border rounded-lg px-3 transition-colors ${
                missingFields.has("activity")
                  ? "border-[#d32f2f] bg-[#fef5f5] focus-within:border-[#d32f2f]"
                  : "border-[#e8ebe9] bg-white focus-within:border-[#3949ab]"
              }`}
            >
              <select
                value={activityLevel}
                onChange={(e) => {
                  setActivityLevel(e.target.value as ActivityLevel);
                  markTouched("activity");
                  clearMissing("activity");
                }}
                className={`w-full border-none outline-none py-2.5 text-[13px] bg-transparent appearance-none cursor-pointer ${
                  !activityLevel
                    ? "text-zinc-400"
                    : isActivityTouched
                      ? "text-zinc-900"
                      : "text-zinc-400"
                }`}
              >
                <option value="" disabled>
                  選択してください
                </option>
                {ACTIVITY_ORDER.map((lv) => (
                  <option key={lv} value={lv}>
                    {ACTIVITY_LABELS[lv]}
                  </option>
                ))}
              </select>
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
            例: 75kg・男性35歳 → 2,483 kcal/日
          </p>
        )}

        {/* 結果カード */}
        {result && (
          <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border border-[rgba(255,235,59,0.4)] rounded-xl mx-4 mb-3 px-5 py-4">
            <h3 className="text-xs font-bold text-[#283593] tracking-wide mb-3 pb-2.5 border-b border-[#e8ebe9]">
              ✓ 計算結果
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <ResultCell label="基礎代謝" value={result.bmr} />
              <ResultCell label="メンテナンス" value={result.maintenance} />
              <ResultCell
                label={
                  <>
                    ダイエット時
                    <br />
                    <span className="text-[9px] text-zinc-500">
                      (−500 kcal)
                    </span>
                  </>
                }
                value={result.diet}
                highlight
              />
              <ResultCell
                label={
                  <>
                    増量時
                    <br />
                    <span className="text-[9px] text-zinc-500">
                      (+500 kcal)
                    </span>
                  </>
                }
                value={result.bulk}
              />
            </div>
          </section>
        )}

        {/* 計算式 */}
        {result && (
          <div className="mx-4 mb-3 px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-700 leading-relaxed font-mono">
            <div className="font-sans text-zinc-800 font-bold text-[11px] mb-1">
              計算式 (ハリスベネディクト式 改訂版・
              {useFemaleFormula ? "女性" : "男性"})
            </div>
            {useFemaleFormula
              ? "BMR = 447.593 + (9.247 × W) + (3.098 × H) − (4.330 × A)"
              : "BMR = 88.362 + (13.397 × W) + (4.799 × H) − (5.677 × A)"}
            <div className="text-zinc-600 mt-0.5">
              W = 体重 ・ H = 身長 ・ A = 年齢
              <br />
              メンテ = BMR × 運動量係数 ・ ダイエット時 = メンテ − 500 ・
              増量時 = メンテ + 500
            </div>
          </div>
        )}

        {/* 目標シートに適用ボタン (?return=goal-sheet 時のみ) */}
        {result && isFromGoalSheet && (
          <div className="mx-4 mb-3">
            <button
              onClick={() => {
                sessionStorage.setItem(
                  "goal-sheet-reflect-calorie",
                  JSON.stringify({ maintenance_kcal: result.maintenance })
                );
                router.push("/goal-sheet/edit");
              }}
              className="w-full py-3.5 bg-[#00897b] text-white rounded text-sm font-bold hover:bg-[#00695c] transition-colors"
            >
              目標シートに適用 →
            </button>
            <p className="text-[11px] text-zinc-600 text-center mt-2">
              メンテナンスカロリー {result.maintenance} kcal を反映して目標シート編集画面に戻ります
            </p>
          </div>
        )}

        {/* 保存ボタン (単独モードのみ) */}
        {result && !isFromGoalSheet && (
          <div className="mx-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 bg-white border border-[#3949ab] text-[#3949ab] rounded text-sm font-bold hover:bg-[#3949ab]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  inputClass,
  onChange,
  last = false,
  hasError = false,
}: {
  label: React.ReactNode;
  value: string;
  unit: string;
  inputClass: string;
  onChange: (v: string) => void;
  last?: boolean;
  hasError?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-3.5"}>
      <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 border rounded-lg px-3 transition-colors ${
          hasError
            ? "border-[#d32f2f] bg-[#fef5f5] focus-within:border-[#d32f2f]"
            : "border-[#e8ebe9] bg-white focus-within:border-[#3949ab]"
        }`}
      >
        <input
          type="number"
          inputMode="decimal"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <span
          className={`text-xs flex-shrink-0 ${
            hasError ? "text-[#d32f2f]" : "text-zinc-500"
          }`}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function ResultCell({
  label,
  value,
  highlight = false,
}: {
  label: React.ReactNode;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-3 text-center border ${
        highlight
          ? "bg-[#3949ab]/8 border-[#3949ab]/25"
          : "bg-white/60 border-white/90"
      }`}
    >
      <div className="text-[10px] text-zinc-600 leading-tight mb-1 min-h-[2.4em]">
        {label}
      </div>
      <div
        className={`font-mono font-bold text-[22px] leading-none ${
          highlight ? "text-[#1a237e]" : "text-zinc-900"
        }`}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-zinc-500 mt-1">kcal / 日</div>
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
