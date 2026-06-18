"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPasswordChangedEmail } from "@/lib/email/password-changed";
import { sendEmailChangeRequestNotice } from "@/lib/email/email-changed";

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

/**
 * パスワード変更 ・ 現在パスワード検証 → 新パスワード更新 (2026-06-17 線① 新設)
 *
 * 流れ:
 *   1. 現在パスワードで signInWithPassword() 実行 (= 検証)
 *      → 失敗 = 現在パスワード不一致
 *   2. 成功 → updateUser({ password: new }) で新パスワード設定
 *   3. ログイン状態は維持される (= Supabase 仕様)
 */
export async function updatePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  if (!email) return { ok: false, error: "ログイン状態を確認できませんでした" };
  if (!currentPassword) return { ok: false, error: "現在のパスワードを入力してください" };
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "新しいパスワードは 8 文字以上で設定してください" };
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: "新しいパスワードは現在のものと違う必要があります" };
  }

  const supabase = await createClient();

  // 1) 現在パスワード検証
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password: currentPassword,
  });
  if (signInError) {
    // 不正解の理由を細かく出さない (列挙攻撃対策)
    return { ok: false, error: "現在のパスワードが正しくありません" };
  }

  // 2) 新パスワードで更新
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // 3) 本人宛セキュリティ通知メール送信 (失敗しても主処理は成功扱い)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await sendPasswordChangedEmail(user.id);
  }

  revalidatePath("/account");
  return { ok: true };
}

/**
 * メールアドレス変更申請 (2026-06-18 線① #8)
 *
 * 流れ:
 *   1. 現在パスワードで本人確認 (signInWithPassword)
 *   2. Supabase に新メール変更を申請 (= auth.updateUser({ email }))
 *   3. 旧メールに「変更要求があります」 通知メール送信
 *   4. 受講生は新メールに届く確認リンクをクリックして完了
 *
 * - リンクをクリックするまで auth.users.email は不変 (= 旧メールでログイン可、 ロックアウトなし)
 * - リンククリック後、 trg_sync_auth_email で public.users.email も自動同期
 */
export async function requestEmailChange(
  currentEmail: string,
  newEmail: string,
  currentPassword: string
): Promise<ActionResult> {
  const newTrimmed = (newEmail ?? "").trim().toLowerCase();
  const oldTrimmed = (currentEmail ?? "").trim().toLowerCase();
  if (!newTrimmed) return { ok: false, error: "新しいメールアドレスを入力してください" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTrimmed)) {
    return { ok: false, error: "メールアドレスの形式が正しくありません" };
  }
  if (newTrimmed === oldTrimmed) {
    return { ok: false, error: "現在と同じメールアドレスです" };
  }
  if (!currentPassword) {
    return { ok: false, error: "現在のパスワードを入力してください" };
  }

  const supabase = await createClient();

  // 1) 本人確認 (= 現在 PW で signIn)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: oldTrimmed,
    password: currentPassword,
  });
  if (signInError) {
    return { ok: false, error: "現在のパスワードが正しくありません" };
  }

  // 2) Supabase にメール変更申請 (= 新メールに確認リンク送信)
  const { error: updateError } = await supabase.auth.updateUser({
    email: newTrimmed,
  });
  if (updateError) {
    // Supabase の重複メアドエラー等
    return {
      ok: false,
      error:
        updateError.message.includes("already") ||
        updateError.message.includes("registered")
          ? "このメールアドレスは既に使われています"
          : updateError.message,
    };
  }

  // 3) 旧メール宛通知 (= 申請時点で即送信、 乗っ取り早期発見)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const userName =
      (userRow as { name?: string | null } | null)?.name ?? "受講生";
    await sendEmailChangeRequestNotice({
      oldEmail: oldTrimmed,
      newEmail: newTrimmed,
      userName,
    });
  }

  revalidatePath("/account");
  return { ok: true };
}

export async function signOutFromAccount() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
