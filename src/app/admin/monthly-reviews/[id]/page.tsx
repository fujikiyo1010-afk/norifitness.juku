import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuditForAdmin,
  listPendingAudits,
} from "@/lib/monthly-audit/queries";
import {
  AUDIT_QUESTIONS,
  formatTargetMonthLabel,
  type AuditQuestion,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
  type MonthlyAuditItems,
  type MonthlyAuditRow,
} from "@/lib/monthly-audit/types";

export const dynamic = "force-dynamic";

/**
 * 管理画面 月次添削 個別作業 (/admin/monthly-reviews/[id])
 *
 * 設計元: /tmp/admin_monthly_review.html (Phase 2-7 モック)
 *
 * Step 8 の範囲 (今):
 *   - 受講生プロフィールカード (名前/入会日/月数/過去返信回数/対象月/経過日数)
 *   - 17 項目回答 (フラット表示、body_measure / score / text の 3 型描画)
 *   - 過去の返信動画リスト (この受講生の published audits 一覧)
 *   - 動画返信エリアの UI スケルトン (2 ボタン disabled)
 *   - 操作バー sticky bottom (3 ボタン disabled)
 *   - 戻るリンク (受信箱に戻る + 残り未返答件数)
 *
 * Step 9 の範囲 (次):
 *   - ブラウザ録画 (MediaRecorder API)
 *   - ファイルアップロード
 *   - Vimeo API 連携 (Tech Check 4 と並行)
 *   - 「送信して終了 / 次へ」の Server Action
 *
 * 17 項目テキストは types.ts の AUDIT_QUESTIONS を「正」として表示
 * (モックは画面構造の参考、項目テキストは types.ts 準拠)。
 */
export default async function AdminMonthlyReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  const audit = await getAuditForAdmin(id);
  if (!audit) notFound();

  // 関連データを並列取得
  const [user, pastReplied, pending] = await Promise.all([
    fetchUser(audit.user_id),
    fetchPastRepliedAudits(audit.user_id, audit.id),
    listPendingAudits(),
  ]);

  // 「送信して次へ」用に、現 audit より後ろの未返答を計算
  const pendingIndex = pending.findIndex((a) => a.id === audit.id);
  const remainingCount =
    pendingIndex >= 0 ? pending.length - pendingIndex - 1 : pending.length;
  const nextAuditId =
    pendingIndex >= 0 && pendingIndex < pending.length - 1
      ? pending[pendingIndex + 1].id
      : null;

  const replyCount = pastReplied.length;
  const monthLabel = formatTargetMonthLabel(audit.target_month);
  const submittedAt = audit.submitted_at ? new Date(audit.submitted_at) : null;
  const daysSinceSubmit = submittedAt
    ? Math.floor((Date.now() - submittedAt.getTime()) / 86_400_000)
    : 0;

  // Q3-Q15 のスコア平均
  const avgScore = calcAverageScore(audit.items);

  return (
    <main className="min-h-screen bg-[#e8ebec] p-6">
      <div className="max-w-[1400px] mx-auto bg-white border border-[#e8ebe9] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,.08)] overflow-hidden">
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
              {admin.name.charAt(0)}
            </div>
            {admin.name}
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
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-zinc-900 mb-1">
                {user.name} さん
              </div>
              <div className="text-xs text-zinc-500 font-mono flex flex-wrap items-center">
                <ProfileMeta label={`入会 ${formatDate(user.joinedAt)}`} sub={`(${monthsSinceJoin(user.joinedAt)} ヶ月目)`} />
                <ProfileSep />
                <ProfileMeta label={`過去返信 ${replyCount} 回`} />
                <ProfileSep />
                <ProfileMeta label={monthLabel} />
                <ProfileSep />
                <ProfileMeta label={`${daysSinceSubmit} 日経過`} />
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
              {avgScore !== null && (
                <span className="bg-[#f8f9fa] text-zinc-600 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                  平均 {avgScore.toFixed(1)} / 10
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
                  <PastVideoRow key={p.id} audit={p} />
                ))}
              </div>
            )}
          </section>

          {/* 動画返信エリア (Step 9 で機能化) */}
          <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border border-[rgba(255,235,59,0.55)] rounded-xl px-5 py-4 mb-3.5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#e8ebe9]">
              <h3 className="text-[13px] font-bold text-[#b8860b] tracking-wide flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                動画で返信する (1 本にまとめて)
              </h3>
              <span className="text-[10px] text-zinc-500 italic">
                Step 9 で機能実装予定
              </span>
            </div>
            <p className="text-xs text-zinc-700 text-center mb-3 leading-relaxed">
              上の 17 項目を読みながら、1 本の動画にまとめて返信してください。
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <VideoReplyButton
                primary
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                }
                label="ブラウザで録画する"
                sub="推奨 ・ 読みながらすぐ撮れる"
              />
              <VideoReplyButton
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                }
                label="ファイルをアップロード"
                sub="tldv / スタジオ撮影 等"
              />
            </div>
          </section>

          {/* 操作バー (Step 9 で機能化) */}
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
      </div>
    </main>
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
  // body_measure: 先月 → 今月 + 差分
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
    const diffColor = diff < 0 ? "text-[#00897b]" : diff > 0 ? "text-zinc-500" : "text-zinc-400";
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

  // score: 0-10
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

  // text のみ: スコアなし
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

