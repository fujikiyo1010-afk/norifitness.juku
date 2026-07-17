import { createClient } from "@/lib/supabase/server";

/**
 * 「本番・藤田さん限定 仮反映」の共通許可リスト (2026-07-17)。
 *
 * ここに列挙したメールのアカウントだけに、本番で先行表示する:
 *   - ホームの「特典ライブラリ」タイル(+コース一覧タイルを非表示にした新レイアウト)
 *   - /tokuten 配下のページ
 *   - 食事の過去日編集 (2026-07-17 追加・meals/page.tsx で PREVIEW_EMAILS を参照)
 * 他の受講生には従来通り。
 *
 * ★仮反映を全体公開に切り替える時は、この判定を使っている箇所を「常に true」にする
 * (= page.tsx / HomeBeta / tokuten / meals ページの分岐を外す)。
 * ★新しいアカウントを仮反映対象にしたい時は、この配列に1行足すだけで全箇所に効く。
 */
export const PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田さん 本番アカウント
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
