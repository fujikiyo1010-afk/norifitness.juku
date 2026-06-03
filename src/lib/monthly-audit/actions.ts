"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  countFilledItems,
  canSubmit,
  listMissingRequiredKeys,
  type MonthlyAuditItems,
} from "./types";

/**
 * 月次添削 (monthly_audits) の更新関数群 (Server Action)。
 *
 * 設計方針:
 *   - 1 ユーザー × 1 月 = 1 件 (upsert で同一行を上書き)
 *   - RLS で受講生は自分のだけ、管理者は全行アクセス可
 *   - 提出時に必須 16 項目チェック (Q16 のみ任意)
 *   - 添削動画 URL の保存は管理者のみ (RLS で自動制御)
 */

export type SaveAuditResult =
  | { ok: true; updated_at: string; filled_count: number }
  | { ok: false; message: string; missing_keys?: string[] };

/**
 * 月次添削の途中保存 (受講生用、upsert)。
 *   - last_saved_at セット
 *   - submitted_at は触らない (記入中のまま、B 状態維持)
 *   - filled_count を自動計算
 */
export async function saveDraft(
  targetMonth: string,
  items: MonthlyAuditItems
): Promise<SaveAuditResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const filledCount = countFilledItems(items);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("monthly_audits")
    .upsert(
      {
        user_id: user.id,
        target_month: targetMonth,
        items,
        items_filled_count: filledCount,
        last_saved_at: now,
      },
      { onConflict: "user_id,target_month" }
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/monthly-review", "page");
  revalidatePath("/monthly-review/form", "page");

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: filledCount,
  };
}

/**
 * 月次添削の提出 (受講生用)。
 *   - 必須 16 項目チェック (Q16 のみ任意)
 *   - 通過すれば submitted_at + last_saved_at セット (C 状態へ)
 *   - 失敗時は missing_keys を返して UI で「未記入があります」表示
 */
export async function submitAudit(
  targetMonth: string,
  items: MonthlyAuditItems
): Promise<SaveAuditResult> {
  // バリデーション: 必須項目チェック
  if (!canSubmit(items)) {
    const missing = listMissingRequiredKeys(items);
    return {
      ok: false,
      message: `未記入の必須項目が ${missing.length} 個あります`,
      missing_keys: missing,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const filledCount = countFilledItems(items);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("monthly_audits")
    .upsert(
      {
        user_id: user.id,
        target_month: targetMonth,
        items,
        items_filled_count: filledCount,
        last_saved_at: now,
        submitted_at: now,
      },
      { onConflict: "user_id,target_month" }
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/monthly-review", "page");
  revalidatePath("/monthly-review/form", "page");
  revalidatePath("/monthly-review/complete", "page");

  // TODO: 管理者に新規提出通知 (Phase 3 後半で実装)

  return {
    ok: true,
    updated_at: data.updated_at as string,
    filled_count: filledCount,
  };
}

// ===== 管理者用 =====

export type AttachVideoResult =
  | { ok: true; updated_at: string }
  | { ok: false; message: string };

/**
 * 管理者用: のり氏動画 URL を月次添削に紐付ける。
 *   - Vimeo / Supabase Storage のどちらでも対応 (URL 文字列で受ける)
 *   - nori_video_published_at セット = 受講生に「返信あり」(D 状態) になる
 *   - RLS で管理者のみ実行可能 (受講生からは update 不可)
 */
export async function attachNoriVideo(
  auditId: string,
  videoUrl: string,
  videoId: string | null,
  durationSec?: number
): Promise<AttachVideoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("monthly_audits")
    .update({
      nori_video_vimeo_url: videoUrl,
      nori_video_vimeo_id: videoId,
      nori_video_duration_sec: durationSec ?? null,
      nori_video_published_at: now,
    })
    .eq("id", auditId)
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/monthly-review", "page");
  revalidatePath("/monthly-review", "page");

  // TODO: 受講生に LINE プッシュ通知 + メール通知を発火 (Phase 3 後半で実装)

  return { ok: true, updated_at: data.updated_at as string };
}
