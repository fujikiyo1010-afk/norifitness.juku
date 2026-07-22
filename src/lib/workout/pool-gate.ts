import { createClient } from "@/lib/supabase/server";

/**
 * 週間プール改修の「藤田だけ先行」ゲート(2026-07-22)。
 * 大改修なので、まず藤田(きよむ)さんだけで実機確認 → OKなら staff-preview 4人 → 全公開。
 * 全公開に切り替える時は、呼び出し側の条件を外す(常に true)だけ。
 */
const POOL_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（本番アカウント）
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
