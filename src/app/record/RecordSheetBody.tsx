"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBodyMetric } from "@/lib/body-metrics/actions";
import { NumberWheel, intRange } from "./Wheel";

/**
 * 記録入力シート本体 (2026-07-06 確定: 縦・両ホイール常時 / 案1)
 *
 *   - 体重・ウエストを ドラムロール(ホイール)で入力。キーボード不要。
 *   - 前回の記録値からスタート (そこから少し回すだけ)。
 *   - 体脂肪率・日付は「詳しく入力」に折りたたみ。
 *   - 保存成功 → onSaved() でシートを閉じ router.refresh()。
 */

const WEIGHT_INT = intRange(30, 150); // kg 整数部
const WAIST_INT = intRange(40, 150); // cm 整数部

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

/** 数値を 整数配列内の index と 小数index(0-9) に分解 */
function toIndices(
  value: number | null | undefined,
  intValues: number[],
  fallback: number
): { intIdx: number; decIdx: number } {
  const v = value != null && Number.isFinite(value) ? value : fallback;
  const min = intValues[0];
  const max = intValues[intValues.length - 1];
  const intPart = Math.max(min, Math.min(max, Math.floor(v)));
  const decPart = Math.max(0, Math.min(9, Math.round((v - Math.floor(v)) * 10)));
  return { intIdx: intPart - min, decIdx: decPart };
}

export function RecordSheetBody({
  initialWeight,
  initialBodyFat,
  initialWaist,
  onSaved,
}: {
  initialWeight?: number | null;
  initialBodyFat?: number | null;
  initialWaist?: number | null;
  onSaved: () => void;
}) {
  const router = useRouter();

  const w0 = toIndices(initialWeight, WEIGHT_INT, 60);
  const wa0 = toIndices(initialWaist, WAIST_INT, 70);
  const [wInt, setWInt] = useState(w0.intIdx);
  const [wDec, setWDec] = useState(w0.decIdx);
  const [waInt, setWaInt] = useState(wa0.intIdx);
  const [waDec, setWaDec] = useState(wa0.decIdx);

  const [bodyFat, setBodyFat] = useState<string>(
    initialBodyFat != null ? String(initialBodyFat) : ""
  );
  const [recordedAt, setRecordedAt] = useState(todayString());
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const weight = WEIGHT_INT[wInt] + wDec / 10;
  const waist = WAIST_INT[waInt] + waDec / 10;

  const hasPrev = initialWeight != null || initialWaist != null;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertBodyMetric({
        recorded_at: recordedAt,
        weight_kg: weight,
        body_fat_percent: parseNum(bodyFat),
        waist_cm: waist,
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
      {hasPrev ? (
        <p className="mb-3 text-center text-[10px] text-[#a59b8c]">
          前回の値からスタート。少し回して合わせてください
        </p>
      ) : null}

      {/* 体重 */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[11px] font-bold text-[#6a6256]">体重</span>
          <span className="font-mono text-[16px] font-extrabold text-[#004d40]">
            {weight.toFixed(1)}
            <span className="ml-0.5 text-[11px] text-[#6a6256]">kg</span>
          </span>
        </div>
        <NumberWheel
          intValues={WEIGHT_INT}
          intIndex={wInt}
          setIntIndex={setWInt}
          decIndex={wDec}
          setDecIndex={setWDec}
          unit="kg"
        />
      </div>

      {/* ウエスト */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-baseline justify-between px-0.5">
          <span className="text-[11px] font-bold text-[#6a6256]">ウエスト</span>
          <span className="font-mono text-[16px] font-extrabold text-[#004d40]">
            {waist.toFixed(1)}
            <span className="ml-0.5 text-[11px] text-[#6a6256]">cm</span>
          </span>
        </div>
        <NumberWheel
          intValues={WAIST_INT}
          intIndex={waInt}
          setIntIndex={setWaInt}
          decIndex={waDec}
          setDecIndex={setWaDec}
          unit="cm"
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
              className="w-full rounded-lg border border-[#e7dcc9] px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
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
