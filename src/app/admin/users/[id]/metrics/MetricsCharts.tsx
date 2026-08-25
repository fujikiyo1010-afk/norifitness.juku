"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 管理画面 受講生ハブ ・ 体組成グラフ (2026-08-25 改修)
 *
 * のり氏の指摘「数値が見えづらい / 何kg痩せたか分からない / 縦長にしたい」への対応。
 * モック: public/mock/admin-metrics-chart-C3.html (案③ 主役+脇役 ・ ラベルA案)
 *
 *  - 主役1つを大きく (左) + 脇役2つを縦長ミニで積む (右)。脇役クリックで主役が入れ替わる。
 *  - Y軸に数値ラベルを描く (旧実装は罫線だけで数字が無く「読めない」原因だった)。
 *  - 変化の基準は「その人の一番最初の記録 → 現在」。
 *      ※ サービス開始日(service_started_at)は使わない: トレクラ移行組は開始日と最初の記録が
 *         最大321日ズレる(トレクラの記録自体が 2026-05 以降にしか無い)ため、
 *         「入会時」と書くと嘘になる。ラベルは「最初の記録」で統一する(A案・きよむ確定)。
 *  - 数値(最初/ベスト/最高/変化)は【全期間】・グラフの描画だけ【選択した期間】。
 *    「何kg痩せたか」は期間タブで変わらない絶対値として見せる。
 */

export type MetricPoint = { d: string; v: number };
export type MetricsRange = "6m" | "1y" | "all";

type Key = "weight" | "bodyFat" | "waist";

const META: Record<Key, { title: string; short: string; unit: string; color: string }> = {
  weight: { title: "体重 (kg)", short: "体重", unit: "kg", color: "#00897b" },
  bodyFat: { title: "体脂肪率 (%)", short: "体脂肪率", unit: "%", color: "#b8860b" },
  waist: { title: "ウエスト (cm)", short: "ウエスト", unit: "cm", color: "#0369a1" },
};

/** グラフの上下の余白 (下は「もう少し余裕を」= きよむ指示で厚め) */
const PAD_TOP_RATIO = 0.12;
const PAD_BOTTOM_RATIO = 0.22;

function parseDate(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T00:00:00` : s);
}
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}
function md(s: string): string {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${fmt(n)}`;
}
function deltaColor(n: number): string {
  return n <= 0 ? "#00897b" : "#c2410c";
}
function deltaBg(n: number): string {
  return n <= 0 ? "#eaf5f2" : "#fdeee6";
}

function filterRange(points: MetricPoint[], range: MetricsRange): MetricPoint[] {
  if (range === "all") return points;
  const cutoff = new Date();
  if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);
  return points.filter((p) => parseDate(p.d) >= cutoff);
}

type Stats = { first: MetricPoint; last: MetricPoint; lo: number; hi: number; delta: number };
function statsOf(points: MetricPoint[]): Stats | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  let lo = first.v;
  let hi = first.v;
  for (const p of points) {
    if (p.v < lo) lo = p.v;
    if (p.v > hi) hi = p.v;
  }
  return { first, last, lo, hi, delta: last.v - first.v };
}

