import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyAudit, listMyAudits } from "@/lib/monthly-audit/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import {
  AUDIT_QUESTIONS,
  AUDIT_CATEGORIES,
  type AuditCategoryKey,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
} from "@/lib/monthly-audit/types";

export const dynamic = "force-dynamic";

/**
 * 月次添削 月詳細画面 (/monthly-review/detail/[targetMonth])
 *
 * 設計元: /tmp/monthly_review_detail.html (Phase 2-7 モック)
 *
 * URL 例: /monthly-review/detail/2026-05-01
 *
 * 構成 (上から):
 *   - ヒーロー帯 (月 + 送信日 + 返信日)
 *   - のりfitness 返信 (動画 + 公開日)
 *   - 全体スコア (平均 / 合計 / 前月比)
 *   - 提出した内容 (17 項目をカテゴリ別に表示)
 *   - CTA (履歴に戻る)
 */
export default async function MonthlyReviewDetailPage({
  params,
}: {
  params: Promise<{ targetMonth: string }>;
}) {
  const { targetMonth } = await params;

  // targetMonth = "2026-05-01" 形式の date 想定
  // 簡易バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetMonth)) {
    notFound();
  }

  const audit = await getMyAudit(targetMonth);
  if (!audit) {
    notFound();
  }

  // 前月比計算のため全件取得
  const allAudits = await listMyAudits(24);

  // この月のスコア集計
  const myScores = collectScores(audit.items);
  const myAverage = myScores.length > 0
    ? myScores.reduce((a, b) => a + b, 0) / myScores.length
    : 0;
  const myTotal = myScores.reduce((a, b) => a + b, 0);
  const maxTotal = AUDIT_QUESTIONS.filter((q) => q.type === "score").length * 10;

  // 前月の月次添削を探す
  const prevAudit = findPrevMonth(allAudits, targetMonth);
  const prevScores = prevAudit ? collectScores(prevAudit.items) : [];
  const prevAverage = prevScores.length > 0
    ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length
    : null;
  const monthOnMonth =
    prevAverage !== null && myAverage !== null
      ? myAverage - prevAverage
      : null;

  // 日付ラベル
  const targetDate = new Date(targetMonth);
  const monthLabel = `${targetDate.getFullYear()} 年 ${targetDate.getMonth() + 1} 月`;
  const reportLabel = `${monthLabel} 月次報告`;
  const submittedLabel = audit.submitted_at
    ? new Date(audit.submitted_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
  const publishedLabel = audit.nori_video_published_at
    ? new Date(audit.nori_video_published_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <>
      <RefreshOnFocus />
      <MemberHeader title="月次添削 詳細" fallbackHref="/monthly-review" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-[100dvh]">
        <div className="mx-auto w-full max-w-[460px] border-x border-[#e7dcc9]">

        {/* ヒーロー帯 (温かいグラデ) */}
        <div className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-5 py-4 border-b border-[#e7dcc9]">
          <div className="text-[22px] font-bold text-[#004d40] mb-1">
            {reportLabel}
          </div>
          <div className="text-[11px] text-[#6a6256] font-mono">
            送信日 {submittedLabel}
            {publishedLabel && ` ・ 返信日 ${publishedLabel}`}
          </div>
        </div>

        <div className="bg-[#f9f5ed] pb-20">
          {/* ====== のりfitness 返信 ====== */}
          <ReplySection
            videoUrl={audit.nori_video_vimeo_url}
            durationSec={audit.nori_video_duration_sec}
          />

          {/* ====== 提出した内容 (17 項目) ====== */}
          <SectionCard
            title="提出した内容"
            icon={
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            }
          >
            <QuestionAnswerList items={audit.items} />
          </SectionCard>

          {/* ====== 全体スコア ====== */}
          <SectionCard
            title="全体スコア"
            icon={
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
            }
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <ScoreCell num={myAverage.toFixed(1)} label="スコア平均" />
              <ScoreCell
                num={`${myTotal}`}
                label={`合計 / ${maxTotal}`}
              />
              <ScoreCell
                num={
                  monthOnMonth === null
                    ? "—"
                    : monthOnMonth > 0
                      ? `+${monthOnMonth.toFixed(1)}`
                      : monthOnMonth.toFixed(1)
                }
                label="前月比"
              />
            </div>
          </SectionCard>

          {/* CTA */}
          <div className="mx-4 my-4 flex flex-col gap-2">
            <Link
              href="/monthly-review"
              className="block w-full text-center py-3 rounded-2xl bg-[#fffdf8] text-[#34603f] border border-[#4a875b] text-xs font-bold hover:bg-[#f8f9fa] transition-colors"
            >
              履歴一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

// =====================================================================
// 補助関数
// =====================================================================
function collectScores(items: MonthlyAuditItems): number[] {
  const scores: number[] = [];
  for (const q of AUDIT_QUESTIONS) {
    if (q.type !== "score") continue;
    const a = items[q.key as keyof MonthlyAuditItems] as ScoreAnswer | undefined;
    if (a?.score !== undefined) scores.push(a.score);
  }
  return scores;
}

function findPrevMonth(
  allAudits: Array<{ target_month: string; items: MonthlyAuditItems }>,
  currentMonth: string
): { items: MonthlyAuditItems } | null {
  const sorted = allAudits
    .filter((a) => a.target_month < currentMonth)
    .sort((a, b) => (a.target_month < b.target_month ? 1 : -1));
  return sorted[0] ?? null;
}

// =====================================================================
// 子コンポーネント
// =====================================================================
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#fffdf8] mx-4 my-4 border border-[#e7dcc9] rounded-2xl px-5 py-4">
      <div className="text-xs font-bold text-zinc-700 tracking-wide flex items-center gap-1.5 mb-3 pb-2 border-b border-[#e7dcc9]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ReplySection({
  videoUrl,
  durationSec,
}: {
  videoUrl: string | null;
  durationSec: number | null;
}) {
  // 動画形式判定: Vimeo URL か Supabase Storage か
  const isVimeo = videoUrl?.includes("vimeo.com") ?? false;
  const vimeoId = isVimeo ? extractVimeoId(videoUrl!) : null;

  return (
    <div className="bg-[rgba(255,235,59,0.12)] mx-4 my-4 border border-[rgba(255,235,59,0.55)] rounded-2xl px-5 py-4">
      <div className="text-xs font-bold text-[#b8860b] tracking-wide flex items-center gap-1.5 mb-3 pb-2 border-b border-[rgba(184,134,11,0.2)]">
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 5L2 7" />
        </svg>
        のりfitness からの返信
      </div>

      {videoUrl ? (
        <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden mb-3">
          {isVimeo && vimeoId ? (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}`}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={videoUrl} controls playsInline className="w-full h-full" />
          )}
          {durationSec && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
              {formatDuration(durationSec)}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video bg-zinc-100 rounded-xl flex items-center justify-center text-[#6a6256] text-xs mb-3">
          動画返信を準備中です
        </div>
      )}

      <div className="text-xs text-zinc-700 leading-relaxed">
        <div className="text-[11px] font-bold text-[#b8860b] mb-1.5">
          のりfitness
        </div>
        {videoUrl
          ? "動画でフィードバックしています。再生してご確認ください。"
          : "提出いただきありがとうございました。返信は数日以内にお届けします。"}
      </div>
    </div>
  );
}

function ScoreCell({ num, label }: { num: string; label: string }) {
  return (
    <div className="bg-[#f8f9fa] rounded-lg px-2 py-2.5">
      <span className="block text-xl font-bold text-[#34603f] font-mono leading-none">
        {num}
      </span>
      <div className="text-[10px] text-[#6a6256] mt-1">{label}</div>
    </div>
  );
}

function QuestionAnswerList({ items }: { items: MonthlyAuditItems }) {
  return (
    <div className="flex flex-col">
      {(Object.keys(AUDIT_CATEGORIES) as AuditCategoryKey[])
        .sort((a, b) => AUDIT_CATEGORIES[a].order - AUDIT_CATEGORIES[b].order)
        .map((catKey) => {
          const cat = AUDIT_CATEGORIES[catKey];
          const questions = AUDIT_QUESTIONS.filter((q) => q.category === catKey);
          return (
            <div key={catKey} className="mt-3.5 first:mt-0">
              <div className="text-[11px] font-bold text-[#34603f] mb-1.5 tracking-wide">
                {cat.label}
              </div>
              {questions.map((q) => (
                <QuestionItem
                  key={q.key}
                  question={q}
                  answer={items[q.key as keyof MonthlyAuditItems]}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}

function QuestionItem({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start py-2 border-b border-[#e7dcc9] last:border-b-0 gap-3">
      <div className="text-xs text-zinc-700 leading-snug">
        <span className="text-[#a59b8c] font-mono mr-1.5">
          {question.key.toUpperCase()}.
        </span>
        {question.label}
      </div>

      {question.type === "body_measure" && (
        <div className="text-xs text-[#34603f] font-bold font-mono text-right whitespace-nowrap">
          {formatBodyMeasure(answer as BodyMeasureAnswer | undefined, question.unit)}
        </div>
      )}

      {question.type === "score" && (
        <div className="text-base font-bold text-[#4a875b] font-mono text-right">
          {(answer as ScoreAnswer | undefined)?.score ?? "—"}
        </div>
      )}

      {question.type === "text" && (
        <div className="text-xs text-[#a59b8c] text-right">—</div>
      )}

      {/* 自由記述 (任意で表示) */}
      {((answer as { text?: string } | undefined)?.text ?? "").trim().length > 0 && (
        <div className="col-span-2 mt-1.5 px-2.5 py-2 bg-[#f8f9fa] rounded-md text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">
          {(answer as { text?: string }).text}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ユーティリティ
// =====================================================================
function extractVimeoId(url: string): string | null {
  // https://vimeo.com/123456789 → "123456789"
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBodyMeasure(
  answer: BodyMeasureAnswer | undefined,
  unit?: string
): string {
  if (!answer) return "—";
  const last = answer.last_value;
  const curr = answer.current_value;
  if (curr === undefined && last === undefined) return "—";
  if (last !== undefined && curr !== undefined) {
    return `${last.toFixed(1)} → ${curr.toFixed(1)} ${unit ?? ""}`;
  }
  if (curr !== undefined) return `${curr.toFixed(1)} ${unit ?? ""}`;
  return `先月 ${last?.toFixed(1)} ${unit ?? ""}`;
}
