import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 受講生の「返信あり」緑バッジ（P2b-2）。
 * 既存 notifications テーブル（type='comment'=のりの返信・is_read）を使う。
 *   - 立てる: FB送信時に daily-feedbacks/actions が1件作る
 *   - 見せる: hasUnreadReply() でホーム掲示板に緑バッジ
 *   - 消す: markRepliesRead() を お知らせ一覧(/notices)表示時に呼ぶ
 */

/** 未読の「のりの返信(comment)」があるか。ホーム緑バッジ用。 */
export async function hasUnreadReply(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "comment")
    .eq("is_read", false);
  return (count ?? 0) > 0;
}

/** 自分の未読「返信(comment)」を既読にする。お知らせ一覧を開いた時に呼ぶ。 */
export async function markRepliesRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // service role で確実に更新（自己 update ポリシーもあるが、描画時の副作用として安定させる）
  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("type", "comment")
    .eq("is_read", false);
}
