"use client";

import { useState } from "react";
import { upsertDailyCondition } from "@/lib/conditions/actions";
import {
  ALCOHOL_OPTS,
  BOWEL_OPTS,
  CONDITION_OPTS,
  type Alcohol,
  type Bowel,
  type Condition,
  type DailyConditionData,
} from "@/lib/conditions/types";

/**
 * 生活記録 4問フォーム(M13・P6・ベータ)。
 *  - 昨夜の睡眠(±0.5・直接入力)/体調/お通じ/お酒。タップ4回・約10秒・スキップ可。
 *  - 夕食保存後の接ぎ木・独立入力口・翌日補完で共通利用。
 */
export function LifeConditionForm({
  date,
  initial,
  title = "今日の調子は？",
  onDone,
  onSkip,
}: {
  date: string;
  initial?: DailyConditionData | null;
  title?: string;
  onDone: (msg: string) => void;
  onSkip?: () => void;
}) {
  const [sleep, setSleep] = useState<number | null>(initial?.sleepHours ?? 6.5);
  const [condition, setCondition] = useState<Condition | null>(initial?.condition ?? null);
  const [bowel, setBowel] = useState<Bowel | null>(initial?.bowel ?? null);
  const [alcohol, setAlcohol] = useState<Alcohol | null>(initial?.alcohol ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(skip: boolean) {
    setError(null);
    setBusy(true);
    try {
      const r = await upsertDailyCondition(
        skip
          ? { date }
          : { date, sleepHours: sleep, condition, bowel, alcohol }
      );
      if (!r.ok) throw new Error(r.message);
      if (skip) onSkip?.();
      else onDone("今日の生活を記録しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <div className="text-[15px] font-extrabold text-[#2b2620]">{title}</div>
        <div className="text-[10px] text-[#a59b8c]">タップ数回・約10秒で終わります</div>
      </div>

      {/* 睡眠 */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">
          昨夜の睡眠（時間・0.5単位）
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSleep((v) => Math.max(0, Math.round(((v ?? 0) - 0.5) * 10) / 10))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7dcc9] bg-white text-[18px] text-[#6a6256]"
          >
            −
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              value={sleep ?? ""}
              onChange={(e) => setSleep(e.target.value === "" ? null : Number(e.target.value))}
              className="w-16 rounded-lg border border-[#e7dcc9] bg-white px-2 py-1 text-center text-[16px] font-bold focus:border-[#4a875b] focus:outline-none"
            />
            <span className="text-[12px] text-[#6a6256]">時間</span>
          </div>
          <button
            type="button"
            onClick={() => setSleep((v) => Math.round(((v ?? 0) + 0.5) * 10) / 10)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7dcc9] bg-white text-[18px] text-[#6a6256]"
          >
            ＋
          </button>
        </div>
      </div>

      <Segment label="体調" opts={CONDITION_OPTS} value={condition} onChange={setCondition} />
      <Segment label="お通じ" opts={BOWEL_OPTS} value={bowel} onChange={setBowel} />
      <Segment label="お酒" opts={ALCOHOL_OPTS} value={alcohol} onChange={setAlcohol} />

      {error && <p className="text-[12px] font-bold text-red-700">❌ {error}</p>}

      <button
        type="button"
        onClick={() => save(false)}
        disabled={busy}
        className="w-full rounded-xl btn3d py-3 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "保存中…" : "これで今日はおしまい"}
      </button>
      <button
        type="button"
        onClick={() => save(true)}
        disabled={busy}
        className="w-full text-center text-[11px] text-[#a59b8c]"
      >
        今日はスキップ
      </button>
    </div>
  );
}

function Segment<T extends string>({
  label,
  opts,
  value,
  onChange,
}: {
  label: string;
  opts: { v: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">{label}</div>
      <div className="flex gap-1.5">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`flex-1 rounded-xl py-2.5 text-[13px] font-bold transition-colors ${
              value === o.v ? "bg-[#4a875b] text-white" : "bg-[#f0ece2] text-[#6a6256]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
