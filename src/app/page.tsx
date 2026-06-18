import Link from "next/link";
import { getAdminInfo } from "@/lib/auth/admin";
import { getMyAlerts, type MemberAlert, type MemberAlertKey } from "@/lib/member/alerts";
import { getMyHomeStats } from "@/lib/member/home-stats";
import { getMyLastWatchedLesson } from "@/lib/member/last-watched";
import { getMyGoalSheetStatus } from "@/lib/member/goal-sheet-status";
import { signOut } from "./login/actions";

export const dynamic = "force-dynamic";

/**
 * 受講生 ホーム画面 v4 (ティール緑統一版)
 *
 * 設計元: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 *
 * 構成 (上から):
 *   - ヘッダー (筋肉塾ロゴ / お知らせアイコン / プロフィールアイコン)
 *   - ヒーロー帯 (挨拶 + 入会日 + 経過日数)
 *   - 黄バナー 3 (カルテ / 目標シート / 体組成 未記入の時のみ)
 *   - 続きから学ぶ CTA (last_watched_at 最新、 なければ「最初のレッスンへ」)
 *   - 4 機能ブロック (コース / 学習 / LINE / ツール)
 *   - 横長 目標管理シート (添削届けば メールアイコンバッジ)
 *   - 全体進捗バー
 *   - 数値 3 枠 (完了レッスン / 視聴時間 / 入会日数)
 *   - 管理者の場合のみ「管理画面へ」リンク (小さく目立たない)
 *   - ログアウトボタン
 *
 * 嘘の数字禁止原則:
 *   - 視聴時間 = watched_seconds 加算ロジック未実装のため null = 「—」表示
 *   - 通知未読バッジ = 未読管理テーブル未実装のため 赤ドット出さない
 *   - 目標シート添削数 = 既読管理未実装のため 数字なし「添削あり」表示のみ
 */
