import { createClient } from "@/lib/supabase/server";
import { isBetaUser } from "@/lib/auth/beta";

/**
 * 特典ライブラリの「本番・藤田さん限定 仮反映」判定 (2026-07-17)。
 *
 * ここに列挙したメールのアカウントだけに、本番で:
 *   - ホームの「特典ライブラリ」タイル(+コース一覧タイルを非表示にした新レイアウト)
 *   - /tokuten 配下のページ
 * を表示する。他の受講生には従来通り(コース一覧あり・特典ライブラリなし)。
 * ※食事の過去日編集は別リスト(meal-edit-preview.ts)。混同しない。
 *
 * 全体公開に切り替える時は、この判定を使っている箇所を「常に true」にする
 * (= page.tsx / HomeBeta / tokuten ページの分岐を外す)。
 */
const PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田さん 本番アカウント
  "hyuuga.morikawa@gmail.com", // 森川さん 本番アカウント
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isTokutenPreviewUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && PREVIEW_EMAILS.includes(email);
}

/**
 * 特典ライブラリを表示してよいか（2026-07-19 拡大）。
 * ベータ4人(is_beta=true) または メール許可リスト(藤田/森川) なら表示。
 * 全体公開時は、これを使う箇所を「常に true」にする。
 */
export async function canSeeTokuten(): Promise<boolean> {
  const [preview, beta] = await Promise.all([
    isTokutenPreviewUser(),
    isBetaUser(),
  ]);
  return preview || beta;
}
