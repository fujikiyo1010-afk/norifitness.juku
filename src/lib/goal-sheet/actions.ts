"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminInfo } from "@/lib/auth/admin";
import { sendPushToUser } from "@/lib/push/send";
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
/**
 * 管理者: 特定受講生の目標シート添削を保存。
 *
 * 動作:
 *   - content.audits だけ更新 (受講生入力 = current_status / goal_selection 等は触らない)
 *   - reviewed_at / reviewed_by を更新
 *   - goal_sheet_revisions に edited_by = 管理者で履歴を残す
 *
 * @param userId 添削対象の受講生 ID
 * @param audits 新しい添削データ
 */
export async function saveGoalSheetAuditByAdmin(
  userId: string,
  audits: GoalSheetContent["audits"]
): Promise<SaveGoalSheetResult> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  const supabase = await createClient();

  // 既存 content を取得 (受講生入力分は維持)
  const { data: existing } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    return {
      ok: false,
      message: "目標シートが未作成です (受講生が初回入力していません)",
    };
  }

  const existingContent = (existing.content as GoalSheetContent | null) ?? {};
  const contentToSave: GoalSheetContent = {
    ...existingContent,
    audits,
  };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("goal_sheets")
    .update({
      content: contentToSave,
      reviewed_by: admin.id,
      reviewed_at: now,
    })
    .eq("user_id", userId)
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  // 添削履歴を goal_sheet_revisions に残す (失敗時はログのみ)
  const { error: revError } = await supabase.from("goal_sheet_revisions").insert({
    user_id: userId,
    snapshot: contentToSave,
    edited_by: admin.id,
    reason: "admin_audit",
  });
  if (revError) {
    console.error("[saveGoalSheetAuditByAdmin] revisions insert failed:", revError.message);
  }

  revalidatePath(`/admin/users/${userId}`, "page");
  revalidatePath(`/admin/users/${userId}/goal-sheet`, "page");
  revalidatePath("/goal-sheet", "page");

  // 受講生に push 通知 (= 「のり氏が見てくれた!」 即タップで確認)
  void sendPushToUser(userId, {
    title: "目標シート 添削が届きました",
    body: "のりfitness からの添削をタップで確認できます",
    url: "/goal-sheet",
    tag: "goal-sheet-reviewed",
  }).catch((e) => console.error("[push] goal-sheet review failed", e));

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: countFilledSections(contentToSave),
  };
}

export async function saveMyGoalSheet(
  inputContent: GoalSheetContent,
  options: { notify?: boolean } = {}
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

  // upsert (notify=true なら last_review_requested_at = now() で
  // 「送信して [再]添削を依頼」 を記録、 管理者アラート集計時に urgent タグ)
  const upsertPayload: {
    user_id: string;
    content: GoalSheetContent;
    last_review_requested_at?: string;
  } = {
    user_id: user.id,
    content: contentToSave,
  };
  if (options.notify) {
    upsertPayload.last_review_requested_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("goal_sheets")
    .upsert(upsertPayload, { onConflict: "user_id" })
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
  // 「送信して [再]添削を依頼」 の場合は管理画面のアラート集計も再生成
  if (options.notify) {
    revalidatePath("/admin", "page");
  }

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: countFilledSections(contentToSave),
  };
}

/**
 * 記録画面「目標推移」タブの「基準を決定する」用(2026-07-23・社員4人 仮反映)。
 *
 * 逆算シミュレーターでいじった 目標体重・目標日 だけを、目標シートの
 * goal_selection に反映(＝案P: これが公式の目標になる)。
 *
 * 作法(重要):
 *   - 既存 content を丸ごと読み、goal_selection の target_weight_kg / target_date
 *     だけ差し替える(他セクション・添削 audits は維持)。
 *   - notify は立てない(last_review_requested_at を触らない=添削依頼を飛ばさない)。
 *   - 編集履歴は goal_sheet_revisions に残す(既存の保存と同じ)。
 */
export async function saveGoalBaselineFromRecord(
  targetWeightKg: number,
  targetDateISO: string
): Promise<SaveGoalSheetResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }
  if (!Number.isFinite(targetWeightKg) || targetWeightKg <= 0) {
    return { ok: false, message: "目標体重が不正です" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateISO)) {
    return { ok: false, message: "目標日が不正です" };
  }

  // 既存 content を丸ごと取得(他セクション・添削を壊さないため)
  const { data: existing } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingContent = (existing?.content as GoalSheetContent | null) ?? {};

  const contentToSave: GoalSheetContent = {
    ...existingContent,
    goal_selection: {
      ...(existingContent.goal_selection ?? {}),
      target_weight_kg: targetWeightKg,
      target_date: targetDateISO,
    },
  };
  contentToSave.filled_sections = calcFilledSections(contentToSave);

  // notify なし(= last_review_requested_at を立てない)
  const { data, error } = await supabase
    .from("goal_sheets")
    .upsert(
      { user_id: user.id, content: contentToSave },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .single();
  if (error) {
    return { ok: false, message: error.message };
  }

  const { error: revError } = await supabase.from("goal_sheet_revisions").insert({
    user_id: user.id,
    snapshot: contentToSave,
    edited_by: user.id,
  });
  if (revError) {
    console.error(
      "[saveGoalBaselineFromRecord] revisions insert failed:",
      revError.message
    );
  }

  revalidatePath("/record", "page");
  revalidatePath("/goal-sheet", "page");
  revalidatePath("/goal-sheet/edit", "page");

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: countFilledSections(contentToSave),
  };
}
