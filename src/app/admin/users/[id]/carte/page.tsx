import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCarteForAdmin } from "@/lib/workout/queries";
import { calcAge, calcAgeBand } from "@/lib/workout/types";
import { CarteEditor } from "./CarteEditor";

export const dynamic = "force-dynamic";

/**
 * 管理画面 カルテ編集 (/admin/users/[id]/carte)
 *
 * 役割:
 *   - 受講生 1 人のカルテを新規作成 or 編集
 *   - 既存カルテがあれば編集モード、なければ新規作成モード
 *   - 機械マッチング項目変更時に Trigger で menu_review_needed が立つ
 *
 * アクセス制御: requireAdmin
 */
export default async function AdminCartePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  // 受講生情報取得 (admin client で取得、RLS バイパス)
  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id, name, nickname, email, joined_at")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) {
    notFound();
  }

  // user_profiles.birthday 取得
  const { data: profileRow } = await admin
    .from("user_profiles")
    .select("birthday")
    .eq("user_id", userId)
    .maybeSingle();

  const birthday = (profileRow?.birthday as string | null) ?? null;
  const age = birthday ? calcAge(birthday) : null;
  const ageBand = birthday ? calcAgeBand(birthday) : null;

  // 既存カルテ取得
  const carte = await getCarteForAdmin(userId);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
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
          <div className="flex-1">
            <h1 className="text-base font-semibold text-zinc-900">
              筋トレカルテ
            </h1>
            <p className="text-xs text-zinc-600">
              {userRow.nickname || userRow.name}
              {ageBand && (
                <span className="ml-2 text-zinc-500">
                  {age}歳 / {ageBand}
                </span>
              )}
            </p>
          </div>
          {carte?.menu_review_needed && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              カルテ変更あり / メニュー要確認
            </span>
          )}
        </div>
      </header>

      {/* 注意: birthday 未設定の警告 */}
      {!birthday && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              この受講生は生年月日 (user_profiles.birthday)
              が未設定です。マッチング検索を使うには先にプロフィールで生年月日を登録してください。
            </p>
          </div>
        </div>
      )}

      {/* カルテ編集フォーム */}
      <main className="mx-auto max-w-3xl px-4 py-6 pb-32">
        <CarteEditor
          userId={userId}
          userName={userRow.nickname || userRow.name}
          initialCarte={carte}
        />
      </main>
    </div>
  );
}
