"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FORECAST_PERIODS,
  type ForecastPeriod,
  computeForecast,
  buildRoadmap,
  etaForPace,
  mdLabel,
  SAFE_MIN,
  SAFE_MAX,
} from "@/lib/body-metrics/forecast";

/**
 * 体重「見通し」カード (M20・確定版・ベータ限定)。
 * 1階=期間チップ+予測+通過点+4状態メッセージ。
 * 2階(折りたたみ)=道のり表(リスト⇄グラフ・今日起点で引き直し)+ペース試算(実測/定型/手入力・安全域警告)。
 * 旧「体重を指定して計算」シートはベータでは出さない(この試算が代替)。
 */

const TEAL = "#4a875b";
const TEAL_DARK = "#34603f";
const GOLD = "#b0870f";

type PacePreset = { key: string; label: string; value: number | null };

export function ForecastCard({
  current,
  target,
  targetDate,
  pace,
}: {
  current: number | null;
  target: number | null;
  targetDate: string | null;
  /** 実測ペース kg/週(符号つき)。<2記録は null */
  pace: number | null;
}) {
  const [periodKey, setPeriodKey] = useState<ForecastPeriod["key"]>("1w");
  const [open, setOpen] = useState(false);
  const [roadView, setRoadView] = useState<"list" | "graph">("list");
  const [paceKey, setPaceKey] = useState<string>("now");
  const [manual, setManual] = useState<number | null>(null);

  // レンダー中の Date.now() は不純のため初回だけ確定(この画面の寿命では十分)
  const [now] = useState(() => Date.now());
  const goalMs = targetDate ? Date.parse(targetDate) : null;
  const paceAbs = pace != null ? Math.abs(pace) : null;

  // エッジ: 記録不足 / 目標未設定
  if (current == null || pace == null) {
    return (
      <Shell>
        <p className="text-[12px] leading-relaxed text-[#6a6256]">
          記録が2回そろうと、ここに「このペースだと何kg」という見通しが出ます。
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

  const period =
    FORECAST_PERIODS.find((p) => p.key === periodKey) ?? FORECAST_PERIODS[0];
  const fc = computeForecast(current, target, pace, now, goalMs, period);
  const roadmap = buildRoadmap(current, target, now, goalMs);

  const presets: PacePreset[] = [
    { key: "now", label: "今のペース", value: paceAbs },
    { key: "slow", label: "ゆっくり", value: 0.3 },
    { key: "std", label: "標準", value: 0.5 },
    { key: "hard", label: "しっかり", value: 0.7 },
    { key: "manual", label: "自分で入力", value: manual },
  ];
  const selectedPace = presets.find((p) => p.key === paceKey)?.value ?? paceAbs;
  const paceEtaMs =
    selectedPace != null ? etaForPace(current, target, selectedPace, now) : null;
  const unsafe =
    selectedPace != null && (selectedPace < SAFE_MIN || selectedPace > SAFE_MAX);

  return (
    <Shell>
      {/* 期間チップ */}
      <div className="flex flex-wrap gap-1.5">
        {FORECAST_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriodKey(p.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              p.key === periodKey
                ? "bg-[#4a875b] text-white"
                : "bg-[#f0ece2] text-[#6a6256]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 3行: 見通し / 通過点 / メッセージ */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-[#6a6256]">
            {period.label}後の見通し
          </span>
          <span className="text-[18px] font-extrabold" style={{ color: TEAL_DARK }}>
            {fc.predicted}
            <span className="ml-0.5 text-[11px] font-bold text-[#a59b8c]">kg</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-[#6a6256]">目標への通過点</span>
          <span className="text-[13px] font-bold text-[#5b5344]">
            {fc.checkpoint}kg
            <span className="ml-2 text-[10px] font-medium text-[#a59b8c]">
              目標 {mdLabel(goalMs)}・{target}kg
            </span>
          </span>
        </div>
        <p className="rounded-lg bg-[#faf7f0] px-3 py-2 text-[11.5px] font-bold leading-relaxed text-[#5b5344]">
          {fc.message}
        </p>
      </div>

      {/* 2階トグル */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-center gap-1 text-[12px] font-bold text-[#4a875b]"
      >
        {open ? "とじる" : "道のりをくわしく見る"}
        <span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-[#efe7d6] pt-3">
          {/* 道のり: リスト⇄グラフ */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#5b5344]">
                目標への道のり
              </span>
              <div className="flex gap-1 rounded-full bg-[#f0ece2] p-0.5">
                {(["list", "graph"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRoadView(v)}
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                      roadView === v ? "bg-white text-[#34603f]" : "text-[#a59b8c]"
                    }`}
                  >
                    {v === "list" ? "リスト" : "グラフ"}
                  </button>
                ))}
              </div>
            </div>

            {roadView === "list" ? (
              <ul className="space-y-1">
                {roadmap.map((pt, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px]"
                    style={{
                      background:
                        pt.kind === "next" ? "#eef5f0" : pt.kind === "goal" ? "#faf5e6" : "transparent",
                    }}
                  >
                    <span className="text-[#6a6256]">{pt.label}</span>
                    <span className="flex items-center gap-2">
                      <b className="font-mono text-[#2b2620]">{pt.weight}kg</b>
                      {pt.kind === "today" && (
                        <span className="text-[10px] text-[#a59b8c]">通過ずみ</span>
                      )}
                      {pt.kind === "next" && (
                        <span className="text-[10px] font-bold" style={{ color: TEAL }}>
                          次の通過点
                        </span>
                      )}
                      {pt.kind === "goal" && (
                        <span className="text-[10px] font-bold" style={{ color: GOLD }}>
                          目標
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <RoadmapGraph
                current={current}
                target={target}
                predictedAtGoal={
                  computeForecast(
                    current,
                    target,
                    pace,
                    now,
                    goalMs,
                    FORECAST_PERIODS[4]
                  ).predicted
                }
              />
            )}
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#a59b8c]">
              この道は毎回「今日の体重」から引き直されます（遅れの借金は積みません）。今のペースが続いた場合の目安です。
            </p>
          </div>

          {/* ペース試算 */}
          <div>
            <div className="mb-2 text-[12px] font-bold text-[#5b5344]">
              ペースを変えたら、いつ着く？
            </div>
            <div className="mb-1 text-[10.5px] text-[#a59b8c]">
              あなたの今のペース：週{paceAbs}kg（直近の実績）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPaceKey(p.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    p.key === paceKey
                      ? "bg-[#34603f] text-white"
                      : "bg-[#f0ece2] text-[#6a6256]"
                  }`}
                >
                  {p.label}
                  {p.value != null && p.key !== "manual"
                    ? ` 週${p.value}`
                    : p.key === "manual" && manual != null
                      ? ` 週${manual}`
                      : ""}
                </button>
              ))}
            </div>

            {paceKey === "manual" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-[#6a6256]">週</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.05}
                  min={0}
                  value={manual ?? ""}
                  onChange={(e) =>
                    setManual(e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="0.6"
                  className="w-20 rounded-lg border border-[#e7dcc9] bg-white px-2 py-1 text-[13px] focus:border-[#4a875b] focus:outline-none"
                />
                <span className="text-[11px] text-[#6a6256]">kg（0.05刻み）</span>
              </div>
            )}

            {/* 結果 */}
            <div className="mt-2 rounded-lg bg-[#faf7f0] px-3 py-2">
              {selectedPace == null || selectedPace < 0.01 ? (
                <p className="text-[11.5px] text-[#6a6256]">
                  ペースを選ぶと、到達日の目安が出ます。
                </p>
              ) : paceEtaMs == null ? (
                <p className="text-[11.5px] text-[#6a6256]">
                  このペースでは目標体重に近づきません。
                </p>
              ) : (
                <p className="text-[11.5px] font-bold leading-relaxed text-[#5b5344]">
                  週{selectedPace}kgなら{" "}
                  <span style={{ color: TEAL_DARK }}>{mdLabel(paceEtaMs)}</span> に{" "}
                  {target}kg
                </p>
              )}
              {unsafe && selectedPace != null && selectedPace >= 0.01 && (
                <p className="mt-1 text-[10.5px] font-bold leading-relaxed text-[#b0640f]">
                  週{SAFE_MIN}〜{SAFE_MAX}kgが無理のない範囲です。体に負担が大きいペースは、おすすめしません。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 医療ただし書きは体組成では既存の運用に準拠(食事側で常設)。ここでは煽らないトーンのみ。 */}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4">
      <div className="mb-2 text-[12px] font-bold text-[#5b5344]">体重の見通し</div>
      {children}
    </div>
  );
}

/** 2本線グラフ: 今日→目標日 で「今のペースの先(緑点線)」と「目標への道(金点線)」 */
function RoadmapGraph({
  current,
  target,
  predictedAtGoal,
}: {
  current: number;
  target: number;
  predictedAtGoal: number;
}) {
  const W = 300;
  const H = 120;
  const pad = { l: 8, r: 8, t: 14, b: 18 };
  const vals = [current, target, predictedAtGoal];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(0.5, max - min);
  const y = (v: number) =>
    pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const x0 = pad.l;
  const x1 = W - pad.r;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* 今のペースの先(緑点線) */}
      <line
        x1={x0}
        y1={y(current)}
        x2={x1}
        y2={y(predictedAtGoal)}
        stroke={TEAL}
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      {/* 目標への道(金点線) */}
      <line
        x1={x0}
        y1={y(current)}
        x2={x1}
        y2={y(target)}
        stroke={GOLD}
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      {/* 今日の点 */}
      <circle cx={x0} cy={y(current)} r={3.5} fill={TEAL_DARK} />
      <text x={x0} y={y(current) - 6} fontSize="9" fill="#5b5344">
        {current}kg(今日)
      </text>
      {/* 終点ラベル */}
      <text x={x1} y={y(predictedAtGoal) - 6} fontSize="9" fill={TEAL} textAnchor="end">
        このペース {predictedAtGoal}
      </text>
      <text x={x1} y={y(target) + 12} fontSize="9" fill={GOLD} textAnchor="end">
        目標 {target}
      </text>
    </svg>
  );
}
