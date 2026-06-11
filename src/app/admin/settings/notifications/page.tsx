/**
 * 設定 ・ 通知設定タブ
 *
 * モック: docs/03_design_mocks/recovered/管理画面_設定.html
 *
 * 設計方針: 画面内バッジ (サイドナビ + KPI) を主軸、 メールは最小限
 *   ✅ 画面内バッジ: 既に実装済 (Step 1 サイドナビ + Step 3 ホーム KPI)
 *   ⏳ メール通知 (新規入会 / daily まとめ): Phase 3 内別タスク
 *   ⏳ トグル UI + 保存ロジック: admin_users にカラム追加が必要
 */
export default function NotificationsPage() {
  return (
    <div className="p-7">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: "#0369a1" }}
        />
        <h2 className="text-base font-bold text-zinc-900">通知設定</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-6">
        画面内バッジ (サイドナビ ・ KPI) を主軸、 メール通知は最小限
      </p>

      <div className="rounded-[10px] border border-[#e8ebe9] bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] p-4 mb-4 text-xs text-[#004d40] leading-relaxed">
        <b className="block mb-1">画面内バッジは既に有効</b>
        サイドナビ・ホーム KPI に件数バッジが表示されています。 メール通知の
        ON/OFF 設定は次のフェーズで実装します。
      </div>

      <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white px-6 py-12 text-center">
        <div className="text-sm font-bold text-zinc-900 mb-2">準備中</div>
        <div className="text-xs text-zinc-500 leading-relaxed mb-4">
          メール通知トグル + daily まとめ送信機能は Phase 3 内 別タスクで実装予定。
        </div>
        <div className="inline-block text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          実装予定: 新規入会通知 (即時) + 重要アラート daily まとめ (毎朝)
        </div>
      </div>
    </div>
  );
}
