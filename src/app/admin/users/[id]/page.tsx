import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireAdmin, getAdminInfo } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getCarteForAdmin,
  getCurrentMenuForAdmin,
  countPendingRequestsForUser,
} from "@/lib/workout/queries";
import { calcAge, calcAgeBand } from "@/lib/workout/types";
import {
  formatDistributionDate,
  formatDistributionDateTime,
} from "@/lib/workout/menu-display";
import { getLatestAuditForUser } from "@/lib/monthly-audit/queries";
import {
  AUDIT_STATUS_LABELS_ADMIN,
  formatTargetMonthLabel,
  getAuditStatus,
  type AuditStatus,
} from "@/lib/monthly-audit/types";
import { getGoalSheetForUser } from "@/lib/goal-sheet/queries";
import { countFilledSections } from "@/lib/goal-sheet/types";

export const dynamic = "force-dynamic";

/**
 * 管理画面 受講生ハブ画面 (/admin/users/[id])
 *
 * Step 4-A: 月次/目標/未対応リクエスト/フラグクリアを追加 (2026-06-03)
 *   - 月次添削 最新状況 + 個別作業画面リンク
 *   - 目標シート 進捗 + 最終更新日 (専用画面はまだ無いので閲覧リンクなし)
 *   - 未対応リクエスト件数 + 受信箱リンク
 *   - 「カルテ変更あり / メニュー要確認」フラグの確認済化ワンクリック
 *
 * Step 4-B 予定: sparkline / 達成度バー / 上部固定ヘッダ整理
 *
 * アクセス制御: requireAdmin
 */
