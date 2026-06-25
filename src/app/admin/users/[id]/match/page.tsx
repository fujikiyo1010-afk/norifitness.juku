import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCarteForAdmin, findCandidateMenus } from "@/lib/workout/queries";
import {
  calcAge,
  type BodyPartGroup,
  type AgeBand,
} from "@/lib/workout/types";
import { CandidatesList } from "./CandidatesList";

export const dynamic = "force-dynamic";

// 案 D 部位フィルタ用マスター (BodyPartGroup と一致、+「カルテ通り」)
const FOCUS_FILTER_OPTIONS: BodyPartGroup[] = [
  "胸",
  "背中",
  "肩",
  "腕",
  "脚",
  "お尻",
  "腹筋",
  "全身",
];

// 年齢フィルタ用マスター (AgeBand 全種)
const AGE_FILTER_OPTIONS: AgeBand[] = [
  "10代",
  "20代",
  "30代",
  "40代",
  "50代",
  "60代",
  "70代",
];

const TOP_N_FOR_EXPAND = 10; // 案 C: 「もっと見る」で最大 10 件まで

/**
 * 管理画面 マッチング検索 (/admin/users/[id]/match)
 *
 * 役割:
 *   - 受講生のカルテからマッチング検索 → 上位 3 件 (もっと見るで 10 件) のテンプレを提示
 *   - のり氏が判断して「採用する」 → メニュー配布画面 (/admin/users/[id]/menu/new) に遷移
 *   - 「ゼロから手作り」も選択可能
 *
 * クエリパラメータ:
 *   - focus: BodyPartGroup の値 (案 D 部位フィルタ)
 *     指定時はカルテの focus_body_parts を上書きしてスコアリング
 *     未指定 or "all" → カルテ通り
 *
 * アクセス制御: requireAdmin
 */
