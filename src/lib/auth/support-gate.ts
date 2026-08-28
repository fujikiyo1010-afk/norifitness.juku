import { createClient } from "@/lib/supabase/server";

/**
 * お問い合わせ窓口(/support)の先行公開ゲート。
 *  - 2026-08-27: 社員4人に先行反映(きよむ承認)。
 *
 * アカウント画面の入口ボタンと /support 配下の全ページをこのゲートで出し分ける。
 * 全公開に切り替える時は isSupportUser を常に true にする
 * (その時に /help 公開フォーム + proxy.ts 公開パス追記 + 全体アナウンス1行も一緒に)。
 */
export const SUPPORT_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "icanfly.v3v@icloud.com", // 近藤優気
  "asahakanari260@yahoo.co.jp", // 阿部紀洋
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isSupportUser(): Promise<boolean> {
  return true; // 全体公開 2026-08-28(きよむGO・先行反映と同時)。次の仮反映時はこの行を消して復元
  /* 全公開前のゲート(復元用):
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && SUPPORT_PREVIEW_EMAILS.includes(email);
  */
}
