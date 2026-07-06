"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBodyMetric } from "@/lib/body-metrics/actions";

/**
 * 記録入力シート本体 (2026-07-06 体組成セクション改修 P4)
 *
 * /record の詳細画面から下からせり上がるボトムシートの中身。
 *   - 主要 2 項目 (体重 / ウエスト) を大きく
 *   - 体脂肪率・メモ・記録日は「詳しく入力」に折りたたみ
 *   - 保存成功 → onSaved() でシートを閉じ、router.refresh() で画面更新
 *
 * 保存ロジックは既存 upsertBodyMetric を共有。
 */

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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
  const [recordedAt, setRecordedAt] = useState(todayString());
  const [weight, setWeight] = useState<string>(
    initialWeight != null ? String(initialWeight) : ""
  );
  const [waist, setWaist] = useState<string>(
    initialWaist != null ? String(initialWaist) : ""
  );
  const [bodyFat, setBodyFat] = useState<string>(
    initialBodyFat != null ? String(initialBodyFat) : ""
  );
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const empty = !weight.trim() && !waist.trim() && !bodyFat.trim();

  function handleSubmit() {
    setError(null);
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
      onSaved();
      router.refresh();
    });
  }

  return (
    <div>
      {/* 主要 2 項目 (体重 / ウエスト) */}
      <div className="grid grid-cols-2 gap-3">
        <BigInput
          label="体重"
          unit="kg"
          value={weight}
          onChange={setWeight}
          placeholder="60.5"
        />
        <BigInput
          label="ウエスト"
          unit="cm"
          value={waist}
          onChange={setWaist}
          placeholder="85.0"
        />
      </div>

      {/* 詳しく入力 (体脂肪率 / 記録日 / メモ) */}
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1 text-[12px] font-bold text-[#4a875b]"
      >
        {showDetails ? "詳しい入力を閉じる" : "＋ 詳しく入力（体脂肪率・日付・メモ）"}
      </button>

      {showDetails ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <SmallInput
              label="体脂肪率 (%)"
              value={bodyFat}
              onChange={setBodyFat}
              placeholder="22.4"
              type="number"
            />
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
          <SmallInput
            label="メモ (任意)"
            value={note}
            onChange={setNote}
            placeholder="昨日たくさん食べた、等"
            type="text"
            maxLength={200}
          />
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-[#a59b8c]">
        同じ日に複数回記録すると、最後の値で上書きされます。少なくとも 1 項目入力してください。リアルタイムで共有されます。
      </p>

      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          ⚠ {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || empty}
        className="mt-3.5 w-full rounded-2xl bg-[#4a875b] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#34603f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "保存中..." : "記録する"}
      </button>
    </div>
  );
}

function BigInput({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block rounded-2xl border border-[#e7dcc9] bg-white p-3 focus-within:border-[#4a875b]">
      <span className="mb-1 block text-[11px] font-bold text-[#6a6256]">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 font-mono text-[26px] font-extrabold text-[#2b2620] placeholder:text-[#d8cdba] focus:outline-none"
        />
        <span className="flex-none text-[13px] font-bold text-[#6a6256]">
          {unit}
        </span>
      </span>
    </label>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
  type,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: "number" | "text";
  maxLength?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "0.1" : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e7dcc9] px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
      />
    </div>
  );
}
