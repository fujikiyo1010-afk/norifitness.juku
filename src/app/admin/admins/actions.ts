"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type ActionResult =
  | { ok: true; meta?: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * 管理者を追加 (= /admin/admins 用)
 *
 * 動作:
 *   1. メアド + 名前 + 仮 PW を受け取る
 *   2. 既に admin_users に同メアドがあれば → エラー
 *   3. auth.users に同メアドがあれば → 既存ユーザーを admin に昇格 (= admin_users に insert)
 *   4. 無ければ → auth.admin.createUser で新規 + public.users + admin_users 3 つ insert
 *   5. role = admin (= superadmin が必要なら別途 SQL or DB から変更)
 *
 * 制約:
 *   - 呼び出し元は superadmin である必要
 *   - PW は 8 文字以上
 */
export async function addAdmin(input: {
  email: string;
  name: string;
  password: string;
}): Promise<ActionResult> {
  const caller = await requireAdmin();
  if (caller.role !== "superadmin") {
    return { ok: false, error: "管理者の追加は superadmin のみ可能です" };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;

  if (!email || !email.includes("@")) {
    return { ok: false, error: "メールアドレスを正しく入力してください" };
  }
  if (!name) {
    return { ok: false, error: "氏名を入力してください" };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: "仮パスワードは 8 文字以上にしてください" };
  }

  const admin = createAdminClient();

  // 1. 既に admin_users にあるか確認
  const { data: existingAdmin } = await admin
    .from("admin_users")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle();

  if (existingAdmin) {
    if (existingAdmin.is_active) {
      return { ok: false, error: "このメールアドレスは既に管理者として登録されています" };
    }
    // 無効化されてた → 有効化
    const { error: updErr } = await admin
      .from("admin_users")
      .update({ is_active: true, name })
      .eq("id", existingAdmin.id);
    if (updErr) return { ok: false, error: `有効化失敗: ${updErr.message}` };
    revalidatePath("/admin/admins", "page");
    return { ok: true, meta: { reactivated: true } };
  }

  // 2. auth.users に既存ユーザーがいるか確認
  // auth.admin.listUsers は per_page まで返すので filter で email を絞る
  const { data: usersList } =
    (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })) ?? {};
  const existingAuthUser = usersList?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email
  );

  let userId: string;
  let isNewAuth = false;

  if (existingAuthUser) {
    userId = existingAuthUser.id;
  } else {
    // 3. 新規 auth.users 作成
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created.user) {
      return { ok: false, error: `ユーザー作成失敗: ${createErr?.message ?? "unknown"}` };
    }
    userId = created.user.id;
    isNewAuth = true;
  }

  // 4. public.users に追加 (= 既にあれば upsert で問題なし)
  const { error: usersErr } = await admin
    .from("users")
    .upsert({ id: userId, email, name, status: "active" }, { onConflict: "id" });
  if (usersErr) {
    // 新規 auth user 作成の場合はロールバック
    if (isNewAuth) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
    return { ok: false, error: `users 登録失敗: ${usersErr.message}` };
  }

  // 5. admin_users に追加 (= role = admin / 必要なら DB で superadmin に昇格)
  const { error: adminErr } = await admin.from("admin_users").insert({
    id: userId,
    email,
    name,
    role: "admin",
    is_active: true,
  });
  if (adminErr) {
    if (isNewAuth) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
    return { ok: false, error: `admin_users 登録失敗: ${adminErr.message}` };
  }

  revalidatePath("/admin/admins", "page");
  return { ok: true, meta: { created: true, isNewAuth } };
}

/**
 * 管理者 有効/無効 トグル
 *
 * 制約:
 *   - 呼び出し元は superadmin である必要
 *   - 自分自身は無効化できない (= 締め出し防止)
 *   - 唯一の superadmin を無効化できない (= ロック防止)
 */
export async function toggleAdminActive(input: {
  adminId: string;
  nextActive: boolean;
}): Promise<ActionResult> {
  const caller = await requireAdmin();
  if (caller.role !== "superadmin") {
    return { ok: false, error: "有効/無効 の切替は superadmin のみ可能です" };
  }
  if (input.adminId === caller.id) {
    return { ok: false, error: "自分自身は無効化できません" };
  }

  const admin = createAdminClient();

  // 唯一の superadmin かチェック
  const { data: target } = await admin
    .from("admin_users")
    .select("role, is_active")
    .eq("id", input.adminId)
    .maybeSingle();

  if (!target) return { ok: false, error: "対象の管理者が見つかりません" };

  if (target.role === "superadmin" && input.nextActive === false) {
    const { count } = await admin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "superadmin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "最後の superadmin は無効化できません" };
    }
  }

  const { error } = await admin
    .from("admin_users")
    .update({ is_active: input.nextActive })
    .eq("id", input.adminId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/admins", "page");
  return { ok: true };
}
