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
import { getUserAlerts } from "@/lib/admin/alerts";
import { daysSinceDateJST } from "@/lib/date/jst";
import {
  formatDistributionDate,
  formatDistributionDateTime,
} from "@/lib/workout/menu-display";
import {
  getLatestAuditForUser,
  listAuditsForUser,
} from "@/lib/monthly-audit/queries";
import {
  getAuditStatus,
  type AuditStatus,
} from "@/lib/monthly-audit/types";
import {
  extractWeightSeries,
  extractWaistSeries,
  getLatestAndPrevious,
  calcBMI,
  classifyBMI,
  calcWeightProgress,
} from "@/lib/monthly-audit/series";
import { getLatestBodyMetricSummary } from "@/lib/body-metrics/queries";
import { weightGoalProgress } from "@/lib/body-metrics/goal-progress";
import {
  getGoalSheetForUser,
  listGoalSheetRevisionsForUser,
} from "@/lib/goal-sheet/queries";
import { countFilledSections } from "@/lib/goal-sheet/types";
import { Sparkline } from "./_components/Sparkline";
import { MonthlyAuditSection } from "./MonthlyAuditSection";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;
  const sp = await searchParams;

  // 動線判定: ?from=inbox なら戻り先を個別対応受信箱に
  const fromInbox = sp.from === "inbox";
  const back = fromInbox
    ? { href: "/admin/requests", label: "受信箱に戻る" }
    : { href: "/admin/users", label: "受講生一覧に戻る" };

  // 受講生情報 + プロフィール + 8リソースを一括並列取得。
  // S2: 以前は users → user_profiles を直列awaitしてから8本Promise.allだった(=先頭2往復が直列)。
  //   これら全て userId(param)引きで互いに独立なので、10本まとめて並列化(notFoundガードは後ろへ)。
  //   ※userRowが無ければ notFound。他9本の結果は捨てられるだけで無害(happy pathで最速)。
  const admin = createAdminClient();
  const [
    { data: userRow },
    { data: profileRow },
    carte,
    currentMenu,
    latestAudit,
    recentAudits,
    goalSheet,
    revisions,
    pendingCounts,
    latestBodyMetric,
    userAlerts,
  ] = await Promise.all([
    admin
      .from("users")
      .select("id, name, nickname, email, joined_at, form_review_first_done")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", userId)
      .maybeSingle(),
    getCarteForAdmin(userId),
    getCurrentMenuForAdmin(userId),
    getLatestAuditForUser(userId),
    listAuditsForUser(userId, 5), // 直近 5 ヶ月 (sparkline 用)
    getGoalSheetForUser(userId),
    listGoalSheetRevisionsForUser(userId, 2), // 前回値比較用 (最新1件 = 1 つ前の編集)
    countPendingRequestsForUser(userId),
    getLatestBodyMetricSummary(userId), // body_metrics (日々記録) の最新値
    getUserAlerts(userId), // ア6: この受講生のアラートタグ(ハブ概要ヘッダに表示)
  ]);

  if (!userRow) {
    notFound();
  }

  const birthday = (profileRow?.birthday as string | null) ?? null;
  const age = birthday ? calcAge(birthday) : null;
  const ageBand = birthday ? calcAgeBand(birthday) : null;

  // 体組成推移データ (sparkline + 前月比較は monthly_audits 由来のまま)
  const weightSeries = extractWeightSeries(recentAudits);
  const waistSeries = extractWaistSeries(recentAudits);
  const {
    latest: latestWeightFromAudit,
    previous: prevWeight,
  } = getLatestAndPrevious(weightSeries);
  const {
    latest: latestWaistFromAudit,
    previous: prevWaist,
  } = getLatestAndPrevious(waistSeries);

  // 「現在の最新値」 は body_metrics (日々記録) を優先、 なければ monthly_audits 最新で fallback。
  // 設計思想: のり氏はリアルタイムで見えるが日々の変更で通知されない (= プル/プッシュ分離、
  // 2026-06-15 きよむさん確定)。 推移グラフ自体は月次のまま。
  const latestWeight =
    latestBodyMetric.latest?.weight_kg ?? latestWeightFromAudit;
  const latestWaist =
    latestBodyMetric.latest?.waist_cm ?? latestWaistFromAudit;

  // 体脂肪率 (現在値 = 目標シートの current_status、前回値 = revisions 最新スナップショット)
  const currentBodyFat = goalSheet?.content.current_status?.body_fat_pct ?? null;
  const prevBodyFatRevision = revisions[0]?.snapshot?.current_status?.body_fat_pct ?? null;

  // BMI (体重 + 身長から計算、片方欠けたら null)
  const heightCm = goalSheet?.content.current_status?.height_cm ?? null;
  const currentBMI = calcBMI(latestWeight, heightCm);
  const bmiCategory = currentBMI !== null ? classifyBMI(currentBMI) : null;

  // 達成度 (体重): 開始 (目標シート作成時の体重) → 現在 → 目標
  const startWeight = goalSheet?.content.current_status?.weight_kg ?? null;
  const targetWeight = goalSheet?.content.goal_selection?.target_weight_kg ?? null;
  const targetDate = goalSheet?.content.goal_selection?.target_date ?? null;
  const weightProgress = calcWeightProgress(startWeight, latestWeight, targetWeight);

  // 対応事項の総件数 (対応事項セクションで使用)
  const hasCarteFlag = !!carte?.menu_review_needed;
  // β: 目標シート 「送信して添削を依頼」 押下後で未対応の状態を検知
  //   = last_review_requested_at が reviewed_at より新しい (or 未添削)
  const hasGoalSheetReReviewFlag =
    !!goalSheet?.last_review_requested_at &&
    (!goalSheet.reviewed_at ||
      goalSheet.last_review_requested_at > goalSheet.reviewed_at);
  const totalActions =
    pendingCounts.total +
    (hasCarteFlag ? 1 : 0) +
    (hasGoalSheetReReviewFlag ? 1 : 0);

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

  /**
   * Server Action: フォーム添削「初回完了」札のトグル。
   * true = 初回済み → 受講生は2回目以降(有料)URLへ。押し間違いを戻せるよう双方向。
   */
  const formReviewFirstDone = (userRow.form_review_first_done as boolean | null) === true;
  async function toggleFormReviewFirstDoneAction() {
    "use server";
    const me = await getAdminInfo();
    if (!me) return;
    const admin2 = createAdminClient();
    await admin2
      .from("users")
      .update({ form_review_first_done: !formReviewFirstDone })
      .eq("id", userId);
    revalidatePath(`/admin/users/${userId}`, "page");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー (タブバー top-0 の下に重ならないよう top-[44px]) */}
      <header className="sticky top-[44px] z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href={back.href}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label={back.label}
            title={back.label}
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
            {/* ア6: この受講生のアラートタグ(概要ヘッダ) */}
            {userAlerts.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {userAlerts.map((t, i) => (
                  <span
                    key={i}
                    className={`text-[10.5px] font-bold rounded-full px-2.5 py-[3px] border ${
                      t.severity === "urgent"
                        ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                        : "bg-[#fff4e6] text-[#c2600f] border-[#fcd9ad]"
                    }`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 右上: 管理者ホームへ直接戻る (左上 ← は親階層 = 受講生一覧) */}
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            title="管理者ホームに戻る"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            ホームに戻る
          </Link>
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

          {/* 達成度 (体重) — 同セクション内、薄い線で区切る */}
          <div className="mt-5 pt-4 border-t border-[#e8ebe9]">
            <div className="text-[11px] font-bold text-zinc-500 tracking-widest mb-3">
              達成度 (体重)
            </div>
            <WeightProgressBlock
              startWeight={startWeight}
              currentWeight={latestWeight}
              targetWeight={targetWeight}
              targetDate={targetDate}
              progress={weightProgress}
              hasGoalSheet={!!goalSheet}
            />
          </div>
        </section>

        {/* 対応事項 (案 C: カルテフラグ + 受講生リクエストを集約) */}
        {(() => {
          return (
            <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
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
                  {/* カルテ変更フラグ (セルフリマインダ、緊急度低めなので灰系) */}
                  {hasCarteFlag && (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-zinc-800 mb-0.5">
                          カルテ変更あり / メニュー要確認
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          自分でカルテの機械マッチング項目を変更しました。今のメニューが新カルテと合っているか確認してください。
                        </div>
                      </div>
                      <form action={clearReviewFlagAction}>
                        <button
                          type="submit"
                          className="rounded-[4px] border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 whitespace-nowrap"
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

                  {/* β: 目標シート 再添削依頼 (= 受講生が編集 + 「送信して添削を依頼」 押下) */}
                  {hasGoalSheetReReviewFlag && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-amber-900 mb-0.5">
                          目標シート 更新あり / 再添削依頼
                        </div>
                        <div className="text-[11px] text-amber-800">
                          受講生が目標シートを編集し、 添削を依頼しています。
                        </div>
                      </div>
                      <Link
                        href={`/admin/users/${userId}/goal-sheet`}
                        className="rounded-[4px] bg-amber-100 hover:bg-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-800 whitespace-nowrap"
                      >
                        添削する →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {/* フォーム添削(5大機能②): 初回完了トグル。押すと受講生は2回目以降(有料)URLへ */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">フォーム添削</h2>
            <span
              className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                formReviewFirstDone
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {formReviewFirstDone ? "初回完了(2回目以降=有料)" : "初回まだ(無料)"}
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-zinc-600">
            受講生アプリのボタンは、初回は<b>無料URL</b>、この札を立てると<b>2回目以降(1回4,000円)URL</b>に切り替わります。初回セッションを終えたら「初回完了にする」を押してください。UTAGEの予約状況はここには出ないので、この一押しが切り替えの合図です。
          </p>
          <form action={toggleFormReviewFirstDoneAction}>
            <button
              type="submit"
              className={`rounded-[4px] px-4 py-2 text-xs font-bold ${
                formReviewFirstDone
                  ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                  : "bg-[#00897b] text-white hover:bg-[#00695c]"
              }`}
            >
              {formReviewFirstDone
                ? "初回まだ(無料)に戻す"
                : "初回完了にする(以後2回目URLへ)"}
            </button>
          </form>
        </section>

        {/* 4 セクション 2x2 グリッド (月次/メニュー/目標/カルテ) */}
        <div className="grid grid-cols-2 gap-5">

        {/* 月次添削 (Client: 動画送信中は「反映中」表示にする、メモ #7) */}
        <MonthlyAuditSection
          latestAudit={latestAudit}
          auditStatus={auditStatus}
          userId={userId}
        />

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
                <dt className="text-zinc-500">強度数</dt>
                <dd className="text-zinc-900 font-medium">
                  {currentMenu.cycles?.length ?? 0} 強度
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

              {/* 総8: ラベル短縮＋作り方の説明1行(構造・遷移先は不変) */}
              <p className="mb-1.5 text-[11px] text-zinc-500">
                作り直す3つの方法（いまの内容を直す／過去事例から作る／白紙から作る）
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/users/${userId}/menu/new?from_current=1`}
                  className="inline-block rounded-[4px] border border-[#00897b] bg-[rgba(0,137,123,0.08)] px-4 py-2 text-xs font-bold text-[#00695c] hover:bg-[rgba(0,137,123,0.16)]"
                >
                  現メニューを編集
                </Link>
                <Link
                  href={`/admin/users/${userId}/match`}
                  className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  過去事例から作る
                </Link>
                {/* 管E11: マッチングを介さず、ゼロから手作りで配布する直接入口 */}
                <Link
                  href={`/admin/users/${userId}/menu/new?from_scratch=1`}
                  className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  ゼロから作る
                </Link>
              </div>
            </>
          ) : isCarteReady ? (
            <>
              <p className="text-sm text-zinc-700 mb-3">
                まだメニューが配布されていません。
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/users/${userId}/match`}
                  className="inline-block rounded-[4px] bg-[#00897b] px-4 py-2 text-xs font-bold text-white hover:bg-[#00695c]"
                >
                  過去事例から作る
                </Link>
                {/* 管E11: ゼロから手作りで配布する直接入口 */}
                <Link
                  href={`/admin/users/${userId}/menu/new?from_scratch=1`}
                  className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  ゼロから作る
                </Link>
              </div>
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
              <Link
                href={`/admin/users/${userId}/goal-sheet`}
                className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                添削画面を開く →
              </Link>
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
  // 「あと◯kg / 達成」は受講生側(/record)と同じ距離ベースの安全計算に統一する。
  // 向きを判定せず絶対距離・符号なし = 増量/減量どちらでも誤表示ゼロ。
  // (§3.6-1 マイナス符号廃止 / §3.6-4 増量目標で「あと-10kg・100%」になるバグの解消)
  // ％バー(pct=progress.ratio)は span ベースで既に両方向対応のため維持。
  const goalDist = weightGoalProgress(currentWeight, targetWeight);

  return (
    <div>
      {/* 上段: 現在 → 目標 + あと N | 残り日数 + N% 達成 を 1 行に */}
      <div className="mb-3 flex items-baseline flex-wrap gap-x-4 gap-y-1">
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
        <div className="flex items-baseline gap-2 text-xs">
          {goalDist.state === "reached" ? (
            <span className="text-zinc-700 font-bold text-sm">達成</span>
          ) : goalDist.state === "remaining" ? (
            <span className="text-zinc-700">
              あと{" "}
              <span className="text-sm font-bold font-mono">
                {goalDist.kg.toFixed(1)} kg
              </span>
            </span>
          ) : null}
          {targetDate && (
            <>
              <span className="text-zinc-300">|</span>
              <span className="text-zinc-500">
                目標日{" "}
                <span className="font-mono">
                  {formatDistributionDate(targetDate)}
                </span>
                {(() => {
                  // 総5: 目標日までの残り日数をJST暦日で(UTC直+Date.nowだと深夜にズレる)
                  const days = -daysSinceDateJST(targetDate.slice(0, 10));
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
        <div className="ml-auto text-sm font-bold text-zinc-700">
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
      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
        <span>開始 {startWeight.toFixed(1)} kg</span>
        <span>目標 {targetWeight.toFixed(1)} kg</span>
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
