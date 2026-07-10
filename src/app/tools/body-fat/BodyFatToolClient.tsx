"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { calculateBodyFat } from "@/lib/tools/calculations";
import { saveToolCalculation } from "@/lib/tools/actions";
import type {
  BodyFatInputs,
  BodyFatOutputs,
  Gender,
  ToolCalculation,
} from "@/lib/tools/types";

/**
 * 体脂肪率計算ツール Client UI (/tools/body-fat 単独モード)
 *
 * 仕様:
 *   - 性別 3 択 (男性/女性/その他)、その他は男性式/女性式を選択
 *   - 動的フィールド: 女性式の時のみヒップ表示
 *   - 前回値プリセット: 薄色表示、編集すると通常色
 *   - 保存ボタン: tool_calculations に UPSERT
 *   - 反映ボタンなし (目標シート連携は Step 10f の別 Client で対応)
 */
export function BodyFatToolClient({
  previous,
}: {
  previous: ToolCalculation<BodyFatInputs, BodyFatOutputs> | null;
}) {
  const prevInputs = previous?.inputs;
  const prevOutputs = previous?.outputs;

  // 入力 state (前回値を初期値に)
  const [gender, setGender] = useState<Gender | "">(prevInputs?.gender ?? "");
  const [formula, setFormula] = useState<"male" | "female" | "">(
    prevInputs?.formula ?? ""
  );
  const [height, setHeight] = useState(prevInputs?.height_cm?.toString() ?? "");
  const [waist, setWaist] = useState(prevInputs?.waist_cm?.toString() ?? "");
  const [neck, setNeck] = useState(prevInputs?.neck_cm?.toString() ?? "");
  const [hip, setHip] = useState(prevInputs?.hip_cm?.toString() ?? "");
  const [weight, setWeight] = useState(prevInputs?.weight_kg?.toString() ?? "");

  // 「触ったかどうか」フラグ (前回値のままなら薄色、触ったら通常色)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (key: string) =>
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // 結果 + エラー
  const [result, setResult] = useState<BodyFatOutputs | null>(prevOutputs ?? null);
  const [error, setError] = useState<string | null>(null);
  // 未入力で計算ボタンを押した時に赤枠表示するフィールド
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  // 入力 onChange で該当フィールドの missing をクリア
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

  // 女性式かどうか (動的にヒップ欄表示判定)
  const useFemaleFormula =
    gender === "female" || (gender === "other" && formula === "female");

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

    // 未入力フィールドを赤枠でハイライト
    const missing = new Set<string>();
    if (!height) missing.add("height");
    if (!waist) missing.add("waist");
    if (!neck) missing.add("neck");
    if (useFemaleFormula && !hip) missing.add("hip");

    if (missing.size > 0) {
      setMissingFields(missing);
      setError(
        useFemaleFormula && missing.has("hip")
          ? "未入力の項目があります (女性式はヒップも必須)"
          : "未入力の項目があります"
      );
      return;
    }
    setMissingFields(new Set());

    const inputs: BodyFatInputs = {
      gender: gender as Gender,
      formula: gender === "other" ? (formula as "male" | "female") : undefined,
      height_cm: parseFloat(height),
      waist_cm: parseFloat(waist),
      neck_cm: parseFloat(neck),
      hip_cm: hip ? parseFloat(hip) : undefined,
      weight_kg: weight ? parseFloat(weight) : undefined,
    };

    try {
      const output = calculateBodyFat(inputs);
      setResult(output);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setResult(null);
    }
  };

  // 保存 (Server Action)
  const handleSave = () => {
    if (!result || !gender) return;
    setSaving(true);
    setError(null);

    const inputs: BodyFatInputs = {
      gender: gender as Gender,
      formula: gender === "other" ? (formula as "male" | "female") : undefined,
      height_cm: parseFloat(height),
      waist_cm: parseFloat(waist),
      neck_cm: parseFloat(neck),
      hip_cm: hip ? parseFloat(hip) : undefined,
      weight_kg: weight ? parseFloat(weight) : undefined,
    };

    startTransition(async () => {
      const res = await saveToolCalculation("body_fat", inputs, result);
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
      touched[key] || !prevInputs ? "text-[#2b2620]" : "text-[#a59b8c]"
    }`;

  return (
    <main className="min-h-screen bg-[#f9f5ed] flex flex-col">
      <div className="flex-1 max-w-[460px] mx-auto w-full pb-10">
        {/* ヒーロー帯 */}
        <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border-b border-[#e7dcc9] px-6 py-5">
          <h2 className="text-xl font-bold text-[#1a237e] mb-1">体脂肪率計算</h2>
          <p className="text-[11px] text-[#6a6256] leading-relaxed">
            アメリカ海軍式 ・ ウエストと首回りから計算します
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
                      : "bg-[#fffdf8] border-[#e7dcc9] text-zinc-600 hover:border-[#3949ab]"
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
                ※ 体脂肪率の計算式は身体構造に基づくため、
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
                        : "bg-[#fffdf8] border-[#e7dcc9] text-zinc-600 hover:border-[#3949ab]"
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
            step="1"
            mode="numeric"
            inputClass={inputClass("height")}
            onChange={(v) => {
              setHeight(v);
              markTouched("height");
              clearMissing("height");
            }}
            hasError={missingFields.has("height")}
          />
          <InputRow
            label="ウエスト"
            value={waist}
            unit="cm"
            inputClass={inputClass("waist")}
            onChange={(v) => {
              setWaist(v);
              markTouched("waist");
              clearMissing("waist");
            }}
            hasError={missingFields.has("waist")}
          />
          <InputRow
            label="首回り"
            value={neck}
            unit="cm"
            inputClass={inputClass("neck")}
            onChange={(v) => {
              setNeck(v);
              markTouched("neck");
              clearMissing("neck");
            }}
            hasError={missingFields.has("neck")}
          />

          {useFemaleFormula && (
            <InputRow
              label={
                <>
                  ヒップ{" "}
                  <span className="text-[#3949ab] text-[10px]">
                    (女性式のみ)
                  </span>
                </>
              }
              value={hip}
              unit="cm"
              inputClass={inputClass("hip")}
              onChange={(v) => {
                setHip(v);
                markTouched("hip");
                clearMissing("hip");
              }}
              hasError={missingFields.has("hip")}
            />
          )}

          <InputRow
            label={
              <>
                体重{" "}
                <span className="text-[#6a6256] text-[10px]">
                  (任意・体脂肪量/除脂肪量も出ます)
                </span>
              </>
            }
            value={weight}
            unit="kg"
            inputClass={inputClass("weight")}
            onChange={(v) => {
              setWeight(v);
              markTouched("weight");
            }}
            last
          />
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
            例: 75kg・W85cm → BF 18.2%
          </p>
        )}

        {/* 結果カード */}
        {result && (
          <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border border-[rgba(255,235,59,0.4)] rounded-xl mx-4 mb-3 px-5 py-4">
            <h3 className="text-xs font-bold text-[#283593] tracking-wide mb-3 pb-2.5 border-b border-[#e7dcc9]">
              ✓ 計算結果
            </h3>
            <div className="text-center py-2">
              <div className="text-[11px] text-zinc-600 mb-1">あなたの体脂肪率</div>
              <div className="font-mono font-bold text-[42px] text-[#1a237e] leading-tight">
                {result.body_fat_pct.toFixed(1)}
                <span className="text-lg text-zinc-600 ml-1">%</span>
              </div>
            </div>
            {result.body_fat_kg !== undefined && result.lean_mass_kg !== undefined && (
              <div className="grid grid-cols-2 gap-2 mt-3.5">
                <div className="bg-[#fffdf8]/60 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-[10px] text-[#6a6256] mb-0.5">体脂肪量</div>
                  <div className="font-mono font-bold text-[17px] text-[#2b2620]">
                    {result.body_fat_kg.toFixed(1)}
                    <span className="text-[11px] text-[#6a6256] ml-0.5">kg</span>
                  </div>
                </div>
                <div className="bg-[#fffdf8]/60 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-[10px] text-[#6a6256] mb-0.5">除脂肪量</div>
                  <div className="font-mono font-bold text-[17px] text-[#2b2620]">
                    {result.lean_mass_kg.toFixed(1)}
                    <span className="text-[11px] text-[#6a6256] ml-0.5">kg</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 計算式 */}
        {result && (
          <div className="mx-4 mb-3 px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-700 leading-relaxed font-mono">
            <div className="font-sans text-zinc-800 font-bold text-[11px] mb-1">
              計算式 (アメリカ海軍式・{useFemaleFormula ? "女性" : "男性"})
            </div>
            {useFemaleFormula
              ? "BF% = 495 / (1.29579 − 0.35004 × log10(W+Hip−N) + 0.22100 × log10(H)) − 450"
              : "BF% = 495 / (1.0324 − 0.19077 × log10(W−N) + 0.15456 × log10(H)) − 450"}
            <div className="text-zinc-600 mt-0.5">
              W = ウエスト ・ N = 首回り ・ H = 身長
              {useFemaleFormula && " ・ Hip = ヒップ"}
            </div>
          </div>
        )}

        {/* 保存ボタン */}
        {result && (
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
              <br />
              (目標シートには反映されません ・ 反映は目標シート編集画面から)
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
  step = "0.1",
  mode = "decimal",
}: {
  label: React.ReactNode;
  value: string;
  unit: string;
  inputClass: string;
  onChange: (v: string) => void;
  last?: boolean;
  hasError?: boolean;
  step?: string;
  mode?: "decimal" | "numeric";
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
            : "border-[#e7dcc9] bg-[#fffdf8] focus-within:border-[#3949ab]"
        }`}
      >
        <input
          type="number"
          inputMode={mode}
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

// =====================================================================
// 補助
// =====================================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
