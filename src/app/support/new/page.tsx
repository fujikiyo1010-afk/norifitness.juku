import { redirect } from "next/navigation";

/**
 * 旧・送信フォーム専用ページ (2026-08-27 廃止)
 *
 * 送信は玄関 /support に統合した(初回に「ボタンだけの空っぽの画面」を見せないため)。
 * 既にこのURLを開いた人・取説等のリンクが生きているので、玄関へ流す。
 */
export default function SupportNewRedirect() {
  redirect("/support");
}
