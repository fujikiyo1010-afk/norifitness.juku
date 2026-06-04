/**
 * 目標管理シート 編集ドラフトの sessionStorage 永続化ヘルパー
 *
 * 目的: ツール画面への往復・タブリロードでの入力消失防止 + ツール側プリセット連携
 *
 * 仕様:
 *   - 編集画面では setContent するたびに writeDraft() でミラー保存
 *   - マウント時に readDraft() で復元 → 無ければ initialContent (= DB 値)
 *   - 本保存成功時に clearDraft() で破棄 (次回は DB から再取得)
 *   - ツール側 (?return=goal-sheet) は readDraft() で現在編集中の値をプリセット
 */
import type { GoalSheetContent } from "./types";

const DRAFT_STORAGE_KEY = "goal-sheet-edit-draft-v1";

export function readDraft(): GoalSheetContent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoalSheetContent) : null;
  } catch {
    return null;
  }
}

export function writeDraft(content: GoalSheetContent): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(content));
  } catch {
    // QuotaExceeded など。書けなくても致命的ではないので無視
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_STORAGE_KEY);
}
