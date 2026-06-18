"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPasswordChangedEmail } from "@/lib/email/password-changed";

/**
 * パスワード変更完了通知 (2026-06-18 #8 一連)
 *
 * Client 側で updateUser({ password }) 成功後に呼ばれる Server Action。
 * Auth 操作は含まず、 副作用 (= 本人宛通知メール) のみ。
 */
export async function notifyPasswordChanged(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    await sendPasswordChangedEmail(user.id);
    return { ok: true };
  } catch (e) {
    console.error("notifyPasswordChanged error:", e);
    return { ok: false };
  }
}