export default async function AdminMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; age?: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;
  const sp = await searchParams;

  // 案 D: focus クエリ → BodyPartGroup として有効か検証
  const focusParam = sp.focus ?? null;
  const focusOverride =
    focusParam && FOCUS_FILTER_OPTIONS.includes(focusParam as BodyPartGroup)
      ? [focusParam as BodyPartGroup]
      : null;

  // 年齢オーバーライド: age クエリ → AgeBand として有効か検証
  const ageParam = sp.age ?? null;
  const ageOverride =
    ageParam && AGE_FILTER_OPTIONS.includes(ageParam as AgeBand)
      ? (ageParam as AgeBand)
      : null;

  // 受講生情報取得
  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, name, nickname")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) {
    notFound();
  }

  // カルテ取得
  const carte = await getCarteForAdmin(userId);
  if (!carte) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/admin/users/${userId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 受講生ハブ
          </Link>
          <h1 className="mt-3 text-lg font-bold text-zinc-900">
            {userRow.nickname || userRow.name} さんのマッチング検索
          </h1>
          <div className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-900">
              この受講生はまだカルテを提出していません。
              <br />
              カルテ提出後にマッチング検索が可能になります。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 受講生のプロフィール (birthday) 確認
  if (!carte.age_band) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/admin/users/${userId}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            ← 受講生ハブ
          </Link>
          <h1 className="mt-3 text-lg font-bold text-zinc-900">
            {userRow.nickname || userRow.name} さんのマッチング検索
          </h1>
          <div className="mt-6 rounded-[14px] border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm text-amber-900">
              生年月日が未設定のため年齢層が計算できず、マッチング検索を実行できません。
              <br />
              プロフィールで生年月日を登録してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // マッチング実行 (案 C: 10 件取得、案 D: focus/age オーバーライド)
  const matchResult = await findCandidateMenus(
    userId,
    TOP_N_FOR_EXPAND,
    focusOverride,
    ageOverride
  );
  const candidates = matchResult.ok ? matchResult.candidates : [];

  const age = carte.birthday ? calcAge(carte.birthday) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/users/${userId}`}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
              aria-label="受講生ハブに戻る"
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
            <div>
              <h1 className="text-base font-semibold text-zinc-900">
                マッチング検索
              </h1>
              <p className="text-xs text-zinc-600">
                {userRow.nickname || userRow.name}
                {age != null && (
                  <span className="ml-2 text-zinc-500">
                    {age}歳 / {carte.age_band}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* カルテ要約 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-[#00897b]" />
            <h2 className="text-sm font-semibold text-zinc-900">
              受講生のカルテ
            </h2>
            <Link
              href={`/admin/users/${userId}/carte`}
              className="ml-auto text-xs text-[#00695c] font-bold hover:underline"
            >
              編集 →
            </Link>
          </div>

          <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-sm">
            <dt className="text-zinc-500 text-xs">性別</dt>
            <dd className="text-zinc-900 font-medium">{carte.gender}</dd>

            <dt className="text-zinc-500 text-xs">年齢層</dt>
            <dd className="text-zinc-900 font-medium">{carte.age_band}</dd>

            <dt className="text-zinc-500 text-xs">使える環境</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.environments.join("・")}
            </dd>

            <dt className="text-zinc-500 text-xs">理想の頻度</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.frequency_wish ?? "—"}
            </dd>

            <dt className="text-zinc-500 text-xs">鍛えたい部位</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.focus_body_parts.join("・")}
            </dd>

            <dt className="text-zinc-500 text-xs">目的</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.purposes.length > 0 ? carte.purposes.join("・") : "—"}
            </dd>

            <dt className="text-zinc-500 text-xs">運動経験</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.experience ?? "—"}
            </dd>

            <dt className="text-zinc-500 text-xs">医師制限</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.medical_limits.length > 0
                ? carte.medical_limits.join("・")
                : "なし"}
            </dd>

            <dt className="text-zinc-500 text-xs">目指す身体像</dt>
            <dd className="text-zinc-900 font-medium">
              {carte.ideal_body ?? "—"}
            </dd>
          </dl>
        </section>

        {/* 絞り込み (部位 + 年齢、案 A 縦 2 段) */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5 space-y-5">
          {/* 部位フィルタ */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">
                重点部位で絞り込み
              </h2>
              <span className="text-[10px] text-zinc-500">
                (この検索だけカルテを上書き)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildMatchUrl(userId, { focus: null, age: ageOverride })}
                scroll={false}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  !focusOverride
                    ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {!focusOverride && <span className="mr-1">●</span>}
                カルテ通り
                {!focusOverride && (
                  <span className="ml-1 text-[10px] text-zinc-500">
                    ({carte.focus_body_parts.join("・")})
                  </span>
                )}
              </Link>
              {FOCUS_FILTER_OPTIONS.map((part) => {
                const selected = focusOverride?.[0] === part;
                return (
                  <Link
                    key={part}
                    href={buildMatchUrl(userId, {
                      focus: part,
                      age: ageOverride,
                    })}
                    scroll={false}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {selected && <span className="mr-1">●</span>}
                    {part}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 年齢フィルタ */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">
                年齢層で絞り込み
              </h2>
              <span className="text-[10px] text-zinc-500">
                (この検索だけカルテを上書き)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildMatchUrl(userId, {
                  focus: focusOverride?.[0] ?? null,
                  age: null,
                })}
                scroll={false}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  !ageOverride
                    ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {!ageOverride && <span className="mr-1">●</span>}
                カルテ通り
                {!ageOverride && carte.age_band && (
                  <span className="ml-1 text-[10px] text-zinc-500">
                    ({carte.age_band})
                  </span>
                )}
              </Link>
              {AGE_FILTER_OPTIONS.map((band) => {
                const selected = ageOverride === band;
                return (
                  <Link
                    key={band}
                    href={buildMatchUrl(userId, {
                      focus: focusOverride?.[0] ?? null,
                      age: band,
                    })}
                    scroll={false}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {selected && <span className="mr-1">●</span>}
                    {band}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* マッチング結果 (案 C: 初期 3 件 → もっと見るで最大 10 件) */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#00897b]" />
              マッチング結果
              {(focusOverride || ageOverride) && (
                <span className="text-[11px] font-normal text-zinc-500">
                  ({[
                    focusOverride && `${focusOverride[0]} 重点`,
                    ageOverride && `${ageOverride} 基準`,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                  で再計算)
                </span>
              )}
            </h2>
            <p className="text-xs text-zinc-500">
              性別フィルタ済 / 重点部位 + 年齢 + 頻度 + 環境
            </p>
          </div>

          <CandidatesList candidates={candidates} userId={userId} />

          {/* ゼロから手作り */}
          <div className="mt-4 rounded-[14px] border border-dashed border-zinc-300 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-1.5">
              候補が合わない場合
            </h3>
            <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
              この受講生に特化したメニューをゼロから作成します。
            </p>
            <Link
              href={`/admin/users/${userId}/menu/new?from_scratch=1`}
              className="inline-block rounded-[4px] border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ゼロから手作りで配布
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * 部位フィルタ + 年齢フィルタの両方を引き継ぐ URL を生成。
 * 片方を変更しても、もう片方の選択状態が残るようにする。
 */
function buildMatchUrl(
  userId: string,
  params: { focus?: string | null; age?: string | null }
): string {
  const qs = new URLSearchParams();
  if (params.focus) qs.set("focus", params.focus);
  if (params.age) qs.set("age", params.age);
  const q = qs.toString();
  return `/admin/users/${userId}/match${q ? `?${q}` : ""}`;
}
