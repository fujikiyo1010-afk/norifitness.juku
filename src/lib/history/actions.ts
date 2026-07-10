"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true; saved: boolean } | { ok: false; message: string };

/** 日次FBのしおりをトグル(確認なし・取り消せる)。 */
export async function toggleFeedbackBookmark(fbDate: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fbDate)) return { ok: false, message: "日付が不正です" };

  const { data: existing } = await supabase
    .from("feedback_bookmarks")
    .select("fb_date")
    .eq("user_id", user.id)
    .eq("fb_date", fbDate)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("feedback_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("fb_date", fbDate);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/history/feedbacks");
    return { ok: true, saved: false };
  }
  const { error } = await supabase
    .from("feedback_bookmarks")
    .insert({ user_id: user.id, fb_date: fbDate });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/history/feedbacks");
  return { ok: true, saved: true };
}