/** 実幅を測る (SVG を歪ませずピクセルで描くため) */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(cr.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

function Chart({
  points,
  color,
  height,
  yLabels = false,
  dots = true,
  /** 全期間の最初の記録日。描画範囲の先頭がこれと同じ時だけ「最初」ラベルを出す */
  firstDate,
  /** 全期間の最低値。描画範囲にこの値の点があれば「ベスト」マーカーを出す */
  bestValue,
  endValue = false,
  xCount = 3,
}: {
  points: MetricPoint[];
  color: string;
  height: number;
  yLabels?: boolean;
  dots?: boolean;
  firstDate?: string;
  bestValue?: number;
  endValue?: boolean;
  xCount?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[10.5px] text-zinc-400"
        style={{ height }}
      >
        この期間の記録がありません
      </div>
    );
  }
  if (points.length === 1) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center text-[10.5px] text-zinc-400"
        style={{ height }}
      >
        2 件以上で線が描かれます
      </div>
    );
  }

  const showStart = firstDate != null && points[0].d === firstDate;
  const padL = yLabels ? 38 : 8;
  const padR = endValue ? 44 : 10;
  const padT = endValue ? 18 : 12;
  const padB = 18;

  let mn = points[0].v;
  let mx = points[0].v;
  for (const p of points) {
    if (p.v < mn) mn = p.v;
    if (p.v > mx) mx = p.v;
  }
  if (mx === mn) {
    mx = mn + 1;
    mn = mn - 1;
  }
  const spread = mx - mn;
  mn -= spread * PAD_BOTTOM_RATIO;
  mx += spread * PAD_TOP_RATIO;

  const t0 = parseDate(points[0].d).getTime();
  const t1 = parseDate(points[points.length - 1].d).getTime();
  const tr = t1 - t0 || 1;
  const W = width || 240;
  const X = (p: MetricPoint) => padL + ((parseDate(p.d).getTime() - t0) / tr) * (W - padL - padR);
  const Y = (p: MetricPoint) => padT + (1 - (p.v - mn) / (mx - mn)) * (height - padT - padB);

  const line = points.map((p) => `${X(p).toFixed(1)},${Y(p).toFixed(1)}`).join(" ");
  const gid = `grad-${color.slice(1)}-${height}`;
  const ticks = yLabels ? 4 : 3;

  // ベスト(全期間の最低)が描画範囲にあるか。
  // ただし最新の点がそのままベストの時は、右端の現在値ラベルと数字が重なって読みにくいので出さない。
  const bestIdx =
    bestValue != null ? points.findIndex((p) => Math.abs(p.v - bestValue) < 0.001) : -1;
  const bestPoint =
    bestIdx >= 0 && !(endValue && bestIdx === points.length - 1) ? points[bestIdx] : null;

  const xTicks: MetricPoint[] = [];
  for (let j = 0; j < xCount; j++) {
    xTicks.push(points[Math.round((j * (points.length - 1)) / (xCount - 1))]);
  }

  return (
    <div ref={ref}>
      {width > 0 && (
        <svg width={W} height={height} style={{ display: "block" }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {Array.from({ length: ticks }).map((_, i) => {
            const val = mx - ((mx - mn) * i) / (ticks - 1);
            const y = padT + ((height - padT - padB) * i) / (ticks - 1);
            return (
              <g key={i}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="#e8ebe9"
                  strokeDasharray={i === ticks - 1 ? undefined : "2 3"}
                />
                {yLabels && (
                  <text
                    x={padL - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fill="#a1a1aa"
                    fontFamily="ui-monospace,Menlo,monospace"
                  >
                    {fmt(val)}
                  </text>
                )}
              </g>
            );
          })}

          <polygon
            points={`${padL},${height - padB} ${line} ${W - padR},${height - padB}`}
            fill={`url(#${gid})`}
          />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

          {dots &&
            points.map((p, i) => {
              const last = i === points.length - 1;
              return (
                <circle
                  key={i}
                  cx={X(p)}
                  cy={Y(p)}
                  r={last ? 4.5 : 1.9}
                  fill={color}
                  stroke={last ? "white" : undefined}
                  strokeWidth={last ? 2 : undefined}
                />
              );
            })}

          {bestPoint && (
            <g>
              <circle cx={X(bestPoint)} cy={Y(bestPoint)} r={4.5} fill="white" stroke={color} strokeWidth={2.5} />
              <text
                x={X(bestPoint)}
                y={Y(bestPoint) + 16}
                textAnchor={
                  X(bestPoint) < padL + 28 ? "start" : X(bestPoint) > W - padR - 28 ? "end" : "middle"
                }
                fontSize="9.5"
                fontWeight="800"
                fill={color}
              >
                ベスト {fmt(bestPoint.v)}
              </text>
            </g>
          )}

          {endValue && (
            <g>
              {showStart && (
                <>
                  <circle
                    cx={X(points[0])}
                    cy={Y(points[0])}
                    r={4}
                    fill="white"
                    stroke="#a1a1aa"
                    strokeWidth={2}
                  />
                  <text
                    x={X(points[0]) + 6}
                    y={Y(points[0]) - 9}
                    fontSize="10.5"
                    fontWeight="800"
                    fill="#8b8b93"
                    fontFamily="ui-monospace,Menlo,monospace"
                  >
                    最初 {fmt(points[0].v)}
                  </text>
                </>
              )}
              <text
                x={W - padR + 4}
                y={Y(points[points.length - 1]) + 4}
                fontSize="12"
                fontWeight="800"
                fill={color}
                fontFamily="ui-monospace,Menlo,monospace"
              >
                {fmt(points[points.length - 1].v)}
              </text>
            </g>
          )}

          {xTicks.map((p, j) => (
            <text
              key={j}
              x={X(p)}
              y={height - 5}
              textAnchor={j === 0 ? "start" : j === xCount - 1 ? "end" : "middle"}
              fontSize="9"
              fill="#a1a1aa"
              fontFamily="ui-monospace,Menlo,monospace"
            >
              {md(p.d)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f9f8] border border-[#eef1f0] px-2 py-1.5">
      <div className="text-[9px] font-bold text-zinc-500">{label}</div>
      <div className="text-[14px] font-bold font-mono text-zinc-800 leading-none mt-0.5">{value}</div>
    </div>
  );
}

export function MetricsCharts({
  weight,
  bodyFat,
  waist,
  range,
}: {
  weight: MetricPoint[];
  bodyFat: MetricPoint[];
  waist: MetricPoint[];
  range: MetricsRange;
}) {
  const [main, setMain] = useState<Key>("weight");
  const all: Record<Key, MetricPoint[]> = { weight, bodyFat, waist };

  const mainMeta = META[main];
  const mainAll = all[main];
  const mainStats = statsOf(mainAll);
  const mainView = filterRange(mainAll, range);
  const subKeys = (Object.keys(META) as Key[]).filter((k) => k !== main);

  return (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: "1.85fr 1fr" }}>
        {/* 主役 */}
        <div className="bg-white border border-[#e8ebe9] rounded-2xl px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-900 mb-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: mainMeta.color }} />
            {mainMeta.title}
          </div>

          {mainStats === null ? (
            <div className="py-10 text-center text-xs text-zinc-400">記録がありません</div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-2.5">
                <div className="text-[38px] font-extrabold font-mono text-zinc-900 leading-none">
                  {fmt(mainStats.last.v)}
                  <span className="text-[14px] font-bold text-zinc-400 ml-1">{mainMeta.unit}</span>
                </div>
                <div
                  className="rounded-xl px-3.5 py-2 text-center"
                  style={{ background: deltaBg(mainStats.delta) }}
                >
                  <div
                    className="text-[9.5px] font-extrabold mb-0.5"
                    style={{ color: deltaColor(mainStats.delta) }}
                  >
                    最初の記録から
                  </div>
                  <div
                    className="text-[26px] font-extrabold font-mono leading-none"
                    style={{ color: deltaColor(mainStats.delta) }}
                  >
                    {signed(mainStats.delta)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <StatBox label={`最初 (${md(mainStats.first.d)})`} value={fmt(mainStats.first.v)} />
                <StatBox label="ベスト" value={fmt(mainStats.lo)} />
                <StatBox label="最高" value={fmt(mainStats.hi)} />
              </div>

              <Chart
                points={mainView}
                color={mainMeta.color}
                height={250}
                yLabels
                firstDate={mainStats.first.d}
                bestValue={mainStats.lo}
                endValue
                xCount={6}
              />
            </>
          )}
        </div>

        {/* 脇役 (クリックで主役に) */}
        <div className="grid gap-2" style={{ gridTemplateRows: "1fr 1fr" }}>
          {subKeys.map((k) => {
            const meta = META[k];
            const st = statsOf(all[k]);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setMain(k)}
                aria-label={`${meta.short}を大きく表示`}
                className="text-left bg-white border border-[#e8ebe9] rounded-2xl px-2.5 pt-2.5 pb-1.5 hover:border-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-900 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                  {meta.short}
                </div>
                {st === null ? (
                  <div className="py-4 text-center text-[11px] text-zinc-400">記録なし</div>
                ) : (
                  <>
                    <div className="flex items-end gap-1.5 mb-0.5">
                      <div className="text-[23px] font-extrabold font-mono text-zinc-900 leading-none">
                        {fmt(st.last.v)}
                      </div>
                      <div
                        className="text-[12px] font-extrabold font-mono leading-none pb-0.5"
                        style={{ color: deltaColor(st.delta) }}
                      >
                        {signed(st.delta)}
                      </div>
                    </div>
                    <div className="text-[9.5px] font-mono text-zinc-400 mb-1">
                      最初 {fmt(st.first.v)} ・ ベスト {fmt(st.lo)}
                    </div>
                    <Chart
                      points={filterRange(all[k], range)}
                      color={meta.color}
                      height={104}
                      dots={false}
                      xCount={2}
                    />
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10.5px] text-zinc-400 mt-1.5">
        数値（最初 / ベスト / 最高 / 変化）は全期間の実績。グラフは選んだ期間のみ描いています。
      </p>
    </>
  );
}
