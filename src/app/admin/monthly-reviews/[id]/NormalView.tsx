"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIT_QUESTIONS,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
} from "@/lib/monthly-audit/types";
import { formatElapsed } from "@/lib/hooks/useVideoRecorder";
import { useUploadJob } from "@/lib/upload/UploadJobContext";
import type { DetailViewData, RecordedVideo } from "./DetailClient";

/**
 * 通常モード。録画済み Blob が DetailClient から渡れば、
 * 動画返信エリアに「録画済みプレビュー」を表示する (Step 9b)。
 * 「送信して終了 / 次へ」は Step 9c で機能化予定。
 */
export function NormalView({
  data,
  recorded,
  onStartRecording,
  onSelectFile,
  onDiscardRecorded,
}: {
  data: DetailViewData;
  recorded: RecordedVideo | null;
  onStartRecording: () => void;
  onSelectFile: (video: RecordedVideo) => void;
  onDiscardRecorded: () => void;
}) {
  const { audit, user, pastReplied, replyCount, remainingCount, nextAuditId, adminName, adminInitial } =
    data;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイル再選択可
    if (!file) return;
    setFileError(null);

    if (!file.type.startsWith("video/")) {
      setFileError("動画ファイルを選んでください (MP4 / MOV / WebM 等)");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(
        `ファイルサイズが大きすぎます (${(file.size / 1024 / 1024).toFixed(0)} MB / 上限 500 MB)`
      );
      return;
    }

    // duration を一時的な <video> 要素で取得
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    const url = URL.createObjectURL(file);
    videoEl.src = url;
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const durationSec = Math.floor(videoEl.duration);
      onSelectFile({
        blob: file,
        mimeType: file.type,
        durationSec: isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
      });
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      setFileError("動画ファイルの読み込みに失敗しました");
    };
  };

  const handleClickFileButton = () => {
    setFileError(null);
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* === 管理画面ヘッダー === */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#e8ebe9] bg-white">
        <div className="flex items-center gap-3">
          <div className="text-base font-bold text-[#004d40] flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            筋肉塾 管理
          </div>
          <div className="text-[11px] text-zinc-500 pl-3 border-l border-[#e8ebe9]">
            月次添削 / 個別作業
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <div className="w-7 h-7 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-xs">
            {adminInitial}
          </div>
          {adminName}
        </div>
      </header>

      {/* === コンテンツ === */}
      <div className="bg-[#f8f9fa] px-7 py-5">
        {/* 戻るリンク */}
        <Link
          href="/admin/monthly-reviews"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 mb-3.5 hover:text-[#00695c] transition-colors"
        >
          ← 受信箱に戻る{remainingCount > 0 ? ` (残り ${remainingCount} 件)` : ""}
        </Link>

        {/* 受講生プロフィールカード */}
        <section className="bg-white border border-[#e8ebe9] rounded-xl px-5 py-4 mb-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#f8f9fa] text-zinc-700 text-lg font-bold flex items-center justify-center flex-shrink-0">
            {user.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-zinc-900 mb-1">
              {user.name} さん
            </div>
            <div className="text-xs text-zinc-500 font-mono flex flex-wrap items-center">
              <ProfileMeta label={`入会 ${user.joinedAtLabel}`} sub={`(${user.monthsSinceJoin} ヶ月目)`} />
              <ProfileSep />
              <ProfileMeta label={`過去返信 ${replyCount} 回`} />
              <ProfileSep />
              <ProfileMeta label={audit.monthLabel} />
              <ProfileSep />
              <ProfileMeta label={`${audit.daysSinceSubmit} 日経過`} />
            </div>
          </div>
        </section>

        {/* 動画返信エリア (画面開いてすぐ録画開始できるよう最上部に、2026-05-27 きよむさん要望) */}
        <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border border-[rgba(255,235,59,0.55)] rounded-xl px-5 py-4 mb-3.5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#e8ebe9]">
            <h3 className="text-[13px] font-bold text-[#b8860b] tracking-wide flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              動画で返信する (1 本にまとめて)
            </h3>
          </div>

          {recorded ? (
            <RecordedPreview
              recorded={recorded}
              auditId={audit.id}
              userName={user.name}
              targetMonthLabel={audit.monthLabel}
              nextAuditId={nextAuditId}
              onDiscard={onDiscardRecorded}
              onRetry={() => {
                onDiscardRecorded();
                onStartRecording();
              }}
            />
          ) : (
            <>
              <p className="text-xs text-zinc-700 text-center mb-3 leading-relaxed">
                下の 17 項目を読みながら、1 本の動画にまとめて返信してください。
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onStartRecording}
                  className="bg-[#00897b] border-[#00897b] text-white border rounded-xl px-3.5 py-4 text-center cursor-pointer transition-all hover:bg-[#00695c] hover:border-[#00695c]"
                >
                  <span className="block mb-1.5 flex justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </span>
                  <div className="text-[13px] font-bold mb-0.5">ブラウザで録画する</div>
                  <div className="text-[10px] opacity-80">推奨 ・ 読みながらすぐ撮れる</div>
                </button>
                <button
                  onClick={handleClickFileButton}
                  className="bg-white border-[#e8ebe9] text-zinc-700 border rounded-xl px-3.5 py-4 text-center cursor-pointer transition-all hover:border-[#00897b] hover:bg-[rgba(0,137,123,0.04)]"
                  title="動画ファイルを選んでアップロード"
                >
                  <span className="block mb-1.5 flex justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <div className="text-[13px] font-bold mb-0.5">ファイルをアップロード</div>
                  <div className="text-[10px] opacity-70">スマホ動画 / tldv / スタジオ撮影 等</div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {fileError && (
                <div className="mt-3 px-3 py-2 bg-[#fef5f5] border border-[#d32f2f]/30 text-[#d32f2f] text-xs rounded-md text-center">
                  {fileError}
                </div>
              )}
            </>
          )}
        </section>

        {/* 過去の返信動画リスト */}
        <section className="bg-white border border-[#e8ebe9] rounded-xl px-5 py-4 mb-3.5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#e8ebe9]">
            <h3 className="text-[13px] font-bold text-zinc-700 tracking-wide flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              過去の返信動画 (この受講生)
            </h3>
            <span className="text-[11px] text-zinc-400 font-mono">
              {pastReplied.length} 件
            </span>
          </div>
          {pastReplied.length === 0 ? (
            <div className="text-xs text-zinc-400 italic py-2">
              過去の返信動画はまだありません
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {pastReplied.map((p) => (
                <PastVideoRow key={p.id} item={p} />
              ))}
            </div>
          )}
        </section>

        {/* 17 項目回答 */}
        <section className="bg-white border border-[#e8ebe9] rounded-xl px-5 py-4 mb-3.5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#e8ebe9]">
            <h3 className="text-[13px] font-bold text-zinc-700 tracking-wide flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              提出された内容 (17 項目)
            </h3>
            {audit.avgScore !== null && (
              <span className="bg-[#f8f9fa] text-zinc-600 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                平均 {audit.avgScore.toFixed(1)} / 10
              </span>
            )}
          </div>
          <div className="flex flex-col">
            {AUDIT_QUESTIONS.map((q) => (
              <QAItem
                key={q.key}
                question={q}
                answer={audit.items[q.key as keyof MonthlyAuditItems]}
              />
            ))}
          </div>
        </section>

        {/* 操作バーは「録画済み」カード内に統合 (2026-05-27 きよむさん要望)
            録画前は送信ボタンが無意味なため非表示 */}
      </div>
    </>
  );
}

