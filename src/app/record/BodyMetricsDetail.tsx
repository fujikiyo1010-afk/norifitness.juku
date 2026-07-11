"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { BodyMetricRow } from "@/lib/body-metrics/queries";
import { deleteBodyMetric } from "@/lib/body-metrics/actions";
import { useRefreshOnReturn } from "@/lib/hooks/useRefreshOnReturn";
import type { BodyPhotoSummary } from "@/lib/body-photos/queries";
import {
  weightGoalProgress,
  weightPaceKgPerWeek,
  weightEta,
  etaForTarget,
} from "@/lib/body-metrics/goal-progress";
import { BodyMetricsChart } from "./BodyMetricsChart";
import { ProgressTrendCard } from "./ProgressTrendCard";
import { BottomSheet } from "./BottomSheet";
import { RecordSheetBody } from "./RecordSheetBody";
import { RecordFab } from "./RecordFab";

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
  targetDate = null,
  photoSummary,
  isBeta = false,
  nowMs,
}: {
  rows: BodyMetricRow[]; // recorded_at 昇順
  targetWeightKg: number | null;
  /** 目標日 ISO (goal_selection.target_date)。M20 見通しカード用。 */
  targetDate?: string | null;
  photoSummary: BodyPhotoSummary;
  /** 体1(戻るで閉じる)・体13(ホイール—)のベータ出し分け。裏側(画像再取得)は全体。 */
  isBeta?: boolean;
  /** hydration対策: サーバ確定の「今」(ms)。予測日はこれ基準で SSR/CSR 一致。 */
  nowMs: number;
}) {
  const [tab, setTab] = useState<Tab>("weight");
  const [calcOpen, setCalcOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  // ② 保存/削除トースト  ① 誤日付記録の削除(2段階確認)
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();
  // 体4: 長時間離れて復帰したら署名URLを取り直す(写真の1時間切れ対策)
  useRefreshOnReturn();
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };
  const confirmDelete = (id: string) =>
    startDelete(async () => {
      const r = await deleteBodyMetric(id);
      setPendingDelete(null);
      if (r.ok) {
        showToast("記録を削除しました");
        router.refresh();
      } else {
        showToast(r.message);
      }
    });

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
  const eta = weightEta(currentWeight, targetWeightKg, pace, nowMs);

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
      {/* ② トースト (保存/削除の反応) */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-[#34603f] px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      )}
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
          targetDate={targetDate}
          ringPct={ringPct}
          pace={pace}
          prog={prog}
          eta={eta}
          isBeta={isBeta}
          nowMs={nowMs}
          onOpenCalc={() => setCalcOpen(true)}
        />
      ) : (
        <WaistView waistRows={waistRows} photoSummary={photoSummary} />
      )}

      {/* ① 最近の記録 (誤った日付の記録を削除・2段階確認) */}
      <RecentRecords
        rows={rows}
        pendingDelete={pendingDelete}
        deleting={isDeleting}
        onAsk={setPendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      {/* 最下行の削除ボタンが右下FABと重ならないための余白 */}
      <div className="h-20" aria-hidden="true" />

      {/* 記録する (右下フローティング・常駐) → 下からせり上がる入力シート。両タブで表示。 */}
      <RecordFab onClick={() => setRecordOpen(true)} />

      {/* 記録入力シート */}
      <BottomSheet
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="今日の記録"
        backClose={isBeta}
      >
        <RecordSheetBody
          initialWeight={latest?.weight_kg ?? null}
          initialBodyFat={latest?.body_fat_percent ?? null}
          initialWaist={latest?.waist_cm ?? null}
          isBeta={isBeta}
          onSaved={() => {
            setRecordOpen(false);
            showToast("記録しました");
          }}
        />
      </BottomSheet>

      {/* 計算シート (体重を指定して逆算) */}
      <BottomSheet
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        title="体重を指定して計算"
        backClose={isBeta}
      >
        <CalcSheetBody currentWeight={currentWeight} pace={pace} nowMs={nowMs} />
      </BottomSheet>
    </div>
  );
}

