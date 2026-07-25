"use client";

import { useEffect, useState } from "react";

/**
 * カレンダー体組成グラフ (二軸)。記録画面 BodyMetricsChart のスタイルを踏襲:
 *   - SVG 自前・グリッド水平線・白丸ドット(stroke色)・初回のみ左から描くアニメ・monospace軸ラベル
 * 拡張:
 *   - 体重(緑・右軸kg) + ウエスト(青・左軸cm) の2本を別スケールで同時表示
 *   - 選択日(selectedDate)に縦破線 + 両線の点を強調
 */
const W = 360;
const H = 200;
const PAD = { top: 16, right: 40, bottom: 26, left: 40 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

type Pt = { date: string; weight: number | null; waist: number | null; fat: number | null };

export function CalendarBodyChart({
  series,
  selectedDate,
}: {
  series: Pt[];
  selectedDate: string;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (series.length === 0) {
    return <div className="empty">体組成の記録がまだありません</div>;
  }

  const ws = series.map((s) => s.weight).filter((v): v is number => v != null);
  const ss = series.map((s) => s.waist).filter((v): v is number => v != null);
  const hasW = ws.length > 0;
  const hasS = ss.length > 0;
  const wMin = hasW ? Math.min(...ws) - 0.5 : 0;
  const wMax = hasW ? Math.max(...ws) + 0.5 : 1;
  const sMin = hasS ? Math.min(...ss) - 1 : 0;
  const sMax = hasS ? Math.max(...ss) + 1 : 1;
  const wSpan = Math.max(wMax - wMin, 0.5);
  const sSpan = Math.max(sMax - sMin, 1);

  const n = series.length;
  const xOf = (i: number) => (n === 1 ? PAD.left + CW / 2 : PAD.left + (i / (n - 1)) * CW);
  const yW = (v: number) => PAD.top + (1 - (v - wMin) / wSpan) * CH;
  const yS = (v: number) => PAD.top + (1 - (v - sMin) / sSpan) * CH;

  const wPts = series
    .map((s, i) => (s.weight != null ? { x: xOf(i), y: yW(s.weight) } : null))
    .filter((p): p is { x: number; y: number } => p != null);
  const sPts = series
    .map((s, i) => (s.waist != null ? { x: xOf(i), y: yS(s.waist) } : null))
    .filter((p): p is { x: number; y: number } => p != null);
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const selIdx = series.findIndex((s) => s.date === selectedDate);
  const selX = selIdx >= 0 ? xOf(selIdx) : null;
  const selW = selIdx >= 0 ? series[selIdx].weight : null;
  const selS = selIdx >= 0 ? series[selIdx].waist : null;

  const xc = Math.min(5, n);
  const xLabels = Array.from({ length: xc }, (_, i) => {
    const idx = Math.floor((i * (n - 1)) / Math.max(xc - 1, 1));
    const d = new Date(series[idx].date + "T00:00:00Z");
    return { x: xOf(idx), label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}` };
  });

  const dash = {
    strokeDasharray: 1,
    strokeDashoffset: drawn ? 0 : 1,
    transition: "stroke-dashoffset 1000ms ease-out",
  } as const;
  const dotStyle = (delay: string) => ({
    opacity: drawn ? 1 : 0,
    transition: `opacity 400ms ease-out ${delay}`,
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* グリッド水平線 */}
      {TICKS.map((t, i) => (
        <line
          key={`g${i}`}
          x1={PAD.left}
          x2={PAD.left + CW}
          y1={PAD.top + t * CH}
          y2={PAD.top + t * CH}
          stroke="#f3f4f6"
          strokeWidth="1"
          strokeDasharray={i === 4 ? "0" : "2,3"}
        />
      ))}

      {/* 左軸 = ウエスト(青) */}
      {hasS &&
        TICKS.map((t, i) => (
          <text key={`sl${i}`} x={PAD.left - 4} y={PAD.top + t * CH + 3} textAnchor="end" fill="#3f6fd8" fontSize="9" fontFamily="ui-monospace, monospace">
            {(sMax - t * sSpan).toFixed(0)}
          </text>
        ))}
      {hasS && (
        <text x={PAD.left - 4} y={PAD.top - 5} textAnchor="end" fill="#3f6fd8" fontSize="8" fontWeight="700">
          cm
        </text>
      )}

      {/* 右軸 = 体重(緑) */}
      {hasW &&
        TICKS.map((t, i) => (
          <text key={`wl${i}`} x={PAD.left + CW + 4} y={PAD.top + t * CH + 3} textAnchor="start" fill="#34603f" fontSize="9" fontFamily="ui-monospace, monospace">
            {(wMax - t * wSpan).toFixed(1)}
          </text>
        ))}
      {hasW && (
        <text x={PAD.left + CW + 4} y={PAD.top - 5} textAnchor="start" fill="#34603f" fontSize="8" fontWeight="700">
          kg
        </text>
      )}

      {/* 選択日 縦破線 */}
      {selX != null && (
        <line x1={selX} x2={selX} y1={PAD.top} y2={PAD.top + CH} stroke="#d8cdbb" strokeWidth="1" strokeDasharray="2 2" />
      )}

      {/* ウエスト線(青) → 体重線(緑) の順で描画(体重を前面に) */}
      {sPts.length > 0 && (
        <path d={toPath(sPts)} fill="none" stroke="#3f6fd8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" pathLength={1} style={dash} />
      )}
      {wPts.length > 0 && (
        <path d={toPath(wPts)} fill="none" stroke="#4a875b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={dash} />
      )}

      {/* ドット(白丸+stroke) */}
      {sPts.map((p, i) => (
        <circle key={`sd${i}`} cx={p.x} cy={p.y} r="3" fill="white" stroke="#3f6fd8" strokeWidth="1.8" style={dotStyle("700ms")} />
      ))}
      {wPts.map((p, i) => (
        <circle key={`wd${i}`} cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#4a875b" strokeWidth="2" style={dotStyle("700ms")} />
      ))}

      {/* 選択日 強調点 */}
      {selS != null && selX != null && (
        <circle cx={selX} cy={yS(selS)} r="5.5" fill="#3f6fd8" stroke="#fff" strokeWidth="2" />
      )}
      {selW != null && selX != null && (
        <circle cx={selX} cy={yW(selW)} r="5.5" fill="#4a875b" stroke="#fff" strokeWidth="2" />
      )}

      {/* X軸ラベル(日付) */}
      {xLabels.map((l, i) => (
        <text key={`xl${i}`} x={l.x} y={H - 8} textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="ui-monospace, monospace">
          {l.label}
        </text>
      ))}
    </svg>
  );
}
