"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
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
