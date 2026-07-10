"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBodyMetric } from "@/lib/body-metrics/actions";
import { NumberWheel } from "./Wheel";

/**
 * 記録入力シート本体 (2026-07-06 確定: 縦・両ホイール常時 + 丸い±0.1 / 案1・B)
 *
 *   - 体重・ウエストを ドラムロール(ホイール)+左右の丸±(0.1刻み) で入力。キーボード不要。
 *   - 前回の記録値からスタート (そこから少し回す/±で詰めるだけ)。
 *   - 体脂肪率・日付は「詳しく入力」に折りたたみ。
 *   - 保存成功 → onSaved() でシートを閉じ router.refresh()。
 */

const WEIGHT_MIN = 30;
const WEIGHT_MAX = 150;
const WAIST_MIN = 40;
const WAIST_MAX = 150;

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function parseNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clampInit(v: number | null | undefined, min: number, max: number, fb: number): number {
  const n = v != null && Number.isFinite(v) ? v : fb;
  return Math.max(min, Math.min(max, n));
}

export function RecordSheetBody({
  initialWeight,
  initialBodyFat,
  initialWaist,
  onSaved,
  isBeta = false,
}: {
  initialWeight?: number | null;
  initialBodyFat?: number | null;
  initialWaist?: number | null;
  onSaved: () => void;
  /** 体13(ベータ): 記録ゼロの初回は「—」開始。全体公開時に既定挙動化。 */
  isBeta?: boolean;
}) {
  const router = useRouter();

  const [weight, setWeight] = useState(
    clampInit(initialWeight, WEIGHT_MIN, WEIGHT_MAX, 60)
  );
  const [waist, setWaist] = useState(
    clampInit(initialWaist, WAIST_MIN, WAIST_MAX, 70)
  );
  const [bodyFat, setBodyFat] = useState<string>(
    initialBodyFat != null ? String(initialBodyFat) : ""
  );
  const [recordedAt, setRecordedAt] = useState(todayString());
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 体13(ベータのみ): 記録ゼロの初回は「—」開始、回して初めて値が立つ(固定60/70の誤保存を防ぐ)。
  //   各フィールドごとに前回値があれば最初から touched。非ベータは従来どおり常に touched(値表示)。
  const [weightTouched, setWeightTouched] = useState(
    isBeta ? initialWeight != null : true
  );
  const [waistTouched, setWaistTouched] = useState(
    isBeta ? initialWaist != null : true
  );

  const hasPrev = initialWeight != null || initialWaist != null;

  function handleSubmit() {
    setError(null);
    const weightVal = weightTouched ? Math.round(weight * 10) / 10 : null;
    const waistVal = waistTouched ? Math.round(waist * 10) / 10 : null;
    const bodyFatVal = parseNum(bodyFat);
    if (weightVal == null && waistVal == null && bodyFatVal == null) {
      setError("体重・ウエスト・体脂肪率のいずれかを入力してください");
      return;
    }
    startTransition(async () => {
      const result = await upsertBodyMetric({
        recorded_at: recordedAt,
        weight_kg: weightVal,
        body_fat_percent: bodyFatVal,
        waist_cm: waistVal,
        note: null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved();
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-3 text-center text-[10px] text-[#a59b8c]">
        {hasPrev
          ? "前回の値からスタート。回す or ± で合わせてください"
          : isBeta
            ? "回す or ± で値を合わせてください（回すまで「—」）"
            : "回す or ± で値を合わせてください"}
      </p>

      {/* 体重 */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[11px] font-bold text-[#6a6256]">体重</span>
          <span className="font-mono text-[16px] font-extrabold text-[#004d40]">
            {weightTouched ? weight.toFixed(1) : "—"}
            <span className="ml-0.5 text-[11px] text-[#6a6256]">kg</span>
          </span>
        </div>
        <NumberWheel
          initial={initialWeight ?? 60}
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          unit="kg"
          onChange={(v) => {
            setWeight(v);
            setWeightTouched(true);
          }}
        />
      </div>

      {/* ウエスト */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[11px] font-bold text-[#6a6256]">ウエスト</span>
          <span className="font-mono text-[16px] font-extrabold text-[#004d40]">
            {waistTouched ? waist.toFixed(1) : "—"}
            <span className="ml-0.5 text-[11px] text-[#6a6256]">cm</span>
          </span>
        </div>
        <NumberWheel
          initial={initialWaist ?? 70}
          min={WAIST_MIN}
          max={WAIST_MAX}
          unit="cm"
          onChange={(v) => {
            setWaist(v);
            setWaistTouched(true);
          }}
        />
      </div>

      {/* 詳しく入力 (体脂肪率 / 記録日) */}
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-1 flex w-full items-center justify-center gap-1 text-[12px] font-bold text-[#4a875b]"
      >
        {showDetails ? "詳しい入力を閉じる" : "＋ 詳しく入力（体脂肪率・日付）"}
      </button>

      {showDetails ? (
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3.5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
              体脂肪率 (%)
            </label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder="22.4"
              className="w-full rounded-lg border border-[#e7dcc9] px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
              記録日
            </label>
            <input
              type="date"
              value={recordedAt}
              max={todayString()}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full appearance-none rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-left text-[13px] text-[#2b2620] [color-scheme:light] focus:border-[#4a875b] focus:outline-none"
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-[#a59b8c]">
        同じ日に複数回記録すると、最後の値で上書きされます。リアルタイムで共有されます。
      </p>

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          ⚠ {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="mt-3.5 w-full rounded-2xl bg-[#4a875b] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#34603f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "保存中..." : "記録する"}
      </button>
    </div>
  );
}
