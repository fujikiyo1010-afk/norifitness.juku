"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /account 設定画面のサーバーアクション (2026-06-17 線① 新設)
 *
 * - updateName: プロフィール氏名更新 (users.name)
 * - toggleEmailNotification: メール通知 ON/OFF (users.email_notification_enabled)
 */

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateName(name: string): Promise<ActionResult> {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "氏名を入力してください" };
  if (trimmed.length > 40) return { ok: false, error: "氏名は 40 文字以内で入力してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("users")
    .update({ name: trimmed })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true };
}

export async function toggleEmailNotification(next: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("users")
    .update({ email_notification_enabled: next })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/account");
  return { ok: true };
}

// updatePassword は廃止 (2026-06-18 移行) ・Auth 操作は Client から直接実行に変更:
// → src/app/account/password/PasswordForm.tsx で browser supabase.auth.signInWithPassword + updateUser を呼ぶ
// → src/app/account/password/_actions.ts の notifyPasswordChanged が本人宛通知のみ担う
// (Server Action 内での auth 操作は @supabase/ssr の cookie 同期で session 切れる問題があるため)

// requestEmailChange も同じ理由で廃止:
// → src/app/account/email/EmailChangeForm.tsx で browser supabase.auth.updateUser を呼ぶ
// → src/app/account/email/_actions.ts の notifyEmailChangeRequest が旧メール通知のみ担う

export async function signOutFromAccount() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