function PastVideoRow({ audit }: { audit: MonthlyAuditRow }) {
  const publishedAt = audit.nori_video_published_at
    ? new Date(audit.nori_video_published_at)
    : null;
  const duration = audit.nori_video_duration_sec
    ? formatDuration(audit.nori_video_duration_sec)
    : null;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-[#f8f9fa] rounded-md text-xs text-zinc-600">
      <span className="font-mono font-semibold text-zinc-900">
        {audit.target_month.substring(0, 7).replace("-", "/")}
      </span>
      {duration && <span>動画 {duration}</span>}
      {publishedAt && (
        <span className="text-zinc-400">
          {publishedAt.toLocaleDateString("ja-JP", {
            month: "2-digit",
            day: "2-digit",
          })}{" "}
          返信
        </span>
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

function VideoReplyButton({
  primary = false,
  icon,
  label,
  sub,
}: {
  primary?: boolean;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  const cls = primary
    ? "bg-[#00897b]/40 border-[#00897b]/40 text-white"
    : "bg-white border-[#e8ebe9] text-zinc-700";
  return (
    <button
      disabled
      className={`${cls} border rounded-xl px-3.5 py-4 text-center cursor-not-allowed opacity-60`}
    >
      <span className="block mb-1.5 flex justify-center">{icon}</span>
      <div className="text-[13px] font-bold mb-0.5">{label}</div>
      <div className="text-[10px] opacity-70">{sub}</div>
    </button>
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
      title={disabledExtra ?? "Step 9 で機能実装予定"}
    >
      {label}
      {arrow && <span className="text-[#00897b]">→</span>}
      {disabledExtra && (
        <span className="text-[10px] opacity-70 ml-1">{disabledExtra}</span>
      )}
    </button>
  );
}

// =====================================================================
// 補助関数
// =====================================================================

function calcAverageScore(items: MonthlyAuditItems): number | null {
  const scores: number[] = [];
  for (const q of AUDIT_QUESTIONS) {
    if (q.type !== "score") continue;
    const a = items[q.key as keyof MonthlyAuditItems] as
      | ScoreAnswer
      | undefined;
    if (a?.score !== undefined) scores.push(a.score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthsSinceJoin(iso: string | null): number {
  if (!iso) return 0;
  const joined = new Date(iso);
  const now = new Date();
  return (
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth())
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// =====================================================================
// データ取得 (page 内補助)
// =====================================================================

async function fetchUser(userId: string): Promise<{
  name: string;
  joinedAt: string | null;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("name, nickname, joined_at, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return { name: "(不明)", joinedAt: null };
  const name =
    (data.nickname as string | null) || (data.name as string) || "(不明)";
  const joinedAt =
    (data.joined_at as string | null) ?? (data.created_at as string | null);
  return { name, joinedAt };
}

async function fetchPastRepliedAudits(
  userId: string,
  currentAuditId: string
): Promise<MonthlyAuditRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .eq("user_id", userId)
    .neq("id", currentAuditId)
    .not("nori_video_published_at", "is", null)
    .order("target_month", { ascending: false });
  return (data ?? []) as unknown as MonthlyAuditRow[];
}
