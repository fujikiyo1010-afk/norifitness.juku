"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * チャット「完了にする」(案A・ホーム警報とチャット一覧で共通＝統一)。
 * 返信せずに返信不要として片付ける。押した時刻(acked_at=now)を記録し、
 * 「受講生の最終発言 <= acked_at」なら未対応から外す(ホーム警報・サイドバー赤バッジ・一覧の強調 すべて連動)。
 * 受講生が新しく発言すると発言時刻 > acked_at となり、自動で未対応に戻る。
 * admin_chat_acks は user_id が PK＝1受講生1行、upsert で最新時刻に上書き。
 */
export type AckResult = { ok: true } | { ok: false; message: string };

export async function ackChatUnreplied(input: {
  userId: string;
}): Promise<AckResult> {
  const adminInfo = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("admin_chat_acks").upsert(
    {
      user_id: input.userId,
      acked_at: new Date().toISOString(),
      acked_by: adminInfo.id,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  return { ok: true };
}

/**
 * 「完了」の取り消し(案A・チャット一覧の取り消し)。
 * admin_chat_acks の行を消して「まだ対応済みにしていない」状態へ戻す。
 * 受講生の最終発言が返信より後なら、これで再び未対応に戻る。
 */
export async function unackChatUnreplied(input: {
  userId: string;
}): Promise<AckResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_chat_acks")
    .delete()
    .eq("user_id", input.userId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/messages");
  return { ok: true };
}