export default async function AdminUserHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  // 受講生情報取得
  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, name, nickname, email, joined_at")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) {
    notFound();
  }

  // プロフィール (生年月日) 取得
  const { data: profileRow } = await admin
    .from("user_profiles")
    .select("birthday")
    .eq("user_id", userId)
    .maybeSingle();

  const birthday = (profileRow?.birthday as string | null) ?? null;
  const age = birthday ? calcAge(birthday) : null;
  const ageBand = birthday ? calcAgeBand(birthday) : null;

  // 6 リソースを並列取得
  const [carte, currentMenu, latestAudit, goalSheet, pendingCounts] =
    await Promise.all([
      getCarteForAdmin(userId),
      getCurrentMenuForAdmin(userId),
      getLatestAuditForUser(userId),
      getGoalSheetForUser(userId),
      countPendingRequestsForUser(userId),
    ]);

  const displayName = userRow.nickname || userRow.name;
  const isCarteReady =
    !!carte &&
    carte.environments.length > 0 &&
    !!carte.frequency_wish &&
    carte.focus_body_parts.length > 0;

  // 月次添削状態
  const auditStatus: AuditStatus = getAuditStatus(latestAudit);

  // 目標シート進捗
  const goalSheetFilled = goalSheet
    ? countFilledSections(goalSheet.content)
    : 0;

  /**
   * Server Action: 「確認済にする」 (menu_review_needed フラグをクリア)
   * inline で定義 → form action として直接使う
   */
  async function clearReviewFlagAction() {
    "use server";
    const me = await getAdminInfo();
    if (!me) return;
    const supabase = await createClient();
    await supabase
      .from("user_workout_carte")
      .update({ menu_review_needed: false })
      .eq("user_id", userId);
    revalidatePath(`/admin/users/${userId}`, "page");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label="ホームに戻る"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-zinc-900">
              {displayName}
            </h1>
            <p className="text-xs text-zinc-600">
              {ageBand ? (
                <>
                  {age}歳 / {ageBand}
                </>
              ) : (
                <span className="text-amber-700">生年月日 未設定</span>
              )}
              <span className="mx-2 text-zinc-300">|</span>
              {userRow.email}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* 筋トレカルテ */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              筋トレカルテ
            </h2>
            {carte?.menu_review_needed && (
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  カルテ変更あり / メニュー要確認
                </span>
                <form action={clearReviewFlagAction}>
                  <button
                    type="submit"
                    className="rounded-[4px] border border-amber-300 bg-white px-2.5 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-100"
                  >
                    確認済にする
                  </button>
                </form>
              </div>
            )}
          </div>

          {carte ? (
            <>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
                <dt className="text-zinc-500">性別</dt>
                <dd className="text-zinc-900 font-medium">{carte.gender}</dd>
                <dt className="text-zinc-500">環境</dt>
                <dd className="text-zinc-900 font-medium">
                  {carte.environments.join("・") || "—"}
                </dd>
                <dt className="text-zinc-500">頻度</dt>
                <dd className="text-zinc-900 font-medium">
                  {carte.frequency_wish ?? "—"}
                </dd>
                <dt className="text-zinc-500">重点部位</dt>
                <dd className="text-zinc-900 font-medium">
                  {carte.focus_body_parts.join("・") || "—"}
                </dd>
              </dl>
              <Link
                href={`/admin/users/${userId}/carte`}
                className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                カルテを編集 →
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-700 mb-3">
                この受講生はまだカルテを提出していません。
              </p>
              <Link
                href={`/admin/users/${userId}/carte`}
                className="inline-block rounded-[4px] bg-[#00897b] px-4 py-2 text-xs font-bold text-white hover:bg-[#00695c]"
              >
                代理でカルテを作成 →
              </Link>
            </>
          )}
        </section>

        {/* 配布中のメニュー */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              配布中のメニュー
            </h2>
            {currentMenu && (
              <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                配布済み
              </span>
            )}
          </div>

          {currentMenu ? (
            <>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
                <dt className="text-zinc-500">配布日時</dt>
                <dd className="text-zinc-900 font-medium font-mono">
                  {formatDistributionDateTime(currentMenu.created_at)}
                </dd>
                <dt className="text-zinc-500">サイクル数</dt>
                <dd className="text-zinc-900 font-medium">
                  {currentMenu.cycles?.length ?? 0} サイクル
                </dd>
                <dt className="text-zinc-500">総種目数</dt>
                <dd className="text-zinc-900 font-medium">
                  {(currentMenu.cycles ?? []).reduce(
                    (sum, c) =>
                      sum +
                      (c["週"] ?? []).reduce(
                        (s, w) => s + (w["種目"]?.length ?? 0),
                        0
                      ),
                    0
                  )}{" "}
                  種目
                </dd>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/users/${userId}/menu/new?from_current=1`}
                  className="inline-block rounded-[4px] border border-[#00897b] bg-[rgba(0,137,123,0.08)] px-4 py-2 text-xs font-bold text-[#00695c] hover:bg-[rgba(0,137,123,0.16)]"
                >
                  現メニューを編集して再配布 →
                </Link>
                <Link
                  href={`/admin/users/${userId}/match`}
                  className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  マッチング検索から新規配布 →
                </Link>
              </div>
            </>
          ) : isCarteReady ? (
            <>
              <p className="text-sm text-zinc-700 mb-3">
                まだメニューが配布されていません。
              </p>
              <Link
                href={`/admin/users/${userId}/match`}
                className="inline-block rounded-[4px] bg-[#00897b] px-4 py-2 text-xs font-bold text-white hover:bg-[#00695c]"
              >
                マッチング検索 → 配布 →
              </Link>
            </>
          ) : (
            <p className="text-sm text-amber-800">
              カルテが未完成のため、マッチング検索ができません。
              <br />
              先にカルテを完成させてください。
            </p>
          )}
        </section>

        {/* 月次添削 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">月次添削</h2>
            <span
              className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] ${auditStatusStyle(
                auditStatus
              )}`}
            >
              {AUDIT_STATUS_LABELS_ADMIN[auditStatus]}
            </span>
          </div>

          {latestAudit ? (
            <>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
                <dt className="text-zinc-500">最新月</dt>
                <dd className="text-zinc-900 font-medium">
                  {formatTargetMonthLabel(latestAudit.target_month)}
                </dd>
                <dt className="text-zinc-500">進捗</dt>
                <dd className="text-zinc-900 font-medium">
                  17 項目中 {latestAudit.items_filled_count} 項目記入済
                </dd>
                {latestAudit.submitted_at && (
                  <>
                    <dt className="text-zinc-500">提出日時</dt>
                    <dd className="text-zinc-900 font-medium font-mono">
                      {formatDistributionDateTime(latestAudit.submitted_at)}
                    </dd>
                  </>
                )}
                {latestAudit.nori_video_published_at && (
                  <>
                    <dt className="text-zinc-500">返信日時</dt>
                    <dd className="text-zinc-900 font-medium font-mono">
                      {formatDistributionDateTime(
                        latestAudit.nori_video_published_at
                      )}
                    </dd>
                  </>
                )}
              </dl>
              <Link
                href={`/admin/monthly-reviews/${latestAudit.id}`}
                className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                添削画面を開く →
              </Link>
            </>
          ) : (
            <p className="text-sm text-zinc-700">
              この受講生はまだ月次添削を 1 回も提出していません。
            </p>
          )}
        </section>

        {/* 目標シート */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">目標シート</h2>
            {goalSheet?.reviewed_at && (
              <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                添削済み
              </span>
            )}
          </div>

          {goalSheet ? (
            <>
              <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
                <dt className="text-zinc-500">記入セクション</dt>
                <dd className="text-zinc-900 font-medium">
                  5 セクション中 {goalSheetFilled} 記入済
                </dd>
                <dt className="text-zinc-500">最終更新日時</dt>
                <dd className="text-zinc-900 font-medium font-mono">
                  {formatDistributionDateTime(goalSheet.updated_at)}
                </dd>
                {goalSheet.reviewed_at && (
                  <>
                    <dt className="text-zinc-500">添削日時</dt>
                    <dd className="text-zinc-900 font-medium font-mono">
                      {formatDistributionDateTime(goalSheet.reviewed_at)}
                    </dd>
                  </>
                )}
              </dl>
              <p className="text-[10px] text-zinc-500">
                ※ 目標シート専用の管理画面は未実装 (今後追加予定)
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-700">
              この受講生はまだ目標シートを作成していません。
            </p>
          )}
        </section>

        {/* 未対応リクエスト */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              未対応リクエスト
            </h2>
            {pendingCounts.total > 0 && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                計 {pendingCounts.total} 件
              </span>
            )}
          </div>

          {pendingCounts.total > 0 ? (
            <>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 gap-x-3 text-xs mb-4">
                <dt className="text-zinc-500">カルテ更新</dt>
                <dd className="text-zinc-900 font-medium">
                  {pendingCounts.carte} 件
                </dd>
                <dt className="text-zinc-500">メニュー変更</dt>
                <dd className="text-zinc-900 font-medium">
                  {pendingCounts.workout} 件
                </dd>
              </dl>
              <Link
                href="/admin/requests"
                className="inline-block rounded-[4px] bg-amber-100 hover:bg-amber-200 px-4 py-2 text-xs font-bold text-amber-800"
              >
                受信箱で対応する →
              </Link>
            </>
          ) : (
            <p className="text-sm text-zinc-700">
              この受講生からの未対応リクエストはありません 🎉
            </p>
          )}
        </section>

        {/* 受講生メタ情報 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">基本情報</h2>
          </div>
          <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 gap-x-3 text-xs">
            <dt className="text-zinc-500">本名</dt>
            <dd className="text-zinc-900 font-medium">{userRow.name}</dd>
            <dt className="text-zinc-500">ニックネーム</dt>
            <dd className="text-zinc-900 font-medium">
              {userRow.nickname || "—"}
            </dd>
            <dt className="text-zinc-500">メール</dt>
            <dd className="text-zinc-900 font-medium font-mono">
              {userRow.email}
            </dd>
            <dt className="text-zinc-500">加入日</dt>
            <dd className="text-zinc-900 font-medium font-mono">
              {userRow.joined_at
                ? formatDistributionDate(userRow.joined_at as string)
                : "—"}
            </dd>
          </dl>
        </section>

        {/* 注記 */}
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-4 text-xs text-zinc-500">
          ※ Step 4-A 完了。Step 4-B で体組成推移 (sparkline) / 達成度バー /
          上部固定ヘッダ整理を追加予定。
        </div>
      </main>
    </div>
  );
}

function auditStatusStyle(status: AuditStatus): string {
  switch (status) {
    case "a_empty":
      return "bg-zinc-100 text-zinc-600 font-medium";
    case "b_in_progress":
      return "bg-amber-50 text-amber-800 font-medium";
    // ★ C 状態は「のり氏が一目で見つけられるよう」強調 (赤背景 + 白文字 + 太字 + ピン留めアイコン)
    case "c_submitted":
      return "bg-rose-500 text-white font-bold shadow-sm";
    case "d_replied":
      return "bg-emerald-50 text-emerald-800 font-medium";
  }
}
