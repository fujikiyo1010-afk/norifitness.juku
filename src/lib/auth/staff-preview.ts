import { createClient } from "@/lib/supabase/server";

/**
 * 社員4人 先行「仮反映」ゲート（全チャット共通）。
 *
 * 新しい修正を、まず社員4人(藤田・森川・阿部・近藤)だけに本番で先行表示したい時に使う、
 * 唯一の許可リスト。今後は機能ごとに個別リストを作らず、これに統一する
 * (= tokuten-preview.ts / workout/preview.ts のような乱立を今後はやめる)。
 *
 * 使い方(サーバーコンポーネント):
 *   const staffPreview = await isStaffPreviewUser();
 *   {staffPreview && <新UI />}
 *
 * 全体公開に切り替える時:
 *   その機能の呼び出し側の条件を外す(常に表示)だけ。このリスト自体は
 *   次の新機能の仮反映のために残す。
 */
const STAFF_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "asahakanari260@yahoo.co.jp", // 阿部紀洋
  "icanfly.v3v@icloud.com", // 近藤優気
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isStaffPreviewUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && STAFF_PREVIEW_EMAILS.includes(email);
}
