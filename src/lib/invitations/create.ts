import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient, getFromEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { reportError } from "@/lib/observability/report";

const INVITATION_TTL_HOURS = 48;

export type CreateInvitationInput = {
  email: string;
  name: string;
  createdBy?: string | null; // admin_users.id
};

export type CreatedInvitation = {
  id: string;
  email: string;
  name: string;
  expires_at: string;
  created_at: string;
};

export type CreateInvitationResult =
  | { ok: true; invitation: CreatedInvitation; emailId: string | null; inviteUrl: string }
  | { ok: false; status: number; error: string; message: string };

export async function createInvitation(
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const { email, name, createdBy = null } = input;

  // ───── バリデーション ─────
  if (typeof email !== "string" || !email.includes("@")) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      message: "メールアドレスを正しく入力してください",
    };
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      message: "氏名を入力してください",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return {
      ok: false,
      status: 500,
      error: "config_error",
      message: "NEXT_PUBLIC_SITE_URL が未設定です",
    };
  }

  const normalizedEmail = email.toLowerCase();
  const supabase = createAdminClient();

  // ───── 冪等性: 既に受講生として登録済みなら拒否 ─────
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    return {
      ok: false,
      status: 409,
      error: "already_registered",
      message: "このメールアドレスは既に受講生として登録されています",
    };
  }

  // ───── トークン生成と DB 登録 ─────
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000);

  const { data: invitation, error: dbError } = await supabase
    .from("invitations")
    .insert({
      email: normalizedEmail,
      name,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: createdBy,
    })
    .select("id, email, name, token, expires_at, created_at")
    .single();

  if (dbError || !invitation) {
    return {
      ok: false,
      status: 500,
      error: "db_error",
      message: dbError?.message ?? "招待登録に失敗しました",
    };
  }

  // ───── 招待メール送信 ─────
  const inviteUrl = `${siteUrl}/invite?token=${encodeURIComponent(token)}`;
  const expiresAtJst = formatJst(expiresAt);
  const { subject, text, html } = buildInvitationEmail({
    name,
    inviteUrl,
    expiresAtJst,
  });

  try {
    const resend = getResendClient();
    const sendResult = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject,
      text,
      html,
    });

    if (sendResult.error) {
      await reportError(
        new Error(sendResult.error.message ?? "invitation email send failed"),
        { where: "createInvitation", email: normalizedEmail }
      );
      await supabase.from("invitations").delete().eq("id", invitation.id);
      return {
        ok: false,
        status: 502,
        error: "email_error",
        message: sendResult.error.message ?? "メール送信に失敗しました",
      };
    }

    // ───── 冪等性: 新規招待が確実に届いた後、古い未承認招待を無効化 ─────
    // 順序が重要: 新しい招待の送信成功を確認してから古いを無効化することで、
    // 「両方無効になって受講生が詰む」事故を防ぐ
    await supabase
      .from("invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .neq("id", invitation.id);

    return {
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        expires_at: invitation.expires_at,
        created_at: invitation.created_at,
      },
      emailId: sendResult.data?.id ?? null,
      inviteUrl,
    };
  } catch (e) {
    await reportError(e, {
      where: "createInvitation:exception",
      email: normalizedEmail,
    });
    await supabase.from("invitations").delete().eq("id", invitation.id);
    return {
      ok: false,
      status: 500,
      error: "email_exception",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

function formatJst(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm} JST`;
}
