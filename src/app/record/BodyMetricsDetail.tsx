"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import type { BodyPhotoSummary } from "@/lib/body-photos/queries";
import {
  weightGoalProgress,
  weightPaceKgPerWeek,
  weightEta,
  etaForTarget,
} from "@/lib/body-metrics/goal-progress";
import { BodyMetricsChart } from "./BodyMetricsChart";
import { BottomSheet } from "./BottomSheet";
import { RecordSheetBody } from "./RecordSheetBody";

/**
 * 体組成 詳細画面 (2026-07-06 体組成セクション改修 ・ 確定モック body-metrics-final.html)
 *
 * タブ: 体重 / ウエスト＋写真 (ピル)
 * 体重: リング → 3カラム(入会時/現在/目標) → ピル2つ(目標まで/現状ペース)
 *       → グラフ → 予測カード(A-2) → 「体重を指定して計算」ボタン(→ボトムシート)
 * ウエスト＋写真: サマリ → グラフ → ビフォーアフター写真(フェーズ6で実装)
 */

type Tab = "weight" | "waist";

function fmt(n: number | null | undefined, d = 1): string {
  return n == null ? "—" : n.toFixed(d);
}
function monthLabel(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return `${m}月ごろ`;
}

export function BodyMetricsDetail({
  rows,
  targetWeightKg,
  photoSummary,
}: {
  rows: BodyMetricRow[]; // recorded_at 昇順
  targetWeightKg: number | null;
  photoSummary: BodyPhotoSummary;
}) {
  const [tab, setTab] = useState<Tab>("weight");
  const [calcOpen, setCalcOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  const weightRows = useMemo(
    () => rows.filter((r) => r.weight_kg != null),
    [rows]
  );
  const waistRows = useMemo(
    () => rows.filter((r) => r.waist_cm != null),
    [rows]
  );

  const startWeight = weightRows[0]?.weight_kg ?? null;
  const currentWeight = weightRows[weightRows.length - 1]?.weight_kg ?? null;
  const latest = rows[rows.length - 1] ?? null; // 直近の記録 (入力初期値)
  const pace = useMemo(() => weightPaceKgPerWeek(rows), [rows]);
  const prog = weightGoalProgress(currentWeight, targetWeightKg);
  const eta = weightEta(currentWeight, targetWeightKg, pace);

  // リング 達成率 (入会→目標 のうち どこまで来たか)
  const ringPct = useMemo(() => {
    if (startWeight == null || currentWeight == null || targetWeightKg == null)
      return null;
    const span = startWeight - targetWeightKg;
    if (Math.abs(span) < 0.05) return currentWeight <= targetWeightKg ? 100 : 0;
    const p = ((startWeight - currentWeight) / span) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }, [startWeight, currentWeight, targetWeightKg]);

  return (
    <div className="space-y-3">
      {/* ピルタブ */}
      <div className="flex gap-1.5 rounded-2xl bg-[#f0ece2] p-1.5">
        {(
          [
            { key: "weight", label: "体重" },
            { key: "waist", label: "ウエスト＋写真" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-2.5 text-[12px] font-bold transition-colors ${
              tab === t.key
                ? "bg-[#4a875b] text-white shadow-[0_2px_6px_rgba(74,135,91,0.35)]"
                : "text-[#6a6256]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "weight" ? (
        <WeightView
          weightRows={weightRows}
          startWeight={startWeight}
          currentWeight={currentWeight}
          targetWeightKg={targetWeightKg}
          ringPct={ringPct}
          pace={pace}
          prog={prog}
          eta={eta}
          onOpenCalc={() => setCalcOpen(true)}
        />
      ) : (
        <WaistView waistRows={waistRows} photoSummary={photoSummary} />
      )}

      {/* 記録する (右下フローティング・常駐) → 下からせり上がる入力シート。
          下部ナビ(約60px+safe-area)の上に浮かせる。 体重タブの時だけ表示。 */}
      {tab === "weight" ? (
        <button
          type="button"
          onClick={() => setRecordOpen(true)}
          aria-label="体組成を記録する"
          className="fixed right-4 z-30 flex items-center gap-1.5 rounded-full bg-[#4a875b] px-5 py-3.5 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(74,135,91,0.45)] transition-colors hover:bg-[#34603f] active:scale-95"
          style={{ bottom: "calc(74px + env(safe-area-inset-bottom))" }}
        >
          <span className="text-[18px] leading-none">＋</span>
          記録
        </button>
      ) : null}

      {/* 記録入力シート */}
      <BottomSheet
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="今日の記録"
      >
        <RecordSheetBody
          initialWeight={latest?.weight_kg ?? null}
          initialBodyFat={latest?.body_fat_percent ?? null}
          initialWaist={latest?.waist_cm ?? null}
          onSaved={() => setRecordOpen(false)}
        />
      </BottomSheet>

      {/* 計算シート (体重を指定して逆算) */}
      <BottomSheet
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        title="体重を指定して計算"
      >
        <CalcSheetBody currentWeight={currentWeight} pace={pace} />
      </BottomSheet>
    </div>
  );
}

function WeightView({
  weightRows,
  startWeight,
  currentWeight,
  targetWeightKg,
  ringPct,
  pace,
  prog,
  eta,
  onOpenCalc,
}: {
  weightRows: BodyMetricRow[];
  startWeight: number | null;
  currentWeight: number | null;
  targetWeightKg: number | null;
  ringPct: number | null;
  pace: number | null;
  prog: ReturnType<typeof weightGoalProgress>;
  eta: ReturnType<typeof weightEta>;
  onOpenCalc: () => void;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = ringPct ?? 0;

  return (
    <>
      {/* リング */}
      <div className="pt-1 text-center">
        <div className="relative mx-auto h-[124px] w-[124px]">
          <svg width="124" height="124" viewBox="0 0 124 124">
            <circle
              cx="62"
              cy="62"
              r={R}
              fill="none"
              stroke="#eadfce"
              strokeWidth="10"
            />
            <circle
              cx="62"
              cy="62"
              r={R}
              fill="none"
              stroke="#4a875b"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
              transform="rotate(-90 62 62)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-[31px] font-extrabold leading-none text-[#2b2620]">
              {fmt(currentWeight)}
            </div>
            <div className="mt-0.5 text-[11px] font-bold text-[#6a6256]">
              kg{ringPct != null ? ` ・ 達成${pct}%` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* 3カラム 入会時/現在/目標 */}
      <div className="flex justify-around border-y border-[#e7dcc9] py-3 text-[11px]">
        {[
          { label: "入会時", val: startWeight, cls: "text-[#2b2620]" },
          { label: "現在", val: currentWeight, cls: "text-[#004d40]" },
          { label: "目標", val: targetWeightKg, cls: "text-[#004d40]" },
        ].map((c) => (
          <span key={c.label} className="text-center font-bold text-[#6a6256]">
            {c.label}
            <b className={`mt-0.5 block font-mono text-[17px] ${c.cls}`}>
              {fmt(c.val)}
            </b>
          </span>
        ))}
      </div>

      {/* ピル2つ (目標まで / 現状ペース) */}
      <div className="flex justify-center gap-2.5">
        <div className="rounded-2xl border border-[#dce9e0] bg-[#eef5f0] px-5 py-2.5 text-center leading-tight">
          <span className="block text-[11px] font-bold text-[#6a6256]">
            目標まで
          </span>
          <span className="mt-0.5 block font-mono text-[17px] font-extrabold text-[#004d40]">
            {prog.state === "remaining"
              ? `あと ${fmt(prog.kg)}kg`
              : prog.state === "reached"
                ? "達成"
                : prog.state === "no_target"
                  ? "未設定"
                  : "—"}
          </span>
        </div>
        <div className="rounded-2xl border border-[#dce9e0] bg-[#eef5f0] px-5 py-2.5 text-center leading-tight">
          <span className="block text-[11px] font-bold text-[#6a6256]">
            現状ペース
          </span>
          <span className="mt-0.5 block font-mono text-[17px] font-extrabold text-[#004d40]">
            {pace != null ? `${pace > 0 ? "+" : ""}${fmt(pace)}kg/週` : "—"}
          </span>
        </div>
      </div>

      {prog.state === "no_target" ? (
        <div className="text-center">
          <Link
            href="/goal-sheet"
            className="text-[12px] font-bold text-[#4a875b] underline underline-offset-2"
          >
            目標体重を設定する
          </Link>
        </div>
      ) : null}

      {/* グラフ */}
      <div className="mt-1">
        <div className="mb-2 px-0.5 text-[12px] font-bold text-[#5b5344]">
          数値の推移
        </div>
        <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 pt-4 pb-3">
          {weightRows.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#6a6256]">
              まだ記録がありません
            </div>
          ) : (
            <BodyMetricsChart
              rows={weightRows}
              metric="weight_kg"
              metricLabel="体重"
              metricUnit="kg"
              targetWeightKg={targetWeightKg}
            />
          )}
        </div>
      </div>

      {/* 予測カード (A-2) */}
      <PredictCard eta={eta} />

      {/* 体重を指定して計算 (アウトライン) */}
      <button
        type="button"
        onClick={onOpenCalc}
        className="block w-full rounded-xl border-2 border-[#4a875b] bg-white py-2.5 text-center text-[13px] font-bold text-[#004d40] transition-colors hover:bg-[#4a875b]/5"
      >
        ＋ 体重を指定して計算する
      </button>
    </>
  );
}

function PredictCard({ eta }: { eta: ReturnType<typeof weightEta> }) {
  if (eta.state === "eta") {
    return (
      <div className="rounded-2xl border border-[#d7e6db] bg-gradient-to-br from-[#eef5f0] to-[#fffbe6] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-11 flex-none flex-col items-center justify-center overflow-hidden rounded-lg border border-[#cfe0d4] bg-white">
            <div className="w-full bg-[#4a875b] py-0.5 text-center text-[9px] font-bold text-white">
              {Number(eta.date.slice(5, 7))}月
            </div>
            <div className="font-mono text-[18px] font-extrabold leading-tight text-[#004d40]">
              {Number(eta.date.slice(8, 10))}
            </div>
          </div>
          <div>
            <div className="text-[14px] font-bold text-[#2b2620]">
              {monthLabel(eta.date)} 達成見込み
            </div>
            <div className="mt-0.5 text-[11px] text-[#6a6256]">
              今のペースであと約{eta.days}日です
            </div>
          </div>
        </div>
      </div>
    );
  }
  // stalled / no_data → 誤った期待を出さない
  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4 text-center">
      <div className="text-[13px] font-bold text-[#5b5344]">
        記録を続けましょう
      </div>
      <div className="mt-1 text-[11px] text-[#6a6256]">
        {eta.state === "no_data"
          ? "記録が増えると、達成の見込みが出せます。"
          : "ペースが安定すると、達成の見込みが出せます。"}
      </div>
    </div>
  );
}

function CalcSheetBody({
  currentWeight,
  pace,
}: {
  currentWeight: number | null;
  pace: number | null;
}) {
  const [input, setInput] = useState<string>(
    currentWeight != null ? String(Math.round(currentWeight - 2)) : ""
  );
  const target = input.trim() ? Number(input) : null;
  const result =
    target != null && Number.isFinite(target)
      ? etaForTarget(currentWeight, target, pace)
      : null;

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-center gap-2 rounded-xl border border-[#e7dcc9] bg-white p-3">
        <span className="text-[12px] font-bold text-[#6a6256]">目標体重</span>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-20 border-b-2 border-[#4a875b] text-center font-mono text-[24px] font-extrabold text-[#2b2620] focus:outline-none"
        />
        <span className="text-[13px] font-bold text-[#6a6256]">kg</span>
      </div>
      <div className="rounded-2xl border border-[#d7e6db] bg-gradient-to-br from-[#eef5f0] to-[#fffbe6] p-4 text-center">
        {currentWeight == null ? (
          <div className="text-[12px] text-[#6a6256]">
            先に体重を記録すると計算できます。
          </div>
        ) : pace == null ? (
          <div className="text-[12px] text-[#6a6256]">
            記録が増えると、現状ペースから逆算できます。
          </div>
        ) : result == null ? (
          <div className="text-[12px] text-[#6a6256]">
            現状のペースでは、この体重への到達を予測できません。
          </div>
        ) : result.days === 0 ? (
          <div className="text-[14px] font-bold text-[#004d40]">
            すでに到達しています
          </div>
        ) : (
          <>
            <div className="text-[13px] font-bold text-[#2b2620]">
              {fmt(target)}kg まで
            </div>
            <div className="mt-1 font-mono text-[24px] font-extrabold text-[#004d40]">
              あと 約{result.days}日
            </div>
            <div className="mt-1 text-[12px] font-bold text-[#2b2620]">
              {monthLabel(result.date)} 見込み
            </div>
            <div className="mt-1.5 text-[11px] text-[#6a6256]">
              現状ペース {pace > 0 ? "+" : ""}
              {fmt(pace)}kg/週 で逆算
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WaistView({
  waistRows,
  photoSummary,
}: {
  waistRows: BodyMetricRow[];
  photoSummary: BodyPhotoSummary;
}) {
  const start = waistRows[0]?.waist_cm ?? null;
  const current = waistRows[waistRows.length - 1]?.waist_cm ?? null;
  const delta =
    start != null && current != null
      ? Math.round((current - start) * 10) / 10
      : null;

  return (
    <>
      <div className="flex justify-around rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] py-4 text-[11px]">
        {[
          { label: "入会時", val: start },
          { label: "現在", val: current },
          {
            label: "変化",
            val: delta,
            sign: true,
          },
        ].map((c) => (
          <span key={c.label} className="text-center font-bold text-[#6a6256]">
            {c.label}
            <b className="mt-0.5 block font-mono text-[19px] text-[#004d40]">
              {c.val == null
                ? "—"
                : c.sign
                  ? `${c.val > 0 ? "+" : ""}${c.val.toFixed(1)}`
                  : c.val.toFixed(1)}
              <span className="ml-0.5 text-[10px] text-[#6a6256]">cm</span>
            </b>
          </span>
        ))}
      </div>

      <div className="mt-1">
        <div className="mb-2 px-0.5 text-[12px] font-bold text-[#5b5344]">
          ウエストの推移
        </div>
        <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 pt-4 pb-3">
          {waistRows.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#6a6256]">
              まだ記録がありません
            </div>
          ) : (
            <BodyMetricsChart
              rows={waistRows}
              metric="waist_cm"
              metricLabel="ウエスト"
              metricUnit="cm"
              targetWeightKg={null}
            />
          )}
        </div>
      </div>

      {/* ビフォーアフター写真 (要点2枚 + 一覧へ) */}
      <PhotoSummaryCard summary={photoSummary} />
    </>
  );
}

function PhotoSummaryCard({ summary }: { summary: BodyPhotoSummary }) {
  // 0枚: 記録を促す
  if (summary.count === 0) {
    return (
      <Link
        href="/record/photos"
        className="mt-1 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-6 text-center transition-colors hover:border-[#4a875b]"
      >
        <span className="text-[13px] font-bold text-[#5b5344]">
          体型写真で変化を記録
        </span>
        <span className="text-[11px] text-[#a59b8c]">
          写真を追加して、見た目の変化を並べて見られます →
        </span>
      </Link>
    );
  }

  const { first, last } = summary;
  return (
    <div className="mt-1 space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[12px] font-bold text-[#5b5344]">
          ビフォーアフター
        </span>
        <Link
          href="/record/photos"
          className="text-[11px] font-bold text-[#4a875b]"
        >
          写真をすべて見る（{summary.count}枚）→
        </Link>
      </div>

      <Link href="/record/photos" className="grid grid-cols-2 gap-2.5">
        <PhotoThumb
          url={first?.url ?? null}
          tag={last ? "入会時ごろ" : "記録"}
          date={first?.recorded_at ?? null}
        />
        {last ? (
          <PhotoThumb url={last.url} tag="現在" date={last.recorded_at} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-4 text-center text-[11px] text-[#a59b8c]">
            もう1枚追加すると
            <br />
            並べて比較できます
          </div>
        )}
      </Link>
    </div>
  );
}

function PhotoThumb({
  url,
  tag,
  date,
}: {
  url: string | null;
  tag: string;
  date: string | null;
}) {
  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#f0ece2]">
        {url ? (
          <Image
            src={url}
            alt={tag}
            fill
            sizes="(max-width:460px) 45vw, 200px"
            className="object-cover"
            unoptimized
          />
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
          {tag}
        </span>
      </div>
      {date ? (
        <div className="mt-1 text-center text-[10px] font-bold text-[#6a6256]">
          {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
        </div>
      ) : null}
    </div>
  );
}
