import type { GoalSheetState } from "@/lib/goal-sheet/state";

/**
 * 目標シートの状態ピル(2026-07-25)。色・ラベルはモック
 * 08_guide/提案_管理_目標シート3段階バッジ.html から転写。
 * 一覧・ハブで共通利用(見た目を1箇所に集約)。純表示のみ=server/client 両用。
 */
// モック .badge = ボーダー無し・pill。gray/green=700 / amber・orange=800。
const CONFIG: Record<GoalSheetState, { label: string; cls: string }> = {
  pending_input: {
    label: "記入待ち",
    cls: "bg-[#f1f2f4] text-[#8a919c] font-bold",
  },
  pending_review: {
    label: "添削待ち",
    cls: "bg-[#fdf3d7] text-[#b07d1a] font-extrabold",
  },
  pending_rereview: {
    label: "再添削待ち",
    cls: "bg-[#fbe9d4] text-[#c2611e] font-extrabold",
  },
  reviewed: {
    label: "添削済",
    cls: "bg-[#e3f4ec] text-[#2f9e78] font-bold",
  },
};

export function GoalSheetStateBadge({ state }: { state: GoalSheetState }) {
  const c = CONFIG[state];
  // サイズは既存バッジ部品準拠(text-[10px] / px-2 py-0.5 / rounded-full)。
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${c.cls}`}
    >
      {c.label}
    </span>
  );
}