function WeightView({
  weightRows,
  startWeight,
  currentWeight,
  targetWeightKg,
  targetDate,
  ringPct,
  pace,
  prog,
  eta,
  isBeta,
  nowMs,
  onOpenCalc,
}: {
  weightRows: BodyMetricRow[];
  startWeight: number | null;
  currentWeight: number | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  ringPct: number | null;
  pace: number | null;
  prog: ReturnType<typeof weightGoalProgress>;
  eta: ReturnType<typeof weightEta>;
  isBeta: boolean;
  nowMs: number;
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
            {/* ★1: 円の中の内側を完全な白(#ffffff)に */}
            <circle cx="62" cy="62" r={R} fill="#ffffff" />
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

      {/* ピル2つ (目標まで / 現状ペース)。★2: 数値を大きく・ラベルと単位を小さく(数字だけ主役) */}
      <div className="mt-3 flex gap-2.5">
        <div className="flex-1 rounded-[14px] border border-[#dce9e0] bg-[#eef5f0] px-1.5 py-[9px] text-center leading-[1.2]">
          <div className="text-[9px] font-bold text-[#a59b8c]">目標まで</div>
          <div className="mt-0.5 font-mono text-[23px] font-extrabold text-[#004d40]">
            {prog.state === "remaining" ? (
              <>
                <span className="mr-0.5 text-[11px] font-bold text-[#6a6256]">
                  あと
                </span>
                {fmt(prog.kg)}
                <small className="text-[11px] font-bold text-[#6a6256]">kg</small>
              </>
            ) : prog.state === "reached" ? (
              "達成"
            ) : prog.state === "no_target" ? (
              "未設定"
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="flex-1 rounded-[14px] border border-[#dce9e0] bg-[#eef5f0] px-1.5 py-[9px] text-center leading-[1.2]">
          <div className="text-[9px] font-bold text-[#a59b8c]">現状ペース</div>
          <div className="mt-0.5 font-mono text-[23px] font-extrabold text-[#004d40]">
            {pace != null ? (
              <>
                {pace > 0 ? "+" : ""}
                {fmt(pace)}
                <small className="text-[11px] font-bold text-[#6a6256]">
                  kg/週
                </small>
              </>
            ) : (
              "—"
            )}
          </div>
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
        <div className="rounded-2xl border border-[#e7dcc9] bg-white px-3 pt-4 pb-3">
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

      {/* M20改: ベータは新「目標推移/現状推移」タブ切替リスト。旧=予測カードA-2+計算シート。 */}
      {isBeta ? (
        <ProgressTrendCard
          current={currentWeight}
          target={targetWeightKg}
          targetDate={targetDate}
          pace={pace}
          nowMs={nowMs}
        />
      ) : (
        <>
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
      )}
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
  nowMs,
}: {
  currentWeight: number | null;
  pace: number | null;
  nowMs: number;
}) {
  const [input, setInput] = useState<string>(
    currentWeight != null ? String(Math.round(currentWeight - 2)) : ""
  );
  const target = input.trim() ? Number(input) : null;
  const result =
    target != null && Number.isFinite(target)
      ? etaForTarget(currentWeight, target, pace, nowMs)
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
      <div className="flex justify-around rounded-2xl border border-[#e7dcc9] bg-white py-4 text-[11px]">
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
        <div className="rounded-2xl border border-[#e7dcc9] bg-white px-3 pt-4 pb-3">
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

// ① 最近の記録リスト (誤った日付の記録を削除・2段階確認)
function RecentRecords({
  rows,
  pendingDelete,
  deleting,
  onAsk,
  onCancel,
  onConfirm,
}: {
  rows: BodyMetricRow[];
  pendingDelete: string | null;
  deleting: boolean;
  onAsk: (id: string) => void;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  const recent = [...rows].reverse().slice(0, 12); // 新しい順・直近12件
  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-3">
      <div className="mb-0.5 px-0.5 text-[12px] font-bold text-[#5b5344]">最近の記録</div>
      <div className="mb-2 px-0.5 text-[10px] text-[#a59b8c]">
        間違えた日付の記録はここから削除できます
      </div>
      <ul className="divide-y divide-[#efe6d4]">
        {recent.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-2 text-[12px]">
            <span className="w-12 flex-none font-mono text-[#6a6256]">
              {Number(r.recorded_at.slice(5, 7))}/{Number(r.recorded_at.slice(8, 10))}
            </span>
            <span className="flex-1 truncate text-[#2b2620]">
              {r.weight_kg != null && <b className="font-mono">{r.weight_kg}kg</b>}
              {r.waist_cm != null && (
                <span className="ml-2 text-[#6a6256]">W{r.waist_cm}cm</span>
              )}
              {r.body_fat_percent != null && (
                <span className="ml-2 text-[#6a6256]">{r.body_fat_percent}%</span>
              )}
            </span>
            {pendingDelete === r.id ? (
              <span className="flex flex-none items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#b91c1c]">削除？</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => onConfirm(r.id)}
                  className="rounded-md bg-[#c0392b] px-2 py-0.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-[#e7dcc9] px-2 py-0.5 text-[11px] text-[#6a6256]"
                >
                  やめる
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onAsk(r.id)}
                className="flex-none text-[11px] text-[#a59b8c] transition-colors hover:text-[#b91c1c]"
              >
                削除
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
