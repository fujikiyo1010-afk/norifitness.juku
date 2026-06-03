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
import {
  getLatestAuditForUser,
  listAuditsForUser,
} from "@/lib/monthly-audit/queries";
import {
  AUDIT_STATUS_LABELS_ADMIN,
  formatTargetMonthLabel,
  getAuditStatus,
  type AuditStatus,
} from "@/lib/monthly-audit/types";
import {
  extractWeightSeries,
  extractWaistSeries,
  extractCategoryAverages,
  getLatestAndPrevious,
  calcBMI,
  classifyBMI,
  calcWeightProgress,
} from "@/lib/monthly-audit/series";
import {
  getGoalSheetForUser,
  listGoalSheetRevisionsForUser,
} from "@/lib/goal-sheet/queries";
import { countFilledSections } from "@/lib/goal-sheet/types";
import { Sparkline } from "./_components/Sparkline";

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

  // 7 リソースを並列取得
  const [
    carte,
    currentMenu,
    latestAudit,
    recentAudits,
    goalSheet,
    revisions,
    pendingCounts,
  ] = await Promise.all([
    getCarteForAdmin(userId),
    getCurrentMenuForAdmin(userId),
    getLatestAuditForUser(userId),
    listAuditsForUser(userId, 5), // 直近 5 ヶ月 (sparkline 用)
    getGoalSheetForUser(userId),
    listGoalSheetRevisionsForUser(userId, 2), // 前回値比較用 (最新1件 = 1 つ前の編集)
    countPendingRequestsForUser(userId),
  ]);

  // 体組成推移データ
  const weightSeries = extractWeightSeries(recentAudits);
  const waistSeries = extractWaistSeries(recentAudits);
  const { latest: latestWeight, previous: prevWeight } =
    getLatestAndPrevious(weightSeries);
  const { latest: latestWaist, previous: prevWaist } =
    getLatestAndPrevious(waistSeries);

  // 体脂肪率 (現在値 = 目標シートの current_status、前回値 = revisions 最新スナップショット)
  const currentBodyFat = goalSheet?.content.current_status?.body_fat_pct ?? null;
  const prevBodyFatRevision = revisions[0]?.snapshot?.current_status?.body_fat_pct ?? null;

  // BMI (体重 + 身長から計算、片方欠けたら null)
  const heightCm = goalSheet?.content.current_status?.height_cm ?? null;
  const currentBMI = calcBMI(latestWeight, heightCm);
  const bmiCategory = currentBMI !== null ? classifyBMI(currentBMI) : null;

  // カテゴリ別スコア平均 (Q3-Q15、4 カテゴリの最新月 / 前月)
  const categoryAvgs = extractCategoryAverages(recentAudits);

  // 達成度 (体重): 開始 (目標シート作成時の体重) → 現在 → 目標
  const startWeight = goalSheet?.content.current_status?.weight_kg ?? null;
  const targetWeight = goalSheet?.content.goal_selection?.target_weight_kg ?? null;
  const targetDate = goalSheet?.content.goal_selection?.target_date ?? null;
  const weightProgress = calcWeightProgress(startWeight, latestWeight, targetWeight);

  // 対応事項の総件数 (対応事項セクションで使用)
  const hasCarteFlag = !!carte?.menu_review_needed;
  const totalActions = pendingCounts.total + (hasCarteFlag ? 1 : 0);

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
              {userRow.nickname && userRow.name && (
                <span className="ml-2 text-[11px] font-normal text-zinc-500">
                  (本名 {userRow.name})
                </span>
              )}
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
              <span className="font-mono">{userRow.email}</span>
              {userRow.joined_at && (
                <>
                  <span className="mx-2 text-zinc-300">|</span>
                  加入 <span className="font-mono">{formatDistributionDate(userRow.joined_at as string)}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* 体組成推移 (Step 4-B) */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">体組成推移</h2>
            <span className="text-[10px] text-zinc-500">
              直近 5 ヶ月 (月次添削から)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <SeriesHeader
                label="体重"
                latest={latestWeight}
                previous={prevWeight}
                unit="kg"
                directionGood="down"
              />
              <Sparkline series={weightSeries} unit="kg" />
            </div>
            <div>
              <SeriesHeader
                label="ウエスト"
                latest={latestWaist}
                previous={prevWaist}
                unit="cm"
                directionGood="down"
              />
              <Sparkline series={waistSeries} unit="cm" color="#0288d1" />
            </div>
          </div>

          {/* 体脂肪率 + BMI を横並び 2 列 */}
          <div className="mt-5 pt-4 border-t border-[#e8ebe9] grid grid-cols-2 gap-5">
            <SeriesHeader
              label="体脂肪率"
              latest={currentBodyFat}
              previous={prevBodyFatRevision}
              unit="%"
              directionGood="down"
              noteWhenNoData="目標シートに未入力"
            />
            <BMICell value={currentBMI} category={bmiCategory} height={heightCm} />
          </div>

          {/* 添削スコア (Q3-Q15 カテゴリ平均、4 カテゴリ 2x2 グリッド) */}
          <div className="mt-5 pt-4 border-t border-[#e8ebe9]">
            <div className="text-[11px] text-zinc-500 font-bold tracking-widest mb-2.5">
              添削スコア (Q3-Q15 カテゴリ平均)
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-5">
              <CategoryScoreCell
                label="食事"
                latest={categoryAvgs.food.latest}
                previous={categoryAvgs.food.previous}
              />
              <CategoryScoreCell
                label="運動"
                latest={categoryAvgs.exercise.latest}
                previous={categoryAvgs.exercise.previous}
              />
              <CategoryScoreCell
                label="休息"
                latest={categoryAvgs.rest.latest}
                previous={categoryAvgs.rest.previous}
              />
              <CategoryScoreCell
                label="マインド"
                latest={categoryAvgs.mind.latest}
                previous={categoryAvgs.mind.previous}
              />
            </div>
          </div>
        </section>

        {/* 達成度 (体重: 開始 → 現在 → 目標) */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">達成度 (体重)</h2>
            <span className="text-[10px] text-zinc-500">
              目標シート + 月次添削から
            </span>
          </div>
          <WeightProgressBlock
            startWeight={startWeight}
            currentWeight={latestWeight}
            targetWeight={targetWeight}
            targetDate={targetDate}
            progress={weightProgress}
            hasGoalSheet={!!goalSheet}
          />
        </section>

        {/* 対応事項 (案 C: カルテフラグ + 受講生リクエストを集約) */}
        {(() => {
          return (
            <section
              className={`rounded-[14px] border bg-white p-5 ${
                totalActions > 0 ? "border-amber-300" : "border-[#e8ebe9]"
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-[#00897b]" />
                <h2 className="text-sm font-semibold text-zinc-900">
                  対応事項
                </h2>
                {totalActions > 0 && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                    計 {totalActions} 件
                  </span>
                )}
              </div>

              {totalActions === 0 ? (
                <p className="text-sm text-zinc-700">
                  対応事項はありません 🎉
                </p>
              ) : (
                <div className="space-y-3">
                  {/* カルテ変更フラグ (セルフリマインダ) */}
                  {hasCarteFlag && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-amber-900 mb-0.5">
                          カルテ変更あり / メニュー要確認
                        </div>
                        <div className="text-[11px] text-amber-800">
                          自分でカルテの機械マッチング項目を変更しました。今のメニューが新カルテと合っているか確認してください。
                        </div>
                      </div>
                      <form action={clearReviewFlagAction}>
                        <button
                          type="submit"
                          className="rounded-[4px] border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                        >
                          確認済にする
                        </button>
                      </form>
                    </div>
                  )}

                  {/* 受講生からのリクエスト */}
                  {pendingCounts.total > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-amber-900 mb-0.5">
                          受講生からの未対応リクエスト
                        </div>
                        <div className="text-[11px] text-amber-800">
                          カルテ更新 {pendingCounts.carte} 件 / メニュー変更{" "}
                          {pendingCounts.workout} 件
                        </div>
                      </div>
                      <Link
                        href="/admin/requests"
                        className="rounded-[4px] bg-amber-100 hover:bg-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-800 whitespace-nowrap"
                      >
                        受信箱で対応 →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {/* 4 セクション 2x2 グリッド (月次/メニュー/目標/カルテ) */}
        <div className="grid grid-cols-2 gap-5">

        {/* 月次添削 (C 状態の時は枠線を薄い赤で強調) */}
        <section
          className={`rounded-[14px] border bg-white p-5 ${
            auditStatus === "c_submitted"
              ? "border-rose-300"
              : "border-[#e8ebe9]"
          }`}
        >
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
                href={`/admin/monthly-reviews/${latestAudit.id}?from=hub&user_id=${userId}`}
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

        {/* 配布中のメニュー (状態 2: 未配布カルテ準備済 = 橙線で「のり氏アクション要」) */}
        <section
          className={`rounded-[14px] border bg-white p-5 ${
            !currentMenu && isCarteReady
              ? "border-amber-300"
              : "border-[#e8ebe9]"
          }`}
        >
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

        {/* 筋トレカルテ (フラグは「対応事項」に集約済、ここは静的情報のみ) */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              筋トレカルテ
            </h2>
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

        </div>
        {/* /4 セクション グリッド終了 */}

        {/* 注記 (基本情報はヘッダに統合済み) */}
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-4 text-xs text-zinc-500">
          ※ Step 4-B-1 (体組成推移) + 案 C (対応事項集約 + 順序見直し) 完了。
          Step 4-B-2 で達成度セクション、Step 4-B-3 で上部 1 行サマリヘッダを追加予定。
        </div>
      </main>
    </div>
  );
}

/**
 * 体重達成度: 開始 → 現在 → 目標 のプログレスバー + テキスト。
 * データ欠落時のフォールバック表示を内包。
 */
function WeightProgressBlock({
  startWeight,
  currentWeight,
  targetWeight,
  targetDate,
  progress,
  hasGoalSheet,
}: {
  startWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  progress: import("@/lib/monthly-audit/series").GoalProgress | null;
  hasGoalSheet: boolean;
}) {
  // パターン 1: 目標シートが無い
  if (!hasGoalSheet) {
    return (
      <p className="text-xs text-zinc-500">
        目標シートが未作成のため、達成度を計算できません。
      </p>
    );
  }
  // パターン 2: 目標体重が未設定
  if (typeof targetWeight !== "number") {
    return (
      <p className="text-xs text-zinc-500">
        目標体重が未設定です。目標シートで「目標体重」を入力してください。
      </p>
    );
  }
  // パターン 3: 開始体重が未設定 (達成度バーは描けないが、現在 → 目標 だけ示す)
  if (typeof startWeight !== "number") {
    return (
      <div>
        <p className="text-xs text-zinc-500 mb-2">
          開始時の体重 (目標シート 現状値) が未入力のため、達成率は計算できません。
        </p>
        {currentWeight !== null && (
          <div className="text-sm">
            現在{" "}
            <span className="font-bold text-zinc-900 font-mono">
              {currentWeight.toFixed(1)} kg
            </span>{" "}
            → 目標{" "}
            <span className="font-bold text-[#00695c] font-mono">
              {targetWeight.toFixed(1)} kg
            </span>{" "}
            <span className="text-zinc-500 ml-2">
              (差 {(targetWeight - currentWeight).toFixed(1)} kg)
            </span>
          </div>
        )}
      </div>
    );
  }
  // パターン 4: 現在体重が未測定 (月次添削まだ)
  if (currentWeight === null) {
    return (
      <p className="text-xs text-zinc-500">
        現在の体重が未測定です (月次添削の Q1 が空欄)。
      </p>
    );
  }

  // パターン 5: 全部揃っている (本命)
  const pct = (progress?.ratio ?? 0) * 100;
  const remainingAbs = Math.abs(progress?.remaining ?? 0);
  const direction = progress?.direction ?? "down";
  const arrowText =
    progress && progress.remaining === 0
      ? "達成"
      : direction === "down"
        ? `あと -${remainingAbs.toFixed(1)} kg`
        : `あと +${remainingAbs.toFixed(1)} kg`;

  return (
    <div>
      {/* 上段: 現在 → 目標 + 距離 */}
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-sm">
          現在{" "}
          <span className="font-bold text-zinc-900 font-mono text-base">
            {currentWeight.toFixed(1)}
          </span>{" "}
          <span className="text-[10px] text-zinc-500">kg</span>{" "}
          <span className="text-zinc-400 mx-1">→</span> 目標{" "}
          <span className="font-bold text-[#00695c] font-mono text-base">
            {targetWeight.toFixed(1)}
          </span>{" "}
          <span className="text-[10px] text-[#00695c]">kg</span>
        </div>
        <div className="text-sm font-bold text-zinc-700">
          {pct.toFixed(0)}% 達成
        </div>
      </div>

      {/* プログレスバー (開始〜目標が両端) */}
      <div className="relative h-3 bg-zinc-100 rounded-full overflow-visible mb-1">
        <div
          className="absolute top-0 left-0 h-full bg-[#00897b] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* 現在位置のドット */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#00897b]"
          style={{ left: `${pct}%` }}
        />
      </div>
      {/* 開始/目標ラベル */}
      <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-3">
        <span>開始 {startWeight.toFixed(1)} kg</span>
        <span>目標 {targetWeight.toFixed(1)} kg</span>
      </div>

      {/* 下段: 残り距離 + 目標日 */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-zinc-700 font-bold">{arrowText}</span>
        {targetDate && (
          <>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-500">
              目標日{" "}
              <span className="font-mono">
                {formatDistributionDate(targetDate)}
              </span>
              {(() => {
                const days = Math.floor(
                  (new Date(targetDate).getTime() - Date.now()) /
                    86_400_000
                );
                if (days < 0) {
                  return (
                    <span className="ml-1 text-rose-600 font-bold">
                      期限超過 {-days} 日
                    </span>
                  );
                }
                return (
                  <span className="ml-1 text-zinc-700">
                    残り {days} 日
                  </span>
                );
              })()}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 体組成値のヘッダ表示。現在値 + 前回比較 (差分の符号と色で良し悪し)。
 * directionGood = "down" のとき、減少 = 良い (体重・ウエスト・体脂肪)。
 */
function SeriesHeader({
  label,
  latest,
  previous,
  unit,
  directionGood,
  noteWhenNoData,
}: {
  label: string;
  latest: number | null;
  previous: number | null;
  unit: string;
  directionGood: "up" | "down";
  noteWhenNoData?: string;
}) {
  if (latest === null) {
    return (
      <div>
        <div className="text-[11px] text-zinc-500 font-bold tracking-widest mb-1">
          {label}
        </div>
        <div className="text-xs text-zinc-400">
          {noteWhenNoData ?? "データなし"}
        </div>
      </div>
    );
  }
  let diffNode: React.ReactNode = (
    <span className="text-xs text-zinc-400 font-mono">初回</span>
  );
  if (previous !== null) {
    const diff = latest - previous;
    const isGood =
      directionGood === "down" ? diff < 0 : diff > 0;
    const isFlat = diff === 0;
    const color = isFlat
      ? "text-zinc-500"
      : isGood
        ? "text-emerald-700"
        : "text-rose-600";
    const sign = diff > 0 ? "+" : "";
    diffNode = (
      <span className={`text-sm font-mono font-bold ${color}`}>
        {sign}
        {diff.toFixed(1)}
      </span>
    );
  }
  return (
    <div className="mb-1.5">
      <div className="text-[11px] text-zinc-500 font-bold tracking-widest mb-0.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-zinc-900 font-mono">
          {latest.toFixed(1)}
        </span>
        <span className="text-[10px] text-zinc-500">{unit}</span>
        {diffNode}
      </div>
    </div>
  );
}

/**
 * BMI セル: 現在値 + カテゴリ (適正/肥満/低体重) + 身長 (参考)。
 */
function BMICell({
  value,
  category,
  height,
}: {
  value: number | null;
  category: string | null;
  height: number | null;
}) {
  if (value === null) {
    return (
      <div>
        <div className="text-[11px] text-zinc-500 font-bold tracking-widest mb-0.5">
          BMI
        </div>
        <div className="text-xs text-zinc-400">
          {height === null
            ? "身長 / 体重が未入力"
            : "体重データなし"}
        </div>
      </div>
    );
  }
  const categoryColor =
    category === "適正"
      ? "text-emerald-700"
      : category === "低体重"
        ? "text-amber-700"
        : "text-rose-600";
  return (
    <div>
      <div className="text-[11px] text-zinc-500 font-bold tracking-widest mb-0.5">
        BMI
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-zinc-900 font-mono">
          {value.toFixed(1)}
        </span>
        <span className={`text-[11px] font-bold ${categoryColor}`}>
          ({category})
        </span>
      </div>
      {height !== null && (
        <div className="text-[9px] text-zinc-400 mt-0.5">
          身長 {height} cm を基準
        </div>
      )}
    </div>
  );
}

/**
 * カテゴリスコアセル: 0-10 平均スコア + 前回比。
 */
function CategoryScoreCell({
  label,
  latest,
  previous,
}: {
  label: string;
  latest: number | null;
  previous: number | null;
}) {
  if (latest === null) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] text-zinc-500 font-bold w-16">
          {label}
        </span>
        <span className="text-xs text-zinc-400">未記入</span>
      </div>
    );
  }
  let diffNode: React.ReactNode = (
    <span className="text-[10px] text-zinc-400 font-mono">初回</span>
  );
  if (previous !== null) {
    const diff = latest - previous;
    const isFlat = Math.abs(diff) < 0.05;
    const color = isFlat
      ? "text-zinc-500"
      : diff > 0
        ? "text-emerald-700"
        : "text-rose-600";
    const sign = diff > 0 ? "+" : "";
    diffNode = (
      <span className={`text-[11px] font-mono font-bold ${color}`}>
        {sign}
        {diff.toFixed(1)}
      </span>
    );
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] text-zinc-500 font-bold w-16">{label}</span>
      <span className="text-base font-bold text-zinc-900 font-mono">
        {latest.toFixed(1)}
      </span>
      {diffNode}
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
