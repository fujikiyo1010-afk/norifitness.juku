"use client";

import { useState } from "react";
import Link from "next/link";
import {
  computeForecast,
  projectWeight,
  etaForPace,
  type ForecastPeriod,
} from "@/lib/body-metrics/forecast";

/**
 * 体重タブ 再設計 (M20改・確定版・ベータ限定)。
 * モック: 08_guide/提案_受講生_体重タブ_目標現状推移_パターン集.html
 *
 * グラフ下の「目標推移/現状推移」タブ切替リスト1枚(案2チェックポイント縦ライン型):
 *   - 目標推移 = ペース手入力(初期値=今の実ペース)→「このペースなら、この日に、この体重」
 *   - 現状推移 = 今の実ペース固定(読むだけ)。実ペースは上部「現状ペース」ピルと同一値。
 *   - レンジ 1日/1週間/1ヶ月 は両タブ共通(=チェックポイント間隔)。
 *   - その下=下カード3点セット(このペースだと/届きたい通過点/責めないひとこと)。
 * 色コード・サイズ・文言はモックから直接転写(ルール21)。
 */

const DAY = 86_400_000;

type TrendTab = "goal" | "now";
type RangeKey = "1d" | "1w" | "1m";

const RANGES: { key: RangeKey; label: string; step: number }[] = [
  { key: "1d", label: "1日", step: 1 },
  { key: "1w", label: "1週間", step: 7 },
  { key: "1m", label: "1ヶ月", step: 30 },
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function roundStep(n: number, step = 0.05): number {
  return Math.round(n / step) * step;
}
/** 予測日ラベル(今年=M/D・来年=来年M/D・それ以降=YYYY/M/D) */
function etaDateLabel(ms: number, nowMs: number): string {
  const d = new Date(ms);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const dy = d.getFullYear();
  const ny = new Date(nowMs).getFullYear();
  if (dy === ny) return md;
  if (dy === ny + 1) return `来年${md}`;
  return `${dy}/${md}`;
}

export function ProgressTrendCard({
  current,
  target,
  targetDate,
  pace,
  nowMs,
}: {
  current: number | null;
  target: number | null;
  targetDate: string | null;
  /** 実測ペース kg/週(符号つき)。上部「現状ペース」ピルと同一値。<2記録は null */
  pace: number | null;
  /** hydration対策: サーバ確定の「今」(ms)。client側 Date.now() を廃し SSR/CSR一致。 */
  nowMs: number;
}) {
  const [tab, setTab] = useState<TrendTab>("goal");
  const [rangeKey, setRangeKey] = useState<RangeKey>("1w");
  // 「今」はサーバから受け取った固定値(client で Date.now() を呼ばない=hydration不一致を防ぐ)
  const now = nowMs;

  const realPaceAbs = pace != null ? Math.abs(pace) : null;
  // 目標推移のペース手入力(初期値=今の実ペース・0.05刻み・最小0.05)
  const [inputPace, setInputPace] = useState<number>(() =>
    realPaceAbs != null ? Math.max(0.05, roundStep(realPaceAbs)) : 0.3
  );

  // エッジ: 記録不足 / 目標(体重・日)未設定 は道のりを引けない
  const goalMs = targetDate ? Date.parse(targetDate) : null;
  if (current == null || pace == null) {
    return (
      <Shell>
        <p className="text-[12px] leading-relaxed text-[#6a6256]">
          記録が2回そろうと、ここに「このペースだと何kg」という道のりが出ます。
        </p>
      </Shell>
    );
  }
  if (target == null || goalMs == null || Number.isNaN(goalMs)) {
    return (
      <Shell>
        <p className="text-[12px] leading-relaxed text-[#6a6256]">
          目標体重と目標日を立てると、通過点と道のりが出せます。
        </p>
        <Link
          href="/goal-sheet"
          className="mt-2 inline-block text-[12px] font-bold text-[#4a875b] underline underline-offset-2"
        >
          目標を立てる →
        </Link>
      </Shell>
    );
  }

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const step = range.step;

  // タブごとの符号つきペース: 目標方向へ動く向きに合わせる。
  const dir = target >= current ? 1 : -1; // 目標に近づく体重変化の向き
  const paceAbs = tab === "goal" ? Math.max(0.05, inputPace) : (realPaceAbs ?? 0);
  const signedPace = tab === "now" ? pace : dir * paceAbs;

  // 到達日(このペースで target へ)。向きが逆/遅すぎなら null。
  const etaMs = etaForPace(current, target, paceAbs, now);
  const etaDays = etaMs != null ? Math.round((etaMs - now) / DAY) : null;

  // チェックポイント(今日→レンジ刻み4点→到達日)。予測点は点線の丸。
  const interim = [1, 2, 3, 4]
    .map((k) => k * step)
    .filter((d) => etaDays == null || d < etaDays)
    .map((d) => ({
      label: etaDateLabel(now + d * DAY, now),
      weight: projectWeight(current, signedPace, d),
    }));

  // 下カード3点セット(このペースだと/届きたい通過点/ひとこと)=computeForecast一発。
  const period: ForecastPeriod = { key: "1w", label: range.label, days: step };
  const fc = computeForecast(current, target, signedPace, now, goalMs, period);

  return (
    <Shell>
      {/* タブ */}
      <div className="flex rounded-[11px] bg-[#efe9dc] p-[3px]">
        {(
          [
            { key: "goal", label: "目標推移" },
            { key: "now", label: "現状推移" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-[9px] py-[7px] text-center text-[11.5px] font-extrabold transition-colors ${
              tab === t.key
                ? "bg-white text-[#34603f] shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                : "text-[#6a6256]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* レンジ(両タブ共通) */}
      <div className="mt-2 flex justify-end gap-[5px]">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeKey(r.key)}
            className={`rounded-full border px-[11px] py-[3px] text-[9.5px] font-extrabold transition-colors ${
              r.key === rangeKey
                ? "border-[#34603f] bg-[#34603f] text-white"
                : "border-[#e0d6c2] bg-[#fffdf8] text-[#6a6256]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {tab === "goal" ? (
        // 目標推移: ペース手入力ボックス
        <div className="mt-[9px] flex items-center gap-2 rounded-xl border border-[#e8ede4] bg-[#f6f8f4] px-[11px] py-[9px]">
          <span className="text-[9.5px] font-extrabold leading-[1.35] text-[#6a6256]">
            ペース
            <br />
            <small className="text-[8px] font-semibold text-[#a59b8c]">
              初期値=今の実ペース
            </small>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label="ペースを下げる"
              onClick={() => setInputPace((v) => Math.max(0.05, roundStep(v - 0.05)))}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-[17px] font-bold text-[#34603f]"
            >
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              step={0.05}
              min={0.05}
              value={inputPace.toFixed(2)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setInputPace(v);
              }}
              className="h-11 w-16 rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-center font-mono text-[17px] font-extrabold text-[#2b2620] focus:outline-none"
            />
            <button
              type="button"
              aria-label="ペースを上げる"
              onClick={() => setInputPace((v) => roundStep(v + 0.05))}
              className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-[17px] font-bold text-[#34603f]"
            >
              ＋
            </button>
            <span className="text-[9px] font-bold text-[#a59b8c]">kg/週</span>
          </span>
        </div>
      ) : (
        // 現状推移: 今の実ペース固定の見出し(入力なし)
        <div className="mt-[9px] text-center text-[9.5px] font-bold text-[#a59b8c]">
          今の実ペース 週{realPaceAbs?.toFixed(2)}kg（直近1ヶ月）で進んだ場合
        </div>
      )}

      {/* チェックポイント縦ライン */}
      <ol className="relative mt-2.5 pl-5">
        <CheckItem label="今日" weight={`${round1(current)} kg`} tag="起点" kind="today" first />
        {interim.map((p, i) => (
          <CheckItem key={i} label={p.label} weight={`${p.weight} kg`} kind="est" />
        ))}
        {etaMs != null ? (
          <CheckItem
            label={etaDateLabel(etaMs, now)}
            weight={`${round1(target)} kg`}
            tag={tab === "goal" ? "このペースの到達日" : "今のペースの到達日"}
            kind="goal"
            last
          />
        ) : (
          <li className="py-1 pl-1 text-[10.5px] text-[#a59b8c]">
            このペースでは目標体重に近づきません。
          </li>
        )}
      </ol>

      {/* 下カード3点セット */}
      <div className="mt-2.5 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-[13px]">
        <div className="flex items-baseline gap-2 border-b border-dashed border-[#f0ead9] py-1.5">
          <span className="w-[120px] flex-none text-[11px] font-bold text-[#6a6256]">
            このペースだと
          </span>
          <span className="font-mono text-[18px] font-extrabold text-[#2b2620]">
            {fc.predicted}
            <small className="text-[10px] font-bold text-[#a59b8c]"> kg</small>
          </span>
        </div>
        <div className="flex items-baseline gap-2 py-1.5">
          <span className="w-[120px] flex-none text-[11px] font-bold text-[#8a6d10]">
            届きたい通過点
          </span>
          <span className="font-mono text-[18px] font-extrabold text-[#8a6d10]">
            {fc.checkpoint}
            <small className="text-[10px] font-bold text-[#a59b8c]"> kg</small>
          </span>
        </div>
        <p className="mt-[9px] rounded-[11px] border border-[#cfe3d6] bg-[#e8f3ec] px-3 py-[9px] text-[11.5px] font-bold leading-[1.6] text-[#34603f]">
          {fc.message}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-[13px]">
      {children}
    </div>
  );
}

/** チェックポイント1行(縦ライン+ドット・モック .cbi 転写) */
function CheckItem({
  label,
  weight,
  tag,
  kind,
  first = false,
  last = false,
}: {
  label: string;
  weight: string;
  tag?: string;
  kind: "today" | "est" | "goal";
  first?: boolean;
  last?: boolean;
}) {
  // 縦ライン(左): first は上半分から、last は上半分まで
  const lineTop = first ? "12px" : "0";
  const lineBottom = last ? "auto" : "0";
  const lineHeight = last ? "12px" : "auto";
  // ドット
  const dotClass =
    kind === "goal"
      ? "border-[#c9a227]"
      : kind === "est"
        ? "border-dashed border-[#c9bfa9]"
        : "border-[#c9bfa9]";
  return (
    <li className="relative py-[5px] pl-1">
      <span
        aria-hidden
        className="absolute left-[-13px] w-[2px] bg-[#e8e0cd]"
        style={{ top: lineTop, bottom: lineBottom, height: lineHeight }}
      />
      <span
        aria-hidden
        className={`absolute left-[-18px] top-[9px] h-3 w-3 rounded-full border-2 bg-white ${dotClass}`}
      />
      <span className="flex items-baseline gap-[7px]">
        <span className="w-[98px] text-[10.5px] font-bold text-[#6a6256]">
          {label}
        </span>
        <span
          className={`font-mono text-[13.5px] font-extrabold ${
            kind === "goal" ? "text-[#8a6d10]" : "text-[#2b2620]"
          }`}
        >
          {weight}
        </span>
        {tag ? (
          <span className="ml-auto text-[8.5px] text-[#a59b8c]">{tag}</span>
        ) : null}
      </span>
    </li>
  );
}
