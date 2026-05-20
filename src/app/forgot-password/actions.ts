"use server";

import { createClient } from "@/lib/supabase/server";

export type RequestPasswordResetResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * パスワードリセットメールを送信する。
 *
 * セキュリティ上の配慮:
 * - メアドの存在/非存在を漏らさないため、エラーが出ても **常に ok を返す**
 *   (列挙攻撃対策)
 */
export async function requestPasswordReset(
  email: string
): Promise<RequestPasswordResetResult> {
  if (typeof email !== "string" || !email.includes("@")) {
    return { ok: false, message: "メールアドレスを正しく入力してください" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return {
      ok: false,
      message: "サイト URL が設定されていません。管理者にお問い合わせください。",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.toLowerCase(),
    {
      redirectTo: `${siteUrl}/reset-password`,
    }
  );

  // 列挙攻撃対策: メアドの存在/非存在を漏らさない
  if (error) {
    console.error("resetPasswordForEmail error:", error.message);
  }

  return { ok: true };
}
