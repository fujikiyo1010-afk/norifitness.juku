import { createClient } from "@/lib/supabase/server";

/**
 * 藤田さん(きよむ) だけの本番「仮反映」ゲート (2026-07-21)。
 *
 * 記録画面 /record の「目標推移」タブを、両方向シミュレーター
 * (目標日を決めれば必要ペースが / ペースを決めれば到達日が自動で出る・保存はしない電卓)
 * に差し替える最初の反映を、まず藤田さん1人だけで本番確認するための許可リスト。
 *
 * ※ staff-preview.ts(社員4人) より狭い「1人だけ」なので、あえて別ゲートにしている。
 *   段階を広げる時の付け替え先:
 *     藤田だけ → 社員4人(isStaffPreviewUser) → ベータ(isBetaUser) → 全体公開(分岐を外す)
 *   全体公開時はこのファイルを使う分岐を消す(このファイル自体も役目を終えたら削除)。
 */
const FUJITA_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄(きよむ・本番アカウント)
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isFujitaPreviewUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && FUJITA_PREVIEW_EMAILS.includes(email);
}
