import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminInfo = {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin";
};

/**
 * 現在のリクエストの管理者情報を返す。
 * - 未ログインなら /login へ
 * - ログイン済みだが admin_users に存在しない/無効なら / へ
 */
export async function requireAdmin(): Promise<AdminInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/admin/invitations");
  }

  // Service Role で確実に取得(自分の admin_users 行は anon でも SELECT 可能だが、
  // RLS ポリシーの実装変更に左右されないよう admin client を使用)
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("id, email, name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    redirect("/");
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as "superadmin" | "admin",
  };
}

/**
 * 現在のユーザーが管理者か(リダイレクトしない判定版)。
 * ホーム画面で「管理画面へのリンク」を出すかどうか等に使う。
 */
export async function getAdminInfo(): Promise<AdminInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select("id, email, name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.is_active) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as "superadmin" | "admin",
  };
}
