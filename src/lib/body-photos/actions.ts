"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * 体型写真の登録/削除 (2026-07-06 P6)
 *
 * アップロード本体 (bucket への PUT) はクライアントが圧縮後に直接行い、
 * ここでは body_photos 行の作成/削除 + storage オブジェクト削除を担う。
 */

/**
 * アップロード済みの storage_path を body_photos に登録。
 * storage_path は必ず {user_id}/... で始まる想定 (RLS と整合)。
 */
export async function addBodyPhoto(input: {
  recorded_at: string;
  storage_path: string; // フル画像
  thumb_path: string | null; // サムネ (無ければ null)
  note: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  if (!input.recorded_at) return { ok: false, message: "記録日が必要です" };
  if (
    !input.storage_path.startsWith(`${user.id}/`) ||
    (input.thumb_path != null && !input.thumb_path.startsWith(`${user.id}/`))
  ) {
    return { ok: false, message: "不正な保存先です" };
  }

  const { error } = await supabase.from("body_photos").insert({
    user_id: user.id,
    recorded_at: input.recorded_at,
    storage_path: input.storage_path,
    thumb_path: input.thumb_path,
    note: input.note,
  });
  if (error) return { ok: false, message: `保存エラー: ${error.message}` };

  revalidatePath("/record");
  revalidatePath("/record/photos");
  return { ok: true };
}

/**
 * 体型写真を削除 (行 + storage オブジェクト)。
 */
export async function deleteBodyPhoto(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };

  // storage_path / thumb_path を取得 (RLS で本人のみ)
  const { data: row } = await supabase
    .from("body_photos")
    .select("storage_path, thumb_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const paths = [row?.storage_path, row?.thumb_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0
  );
  if (paths.length > 0) {
    await supabase.storage.from("body-photos").remove(paths);
  }

  const { error } = await supabase
    .from("body_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: `削除エラー: ${error.message}` };

  revalidatePath("/record");
  revalidatePath("/record/photos");
  return { ok: true };
}
