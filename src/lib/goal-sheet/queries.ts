import { createClient } from "@/lib/supabase/server";
import type { GoalSheetContent, GoalSheetRow } from "./types";

/**
 * 目標管理シート (goal_sheets) の読み取り関数群。
 *
 * 設計方針:
 *   - 受講生は自分のシートのみ取得 (RLS で自動制御)
 *   - 管理者は特定ユーザーのシートを取得可能 (RLS で自動許可)
 *   - 1 ユーザー = 1 シート (PK = user_id)
 *   - jsonb content の構造は src/lib/goal-sheet/types.ts 参照
 */

/**
 * 現在のログインユーザーの目標管理シートを取得。
 * RLS により自分の行のみ返る。
 * まだ作成していなければ null を返す (初回アクセス時)。
 */
export async function getMyGoalSheet(): Promise<GoalSheetRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("goal_sheets")
    .select(
      "user_id, content, admin_notes, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    user_id: data.user_id as string,
    content: (data.content as GoalSheetContent) ?? {},
    admin_notes: (data.admin_notes as string | null) ?? null,
    reviewed_by: (data.reviewed_by as string | null) ?? null,
    reviewed_at: (data.reviewed_at as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/**
 * 管理者用: 特定ユーザーの目標シートを取得。
 * RLS により管理者のみ実行可能。
 * 主に admin/users/[id]/goal-sheet 等で使用。
 */
export async function getGoalSheetForUser(
  userId: string
): Promise<GoalSheetRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goal_sheets")
    .select(
      "user_id, content, admin_notes, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    user_id: data.user_id as string,
    content: (data.content as GoalSheetContent) ?? {},
    admin_notes: (data.admin_notes as string | null) ?? null,
    reviewed_by: (data.reviewed_by as string | null) ?? null,
    reviewed_at: (data.reviewed_at as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/**
 * 編集履歴を取得 (goal_sheet_revisions テーブル)。
 * 新しい順で返す。
 */
export type GoalSheetRevision = {
  id: string;
  user_id: string;
  snapshot: GoalSheetContent;
  edited_by: string | null;
  reason: string | null;
  created_at: string;
};

export async function listMyGoalSheetRevisions(): Promise<GoalSheetRevision[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("goal_sheet_revisions")
    .select("id, user_id, snapshot, edited_by, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    snapshot: (r.snapshot as GoalSheetContent) ?? {},
    edited_by: (r.edited_by as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

/**
 * 管理者用: 特定ユーザーの編集履歴を新しい順で取得 (ハブ画面の前回値比較用)。
 */
export async function listGoalSheetRevisionsForUser(
  userId: string,
  limit: number = 10
): Promise<GoalSheetRevision[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goal_sheet_revisions")
    .select("id, user_id, snapshot, edited_by, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    snapshot: (r.snapshot as GoalSheetContent) ?? {},
    edited_by: (r.edited_by as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}
