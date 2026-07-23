"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  computeForecast,
  projectWeight,
  etaForPace,
  SAFE_MAX,
  type ForecastPeriod,
} from "@/lib/body-metrics/forecast";
import { saveGoalBaselineFromRecord } from "@/lib/goal-sheet/actions";

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
// 修1: ペースは0.05刻みに丸め、0.05〜5.0にクランプ(5.0超は切り詰め)。
const PACE_MIN = 0.05;
const PACE_MAX = 5.0;
function clampPace(n: number): number {
  return Math.min(PACE_MAX, Math.max(PACE_MIN, roundStep(n)));
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
  staffPreview = false,
  nowMs,
}: {
  current: number | null;
  target: number | null;
  targetDate: string | null;
  /** 実測ペース kg/週(符号つき)。上部「現状ペース」ピルと同一値。<2記録は null */
  pace: number | null;
  /** 社員4人への仮反映(2026-07-21)。目標推移タブを両方向シミュレーターに差し替える。 */
  staffPreview?: boolean;
  /** hydration対策: サーバ確定の「今」(ms)。client側 Date.now() を廃し SSR/CSR一致。 */
  nowMs: number;
}) {
  const [tab, setTab] = useState<TrendTab>("goal");
  const [rangeKey, setRangeKey] = useState<RangeKey>("1w");
  // 「今」はサーバから受け取った固定値(client で Date.now() を呼ばない=hydration不一致を防ぐ)
  const now = nowMs;

  const realPaceAbs = pace != null ? Math.abs(pace) : null;
  // 目標推移のペース手入力(初期値=今の実ペース・0.05刻み・0.05〜5.0)。
  // inputPace=確定値(計算に使う)/ inputPaceStr=入力中の文字列(打っている間は変換しない)。
  const [inputPace, setInputPace] = useState<number>(() =>
    realPaceAbs != null ? clampPace(realPaceAbs) : 0.3
  );
  const [inputPaceStr, setInputPaceStr] = useState<string>(() =>
    (realPaceAbs != null ? clampPace(realPaceAbs) : 0.3).toFixed(2)
  );
  // 修1: 確定はblur/Enter時のみ。数値でない/0以下は元の値へ戻す→丸め→クランプ。
  function commitPace(raw: string) {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      setInputPaceStr(inputPace.toFixed(2));
      return;
    }
    const c = clampPace(v);
    setInputPace(c);
    setInputPaceStr(c.toFixed(2));
  }
  // ±ボタン: 0.05刻み(同じクランプを通す)。
  function stepPace(delta: number) {
    const c = clampPace(inputPace + delta);
    setInputPace(c);
    setInputPaceStr(c.toFixed(2));
  }

  // エッジ: 記録不足 / 目標(体重・日)未設定 は道のりを引けない
  const goalMs = targetDate ? Date.parse(targetDate) : null;
  if (current == null || pace == null) {
    return (
      <Shell white={staffPreview}>
        <p className="text-[12px] leading-relaxed text-[#6a6256]">
          記録が2回そろうと、ここに「このペースだと何kg」という道のりが出ます。
        </p>
      </Shell>
    );
  }
  if (target == null || goalMs == null || Number.isNaN(goalMs)) {
    return (
      <Shell white={staffPreview}>
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

  // 修2: チェックポイント(今日→レンジ刻み→到達日)。予測点は点線の丸。
  // 到達日以降の行は出さない(既存の < etaDays フィルタ維持)。
  // 社員4人仮反映(2026-07-22): 上限14点をやめ、到達日までの全点を表示。
  const cpCount =
    staffPreview && etaDays != null ? Math.max(1, Math.ceil(etaDays / step)) : 14;
  const interim = Array.from({ length: cpCount }, (_, i) => (i + 1) * step)
    .filter((d) => etaDays == null || d < etaDays)
    .map((d) => ({
      label: etaDateLabel(now + d * DAY, now),
      weight: projectWeight(current, signedPace, d),
    }));

  // 下カード3点セット(このペースだと/届きたい通過点/ひとこと)=computeForecast一発。
  const period: ForecastPeriod = { key: "1w", label: range.label, days: step };
  const fc = computeForecast(current, target, signedPace, now, goalMs, period);

  // 修3: 「このペースだと」は目標体重でクランプ(行き過ぎ禁止)。
  // 選択期間内に到達する場合はひとことを到達見込みに差し替え、state1〜4判定はスキップ。
  const reachedInPeriod = dir > 0 ? fc.predicted >= target : fc.predicted <= target;
  const predictedShown = reachedInPeriod ? round1(target) : fc.predicted;
  const messageShown =
    reachedInPeriod && etaMs != null
      ? `このペースなら ${etaDateLabel(etaMs, now)} に目標到達の見込みです`
      : fc.message;

  return (
    <Shell white={staffPreview}>
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

      {staffPreview && tab === "goal" ? (
        // 社員4人だけ: 両方向シミュレーター(目標日⇄ペースのシーソー・保存しない電卓)
        <TwoWayGoalBody
          current={current}
          initialTarget={target}
          initialGoalMs={goalMs}
          step={step}
          now={now}
        />
      ) : (
        <>
      {tab === "goal" ? (
        // 目標推移: ペース手入力ボックス + 安全域警告(修4)
        <>
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
                onClick={() => stepPace(-0.05)}
                className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-[17px] font-bold text-[#34603f]"
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={inputPaceStr}
                onChange={(e) => setInputPaceStr(e.target.value)}
                onBlur={(e) => commitPace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPace((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="h-11 w-16 rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-center font-mono text-[17px] font-extrabold text-[#2b2620] focus:outline-none"
              />
              <button
                type="button"
                aria-label="ペースを上げる"
                onClick={() => stepPace(0.05)}
                className="flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-[17px] font-bold text-[#34603f]"
              >
                ＋
              </button>
              <span className="text-[9px] font-bold text-[#a59b8c]">kg/週</span>
            </span>
          </div>
          {inputPace > SAFE_MAX && (
            <div className="mt-1.5 rounded-lg border border-[#f0e2b8] bg-[#fff8e1] px-3 py-2 text-[10.5px] font-bold leading-[1.5] text-[#8a6d10]">
              週0.8kgを超えるペースは体に負担が大きいことがあります。無理のない計画にしましょう
            </div>
          )}
        </>
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
      <div
        className={`mt-2.5 rounded-2xl border border-[#e7dcc9] p-[13px] ${
          staffPreview ? "bg-white" : "bg-[#fffdf8]"
        }`}
      >
        <div className="flex items-baseline gap-2 border-b border-dashed border-[#f0ead9] py-1.5">
          <span className="w-[120px] flex-none text-[11px] font-bold text-[#6a6256]">
            このペースだと
          </span>
          <span className="font-mono text-[18px] font-extrabold text-[#2b2620]">
            {predictedShown}
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
          {messageShown}
        </p>
      </div>
        </>
      )}
    </Shell>
  );
}

function Shell({
  children,
  white = false,
}: {
  children: React.ReactNode;
  /** 社員4人仮反映(2026-07-22): カードの地を白に */
  white?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#e7dcc9] p-[13px] ${
        white ? "bg-white" : "bg-[#fffdf8]"
      }`}
    >
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

// =====================================================================
// 社員4人への仮反映(2026-07-21): 目標推移タブ = 両方向シミュレーター
// モック: public/mock/goal-trend-simulator.html
//
// 目標体重・目標日・ペースを画面上で自由に動かせる「電卓」(保存しない)。
//   - 目標日を触る → 必要ペースが自動追従(driver="date")
//   - ペースを触る → 到達日が自動追従(driver="pace")
//   - 現在体重は最新の記録で固定・目標体重の初期値は目標シート。
// 記録画面はあくまで参考・確認(B=X)なので、ここでの変更は目標シートに書き戻さない。
// =====================================================================
function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function FieldRow({
  label,
  sub,
  auto = false,
  children,
}: {
  label: string;
  sub?: string;
  auto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-[11px] py-[9px]">
      <span className="flex-none text-[10.5px] font-extrabold leading-[1.3] text-[#6a6256]">
        {label}
        {auto && (
          <span className="ml-1 rounded-full border border-[#bcdcc6] bg-[#e2efe6] px-1.5 py-[1px] text-[8px] font-extrabold text-[#34603f]">
            自動
          </span>
        )}
        {sub && (
          <small className="block text-[8px] font-bold text-[#a59b8c]">{sub}</small>
        )}
      </span>
      {children}
    </div>
  );
}

/** 目標体重・ペースの −/＋ ステッパーボタン(共通・36px角) */
function StepBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-[16px] font-bold text-[#34603f]"
    >
      {children}
    </button>
  );
}

/** A1 ブラケットの見出しアイコン(鎖=連動) */
function LinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 12h6" />
      <path d="M10 8a4 4 0 0 0 0 8" />
      <path d="M14 8a4 4 0 0 1 0 8" />
    </svg>
  );
}

function TwoWayGoalBody({
  current,
  initialTarget,
  initialGoalMs,
  step,
  now,
}: {
  current: number;
  initialTarget: number;
  initialGoalMs: number;
  /** レンジ(1/7/30日)=チェックポイント間隔 */
  step: number;
  now: number;
}) {
  // 目標体重(編集可)
  const [tgt, setTgt] = useState<number>(round1(initialTarget));
  const [tgtStr, setTgtStr] = useState<string>(round1(initialTarget).toFixed(1));
  // シーソーの「今触っている側」。初期=目標日ドライブ→ペースが自動で出る(受講生の声)。
  const [driver, setDriver] = useState<"date" | "pace">("date");
  const [dateMs, setDateMs] = useState<number>(initialGoalMs);
  const [pace, setPace] = useState<number>(0.3);
  const [paceStr, setPaceStr] = useState<string>("0.30");
  // C1 連動ハイライト: 自動追従した側(follower)が変わった瞬間に光らせる。
  // n を増やすと follower 側の box が key 変化で再マウント → CSS アニメが再生。
  const [flash, setFlash] = useState<{ side: "date" | "pace" | null; n: number }>({
    side: null,
    n: 0,
  });
  const bumpFlash = (side: "date" | "pace") =>
    setFlash((f) => ({ side, n: f.n + 1 }));
  // 「基準を決定する」(案P): いじった目標を目標シートへ反映。
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const needed = round1(current - tgt); // 減量前提(>0で有効)
  const invalid = needed <= 0;

  // 依存の再計算: driver に応じて片方を導出。
  let effPace: number;
  let effDateMs: number;
  if (driver === "date") {
    const days = Math.max(1, Math.round((dateMs - now) / DAY));
    effPace = invalid ? 0 : clampPace(needed / (days / 7));
    effDateMs = dateMs;
  } else {
    effPace = Math.max(PACE_MIN, pace);
    const days = invalid ? 0 : Math.ceil(needed / (effPace / 7));
    effDateMs = now + days * DAY;
  }

  // ペース入力の表示値: driver=date は導出値を直接表示(state不要)、
  // driver=pace は手入力中の文字列(paceStr)を表示。→ setState-in-effect を避ける。
  const paceInputValue = driver === "date" ? effPace.toFixed(2) : paceStr;

  function commitPace(raw: string) {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      setPaceStr((driver === "date" ? effPace : pace).toFixed(2));
      return;
    }
    const c = clampPace(v);
    setDriver("pace");
    setPace(c);
    setPaceStr(c.toFixed(2));
    bumpFlash("date"); // ペースを確定 → 目標日が自動追従して光る
  }
  function stepPace(delta: number) {
    const base = driver === "date" ? effPace : pace;
    const c = clampPace(base + delta);
    setDriver("pace");
    setPace(c);
    setPaceStr(c.toFixed(2));
    bumpFlash("date");
  }
  function commitTgt(raw: string) {
    const v = Number(raw);
    if (!Number.isFinite(v)) {
      setTgtStr(tgt.toFixed(1));
      return;
    }
    setTgt(round1(v));
    setTgtStr(round1(v).toFixed(1));
    bumpFlash(driver === "date" ? "pace" : "date"); // 目標体重変更 → 自動側が再計算して光る
  }
  function stepTgt(delta: number) {
    const c = round1(tgt + delta);
    setTgt(c);
    setTgtStr(c.toFixed(1));
    bumpFlash(driver === "date" ? "pace" : "date");
  }

  const days = Math.round((effDateMs - now) / DAY);
  const overSafe = effPace > SAFE_MAX;

  // 初期値(=目標シート)から変わっている時だけ「基準を決定する」を押せる。
  const dirty = tgt !== round1(initialTarget) || effDateMs !== initialGoalMs;
  function decide() {
    setSaveMsg(null);
    startSave(async () => {
      const r = await saveGoalBaselineFromRecord(round1(tgt), isoDate(effDateMs));
      if (r.ok) {
        setSaveMsg({ ok: true, text: "✓ 基準を決定しました" });
        router.refresh();
      } else {
        setSaveMsg({ ok: false, text: r.message });
      }
    });
  }

  // チェックポイント(今日→レンジ刻み→到達日)。社員4人仮反映: 上限なしで全点表示。
  const interim = invalid
    ? []
    : Array.from(
        { length: Math.max(0, Math.ceil(days / step) - 1) },
        (_, i) => (i + 1) * step
      )
        .filter((d) => d < days)
        .map((d) => ({
          label: etaDateLabel(now + d * DAY, now),
          weight: round1(current - effPace * (d / 7)),
        }));

  return (
    <>
      {/* 設定フィールド。縦の列を揃える = [ラベル | 固定幅クラスター(148px) | 単位(36px)]。
          現在体重・目標日 = −〜＋の端まで貫く1枚箱 / 目標体重・ペース = [−][箱][＋]。
          目標日+ペースは連動する一組なので A1 ブラケット(見出し+左アクセント+背景)でくくる。 */}
      <div className="mt-[9px] rounded-xl border border-[#e8ede4] bg-[#f6f8f4] p-1.5">
        <div className="divide-y divide-[#e8ede4]">
          {/* 現在体重: 読み取り専用の広い箱(−〜＋幅)。目標体重の箱列と完璧整列。 */}
          <FieldRow label="現在体重" sub="最新の記録">
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex w-[148px] items-center justify-end">
                <span className="flex h-9 w-full items-center justify-center rounded-[10px] border-[1.5px] border-[#e3e7e0] bg-[#eef1ec] font-mono text-[15px] font-extrabold text-[#4a4436]">
                  {round1(current).toFixed(1)}
                </span>
              </span>
              <span className="w-9 text-left text-[9px] font-bold text-[#a59b8c]">kg</span>
            </span>
          </FieldRow>
          {/* 目標体重: [−][箱][＋] 刻み0.1 */}
          <FieldRow label="目標体重" sub="初期=目標シート">
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex w-[148px] items-center gap-1.5">
                <StepBtn label="目標体重を下げる" onClick={() => stepTgt(-0.1)}>
                  −
                </StepBtn>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tgtStr}
                  onChange={(e) => setTgtStr(e.target.value)}
                  onBlur={(e) => commitTgt(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-center font-mono text-[15px] font-extrabold text-[#2b2620] focus:outline-none"
                />
                <StepBtn label="目標体重を上げる" onClick={() => stepTgt(0.1)}>
                  ＋
                </StepBtn>
              </span>
              <span className="w-9 text-left text-[9px] font-bold text-[#a59b8c]">kg</span>
            </span>
          </FieldRow>
        </div>

        {/* 連動ブラケット: 目標日 ⇄ ペース(背景の色差のみ・左の縦線は無し) */}
        <div className="mt-1.5 rounded-[12px] bg-[#eef6f0] pb-0.5">
          <div className="flex items-center gap-1 px-[11px] pt-2 pb-1 text-[9px] font-extrabold tracking-wide text-[#34603f]">
            <LinkIcon />
            各数値の増減を反映します。
          </div>
          <div className="divide-y divide-[#d7e6dc]">
            {/* 目標日: 広い箱(−〜＋幅)・太字。driver=pace のとき自動追従して光る */}
            <FieldRow label="目標日" auto={driver === "pace"}>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="flex w-[148px]">
                  <input
                    key={`date-${flash.side === "date" ? flash.n : 0}`}
                    type="date"
                    value={isoDate(effDateMs)}
                    onChange={(e) => {
                      const ms = Date.parse(`${e.target.value}T00:00:00`);
                      if (!Number.isNaN(ms)) {
                        setDriver("date");
                        setDateMs(ms);
                        bumpFlash("pace"); // 目標日を変更 → ペースが自動追従して光る
                      }
                    }}
                    className={`goal-date h-9 w-full rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white px-2 text-[13px] font-bold text-[#2b2620] focus:outline-none ${
                      driver === "pace" ? "goal-flash" : ""
                    }`}
                  />
                </span>
                <span className="w-9" aria-hidden="true" />
              </span>
            </FieldRow>
            {/* ペース: [−][箱][＋] 刻み0.05。driver=date のとき自動追従して光る */}
            <FieldRow label="ペース" auto={driver === "date"}>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="flex w-[148px] items-center gap-1.5">
                  <StepBtn label="ペースを下げる" onClick={() => stepPace(-0.05)}>
                    −
                  </StepBtn>
                  <input
                    key={`pace-${flash.side === "pace" ? flash.n : 0}`}
                    type="text"
                    inputMode="decimal"
                    value={paceInputValue}
                    onChange={(e) => {
                      setDriver("pace");
                      setPaceStr(e.target.value);
                    }}
                    onBlur={(e) => commitPace(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitPace((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className={`h-9 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-[#cfe0d4] bg-white text-center font-mono text-[15px] font-extrabold text-[#2b2620] focus:outline-none ${
                      driver === "date" ? "goal-flash" : ""
                    }`}
                  />
                  <StepBtn label="ペースを上げる" onClick={() => stepPace(0.05)}>
                    ＋
                  </StepBtn>
                </span>
                <span className="w-9 text-left text-[9px] font-bold text-[#a59b8c]">kg/週</span>
              </span>
            </FieldRow>
          </div>
        </div>
      </div>

      {invalid && (
        <div className="mt-1.5 rounded-lg border border-[#f2c4c0] bg-[#fdf1ef] px-3 py-2 text-[10.5px] font-bold leading-[1.5] text-[#c0392b]">
          目標体重は現在体重より軽い値にしてください
        </div>
      )}
      {!invalid && overSafe && (
        <div className="mt-1.5 rounded-lg border border-[#f0e2b8] bg-[#fff8e1] px-3 py-2 text-[10.5px] font-bold leading-[1.5] text-[#8a6d10]">
          週0.8kgを超えるペースは体に負担が大きいことがあります。無理のない計画にしましょう
        </div>
      )}

      {!invalid && (
        <>
          {/* チェックポイント縦ライン */}
          <ol className="relative mt-2.5 pl-5">
            <CheckItem
              label="今日"
              weight={`${round1(current)} kg`}
              tag="起点"
              kind="today"
              first
            />
            {interim.map((p, i) => (
              <CheckItem key={i} label={p.label} weight={`${p.weight} kg`} kind="est" />
            ))}
            <CheckItem
              label={etaDateLabel(effDateMs, now)}
              weight={`${round1(tgt)} kg`}
              tag={driver === "date" ? "目標日＝到達" : "このペースの到達日"}
              kind="goal"
              last
            />
          </ol>

          {/* 下カード: ドライブ側に応じて主役を切替(必要ペース ⇄ 到達日) */}
          <div className="mt-2.5 rounded-2xl border border-[#e7dcc9] bg-white p-[13px]">
            <div className="flex items-baseline gap-2 py-1.5">
              <span className="w-[150px] flex-none text-[11px] font-bold text-[#6a6256]">
                {driver === "date" ? "目標日に間に合う必要ペース" : "このペースの到達日"}
              </span>
              <span className="font-mono text-[18px] font-extrabold text-[#2b2620]">
                {driver === "date" ? (
                  <>
                    {effPace.toFixed(2)}
                    <small className="text-[10px] font-bold text-[#a59b8c]"> kg/週</small>
                  </>
                ) : (
                  <>
                    {etaDateLabel(effDateMs, now)}
                    <small className="text-[10px] font-bold text-[#a59b8c]"> ごろ</small>
                  </>
                )}
              </span>
            </div>
            <p
              className={`mt-[9px] rounded-[11px] border px-3 py-[9px] text-[11.5px] font-bold leading-[1.6] ${
                overSafe
                  ? "border-[#f0e2b8] bg-[#fff8e1] text-[#8a6d10]"
                  : "border-[#cfe3d6] bg-[#e8f3ec] text-[#34603f]"
              }`}
            >
              {overSafe
                ? "急がなくて大丈夫。目標日を少し後ろにすると、無理のないペースになります"
                : effPace > 0.5
                  ? "ややしっかりめのペースです。体調を見ながらいきましょう"
                  : "いいペースです。この調子でいきましょう"}
            </p>
          </div>

          {/* 基準を決定する: いじった目標体重・目標日を公式の目標に反映(案P) */}
          <button
            type="button"
            onClick={decide}
            disabled={isSaving || !dirty}
            className="btn3d mt-2.5 w-full rounded-xl py-3 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {isSaving ? "決定中…" : "基準を決定する"}
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-[1.5] text-[#a59b8c]">
            {dirty
              ? "決定時点の数値が残り続けます。"
              : "目標体重や目標日を変えると、ここで目標を更新できます"}
          </p>
          {saveMsg && (
            <p
              className={`mt-1 text-center text-[11px] font-bold ${
                saveMsg.ok ? "text-[#34603f]" : "text-[#c0392b]"
              }`}
            >
              {saveMsg.text}
            </p>
          )}
        </>
      )}
    </>
  );
}
