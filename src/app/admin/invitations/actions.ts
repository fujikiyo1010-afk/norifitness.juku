"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvitation } from "@/lib/invitations/create";

export type SendInvitationResult =
  | { ok: true; email: string; id: string }
  | { ok: false; message: string };

export async function sendInvitation(input: {
  email: string;
  name: string;
}): Promise<SendInvitationResult> {
  const me = await requireAdmin();

  const result = await createInvitation({
    email: input.email,
    name: input.name,
    createdBy: me.id,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/admin/invitations");
  return { ok: true, email: result.invitation.email, id: result.invitation.id };
}

// =====================================================================
// 申請承認 / 却下 (signup_requests からの動線)
// =====================================================================

export type ApproveSignupRequestResult =
  | { ok: true; email: string; invitationId: string }
  | { ok: false; message: string };

export async function approveSignupRequest(
  signupRequestId: string
): Promise<ApproveSignupRequestResult> {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const { data: req, error: fetchError } = await admin
    .from("signup_requests")
    .select("id, name, email, status")
    .eq("id", signupRequestId)
    .maybeSingle();

  if (fetchError || !req) {
    return { ok: false, message: "申請が見つかりません" };
  }
  if (req.status !== "pending") {
    return { ok: false, message: `この申請は既に ${req.status} です` };
  }

  // createInvitation = invitations 行作成 + Resend メール送信 (冪等性込み)
  const inviteResult = await createInvitation({
    email: req.email,
    name: req.name,
    createdBy: me.id,
  });

  if (!inviteResult.ok) {
    return { ok: false, message: inviteResult.message };
  }

  const { error: updateError } = await admin
    .from("signup_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: me.id,
      invitation_id: inviteResult.invitation.id,
    })
    .eq("id", req.id);

  if (updateError) {
    // invitations は既に作成済 = 受講生にメールは届いている。 ログのみ残す
    console.error("signup_requests update failed after invitation:", updateError);
  }

  revalidatePath("/admin/invitations");
  return {
    ok: true,
    email: inviteResult.invitation.email,
    invitationId: inviteResult.invitation.id,
  };
}

export type RejectSignupRequestResult =
  | { ok: true }
  | { ok: false; message: string };

export async function rejectSignupRequest(
  signupRequestId: string,
  reason: string
): Promise<RejectSignupRequestResult> {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    return { ok: false, message: "却下理由を入力してください" };
  }

  const { data: req, error: fetchError } = await admin
    .from("signup_requests")
    .select("id, status")
    .eq("id", signupRequestId)
    .maybeSingle();

  if (fetchError || !req) {
    return { ok: false, message: "申請が見つかりません" };
  }
  if (req.status !== "pending") {
    return { ok: false, message: `この申請は既に ${req.status} です` };
  }

  const { error: updateError } = await admin
    .from("signup_requests")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: me.id,
      rejection_reason: trimmedReason,
    })
    .eq("id", req.id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/admin/invitations");
  return { ok: true };
}
