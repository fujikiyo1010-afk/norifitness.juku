/**
 * 設定 ・ テンプレートタブ
 *
 * モック: docs/03_design_mocks/recovered/管理画面_設定.html
 *
 * TODO: テンプレート CRUD 機能の実装
 *   - DB: admin_message_templates テーブル (カテゴリ + タイトル + 本文)
 *   - CRUD UI: 新規 / 編集 / 削除 / 複製
 *   - リクエスト返答画面 (RequestReplyForm) のテンプレ挿入と連動
 *   - 現状はリクエスト返信フォーム内にハードコード済 (= 動作はする)
 */
export default function TemplatesPage() {
  return (
    <div className="p-7">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: "#00897b" }}
        />
        <h2 className="text-base font-bold text-zinc-900">メッセージテンプレート</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-6">
        月次添削コメント / リクエスト返答 / 新規入会案内 で使う定型文を管理
      </p>

      <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white px-6 py-12 text-center">
        <div className="text-sm font-bold text-zinc-900 mb-2">この機能はまだご用意していません</div>
        <div className="text-xs text-zinc-500 leading-relaxed">
          定型文の管理画面は近日ご用意します。<br />
          いまはリクエストの返信フォームに定型文が入っているので、返信自体は問題なくできます。
        </div>
      </div>
    </div>
  );
}
