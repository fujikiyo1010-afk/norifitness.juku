"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBodyMetric } from "@/lib/body-metrics/actions";

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function BodyMetricsForm({
  initialWeight,
  initialBodyFat,
  initialWaist,
}: {
  initialWeight?: number | null;
  initialBodyFat?: number | null;
  initialWaist?: number | null;
}) {
  const router = useRouter();
  const [recordedAt, setRecordedAt] = useState(todayString());
  const [weight, setWeight] = useState<string>(
    initialWeight !== null && initialWeight !== undefined ? String(initialWeight) : ""
  );
  const [bodyFat, setBodyFat] = useState<string>(
    initialBodyFat !== null && initialBodyFat !== undefined
      ? String(initialBodyFat)
      : ""
  );
  const [waist, setWaist] = useState<string>(
    initialWaist !== null && initialWaist !== undefined ? String(initialWaist) : ""
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseNum(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await upsertBodyMetric({
        recorded_at: recordedAt,
        weight_kg: parseNum(weight),
        body_fat_percent: parseNum(bodyFat),
        waist_cm: parseNum(waist),
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess("記録しました");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-[#e8ebe9] rounded-2xl p-5">
      <h2 className="text-sm font-bold text-zinc-900 mb-4">
        今日の体組成を記録
      </h2>

      {/* 記録日 */}
      <div className="mb-3">
        <label className="block text-xs text-zinc-500 mb-1.5">記録日</label>
        <input
          type="date"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="w-full px-3 py-2.5 border border-[#e8ebe9] rounded-lg text-sm focus:outline-none focus:border-[#00897b]"
          max={todayString()}
        />
      </div>

      {/* 3 項目グリッド */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            体重 (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="60.5"
            className="w-full px-3 py-2.5 border border-[#e8ebe9] rounded-lg text-base font-mono focus:outline-none focus:border-[#00897b]"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            体脂肪 (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            placeholder="22.4"
            className="w-full px-3 py-2.5 border border-[#e8ebe9] rounded-lg text-base font-mono focus:outline-none focus:border-[#00897b]"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            ウエスト (cm)
          </label>
          <input
            type="number"
            step="0.1"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            placeholder="85.0"
            className="w-full px-3 py-2.5 border border-[#e8ebe9] rounded-lg text-base font-mono focus:outline-none focus:border-[#00897b]"
            inputMode="decimal"
          />
        </div>
      </div>

      {/* メモ */}
      <div className="mb-3">
        <label className="block text-xs text-zinc-500 mb-1.5">
          メモ (任意)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="昨日たくさん食べた、 等"
          className="w-full px-3 py-2.5 border border-[#e8ebe9] rounded-lg text-sm focus:outline-none focus:border-[#00897b]"
          maxLength={200}
        />
      </div>

      {/* 注意 */}
      <div className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
        同じ日に複数回記録すると、 最後の値で上書きされます。
        <br />
        少なくとも 1 項目入力してください。
      </div>

      {/* エラー / 成功 */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          ⚠ {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800">
          ✓ {success}
        </div>
      )}

      {/* 送信 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          isPending || (!weight.trim() && !bodyFat.trim() && !waist.trim())
        }
        className="w-full px-4 py-3 bg-[#00897b] hover:bg-[#00695c] text-white rounded-2xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "保存中..." : "記録する"}
      </button>
    </div>
  );
}
