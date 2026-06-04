import Link from "next/link";
import {
  getMyCurrentMonthAudit,
  listMyAudits,
} from "@/lib/monthly-audit/queries";
import {
  getAuditStatus,
  formatTargetMonthLabel,
  countFilledItems,
  type MonthlyAuditRow,
  type AuditStatus,
} from "@/lib/monthly-audit/types";

export const dynamic = "force-dynamic";

/**
 * 月次添削 履歴画面 (/monthly-review)
 *
 * 設計元: /tmp/monthly_review_history.html (Phase 2-7 モック)
 *
 * 構成 (上から):
 *   - ブロック A: 今月の月次添削 (4 状態カード A/B/C/D で 1 つだけ表示)
 *   - ブロック B-1: カテゴリ別スコア (レーダー + バー) ※ Day 15+ で本格実装
 *   - ブロック B-2: 月次推移グラフ (折れ線) ※ Day 15+ で本格実装
 *   - ブロック C: 月別ログ一覧 (タップで月詳細へ)
 */
export default async function MonthlyReviewHistoryPage() {
  const currentAudit = await getMyCurrentMonthAudit();
  const allAudits = await listMyAudits(24); // 過去 2 年分
  const currentStatus = getAuditStatus(currentAudit);

  // 過去月 (当月を除く、新しい順)
  const pastAudits = currentAudit
    ? allAudits.filter((a) => a.id !== currentAudit.id)
    : allAudits;

  return (
    <main className="flex flex-1 flex-col bg-[#fafbfa] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] bg-white border-x border-[#e8ebe9]">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-[#e8ebe9] flex items-center justify-between bg-white">
          <Link href="/" className="text-zinc-900">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="text-sm font-bold text-zinc-900">月次添削 履歴</div>
          <div className="w-5" />
        </div>

        {/* スクロール本体 */}
        <div className="bg-[#fafbfa] pb-20">
          {/* ====== ブロック A: 今月の月次添削 (4 状態カード) ====== */}
          <BlockWrapper title="今月の月次添削" icon="clipboard">
            <CurrentMonthCard status={currentStatus} audit={currentAudit} />
          </BlockWrapper>

          {/* ====== ブロック B-1: カテゴリ別スコア (Day 15+ で本格実装、現状はプレースホルダ) ====== */}
          <BlockWrapper title="カテゴリ別スコア" icon="bar">
            <PlaceholderBlock
              text="過去 3 ヶ月以上の月次添削が揃うと、ここにカテゴリ別の推移が表示されます"
            />
          </BlockWrapper>

          {/* ====== ブロック B-2: 月次推移グラフ (Day 15+ で本格実装) ====== */}
          <BlockWrapper title="月次推移 (17 項目 平均)" icon="line">
            <PlaceholderBlock
              text="過去 3 ヶ月以上の月次添削が揃うと、ここに折れ線グラフが表示されます"
            />
          </BlockWrapper>

          {/* ====== ブロック C: 月別ログ一覧 ====== */}
          <BlockWrapper title="過去の月次添削" icon="calendar" hint="タップで詳細">
            <PastAuditList audits={pastAudits} />
          </BlockWrapper>
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// ブロック共通ラッパー
// =====================================================================
function BlockWrapper({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon: "clipboard" | "bar" | "line" | "calendar";
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white mx-4 my-4 border border-[#e8ebe9] rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="text-xs font-bold text-zinc-700 tracking-wide flex items-center gap-1.5">
          <BlockIcon name={icon} />
          {title}
        </div>
        {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function BlockIcon({ name }: { name: "clipboard" | "bar" | "line" | "calendar" }) {
  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "w-3.5 h-3.5",
  };
  if (name === "clipboard") {
    return (
      <svg {...svgProps}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    );
  }
  if (name === "bar") {
    return (
      <svg {...svgProps}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    );
  }
  if (name === "line") {
    return (
      <svg {...svgProps}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  // calendar
  return (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// =====================================================================
// ブロック A: 今月の月次添削 (4 状態カード、現在状態に応じて 1 つだけ表示)
// =====================================================================
function CurrentMonthCard({
  status,
  audit,
}: {
  status: AuditStatus;
  audit: MonthlyAuditRow | null;
}) {
  if (status === "a_empty") return <StateCardA />;
  if (status === "b_in_progress") return <StateCardB audit={audit!} />;
  if (status === "c_submitted") return <StateCardC audit={audit!} />;
  return <StateCardD audit={audit!} />;
}

// 状態 A: 未記入
function StateCardA() {
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-2xl px-4 py-4">
      <span className="inline-flex items-center justify-center leading-none text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f8f9fa] text-zinc-700 border border-[#e8ebe9]">
        今月分
      </span>
      <div className="text-sm font-medium text-zinc-900 mt-2 mb-1.5">
        月次添削が届いています
      </div>
      <div className="text-[11px] text-zinc-600 leading-relaxed mb-3">
        17 項目を振り返り、のりfitness に提出すると動画で返信が届きます。
        途中保存もできるので無理せずに。
      </div>
      <Link
        href="/monthly-review/form"
        className="block w-full text-center py-2.5 rounded-lg bg-[#00897b] hover:bg-[#00695c] text-white text-xs font-medium transition-colors"
      >
        記入を始める
      </Link>
    </div>
  );
}

// 状態 B: 記入中
function StateCardB({ audit }: { audit: MonthlyAuditRow }) {
  const filled = audit.items_filled_count;
  const total = 17;
  const pct = (filled / total) * 100;
  const lastSavedLabel = audit.last_saved_at
    ? new Date(audit.last_saved_at).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  return (
    <div className="bg-white border border-[#00897b] rounded-2xl px-4 py-4">
      <span className="inline-flex items-center justify-center leading-none text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(0,137,123,0.1)] text-[#00695c] border border-[#00897b]">
        記入中
      </span>
      <div className="text-sm font-medium text-zinc-900 mt-2 mb-2">
        {filled} / {total} 項目まで進んでいます
      </div>
      <div className="h-1 bg-[#f0f2f1] rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full bg-[#00897b] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-zinc-600 leading-relaxed mb-3">
        最後に保存: {lastSavedLabel}
        <br />
        提出するまで、のりfitness には届きません。
      </div>
      <Link
        href="/monthly-review/form"
        className="block w-full text-center py-2.5 rounded-lg bg-[#00897b] hover:bg-[#00695c] text-white text-xs font-medium transition-colors"
      >
        続きから記入する
      </Link>
    </div>
  );
}

// 状態 C: 提出済み・返信待ち
function StateCardC({ audit }: { audit: MonthlyAuditRow }) {
  const submittedAt = new Date(audit.submitted_at!);
  const submittedLabel = submittedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const daysSince = Math.floor(
    (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  return (
    <div className="bg-[#fafafa] border border-[#e8ebe9] rounded-2xl px-4 py-4">
      <span className="inline-flex items-center justify-center leading-none text-base font-bold px-3 py-1 rounded-full bg-white text-zinc-500 border border-[#e8ebe9]">
        提出済み
      </span>
      <div className="text-sm font-medium text-zinc-900 mt-2 mb-2 flex items-center">
        のりfitness が動画返信を準備中
        <span className="ml-2 inline-flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" />
          <span
            className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse"
            style={{ animationDelay: "0.4s" }}
          />
        </span>
      </div>
      <div className="text-[11px] text-zinc-600 leading-relaxed mb-3">
        提出いただきありがとうございました。動画返信は通常 数日以内 にお届けします。
        届いたらこの画面に表示されます。
      </div>
      <Link
        href={`/monthly-review/detail/${audit.target_month}`}
        className="block w-full text-center py-2.5 rounded-lg bg-[rgba(255,235,59,0.12)] text-[#b8860b] border border-[rgba(255,235,59,0.55)] text-xs font-bold hover:bg-[rgba(255,235,59,0.2)] transition-colors"
      >
        提出した内容を見直す
      </Link>
      <div className="text-[10px] text-zinc-500 text-center mt-2 font-mono">
        提出 {submittedLabel} ・ 経過 {daysSince} 日
      </div>
    </div>
  );
}

// 状態 D: 返信あり
function StateCardD({ audit }: { audit: MonthlyAuditRow }) {
  const publishedAt = new Date(audit.nori_video_published_at!);
  const publishedLabel = publishedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const monthLabel = formatTargetMonthLabel(audit.target_month).replace(
    " 月次報告",
    ""
  );
  return (
    <div className="bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)] rounded-2xl px-4 py-4">
      <span className="inline-flex items-center justify-center leading-none text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#b8860b] text-white">
        のりfitness から返信
      </span>
      <div className="text-sm font-medium text-zinc-900 mt-2 mb-1.5">
        動画返信が届きました
      </div>
      <div className="text-[11px] text-zinc-600 leading-relaxed mb-3">
        {monthLabel}の添削に動画でお返事しています。
        記入内容と一緒にご覧ください。
      </div>
      <Link
        href={`/monthly-review/detail/${audit.target_month}`}
        className="flex items-center justify-center gap-2 w-full text-center py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors"
      >
        <span className="text-[#00897b]">▶</span> {monthLabel} 月次添削動画を開く
      </Link>
      <div className="text-[10px] text-zinc-500 text-center mt-2 font-mono">
        返信 {publishedLabel}
      </div>
    </div>
  );
}

// =====================================================================
// ブロック B プレースホルダ (Day 15+ で本格実装)
// =====================================================================
function PlaceholderBlock({ text }: { text: string }) {
  return (
    <div className="bg-[#fafbfa] border border-dashed border-[#e8ebe9] rounded-lg px-4 py-6 text-center">
      <svg
        className="w-7 h-7 mx-auto mb-2 text-zinc-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
      <div className="text-[11px] text-zinc-500 leading-relaxed">{text}</div>
    </div>
  );
}

// =====================================================================
// ブロック C: 月別ログ一覧
// =====================================================================
function PastAuditList({ audits }: { audits: MonthlyAuditRow[] }) {
  if (audits.length === 0) {
    return (
      <div className="py-6 text-center text-[11px] text-zinc-500">
        まだ過去の月次添削はありません
      </div>
    );
  }

  return (
    <div>
      {audits.map((audit) => {
        const status = getAuditStatus(audit);
        const filled = countFilledItems(audit.items);
        const targetDate = new Date(audit.target_month);
        const monthLabel = `${targetDate.getFullYear()} 年 ${targetDate.getMonth() + 1} 月`;
        return (
          <Link
            key={audit.id}
            href={`/monthly-review/detail/${audit.target_month}`}
            className="flex items-center justify-between py-3 border-b border-[#e8ebe9] last:border-b-0 hover:bg-[#fafbfa] transition-colors -mx-1 px-1"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-zinc-900 font-mono text-sm">
                {monthLabel}
              </span>
              <PastBadge status={status} filledCount={filled} />
            </div>
            <span className="text-zinc-400 font-mono text-xs">▶</span>
          </Link>
        );
      })}
    </div>
  );
}

function PastBadge({
  status,
  filledCount,
}: {
  status: AuditStatus;
  filledCount: number;
}) {
  if (status === "d_replied") {
    return (
      <span className="inline-flex items-center justify-center leading-none text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,137,123,0.1)] text-[#00695c]">
        ✓ 返信あり
      </span>
    );
  }
  if (status === "c_submitted") {
    return (
      <span className="inline-flex items-center justify-center leading-none text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,235,59,0.18)] text-[#b8860b]">
        返信待ち
      </span>
    );
  }
  if (status === "b_in_progress") {
    return (
      <span className="inline-flex items-center justify-center leading-none text-[10px] px-2 py-0.5 rounded-full bg-[#f8f9fa] text-zinc-500">
        記入中 ({filledCount}/17)
      </span>
    );
  }
  // a_empty (基本ここには来ない、過去月で未記入は表示されない想定)
  return (
    <span className="inline-flex items-center justify-center leading-none text-[10px] px-2 py-0.5 rounded-full bg-[#f8f9fa] text-zinc-500">
      未記入
    </span>
  );
}