export default async function Home() {
  const [alerts, stats, lastWatched, goalSheet, admin] = await Promise.all([
    getMyAlerts(),
    getMyHomeStats(),
    getMyLastWatchedLesson(),
    getMyGoalSheetStatus(),
    getAdminInfo(),
  ]);

  const displayName = stats?.displayName ?? "受講生";
  const joinedAtLabel = stats
    ? new Date(stats.joinedAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
  const progressPct =
    stats && stats.totalLessons > 0
      ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
      : 0;

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-[18px] py-[14px] border-b border-[#e7dcc9] bg-[#fffdf8] sticky top-0 z-10">
        <div className="text-[17px] font-bold tracking-[0.04em] text-[#004d40]">
          筋肉塾
        </div>
        <Link
          href="/account"
          aria-label="プロフィール"
          className="w-[26px] h-[26px] rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[12px] font-bold"
        >
          {displayName.charAt(0)}
        </Link>
      </header>

      {/* ヒーロー帯 */}
      <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-5 py-[22px]">
        <h1 className="text-[18px] font-bold text-[#2b2620] mb-1">
          こんにちは、{displayName} さん
        </h1>
        <div className="text-[11px] text-[#6a6256] font-mono">
          入会 {joinedAtLabel}
          {stats && ` ・ ${stats.daysSinceJoined + 1} 日目`}
        </div>
      </section>

      {/* 黄バナー 3 (該当アラートのみ表示) */}
      <div className="px-4 pt-3.5 flex flex-col gap-2">
        {alerts.map((alert) => (
          <NoticeBanner key={alert.key} alert={alert} />
        ))}
      </div>

      {/* 続きから学ぶ CTA */}
      <div className="px-4 pt-3.5">
        <ContinueCTA lastWatched={lastWatched} />
      </div>

      {/* 3 機能ブロック (LINE サポートは線② で復活予定) */}
      <SectionLabel>機能</SectionLabel>
      <div className="grid grid-cols-3 gap-2 px-4">
        <FeatureBlock
          href="/courses"
          name="コース一覧"
          desc="動画を見る"
          icon={<BookIcon />}
        />
        <FeatureBlock
          href="/my-log"
          name="学習"
          desc="振り返りと進捗"
          icon={<PencilIcon />}
        />
        <FeatureBlock
          href="/tools"
          name="ツール"
          desc="計算ツール"
          icon={<ToolIcon />}
        />
      </div>

      {/* 横長 目標管理シート */}
      <div className="px-4 pt-2">
        <Link
          href="/goal-sheet"
          className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-[18px] py-4 flex items-center gap-3 hover:border-[#4a875b] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#4a875b1a] flex items-center justify-center flex-shrink-0">
            <TargetIcon />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-[#2b2620] mb-0.5 flex items-center gap-1.5">
              目標管理シート
              {goalSheet.hasReviewNotice && (
                <span className="bg-[#b8860b] text-white text-[9px] px-1.5 py-[1px] rounded-full inline-flex items-center gap-1">
                  <MailMiniIcon /> 添削あり
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#6a6256]">
              {goalSheet.hasContent
                ? goalSheet.hasReviewNotice
                  ? "のりfitness から添削が届いています"
                  : "記入済 ・ 添削待ち"
                : "まだ記入されていません"}
            </div>
          </div>
          <span className="text-[#a59b8c] font-mono text-xs">→</span>
        </Link>
      </div>

      {/* 全体進捗バー */}
      <div className="px-4 pt-[18px]">
        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3.5">
          <div className="flex justify-between items-baseline mb-2">
            <div className="text-[11px] font-semibold text-zinc-600">
              全体進捗
            </div>
            <div className="font-mono text-base font-bold text-[#34603f]">
              {progressPct}%
              <span className="text-[10px] text-[#6a6256] ml-1">
                ({stats?.completedLessons ?? 0} / {stats?.totalLessons ?? 0})
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4a875b] to-[#34603f] rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 数値 2 枠 (視聴時間は加算ロジック未実装 = 線② で復活) */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <StatCell
          num={stats?.completedLessons ?? 0}
          unit="レッスン"
          label="完了"
        />
        <StatCell
          num={(stats?.daysSinceJoined ?? 0) + 1}
          unit="日目"
          label="入会から"
        />
      </div>

      {/* フッター (管理者リンク + ログアウト) */}
      <footer className="mt-auto px-4 pt-8 pb-6 flex flex-col items-center gap-3">
        {admin && (
          <Link
            href="/admin"
            className="text-[11px] text-[#6a6256] hover:text-[#34603f] transition-colors"
          >
            管理画面へ →
          </Link>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="text-[11px] text-[#a59b8c] hover:text-zinc-700 transition-colors"
          >
            ログアウト
          </button>
        </form>
      </footer>
      </div>
    </main>
  );
}

// =====================================================================
// 黄バナー
// =====================================================================

type AlertConfig = {
  /** 動的データを受けて strong 文字列を生成 (= 体組成 N 日途絶など)。 string で固定値も OK */
  strong: string | ((alert: MemberAlert) => string);
  tail: string;
  href: string;
  icon: React.ReactNode;
};

const ALERT_CONFIG: Record<MemberAlertKey, AlertConfig> = {
  carte_blank: {
    strong: "カルテが未記入",
    tail: "です。専用メニュー作成のために記入を",
    href: "/workout/carte/new",
    icon: <DocIcon />,
  },
  goal_sheet_blank: {
    strong: "目標管理シートが未記入",
    tail: "です。タップして設定しましょう",
    href: "/goal-sheet",
    icon: <TargetIcon />,
  },
  body_metrics_missing: {
    strong: "体組成 まだ記録なし",
    tail: "。基準値を記録しましょう",
    href: "/body-metrics",
    icon: <BarIcon />,
  },
  body_metrics_stalled: {
    strong: (alert) =>
      `体組成の記録が止まっています (最後 ${alert.daysSinceLatest ?? "?"} 日前)`,
    tail: "。記録しましょう",
    href: "/body-metrics",
    icon: <BarIcon />,
  },
};

function NoticeBanner({ alert }: { alert: MemberAlert }) {
  const cfg = ALERT_CONFIG[alert.key];
  const strong =
    typeof cfg.strong === "function" ? cfg.strong(alert) : cfg.strong;
  return (
    <Link
      href={cfg.href}
      className="px-3.5 py-3 bg-gradient-to-br from-[rgba(255,235,59,0.18)] to-[rgba(255,235,59,0.10)] border border-[rgba(255,235,59,0.55)] rounded-[10px] flex items-center gap-2.5 text-[12px] text-[#2b2620]"
    >
      <span className="flex-shrink-0 w-[18px] h-[18px] text-zinc-700">
        {cfg.icon}
      </span>
      <span className="flex-1">
        <b className="text-[#b8860b] font-bold">{strong}</b>
        {cfg.tail}
      </span>
      <span className="text-[#b8860b] font-mono font-bold">→</span>
    </Link>
  );
}

// =====================================================================
// 続きから学ぶ CTA
// =====================================================================

function ContinueCTA({
  lastWatched,
}: {
  lastWatched: Awaited<ReturnType<typeof getMyLastWatchedLesson>>;
}) {
  if (lastWatched) {
    return (
      <Link
        href={lastWatched.href}
        className="block bg-gradient-to-br from-[#4a875b] to-[#34603f] rounded-[14px] px-[18px] py-4 text-white shadow-[0_4px_14px_rgba(0,137,123,0.22)] relative overflow-hidden"
      >
        <div className="text-[11px] opacity-90 mb-1 tracking-[0.03em] flex items-center gap-1">
          <span className="font-mono">▶</span> 続きから学ぶ
        </div>
        <div className="text-[16px] font-bold mb-0.5 pr-12 line-clamp-1">
          {lastWatched.lessonTitle}
        </div>
        <div className="text-[11px] opacity-85 pr-12 line-clamp-1">
          {lastWatched.courseTitle} ・ {lastWatched.chapterTitle}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#fffdf8]/20 flex items-center justify-center text-sm">
          ▶
        </div>
      </Link>
    );
  }

  // 未受講: 最初のレッスンへ
  return (
    <Link
      href="/courses"
      className="block bg-gradient-to-br from-[#4a875b] to-[#34603f] rounded-[14px] px-[18px] py-4 text-white shadow-[0_4px_14px_rgba(0,137,123,0.22)] relative overflow-hidden"
    >
      <div className="text-[11px] opacity-90 mb-1 tracking-[0.03em] flex items-center gap-1">
        <span className="font-mono">▶</span> 最初のレッスンへ
      </div>
      <div className="text-[16px] font-bold mb-0.5 pr-12">
        コース一覧を開く
      </div>
      <div className="text-[11px] opacity-85 pr-12">
        まずは 1 本見てみましょう
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#fffdf8]/20 flex items-center justify-center text-sm">
        ▶
      </div>
    </Link>
  );
}

// =====================================================================
// 4 機能ブロック
// =====================================================================

function FeatureBlock({
  href,
  name,
  desc,
  icon,
  disabled,
}: {
  href?: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div className="w-10 h-10 mx-auto mb-2.5 flex items-center justify-center text-[#2b2620]">
        {icon}
      </div>
      <div className="text-[12px] font-semibold text-[#2b2620] mb-0.5">
        {name}
      </div>
      <div className="text-[9px] text-[#6a6256] leading-tight">{desc}</div>
    </>
  );
  const base =
    "bg-[#fffdf8] border border-[#e7dcc9] rounded-[4px] px-3 pt-5 pb-4 text-center transition-[border-color,transform] duration-150";
  if (disabled || !href) {
    return (
      <div className={`${base} opacity-60 cursor-not-allowed`}>{inner}</div>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} hover:border-[#4a875b] hover:-translate-y-px`}
    >
      {inner}
    </Link>
  );
}

// =====================================================================
// 数値 1 枠
// =====================================================================

function StatCell({
  num,
  unit,
  label,
}: {
  num: number | string;
  unit: string;
  label: string;
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-1.5 py-3 text-center">
      <div className="font-mono text-[22px] font-bold text-[#004d40] leading-none">
        {num}
      </div>
      {unit && (
        <div className="text-[10px] text-[#6a6256] mt-1">{unit}</div>
      )}
      <div className="text-[10px] text-zinc-600 mt-1">{label}</div>
    </div>
  );
}

// =====================================================================
// セクションラベル
// =====================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-[#6a6256] font-bold tracking-[0.06em] mx-4 mt-[18px] mb-2 pl-1">
      {children}
    </div>
  );
}

// =====================================================================
// ユーティリティ
// =====================================================================

// =====================================================================
// アイコン (線画黒一色、 許可絵文字は ✓ ▶ → ← のみ)
// =====================================================================

const ICO_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function MailMiniIcon() {
  return (
    <svg {...ICO_PROPS} width="10" height="10" strokeWidth={2.5}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      {...ICO_PROPS}
      width="20"
      height="20"
      className="text-[#4a875b]"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function BarIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}
