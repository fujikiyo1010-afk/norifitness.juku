"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoalSheetContent, SectionKey } from "./types";
import {
  countFilledSections,
  isCurrentStatusFilled,
  isGoalSelectionFilled,
  isNutritionFilled,
  isPositiveGoalsFilled,
  isSelfImageFilled,
} from "./types";

/**
 * 目標管理シート (goal_sheets) の更新関数群。
 *
 * 設計方針:
 *   - 1 ユーザー = 1 シート、編集時は upsert で同一行を上書き
 *   - RLS により他人のシートは更新不可
 *   - 添削データ (audits) は受講生から保存される値を採用しない
 *     既存値を維持 (添削は管理画面でのみ追加・編集する想定)
 *   - 編集が成功したら goal_sheet_revisions に スナップショット保存
 */

export type SaveGoalSheetResult =
  | { ok: true; updated_at: string; filled_count: number }
  | { ok: false; message: string };

const MAX_TEXT_LENGTH = 5000;

/**
 * 入力 content の文字数バリデーション。
 * jsonb 内のテキストフィールドのみチェック (簡易)。
 */
function validateContent(content: GoalSheetContent): string | null {
  const goal = content.goal_selection;
  if (goal?.short_term && goal.short_term.length > MAX_TEXT_LENGTH) {
    return `短期目標は ${MAX_TEXT_LENGTH} 文字以内にしてください`;
  }
  if (goal?.long_term && goal.long_term.length > MAX_TEXT_LENGTH) {
    return `長期目標は ${MAX_TEXT_LENGTH} 文字以内にしてください`;
  }
  if (goal?.process && goal.process.length > MAX_TEXT_LENGTH) {
    return `プロセスは ${MAX_TEXT_LENGTH} 文字以内にしてください`;
  }
  if (
    content.positive_goals?.achievement_feeling &&
    content.positive_goals.achievement_feeling.length > MAX_TEXT_LENGTH
  ) {
    return `達成時の気持ちは ${MAX_TEXT_LENGTH} 文字以内にしてください`;
  }
  return null;
}

/**
 * filled_sections を再計算 (進捗バー用)。
 */
function calcFilledSections(content: GoalSheetContent): SectionKey[] {
  const filled: SectionKey[] = [];
  if (isCurrentStatusFilled(content.current_status)) filled.push("current_status");
  if (isGoalSelectionFilled(content.goal_selection)) filled.push("goal_selection");
  if (isNutritionFilled(content.nutrition)) filled.push("nutrition");
  if (isPositiveGoalsFilled(content.positive_goals)) filled.push("positive_goals");
  if (isSelfImageFilled(content.self_image)) filled.push("self_image");
  return filled;
}

/**
 * 現在のログインユーザーの目標シートを upsert。
 *
 * 重要な仕様:
 *   - 受講生から渡される content の audits は無視 (既存値を維持)
 *   - 編集が成功したら goal_sheet_revisions に スナップショット保存
 *   - filled_sections は自動再計算
 */
export async function saveMyGoalSheet(
  inputContent: GoalSheetContent
): Promise<SaveGoalSheetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  // バリデーション
  const validationError = validateContent(inputContent);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  // 既存シートの添削データを取得 (添削は受講生から上書きされない)
  const { data: existing } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", user.id)
    .maybeSingle();

  const existingAudits =
    existing && (existing.content as GoalSheetContent | null)?.audits;

  // 保存する content を組み立て (audits は既存値を維持)
  const contentToSave: GoalSheetContent = {
    current_status: inputContent.current_status,
    goal_selection: inputContent.goal_selection,
    nutrition: inputContent.nutrition,
    positive_goals: inputContent.positive_goals,
    self_image: inputContent.self_image,
    audits: existingAudits ?? undefined,
    filled_sections: calcFilledSections(inputContent),
  };

  // upsert
  const { data, error } = await supabase
    .from("goal_sheets")
    .upsert(
      {
        user_id: user.id,
        content: contentToSave,
      },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  // 編集履歴を goal_sheet_revisions に INSERT (失敗してもメイン保存は成功扱い)
  const { error: revError } = await supabase.from("goal_sheet_revisions").insert({
    user_id: user.id,
    snapshot: contentToSave,
    edited_by: user.id,
  });
  if (revError) {
    // ログだけ残してメイン処理は成功扱い (revisions 失敗で全体失敗にしない)
    console.error("[saveMyGoalSheet] revisions insert failed:", revError.message);
  }

  revalidatePath("/goal-sheet", "page");
  revalidatePath("/goal-sheet/edit", "page");

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: countFilledSections(contentToSave),
  };
}
