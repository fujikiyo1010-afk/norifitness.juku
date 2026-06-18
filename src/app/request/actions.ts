"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToAllAdmins } from "@/lib/push/send";

export type SubmitSignupRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitSignupRequest(input: {
  name: string;
  email: string;
}): Promise<SubmitSignupRequestResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();

  if (name.length === 0) {
    return { ok: false, error: "氏名を入力してください" };
  }
  if (name.length > 100) {
    return { ok: false, error: "氏名が長すぎます" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "メールアドレスの形式が正しくありません" };
  }
  if (email.length > 254) {
    return { ok: false, error: "メールアドレスが長すぎます" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("signup_requests")
    .insert({
      name,
      email,
      status: "pending",
    });

  if (error) {
    console.error("signup_requests insert failed:", error);
    return {
      ok: false,
      error:
        "送信に失敗しました。 時間をおいて再度お試しいただくか、 公式 LINE までご連絡ください。",
    };
  }

  // 全 active admin に即時 push 通知 (= A-1 重要、 受講生獲得チャンスを取りこぼさない)
  void sendPushToAllAdmins({
    title: "新規入会申請",
    body: `${name} さん (${email}) から申請が届きました`,
    url: "/admin/invitations",
    tag: "signup-request",
  }).catch((e) => console.error("[push] signup request failed", e));

  return { ok: true };
}