// =====================================================================
// 録画済みプレビュー (Step 9b で追加)
// =====================================================================

function RecordedPreview({
  recorded,
  auditId,
  userName,
  targetMonthLabel,
  nextAuditId,
  onDiscard,
  onRetry,
}: {
  recorded: RecordedVideo;
  auditId: string;
  userName: string;
  targetMonthLabel: string;
  nextAuditId: string | null;
  onDiscard: () => void;
  onRetry: () => void;
}) {
  const router = useRouter();
  const { job, startUpload } = useUploadJob();
  const isUploading = job.status === "uploading";

  const handleSendAndExit = () => {
    if (isUploading) return;
    startUpload({
      auditId,
      userName,
      targetMonthLabel,
      blob: recorded.blob,
      mimeType: recorded.mimeType,
      durationSec: recorded.durationSec,
    });
    // 即座に受信箱に戻る (案 B: 裏でアップロード継続)
    router.push("/admin/monthly-reviews");
  };

  const handleSendAndNext = () => {
    if (isUploading || !nextAuditId) return;
    startUpload({
      auditId,
      userName,
      targetMonthLabel,
      blob: recorded.blob,
      mimeType: recorded.mimeType,
      durationSec: recorded.durationSec,
    });
    // 即座に次の未返答へ
    router.push(`/admin/monthly-reviews/${nextAuditId}`);
  };
  const blobUrl = useMemo(
    () => URL.createObjectURL(recorded.blob),
    [recorded.blob]
  );

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // NOTE: 録画動画のサムネ (最初のフレームを poster に) は、
  // MediaRecorder で生成された WebM の duration バグ + ブラウザの autoplay policy の
  // 組み合わせで安定動作させるのが難しく、Step 9 完了後に再挑戦予定。
  // 代替案: Vimeo アップロード後は Vimeo が自動でサムネを生成するので、
  // 「録画済み」表示は Step 9c 以降に Vimeo 側サムネに切り替えるのが現実的。

  const sizeMB = (recorded.blob.size / 1024 / 1024).toFixed(2);
  const formatName = recorded.mimeType.includes("mp4") ? "MP4" : "WebM";

  return (
    <div className="bg-white rounded-xl border border-[#e8ebe9] p-4">
      <div className="flex items-start gap-4">
        {/* サムネ (video 要素、再生ボタンで動画再生可能。サムネ静止表示は保留中) */}
        <video
          src={blobUrl}
          controls
          playsInline
          className="w-48 aspect-[4/3] bg-zinc-900 rounded-lg flex-shrink-0 object-cover"
        />

        {/* 中: 録画済み情報 + 録り直す/削除 */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#00897b]" />
            録画済み
          </div>
          <div className="text-xs text-zinc-600 mb-3 font-mono space-y-0.5">
            <div>長さ: <span className="font-bold text-zinc-900">{formatElapsed(recorded.durationSec)}</span></div>
            <div>サイズ: <span className="font-bold text-zinc-900">{sizeMB} MB</span></div>
            <div>形式: <span className="font-bold text-zinc-900">{formatName}</span></div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1.5 bg-[#f8f9fa] text-zinc-700 border border-[#e8ebe9] rounded-md hover:bg-zinc-100 transition-colors flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              録り直す
            </button>
            <button
              onClick={onDiscard}
              className="text-xs px-3 py-1.5 bg-[#fef5f5] text-[#d32f2f] border border-[#d32f2f]/30 rounded-md hover:bg-[#d32f2f]/10 transition-colors flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              削除
            </button>
          </div>
        </div>

        {/* 右: 送信操作ボタン群 (Step 9c で機能化、案 B: 裏でアップロード継続) */}
        <div className="flex flex-col gap-2 w-44 flex-shrink-0">
          <button
            disabled
            className="bg-white text-zinc-500 border-[#e8ebe9] px-4 py-2.5 rounded-lg text-xs font-medium border cursor-not-allowed opacity-60"
            title="下書き保存は将来検討予定"
          >
            下書き保存
          </button>
          <button
            onClick={handleSendAndExit}
            disabled={isUploading}
            className="bg-[#00897b] text-white border-transparent px-4 py-2.5 rounded-lg text-xs font-bold border hover:bg-[#00695c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isUploading ? "他の動画を送信中" : "送信して受信箱に戻る"}
          >
            送信して終了
          </button>
          <button
            onClick={handleSendAndNext}
            disabled={isUploading || !nextAuditId}
            className="bg-zinc-900 text-white border-transparent px-4 py-2.5 rounded-lg text-xs font-bold border hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title={
              isUploading
                ? "他の動画を送信中"
                : !nextAuditId
                  ? "次の未返答はありません"
                  : "送信して次の未返答へ"
            }
          >
            送信して次へ
            <span className="text-[#00897b]">→</span>
            {!nextAuditId && (
              <span className="text-[9px] opacity-70 ml-0.5">(なし)</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 既存の子コンポーネント (Step 8 から維持)
// =====================================================================

function ProfileMeta({ label, sub }: { label: string; sub?: string }) {
  return (
    <span>
      {label}
      {sub && <span className="text-zinc-400 ml-1">{sub}</span>}
    </span>
  );
}

function ProfileSep() {
  return <span className="mx-3 text-[#e8ebe9]">|</span>;
}

function QAItem({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  return (
    <div className="py-3.5 border-b border-[#e8ebe9] last:border-b-0 first:pt-1 last:pb-1">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="text-[13px] text-zinc-900 font-medium flex-1">
          <span className="font-mono text-[11px] text-zinc-400 font-semibold mr-1.5">
            {question.key.toUpperCase()}
          </span>
          {question.label}
        </div>
        <QAScoreOrValue question={question} answer={answer} />
      </div>
      <QAAnswerBody question={question} answer={answer} />
    </div>
  );
}

function QAScoreOrValue({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  if (question.type === "body_measure") {
    const a = answer as BodyMeasureAnswer | undefined;
    if (!a || a.current_value === undefined) {
      return <span className="font-mono text-lg font-bold text-zinc-400">—</span>;
    }
    const decimals = question.numberDecimals ?? 1;
    const unit = question.unit ?? "";
    const current = a.current_value.toFixed(decimals);
    if (a.last_value === undefined) {
      return (
        <span className="font-mono text-base font-bold text-[#00897b]">
          {current} {unit}
        </span>
      );
    }
    const diff = a.current_value - a.last_value;
    const diffStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(decimals)}`;
    const diffColor =
      diff < 0 ? "text-[#00897b]" : diff > 0 ? "text-zinc-500" : "text-zinc-400";
    return (
      <div className="flex items-baseline gap-1.5 font-mono">
        <span className="text-xs text-zinc-400">{a.last_value.toFixed(decimals)}</span>
        <span className="text-zinc-300 text-xs">→</span>
        <span className="text-base font-bold text-zinc-900">{current}</span>
        <span className="text-xs text-zinc-500">{unit}</span>
        <span className={`text-xs font-semibold ml-1 ${diffColor}`}>
          ({diffStr})
        </span>
      </div>
    );
  }

  if (question.type === "score") {
    const a = answer as ScoreAnswer | undefined;
    if (!a || a.score === undefined) {
      return <span className="font-mono text-lg font-bold text-zinc-400">—</span>;
    }
    const isLow = a.score < 6;
    return (
      <span
        className={`font-mono text-lg font-bold ${
          isLow ? "text-zinc-500" : "text-[#00897b]"
        }`}
      >
        {a.score}
      </span>
    );
  }

  return <span className="font-mono text-xs text-zinc-400">—</span>;
}

function QAAnswerBody({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  const text =
    question.type === "body_measure"
      ? (answer as BodyMeasureAnswer | undefined)?.text
      : question.type === "score"
        ? (answer as ScoreAnswer | undefined)?.text
        : (answer as TextAnswer | undefined)?.text;

  const isEmpty = !text || text.trim().length === 0;
  if (isEmpty) {
    return (
      <div className="px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg border-l-[3px] border-zinc-300 text-[13px] text-zinc-400 italic leading-relaxed">
        {question.required ? "(未記入)" : "(任意・未記入)"}
      </div>
    );
  }
  return (
    <div className="px-3.5 py-2.5 bg-[#f8f9fa] rounded-lg border-l-[3px] border-[#00897b] text-[13px] text-zinc-900 leading-relaxed whitespace-pre-wrap">
      {text}
    </div>
  );
}

function PastVideoRow({
  item,
}: {
  item: {
    id: string;
    targetMonthLabel: string;
    publishedDateLabel: string | null;
    durationLabel: string | null;
  };
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-[#f8f9fa] rounded-md text-xs text-zinc-600">
      <span className="font-mono font-semibold text-zinc-900">
        {item.targetMonthLabel}
      </span>
      {item.durationLabel && <span>動画 {item.durationLabel}</span>}
      {item.publishedDateLabel && (
        <span className="text-zinc-400">{item.publishedDateLabel} 返信</span>
      )}
      <span
        className="ml-auto w-5 h-5 rounded-full bg-zinc-300 text-white flex items-center justify-center text-[8px]"
        title="Step 9 で再生機能を実装予定"
      >
        ▶
      </span>
    </div>
  );
}

function ActionButton({
  kind,
  label,
  arrow = false,
  disabledExtra,
}: {
  kind: "mute" | "primary" | "dark";
  label: string;
  arrow?: boolean;
  disabledExtra?: string;
}) {
  const classes = {
    mute: "bg-white text-zinc-500 border-[#e8ebe9]",
    primary: "bg-[#00897b]/50 text-white border-transparent",
    dark: "bg-zinc-900/50 text-white border-transparent ml-auto flex items-center gap-1.5",
  }[kind];

  return (
    <button
      disabled
      className={`${classes} px-4 py-2.5 rounded-lg text-[13px] font-medium border cursor-not-allowed opacity-60`}
      title={disabledExtra ?? "Step 9c-d で機能実装予定"}
    >
      {label}
      {arrow && <span className="text-[#00897b]">→</span>}
      {disabledExtra && (
        <span className="text-[10px] opacity-70 ml-1">{disabledExtra}</span>
      )}
    </button>
  );
}
