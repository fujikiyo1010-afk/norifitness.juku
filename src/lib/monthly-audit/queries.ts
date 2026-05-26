import { createClient } from "@/lib/supabase/server";
import type { MonthlyAuditRow, MonthlyAuditItems } from "./types";
import { getCurrentTargetMonth } from "./types";

/**
 * 月次添削 (monthly_audits) の読み取り関数群。
 *
 * 設計方針:
 *   - 受講生は自分の添削のみ取得 (RLS で自動制御)
 *   - 管理者は全添削を取得可能 (RLS で自動許可)
 *   - 1 ユーザー × 1 月 = 1 件 (UNIQUE 制約あり)
 */

// 共通: DB の row を MonthlyAuditRow に変換
function rowToRecord(data: Record<string, unknown>): MonthlyAuditRow {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    target_month: data.target_month as string,
    items: (data.items as MonthlyAuditItems) ?? {},
    items_filled_count: (data.items_filled_count as number) ?? 0,
    last_saved_at: (data.last_saved_at as string | null) ?? null,
    submitted_at: (data.submitted_at as string | null) ?? null,
    nori_video_vimeo_url: (data.nori_video_vimeo_url as string | null) ?? null,
    nori_video_vimeo_id: (data.nori_video_vimeo_id as string | null) ?? null,
    nori_video_published_at:
      (data.nori_video_published_at as string | null) ?? null,
    nori_video_duration_sec:
      (data.nori_video_duration_sec as number | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

// ===== 受講生向け =====

/**
 * 現在のログインユーザーの当月の月次添削を取得。
 * なければ null (= A 状態 未記入)。
 */
export async function getMyCurrentMonthAudit(): Promise<MonthlyAuditRow | null> {
  return getMyAudit(getCurrentTargetMonth());
}

/**
 * 現在のログインユーザーの指定月の月次添削を取得 (履歴閲覧用)。
 * @param targetMonth ISO date (YYYY-MM-01 形式)
 */
export async function getMyAudit(
  targetMonth: string
): Promise<MonthlyAuditRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .eq("target_month", targetMonth)
    .maybeSingle();

  if (!data) return null;
  return rowToRecord(data as Record<string, unknown>);
}

/**
 * 現在のログインユーザーの月次添削履歴を新しい順で取得 (履歴一覧画面用)。
 * @param limit 取得件数 (デフォルト 12 = 1 年分)
 */
export async function listMyAudits(
  limit: number = 12
): Promise<MonthlyAuditRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("target_month", { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => rowToRecord(d as Record<string, unknown>));
}

// ===== 管理者向け =====

/**
 * 管理者用: 特定の添削 ID で取得 (個別作業画面用)。
 * RLS で管理者のみ全件アクセス可能。
 */
export async function getAuditForAdmin(
  auditId: string
): Promise<MonthlyAuditRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .eq("id", auditId)
    .maybeSingle();
  if (!data) return null;
  return rowToRecord(data as Record<string, unknown>);
}

/**
 * 管理者用: 未返答リスト (提出済 + 動画未配信)。
 * 古い順 (FIFO) で返す。受信箱画面で使う。
 */
export async function listPendingAudits(): Promise<MonthlyAuditRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .not("submitted_at", "is", null)
    .is("nori_video_published_at", null)
    .order("submitted_at", { ascending: true });

  return (data ?? []).map((d) => rowToRecord(d as Record<string, unknown>));
}

/**
 * 管理者用: 全添削履歴を新しい順で取得 (履歴閲覧用)。
 */
export async function listAllAudits(
  limit: number = 100
): Promise<MonthlyAuditRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_audits")
    .select(
      "id, user_id, target_month, items, items_filled_count, last_saved_at, submitted_at, nori_video_vimeo_url, nori_video_vimeo_id, nori_video_published_at, nori_video_duration_sec, created_at, updated_at"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((d) => rowToRecord(d as Record<string, unknown>));
}
