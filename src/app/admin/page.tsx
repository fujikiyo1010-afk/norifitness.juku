import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDashboardKPI } from "@/lib/admin/dashboard";
import {
  listUsersWithAlerts,
  bucketAlertsBySeverity,
  type AlertTag,
  type UserWithAlerts,
} from "@/lib/admin/alerts";

export const dynamic = "force-dynamic";

/**
 * 管理者ホームダッシュボード (/admin)
 *
 * モック準拠: docs/03_design_mocks/recovered/管理画面_ホームダッシュボード.html
 *
 * 構成:
 *   - ヘッダー: 挨拶 + 日付 + 受講生数
 *   - KPI 6 カード (成果 1 + 残務 5)
 *   - 今すぐ対応セクション (緊急タグ持ち)
 *   - 今日中に確認セクション (注意タグ持ち)
 *
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)
 */
export default async function AdminHomePage() {
  await requireAdmin();
  const [kpi, usersWithAlerts] = await Promise.all([
    getDashboardKPI(),
    listUsersWithAlerts(),
  ]);

  const { urgent, warn } = bucketAlertsBySeverity(usersWithAlerts);
  const completionPercent = kpi.thisMonthAuditsTotal
    ? Math.round((kpi.thisMonthAuditsCompleted / kpi.thisMonthAuditsTotal) * 100)
    : 0;
  const remainingAudits = kpi.thisMonthAuditsTotal - kpi.thisMonthAuditsCompleted;

  const today = new Date();
  const dateStr = today.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      {/* ヘッダー */}
      <header className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">
            お疲れさまです、 管理者さん
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {dateStr} ・ 受講生 {kpi.totalUsers} 名
          </p>
        </div>
      </header>

      {/* KPI 6 カード */}
      <div
        className="grid gap-3.5 mb-7"
        style={{ gridTemplateColumns: "1.6fr repeat(5, 1fr)" }}
      >
        {/* ヒーロー: 月次添削 完了率 */}
        <div className="rounded-[10px] border border-[#b2dfdb] p-4 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6]">
          <div className="text-[11px] font-bold text-[#00695c] tracking-widest mb-2">
            今月の月次添削 完了率
          </div>
          <div className="flex items-baseline gap-2.5 mb-2">
            <span className="text-[32px] font-bold text-[#004d40] font-mono leading-none">
              {kpi.thisMonthAuditsCompleted}
            </span>
            <span className="text-sm text-zinc-600 font-medium">
              / {kpi.thisMonthAuditsTotal} 人
            </span>
            <span className="ml-auto text-lg font-bold text-[#004d40] font-mono">
              {completionPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-white/70 border border-[#b2dfdb] rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-[#00897b] to-[#00695c] rounded-full transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-[#004d40] font-semibold">
            残り {Math.max(0, remainingAudits)} 人
          </div>
        </div>

        <KpiCard
          label="月次添削 未送信"
          value={kpi.pendingAudits}
          suffix={`/ ${kpi.totalUsers}`}
          href="/admin/monthly-reviews"
          linkLabel={kpi.pendingAudits === 0 ? "✓ 全員返信済" : "添削する →"}
          allDone={kpi.pendingAudits === 0}
        />
        <KpiCard
          label="重要アラート"
          value={urgent.length}
          suffix="件"
          alert={urgent.length > 0}
          subText={
            urgent.length > 0
              ? "下記「今すぐ対応」参照"
              : "緊急対応はありません"
          }
          allDone={urgent.length === 0}
        />
        <KpiCard
          label="リクエスト未対応"
          value={kpi.pendingRequests}
          suffix="件"
          href="/admin/requests"
          linkLabel="確認する →"
        />
        <KpiCard
          label="プロテイン発送未対応"
          value={kpi.pendingShipments}
          suffix="件"
          href="/admin/shipments"
          linkLabel="発送リスト →"
        />
        <KpiCard
          label="新規入会 未処理"
          value={kpi.pendingInvitations}
          suffix="件"
          href="/admin/invitations"
          linkLabel={kpi.pendingInvitations === 0 ? "✓ すべて処理済" : "招待 →"}
          allDone={kpi.pendingInvitations === 0}
        />
      </div>

      {/* 今すぐ対応 */}
      {urgent.length > 0 && (
        <Section
          title="今すぐ対応"
          dotColor="bg-red-500"
          count={urgent.length}
          tone="urgent"
        >
          {urgent.map((user) => (
            <UserCard key={user.userId} user={user} />
          ))}
        </Section>
      )}

      {/* 今日中に確認 */}
      {warn.length > 0 && (
        <Section
          title="今日中に確認"
          dotColor="bg-orange-500"
          count={warn.length}
          tone="warn"
        >
          {warn.map((user) => (
            <UserCard key={user.userId} user={user} />
          ))}
        </Section>
      )}

      {/* アラートゼロ */}
      {urgent.length === 0 && warn.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-[#b2dfdb] bg-[#f0fdf4] px-5 py-8 text-center text-sm text-emerald-700">
          ✓ アラート対象の受講生はいません
        </div>
      )}
    </div>
  );
}

// =====================================================================
// KPI カード
// =====================================================================

function KpiCard({
  label,
  value,
  suffix,
  alert,
  href,
  linkLabel,
  subText,
  allDone,
}: {
  label: string;
  value: number;
  suffix?: string;
  alert?: boolean;
  href?: string;
  linkLabel?: string;
  subText?: string;
  allDone?: boolean;
}) {
  const bg = alert ? "bg-red-50 border-red-200" : "bg-white border-[#e8ebe9]";
  const valueColor = alert ? "text-red-600" : "text-zinc-900";

  const inner = (
    <div
      className={`rounded-[10px] border p-4 transition-colors h-full ${bg} ${
        href ? "hover:border-[#00897b] cursor-pointer" : ""
      }`}
    >
      <div className="text-[11px] font-bold text-zinc-500 tracking-widest mb-2">
        {label}
      </div>
      <div className={`text-[28px] font-bold font-mono leading-none ${valueColor}`}>
        {value}
        {suffix && (
          <span className="text-sm text-zinc-500 font-medium ml-1">{suffix}</span>
        )}
      </div>
      {(linkLabel || subText) && (
        <div
          className={`text-[11px] mt-1.5 flex items-center gap-1 ${
            allDone
              ? "text-emerald-600 font-semibold"
              : alert
                ? "text-red-600"
                : "text-zinc-500"
          }`}
        >
          {allDone && <CheckIcon className="w-3 h-3" />}
          {linkLabel ? (
            <span className="underline">{linkLabel}</span>
          ) : (
            <span>{subText}</span>
          )}
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// =====================================================================
// セクション (今すぐ対応 / 今日中に確認)
// =====================================================================

function Section({
  title,
  dotColor,
  count,
  tone,
  children,
}: {
  title: string;
  dotColor: string;
  count: number;
  tone: "urgent" | "warn";
  children: React.ReactNode;
}) {
  const countStyle =
    tone === "urgent"
      ? "text-red-600 bg-red-50 border-red-200"
      : "text-orange-700 bg-orange-50 border-orange-200";

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2.5 mb-3 mt-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="text-[15px] font-bold text-zinc-900">{title}</span>
        <span
          className={`text-xs border rounded-full px-2 py-px font-mono ${countStyle}`}
        >
          {count} 人
        </span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

// =====================================================================
// ユーザーカード
// =====================================================================

function UserCard({ user }: { user: UserWithAlerts }) {
  const actions = buildUserActions(user);

  return (
    <div className="rounded-[10px] border border-[#e8ebe9] bg-white px-4 py-3.5 flex items-center gap-3.5 hover:border-[#00897b] transition-colors">
      <div className="w-10 h-10 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {user.userName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-zinc-900 mb-1">
          {user.userName}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {user.tags.map((tag) => (
            <AlertChip key={tag.key} tag={tag} />
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#e8ebe9] rounded-md text-xs font-semibold text-zinc-900 hover:border-[#00897b] hover:bg-[#00897b]/10 hover:text-[#00695c] transition-colors"
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function AlertChip({ tag }: { tag: AlertTag }) {
  const cls =
    tag.severity === "urgent"
      ? "bg-red-50 text-red-600 border-red-200"
      : "bg-orange-50 text-orange-700 border-orange-200";
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {tag.label}
    </span>
  );
}

type UserAction = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

/**
 * アラートタグからアクションボタンを構築:
 *  - 「詳細」は常に表示 (受講生ハブ)
 *  - 最大 2 番目までアラートに応じたアクションを追加
 *    - 緊急: 最大 3 ボタン (詳細 + 2 アクション)
 *    - 注意: 最大 2 ボタン (詳細 + 1 アクション)
 */
function buildUserActions(user: UserWithAlerts): UserAction[] {
  const actions: UserAction[] = [
    {
      label: "詳細",
      href: `/admin/users/${user.userId}`,
      icon: <UserIcon className="w-3.5 h-3.5 text-[#00695c]" />,
    },
  ];

  const isUrgent = user.topSeverity === "urgent";
  const maxExtra = isUrgent ? 2 : 1;

  const seen = new Set<string>();
  for (const tag of user.tags) {
    if (actions.length >= 1 + maxExtra) break;
    const action = mapTagToAction(tag, user.userId);
    if (action && !seen.has(action.label)) {
      actions.push(action);
      seen.add(action.label);
    }
  }
  return actions;
}

function mapTagToAction(
  tag: AlertTag,
  userId: string
): UserAction | null {
  switch (tag.key) {
    case "monthly_overdue_soon":
    case "monthly_overdue":
      return {
        label: "添削",
        href: "/admin/monthly-reviews",
        icon: <VideoIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "carte_blank":
      return {
        label: "カルテ",
        href: `/admin/users/${userId}/carte`,
        icon: <DocIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "goal_sheet_blank":
      return {
        label: "目標シート",
        href: `/admin/users/${userId}/goal-sheet`,
        icon: <TargetIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "weight_gain":
    case "body_metrics_stalled":
      return {
        label: "体組成",
        href: `/admin/users/${userId}/metrics`,
        icon: <TargetIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    // 新1〜3(のり宿題): 管理ホームでそのまま次の一手に飛べるように
    case "nori_no_menu":
      return {
        label: "メニュー配布",
        href: `/admin/users/${userId}/menu/new?from_current=1`,
        icon: <DocIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "nori_no_video":
      return {
        label: "月次添削",
        href: "/admin/monthly-reviews",
        icon: <VideoIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "nori_chat_unreplied":
      return {
        label: "チャット",
        href: "/admin/messages",
        icon: <DocIcon className="w-3.5 h-3.5 text-[#00695c]" />,
      };
    case "no_learning":
    case "long_no_login":
    case "workout_stalled":
    case "meal_stalled":
    case "skip_streak":
      return null;
  }
}

// =====================================================================
// SVG アイコン
// =====================================================================

function svgBase(props: React.SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

function VideoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function DocIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase({ ...props, strokeWidth: 3 })}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
