import { createClient } from "@/lib/supabase/server";

/**
 * 週間プール改修の限定公開ゲート。
 *  - 2026-07-22: 藤田だけ先行(骨格確認)。
 *  - 2026-07-23: 再設計後、藤田・森川・近藤の3人へ拡大(阿部さんは含めない)。
 * 全公開に切り替える時は、呼び出し側の条件を外す(常に true)だけ。
 */
const POOL_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "icanfly.v3v@icloud.com", // 近藤優気
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isWeeklyPoolUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && POOL_PREVIEW_EMAILS.includes(email);
}
