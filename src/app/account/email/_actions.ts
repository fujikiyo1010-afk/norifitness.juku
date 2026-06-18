"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmailChangeRequestNotice } from "@/lib/email/email-changed";

/**
 * 旧メール宛 「変更要求があります」 通知メール送信 (2026-06-18 #8)
 *
 * Client から呼ばれる Server Action。 Auth 操作は含まず、 副作用 (メール送信) のみ。
 */
export async function notifyEmailChangeRequest(
  newEmail: string
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    const userName =
      (userRow as { name?: string | null } | null)?.name ?? "受講生";

    await sendEmailChangeRequestNotice({
      oldEmail: user.email ?? "",
      newEmail,
      userName,
    });
    return { ok: true };
  } catch (e) {
    console.error("notifyEmailChangeRequest error:", e);
    return { ok: false };
  }
}
