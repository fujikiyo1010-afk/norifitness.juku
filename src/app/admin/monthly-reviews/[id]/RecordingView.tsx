"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIT_QUESTIONS,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
} from "@/lib/monthly-audit/types";
import { useVideoRecorder, formatElapsed } from "@/lib/hooks/useVideoRecorder";
import type { DetailMode, DetailViewData, RecordedVideo } from "./DetailClient";
import { GoalSheetReferenceView } from "./GoalSheetReferenceView";

/** 録画モード左パネルの表示切替。録画モード抜けるとリセット (ローカル state) */
type LeftPanelTab = "monthly" | "goal_sheet";

/**
 * 録画モード (Step 9b で MediaRecorder 統合済)。
 *
 * 内部で 3 状態を扱う:
 *   - recording_ready (準備中): カメラプレビュー + 録画開始ボタン
 *   - recording (録画中): タイマー + 録画停止ボタン
 *   - preview (プレビュー): 再生 + 採用/録り直し
 *
 * mode は外部 (DetailClient) から渡る。録画フックの state と連動して
 * recording / preview の表示を切り替える。
 *
 * 採用 → onAccept(video) で normal モードに戻る (Blob 持ち越し)。
 * 終了 → onExit で normal モードに戻る (Blob 破棄)。
 *
 * カメラの cleanup は useVideoRecorder の useEffect で自動実行。
 */
