/**
 * 受講生ハブ ・ 体組成推移タブ
 *
 * モック: docs/03_design_mocks/recovered/体組成推移グラフ画面.html (案 B 採用)
 *
 * TODO: 体組成 DB スキーマが未実装のため、 現状はプレースホルダ。
 *   - body_metrics テーブル作成
 *   - 受講生 UI 側に体組成記録機能を実装
 *   - その上で「体重 / 体脂肪率 / ウエスト」の 3 グラフ + 目標達成度ブロック表示
 */
export default async function UserMetricsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-[14px] border border-dashed border-[#e8ebe9] bg-white px-6 py-12 text-center">
        <div className="text-sm font-bold text-zinc-900 mb-2">
          体組成推移グラフ
        </div>
        <div className="text-xs text-zinc-500 leading-relaxed mb-4">
          体組成記録機能 (受講生側 + DB) の実装後に有効化されます。<br />
          モック確定済 (案 B 採用 ・ 3 グラフ並び)。
        </div>
        <div className="inline-block text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          未実装 ・ Phase 3 内 別タスク
        </div>
      </div>
    </div>
  );
}
