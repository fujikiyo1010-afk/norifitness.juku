import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { countAdminDashboardMetrics } from "@/lib/workout/queries";

export const dynamic = "force-dynamic";

/**
 * 管理者ホーム (/admin)
 *
 * 「困らない設計」の起点として:
 *   - ダッシュボード: 受講生数 / 月次未返信 / 個別対応 / カルテ変更フラグ
 *   - クイックアクセス: 受講生一覧 / 月次受信箱 / 個別対応受信箱
 *
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)
 * アクセス制御: requireAdmin
 */
export default async function AdminHomePage() {
  await requireAdmin();
  const metrics = await countAdminDashboardMetrics();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* ヘッダー */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">管理者ホーム</h1>
          <p className="text-sm text-zinc-600 mt-1">
            のりfitness 筋肉塾 管理画面
          </p>
        </header>

        {/* ダッシュボード メトリクス */}
        <section className="mb-8">
          <h2 className="text-xs font-bold text-zinc-500 tracking-widest mb-3">
            ダッシュボード
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="受講生"
              value={metrics.totalUsers}
              suffix="人"
              tone="neutral"
            />
            <MetricCard
              label="月次未返信"
              value={metrics.pendingAudits}
              suffix="件"
              tone={metrics.pendingAudits > 0 ? "danger" : "success"}
              href="/admin/monthly-reviews"
              hint="動画返信が必要"
            />
            <MetricCard
              label="個別対応"
              value={metrics.pendingTotal}
              suffix="件"
              tone={metrics.pendingTotal > 0 ? "warning" : "success"}
              href="/admin/requests"
              hint={
                metrics.pendingTotal > 0
                  ? `カルテ ${metrics.pendingCarteRequests} / メニュー ${metrics.pendingWorkoutRequests}`
                  : "全件対応済み"
              }
            />
            <MetricCard
              label="カルテ変更あり"
              value={metrics.carteReviewFlagged}
              suffix="人"
              tone={metrics.carteReviewFlagged > 0 ? "warning" : "neutral"}
              hint="メニュー要確認"
            />
          </div>
        </section>

        {/* クイックアクセス */}
        <section className="mb-8">
          <h2 className="text-xs font-bold text-zinc-500 tracking-widest mb-3">
            クイックアクセス
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <QuickAccessCard
              title="受講生一覧"
              description="受講生の状態をまとめて確認、ハブ画面に飛ぶ"
              href="/admin/users"
            />
            <QuickAccessCard
              title="月次添削受信箱"
              description="提出された月次添削に動画で返信"
              href="/admin/monthly-reviews"
              badge={metrics.pendingAudits > 0 ? metrics.pendingAudits : null}
              badgeTone="danger"
            />
            <QuickAccessCard
              title="個別対応受信箱"
              description="カルテ更新 / メニュー変更のリクエストに対応"
              href="/admin/requests"
              badge={metrics.pendingTotal > 0 ? metrics.pendingTotal : null}
              badgeTone="warning"
            />
          </div>
        </section>

        {/* 注記 */}
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-4 text-xs text-zinc-500">
          ※ 管理画面はデスクトップ PC 専用。スマホ表示は未対応。
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// メトリクスカード
// =====================================================================

type Tone = "neutral" | "success" | "warning" | "danger";

function toneToBg(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-50 border-emerald-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    case "danger":
      return "bg-rose-50 border-rose-200";
    default:
      return "bg-white border-[#e8ebe9]";
  }
}

function toneToText(tone: Tone): string {
  switch (tone) {
    case "success":
      return "text-emerald-700";
    case "warning":
      return "text-amber-800";
    case "danger":
      return "text-rose-700";
    default:
      return "text-zinc-900";
  }
}

function MetricCard({
  label,
  value,
  suffix,
  tone,
  href,
  hint,
}: {
  label: string;
  value: number;
  suffix: string;
  tone: Tone;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div
      className={`rounded-[14px] border p-5 ${toneToBg(tone)} ${
        href ? "hover:shadow-md transition-shadow cursor-pointer" : ""
      }`}
    >
      <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-3xl font-bold font-mono ${toneToText(tone)}`}
        >
          {value}
        </span>
        <span className="text-xs text-zinc-500 font-medium">{suffix}</span>
      </div>
      {hint && (
        <div className="text-[10px] text-zinc-500 mt-1.5">{hint}</div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// =====================================================================
// クイックアクセスカード
// =====================================================================

function QuickAccessCard({
  title,
  description,
  href,
  badge,
  badgeTone,
}: {
  title: string;
  description: string;
  href: string;
  badge?: number | null;
  badgeTone?: Tone;
}) {
  return (
    <Link
      href={href}
      className="rounded-[14px] border border-[#e8ebe9] bg-white p-5 hover:border-[#00897b] hover:shadow-md transition-all block"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1">
          <div className="text-sm font-bold text-zinc-900 mb-1">{title}</div>
          <div className="text-xs text-zinc-600 leading-relaxed">
            {description}
          </div>
        </div>
        {badge && badge > 0 && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              badgeTone === "danger"
                ? "bg-rose-100 text-rose-700"
                : badgeTone === "warning"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 text-xs text-[#00695c] font-bold">
        開く →
      </div>
    </Link>
  );
}
