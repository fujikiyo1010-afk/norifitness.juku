"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordLoginFailure, clearLoginFailures } from "@/lib/auth/login-attempts";

export type SignInResult = { ok: false; error: string };

export async function signIn(
  email: string,
  password: string,
  next: string | null
): Promise<SignInResult> {
  if (typeof email !== "string" || !email.includes("@")) {
    return { ok: false, error: "メールアドレスを正しく入力してください" };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "パスワードを入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (error) {
    // 連続失敗を記録し、閾値超で管理者へ通知 (D-2)。失敗してもログイン応答は妨げない
    await recordLoginFailure(email);
    // 細かい理由は明かさない(列挙攻撃対策)
    return { ok: false, error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // 成功 → 失敗カウントをリセット (D-2)
  await clearLoginFailures(email);

  // 戻り先の検証(オープンリダイレクト対策): 自サイト内パスのみ許可
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(dest);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