export function RecordingView({
  data,
  mode,
  onChangeMode,
  onAccept,
  onExit,
}: {
  data: DetailViewData;
  mode: DetailMode;
  onChangeMode: (mode: DetailMode) => void;
  onAccept: (video: RecordedVideo) => void;
  onExit: () => void;
}) {
  const { audit, user, goalSheet } = data;
  const recorder = useVideoRecorder();
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("monthly");

  // 録画モード突入時、自動でカメラ起動
  useEffect(() => {
    if (mode === "recording_ready" && recorder.state === "idle") {
      recorder.startCamera();
    }
  }, [mode, recorder]);

  // ライブカメラを <video> 要素に流す
  useEffect(() => {
    if (liveVideoRef.current && recorder.videoStream) {
      liveVideoRef.current.srcObject = recorder.videoStream;
    }
  }, [recorder.videoStream]);

  // 録画停止 → mode を preview に変更
  useEffect(() => {
    if (recorder.state === "stopped" && mode === "recording") {
      onChangeMode("preview");
    }
  }, [recorder.state, mode, onChangeMode]);

  // プレビュー用の Blob URL
  const blobUrl = useMemo(() => {
    if (!recorder.recordedBlob) return null;
    return URL.createObjectURL(recorder.recordedBlob);
  }, [recorder.recordedBlob]);

  // cleanup: blobUrl が変わった時に古い URL を revoke
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // 録画開始ボタン
  const handleStartRec = () => {
    recorder.startRecording();
    onChangeMode("recording");
  };

  // 録画停止ボタン
  const handleStopRec = () => {
    recorder.stopRecording();
    // useEffect で mode を preview に切り替える
  };

  // 採用ボタン (プレビューから)
  const handleAccept = () => {
    if (!recorder.recordedBlob) return;
    onAccept({
      blob: recorder.recordedBlob,
      mimeType: recorder.recordedMimeType,
      durationSec: recorder.elapsedSec,
    });
    // カメラは onAccept 後の unmount で cleanup される
    recorder.stopCamera();
  };

  // 録り直し
  const handleRetry = () => {
    recorder.discardRecording();
    onChangeMode("recording_ready");
  };

  // 録画モード終了
  const handleExit = () => {
    recorder.stopCamera();
    onExit();
  };

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
          onClick={handleExit}
          className="text-xs text-white/70 hover:text-white cursor-pointer"
          disabled={mode === "recording"}
          title={mode === "recording" ? "録画停止後に終了できます" : ""}
        >
          {mode === "recording" ? "⚠ 録画中: 停止ボタンで終了" : "← 録画モードを終了"}
        </button>
      </header>

      {/* === 録画モード本体: 左右 50:50 === */}
      <div className="grid grid-cols-2 min-h-[600px]">
        {/* === 左: 月次 / 目標シート 切替パネル (スクロール) === */}
        <div className="bg-[#f8f9fa] px-6 py-5 overflow-y-auto max-h-[700px] border-r border-[#e8ebe9]">
          <div className="text-[11px] text-zinc-500 mb-2 font-mono">
            受講生: <span className="font-bold text-zinc-900">{user.name}</span>{" "}
            ・ {audit.monthLabel}
          </div>

          {/* タブ: 月次 / 目標シート */}
          <div className="flex items-center gap-1 border-b border-[#e8ebe9] mb-3">
            <LeftTabButton
              label="月次"
              active={leftTab === "monthly"}
              onClick={() => setLeftTab("monthly")}
            />
            <LeftTabButton
              label="目標シート"
              active={leftTab === "goal_sheet"}
              onClick={() => setLeftTab("goal_sheet")}
            />
          </div>

          {leftTab === "monthly" ? (
            <>
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
            </>
          ) : (
            <GoalSheetReferenceView sheet={goalSheet} />
          )}
        </div>

        {/* === 右: カメラ/プレビューエリア === */}
        <div className="bg-zinc-900 flex flex-col items-center justify-center p-6 relative">
          {recorder.error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-xs px-3 py-2 rounded-lg mb-3 max-w-md text-center">
              {recorder.error}
            </div>
          )}

          {/* recording_ready + recording: カメラプレビュー (video 要素は 1 つに統合、
              mode 切替時に DOM 再生成を避けて srcObject 紐付けを維持) */}
          {(mode === "recording_ready" || mode === "recording") && (
            <>
              <div
                className={`w-full aspect-[4/3] bg-[#0a0a0a] rounded-xl mb-5 overflow-hidden relative transition-all ${
                  mode === "recording"
                    ? "border-2 border-[#d32f2f] shadow-[0_0_0_4px_rgba(211,47,47,.18)]"
                    : "border-2 border-white/10"
                }`}
              >
                <video
                  ref={liveVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* 録画中タイマー */}
                {mode === "recording" && (
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-2.5 py-1 rounded-md font-mono text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#d32f2f] rounded-full animate-pulse" />
                    {formatElapsed(recorder.elapsedSec)}
                  </div>
                )}
                {/* カメラ起動前のオーバーレイ */}
                {mode === "recording_ready" && recorder.state !== "ready" && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs bg-[#0a0a0a]/80">
                    {recorder.state === "starting" ? "カメラ起動中..." : "待機中"}
                  </div>
                )}
              </div>

              {/* mode に応じてボタンを切替 */}
              {mode === "recording_ready" ? (
                <>
                  <button
                    onClick={handleStartRec}
                    disabled={recorder.state !== "ready"}
                    className="w-16 h-16 rounded-full bg-[#d32f2f] text-white flex items-center justify-center text-2xl shadow-[0_4px_16px_rgba(211,47,47,.4)] hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                    title={recorder.state !== "ready" ? "カメラ起動を待っています" : "録画開始"}
                  >
                    ●
                  </button>
                  <div className="text-[11px] text-white/60 mt-2 text-center">
                    {recorder.state === "ready"
                      ? "録画開始 (押すとすぐ録画が始まります)"
                      : "カメラ準備中..."}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={handleStopRec}
                    className="w-16 h-16 rounded-full bg-white text-[#d32f2f] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                    title="録画停止"
                  >
                    <span className="w-5 h-5 bg-[#d32f2f] rounded" />
                  </button>
                  <div className="text-[11px] text-white/60 mt-2 text-center">
                    録画停止 (停止後にプレビュー確認できます)
                  </div>
                </>
              )}
            </>
          )}

          {/* preview: 録画した動画を再生 + 採用/録り直し */}
          {mode === "preview" && blobUrl && (
            <>
              <video
                ref={previewVideoRef}
                src={blobUrl}
                controls
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  // 最初のフレームを静止画表示 (黒画面回避)
                  const v = e.currentTarget;
                  if (v.currentTime === 0) v.currentTime = 0.1;
                }}
                className="w-full aspect-[4/3] bg-[#0a0a0a] rounded-xl mb-5 object-cover"
              />
              <div className="text-white/70 text-xs text-center mb-4 font-mono">
                <span className="text-white font-semibold">録画完了</span> ・ 長さ:{" "}
                <span className="text-white font-semibold">
                  {formatElapsed(recorder.elapsedSec)}
                </span>
                {recorder.recordedBlob && (
                  <>
                    {" "}・ サイズ:{" "}
                    <span className="text-white font-semibold">
                      {(recorder.recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-3 w-full max-w-md">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-white/10 border border-white/20 text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  録り直す
                </button>
                <button
                  onClick={handleAccept}
                  className="flex-1 bg-[#00897b] text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-[#00695c] transition-colors flex items-center justify-center gap-1.5"
                >
                  ✓ この動画を採用
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// =====================================================================
// 左パネル タブボタン
// =====================================================================

function LeftTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-bold tracking-wide transition-colors -mb-px border-b-2 ${
        active
          ? "border-[#00897b] text-[#00695c]"
          : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
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
    normal: "bg-white/10 text-white/80",
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
// コンパクト QA アイテム
// =====================================================================

function CompactQAItem({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
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
