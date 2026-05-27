"use client";

import Link from "next/link";
import {
  AUDIT_QUESTIONS,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
} from "@/lib/monthly-audit/types";
import type { DetailViewData } from "./DetailClient";

/**
 * 通常モード (Step 8 で実装した UI を移植)。
 *
 * - 受講生プロフィールカード
 * - 17 項目回答 (フラット表示)
 * - 過去の返信動画リスト
 * - 動画返信エリア (録画ボタンは onStartRecording を呼ぶ、Step 9a で機能化)
 * - 操作バー sticky bottom (Step 9c-d で機能化)
 * - 戻るリンク
 */
export function NormalView({
  data,
  onStartRecording,
}: {
  data: DetailViewData;
  onStartRecording: () => void;
}) {
  const { audit, user, pastReplied, replyCount, remainingCount, nextAuditId, adminName, adminInitial } =
    data;

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

        {/* 動画返信エリア */}
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
          <p className="text-xs text-zinc-700 text-center mb-3 leading-relaxed">
            上の 17 項目を読みながら、1 本の動画にまとめて返信してください。
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {/* ブラウザで録画 (Step 9a でクリック可能、9b で実機能) */}
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
            {/* ファイルアップロード (Step 9e で実装) */}
            <button
              disabled
              className="bg-white border-[#e8ebe9] text-zinc-700 border rounded-xl px-3.5 py-4 text-center cursor-not-allowed opacity-60"
              title="Step 9e で機能実装予定"
            >
              <span className="block mb-1.5 flex justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div className="text-[13px] font-bold mb-0.5">ファイルをアップロード</div>
              <div className="text-[10px] opacity-70">tldv / スタジオ撮影 等</div>
            </button>
          </div>
        </section>

        {/* 操作バー */}
        <div className="flex gap-2.5 pt-4 pb-2 sticky bottom-0 bg-[#f8f9fa] border-t border-[#e8ebe9] mt-4">
          <ActionButton kind="mute" label="下書き保存" />
          <ActionButton kind="primary" label="送信して終了" />
          <ActionButton
            kind="dark"
            label="送信して次へ"
            arrow
            disabledExtra={!nextAuditId ? "(次の未返答なし)" : undefined}
          />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// 子コンポーネント
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
