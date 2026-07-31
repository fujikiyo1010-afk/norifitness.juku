import { createClient } from "@/lib/supabase/server";

/**
 * 休止(一時停止)ユーザーのゲート (2026-07-31)。
 *
 * 災害等で「しばらく利用を止める」受講生。ホームの黄バナー(未記入誘導)・
 * 月次NEWバッジ・掲示板/お知らせのフラッシュバックなど、アプリ内の"ナグ"を
 * 一切出さないための判定。
 *   - プッシュ通知: push_subscription を削除して停止(DB側)
 *   - メール/お知らせ通知: users.email_notification_enabled=false(DB側)
 *   - リマインドcron: push_subscription 無しで実質無効
 *   - アプリ内バナー: このゲートで抑止(コード側=本ファイル)
 *
 * 復帰(再開)時は、このリストから該当メールを外すだけ。
 */
export const PAUSED_USER_EMAILS = [
  "tomato.no.kandume@gmail.com", // 木藤愛（2026-07-31 熊本地震で休止）
];

export async function isPausedUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && PAUSED_USER_EMAILS.includes(email);
}
