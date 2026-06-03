import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCarteForAdmin,
  getCurrentMenuForAdmin,
} from "@/lib/workout/queries";
import { calcAge, calcAgeBand } from "@/lib/workout/types";
import {
  formatDistributionDate,
  formatDistributionDateTime,
} from "@/lib/workout/menu-display";

export const dynamic = "force-dynamic";

/**
 * 管理画面 受講生ハブ画面 (/admin/users/[id])
 *
 * 暫定実装 (Step 2 修正の一環):
 *   - これまで /admin/users/[id] が存在せず、各画面の戻りリンクが 404 になっていた
 *   - Step 4 で本格的なハブ画面 (月次/メトリクス/受信箱集約) を作る予定だが、
 *     先に受講生情報 + 各画面リンクのシンプル版を作って 404 を解消する
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

  // カルテ・メニュー取得 (両方とも null 許容)
  const [carte, currentMenu] = await Promise.all([
    getCarteForAdmin(userId),
    getCurrentMenuForAdmin(userId),
  ]);

  const displayName = userRow.nickname || userRow.name;
  const isCarteReady =
    !!carte &&
    carte.environments.length > 0 &&
    !!carte.frequency_wish &&
    carte.focus_body_parts.length > 0;

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
        {/* カルテ状態 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              筋トレカルテ
            </h2>
            {carte?.menu_review_needed && (
              <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                カルテ変更あり / メニュー要確認
              </span>
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

        {/* 現在のメニュー */}
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

              {/* メニューに対するアクション (左: 既存編集 / 右: 新規配布) */}
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

        {/* 注記: 本格ハブは Step 4 で */}
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-4 text-xs text-zinc-500">
          ※ この画面は Step 2 修正の暫定版です。
          月次添削履歴 / 体組成推移 / リクエスト集約などは Step 4 で追加します。
        </div>
      </main>
    </div>
  );
}
