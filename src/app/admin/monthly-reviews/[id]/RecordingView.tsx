"use client";

import {
  AUDIT_QUESTIONS,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
} from "@/lib/monthly-audit/types";
import type { DetailMode, DetailViewData } from "./DetailClient";

/**
 * 録画モード (Step 9a で UI スケルトン、9b で MediaRecorder 統合)。
 *
 * 内部で 3 状態を扱う:
 *   - recording_ready (準備中): カメラプレビュー + 録画開始ボタン
 *   - recording (録画中): タイマー + 録画停止ボタン (9b)
 *   - preview (プレビュー): 再生 + 採用/録り直し (9b)
 *
 * レイアウト: 左右 50:50 grid
 *   - 左: 受講生プロフィール + 17 項目スクロール (常に表示)
 *   - 右: カメラエリア + 録画コントロール (mode に応じて変化)
 *
 * Step 9a 時点では recording_ready の UI のみ実装、
 * カメラ起動・録画機能はまだなし (Step 9b で MediaRecorder 統合)。
 */
export function RecordingView({
  data,
  mode,
  onChangeMode,
  onExitRecording,
}: {
  data: DetailViewData;
  mode: DetailMode;
  onChangeMode: (mode: DetailMode) => void;
  onExitRecording: () => void;
}) {
  const { audit, user } = data;

  return (
    <>
      {/* === 録画モードヘッダー (ダークテーマ) === */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#e8ebe9] bg-zinc-900 text-white">
        <div className="flex items-center gap-2.5 text-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="font-medium">動画録画モード</span>
          <StatusBadge mode={mode} />
        </div>
        <button
          onClick={onExitRecording}
          className="text-xs text-white/70 hover:text-white cursor-pointer"
        >
          ← 録画モードを終了
        </button>
      </header>

      {/* === 録画モード本体: 左右 50:50 === */}
      <div className="grid grid-cols-2 min-h-[600px]">
        {/* === 左: 17 項目スクロール === */}
        <div className="bg-[#f8f9fa] px-6 py-5 overflow-y-auto max-h-[700px] border-r border-[#e8ebe9]">
          <div className="text-[11px] text-zinc-500 mb-1 font-mono">
            受講生: <span className="font-bold text-zinc-900">{user.name}</span>{" "}
            ・ {audit.monthLabel}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-3 pb-2 border-b border-[#e8ebe9] flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            17 項目の回答
          </h3>
          <div className="flex flex-col">
            {AUDIT_QUESTIONS.map((q) => (
              <CompactQAItem
                key={q.key}
                question={q}
                answer={audit.items[q.key as keyof MonthlyAuditItems]}
              />
            ))}
          </div>
        </div>

        {/* === 右: カメラエリア (ダークテーマ) === */}
        <div className="bg-zinc-900 flex flex-col items-center justify-center p-6 relative">
          <CameraArea mode={mode} onChangeMode={onChangeMode} />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// ステータスバッジ
// =====================================================================

function StatusBadge({ mode }: { mode: DetailMode }) {
  const style = {
    recording_ready: "bg-white/10 text-white/80",
    recording: "bg-[#d32f2f] text-white",
    preview: "bg-[#00897b] text-white",
    normal: "bg-white/10 text-white/80", // 通常表示されないが念のため
  }[mode];

  const label = {
    recording_ready: "○ 待機中",
    recording: "● REC",
    preview: "✓ 録画完了",
    normal: "—",
  }[mode];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${style}`}
    >
      {label}
    </span>
  );
}

// =====================================================================
// カメラエリア (mode に応じて UI 変化)
// =====================================================================

function CameraArea({
  mode,
  onChangeMode,
}: {
  mode: DetailMode;
  onChangeMode: (mode: DetailMode) => void;
}) {
  if (mode === "recording_ready") {
    return (
      <>
        <div className="w-full aspect-[4/3] bg-[#0a0a0a] rounded-xl mb-5 flex items-center justify-center border-2 border-white/10 overflow-hidden">
          <div className="text-white/60 text-center text-xs p-5">
            <div className="w-24 h-24 rounded-full bg-white/10 mx-auto mb-3 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-10 h-10"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            のりさんの顔がここに映ります
            <br />
            <span className="text-[11px] opacity-60">
              (Step 9b でカメラ起動を実装します)
            </span>
          </div>
        </div>
        <button
          disabled
          className="w-16 h-16 rounded-full bg-[#d32f2f] text-white flex items-center justify-center text-2xl shadow-[0_4px_16px_rgba(211,47,47,.4)] cursor-not-allowed opacity-50"
          title="Step 9b で機能実装予定"
        >
          ●
        </button>
        <div className="text-[11px] text-white/60 mt-2 text-center">
          録画開始 (Step 9b で実装)
        </div>
      </>
    );
  }

  if (mode === "recording") {
    // Step 9b で実装
    return (
      <div className="text-white/60 text-center text-xs">
        (Step 9b で実装予定)
      </div>
    );
  }

  if (mode === "preview") {
    // Step 9b で実装
    return (
      <div className="text-white/60 text-center text-xs">
        (Step 9b で実装予定)
      </div>
    );
  }

  return null;
}

// =====================================================================
// コンパクト QA アイテム (左側の 17 項目スクロール用)
// =====================================================================

function CompactQAItem({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  // スコアまたは数値 (簡易表示)
  let score: string | null = null;
  if (question.type === "score") {
    const a = answer as ScoreAnswer | undefined;
    score = a?.score !== undefined ? String(a.score) : null;
  } else if (question.type === "body_measure") {
    const a = answer as BodyMeasureAnswer | undefined;
    if (a?.current_value !== undefined) {
      score =
        a.current_value.toFixed(question.numberDecimals ?? 1) +
        (question.unit ?? "");
    }
  }

  const text =
    question.type === "body_measure"
      ? (answer as BodyMeasureAnswer | undefined)?.text
      : question.type === "score"
        ? (answer as ScoreAnswer | undefined)?.text
        : (answer as TextAnswer | undefined)?.text;

  const isEmpty = !text || text.trim().length === 0;

  return (
    <div className="py-2.5 border-b border-[#e8ebe9] last:border-b-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div className="text-xs text-zinc-900 font-medium flex-1">
          <span className="font-mono text-[10px] text-zinc-400 mr-1">
            {question.key.toUpperCase()}
          </span>
          {question.label}
        </div>
        {score && (
          <span className="font-mono text-[13px] font-bold text-[#00897b] flex-shrink-0">
            {score}
          </span>
        )}
      </div>
      {isEmpty ? (
        <div className="text-[11px] text-zinc-400 italic px-2.5 py-1.5 bg-white rounded border-l-2 border-zinc-300">
          (未記入)
        </div>
      ) : (
        <div className="text-[11px] text-zinc-700 px-2.5 py-1.5 bg-white rounded border-l-2 border-[#00897b] leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
