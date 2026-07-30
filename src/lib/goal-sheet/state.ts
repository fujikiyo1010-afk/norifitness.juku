/**
 * 目標シートの状態を「誰の番か」で一元判定(2026-07-25・のり要望)。
 * 判定材料は reviewed_at と last_review_requested_at の2タイムスタンプのみ(新カラム不要)。
 * 一覧・ハブ・(将来)デイリー で同じ段階を出すため、判定はここに集約する。
 *
 *  - 記入待ち   pending_input    : 行なし、または(未添削 かつ 依頼なし)= 受講生の番
 *      ↑ 書きかけの autosave(notify:false)や「基準を決定する」の自動書き込みで
 *        行だけできた人もここ(依頼を出すまでは受講生の番)。
 *  - 添削待ち   pending_review   : 未添削 かつ 依頼あり = のりの番(初回)
 *  - 再添削待ち pending_rereview : 添削済 かつ 再依頼が添削より後 = のりの番(2回目以降)
 *  - 添削済     reviewed         : 添削済 かつ 再依頼なし(または 依頼 <= 添削)
 */
export type GoalSheetState =
  | "pending_input"
  | "pending_review"
  | "pending_rereview"
  | "reviewed";

export function getGoalSheetState(
  row:
    | { reviewed_at: string | null; last_review_requested_at: string | null }
    | null
    | undefined
): GoalSheetState {
  if (!row) return "pending_input"; // 行なし
  const reviewed = row.reviewed_at;
  const requested = row.last_review_requested_at;
  if (!reviewed) {
    // 未添削: 依頼を出していれば のりの番、出していなければ 受講生の番(書きかけ等)
    return requested ? "pending_review" : "pending_input";
  }
  // 添削済: 添削後に再依頼が来ていれば のりの番(再添削待ち)
  if (requested && requested > reviewed) return "pending_rereview";
  return "reviewed";
}
