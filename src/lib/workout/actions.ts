"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminInfo } from "@/lib/auth/admin";
import { validateMenuForDistribution } from "./menu-display";
import {
  type Gender,
  type Environment,
  type Frequency,
  type BodyPartGroup,
  type Purpose,
  type Experience,
  type MedicalLimit,
  type IdealBody,
  type WorkoutCycles,
  type WorkoutTemplateRow,
} from "./types";

/**
 * 筋トレメニュー機能 書き込み Server Action 群
 *
 * 設計方針:
 *   - 戻り値は { ok: true; ... } | { ok: false; message: string } の discriminated union
 *   - 管理者専用関数は getAdminInfo() で権限チェック (redirect ではなく戻り値でエラー)
 *   - 受講生発信のリクエスト作成は auth.uid() で本人確認のみ
 *   - revalidatePath で関連画面を再生成
 *
 * 関連:
 *   - 読み取り: ./queries.ts
 *   - 純粋関数: ./matching.ts
 *   - 型定義: ./types.ts
 */

// =====================================================================
// 共通: 戻り値型
// =====================================================================

export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

// =====================================================================
// 受講生: 自分のカルテを初回作成 (INSERT のみ、UPDATE は管理者経由)
// =====================================================================

export type MyCarteInput = {
  gender: Gender;
  environments: Environment[];
  frequency_wish: Frequency | null;
  focus_body_parts: BodyPartGroup[];
  purposes: Purpose[];
  experience: Experience | null;
  medical_limits: MedicalLimit[];
  ideal_body: IdealBody | null;
};

/**
 * 受講生が自分のカルテを初回提出。
 *
 * - INSERT のみ (UPDATE は受講生不可、変更は「カルテ更新リクエスト」経由)
 * - user_workout_carte.user_id PRIMARY KEY のため、2 回目は UNIQUE 違反で弾く
 * - 機械マッチング 4 項目 (gender/environments/frequency_wish/focus_body_parts) は必須
 * - 補助 4 項目 (purposes/experience/medical_limits/ideal_body) は任意
 */
export async function createMyCarte(
  input: MyCarteInput
): Promise<ActionResult<{ created: true }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  // 必須項目バリデーション (機械マッチング 4 項目)
  if (input.environments.length === 0) {
    return { ok: false, message: "使える環境を 1 つ以上選んでください" };
  }
  if (!input.frequency_wish) {
    return { ok: false, message: "理想の頻度を選んでください" };
  }
  if (input.focus_body_parts.length === 0) {
    return { ok: false, message: "鍛えたい部位を 1 つ以上選んでください" };
  }

  const { error } = await supabase.from("user_workout_carte").insert({
    user_id: user.id,
    gender: input.gender,
    environments: input.environments,
    frequency_wish: input.frequency_wish,
    focus_body_parts: input.focus_body_parts,
    purposes: input.purposes,
    experience: input.experience,
    medical_limits: input.medical_limits,
    ideal_body: input.ideal_body,
  });

  if (error) {
    // PRIMARY KEY 違反 (= 2 回目提出)
    if (error.code === "23505") {
      return {
        ok: false,
        message:
          "すでにカルテを提出しています。変更したい場合は「カルテ更新リクエスト」を送ってください",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/workout", "page");
  revalidatePath("/workout/carte", "page");
  revalidatePath("/workout/carte/new", "page");

  return { ok: true, created: true };
}

// =====================================================================
// 管理者: カルテ作成 / 更新
// =====================================================================

export type CarteInput = {
  user_id: string;
  gender: Gender;
  environments: Environment[];
  frequency_wish: Frequency | null;
  focus_body_parts: BodyPartGroup[];
  purposes: Purpose[];
  experience: Experience | null;
  medical_limits: MedicalLimit[];
  ideal_body: IdealBody | null;
};

/**
 * 管理者がカルテを upsert (作成または上書き)。
 * 機械マッチング項目が変わった場合、Trigger で menu_review_needed = true がセットされる。
 */
export async function saveCarteAsAdmin(
  input: CarteInput
): Promise<ActionResult<{ updated_at: string }>> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_workout_carte")
    .upsert(
      {
        user_id: input.user_id,
        gender: input.gender,
        environments: input.environments,
        frequency_wish: input.frequency_wish,
        focus_body_parts: input.focus_body_parts,
        purposes: input.purposes,
        experience: input.experience,
        medical_limits: input.medical_limits,
        ideal_body: input.ideal_body,
      },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/users/${input.user_id}`, "page");
  revalidatePath("/admin/carte-requests", "page");

  return { ok: true, updated_at: data.updated_at as string };
}

/**
 * 管理者がカルテの menu_review_needed フラグをクリア
 * (メニュー見直し対応が完了したことを記録)。
 */
export async function clearMenuReviewFlag(
  userId: string
): Promise<ActionResult<{ updated_at: string }>> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_workout_carte")
    .update({
      menu_review_needed: false,
    })
    .eq("user_id", userId)
    .select("updated_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/users/${userId}`, "page");

  return { ok: true, updated_at: data.updated_at as string };
}

// =====================================================================
// 管理者: メニュー配布
// =====================================================================

export type DistributeMenuInput = {
  user_id: string;
  template_id: string | null;            // テンプレベースなら id、ゼロから手作りなら null
  template_snapshot: WorkoutTemplateRow | null;  // テンプレ削除後も参照できるようコピー
  cycles: WorkoutCycles;                 // 微調整後の最終メニュー
  notes: string | null;
  effective_from?: string;               // YYYY-MM-DD、デフォルトは今日
};

/**
 * 管理者が新規メニューを受講生に配布。
 *
 * 動作:
 *   1. 既存の現役メニュー (is_current=true) を全部 is_current=false に
 *   2. 新規メニューを is_current=true で INSERT
 *   3. (波及) workout_templates にも source_user_id 付きで自動追加 (将来的にマッチング母集団になる)
 */
export async function distributeMenu(
  input: DistributeMenuInput
): Promise<ActionResult<{ menu_id: string }>> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  // バリデーション (5 項目)
  const validation = validateMenuForDistribution(input.cycles, input.notes);
  if (!validation.ok) {
    return {
      ok: false,
      message: `配布できません:\n${validation.errors.map((e) => `・${e}`).join("\n")}`,
    };
  }

  const supabase = await createClient();

  // 1. 既存現役メニューを過去化
  const { error: pastErr } = await supabase
    .from("user_workout_menu")
    .update({ is_current: false })
    .eq("user_id", input.user_id)
    .eq("is_current", true);

  if (pastErr) {
    return { ok: false, message: `既存メニュー切替失敗: ${pastErr.message}` };
  }

  // 2. 新規メニュー INSERT
  const { data: newMenu, error: insErr } = await supabase
    .from("user_workout_menu")
    .insert({
      user_id: input.user_id,
      template_id: input.template_id,
      template_snapshot: input.template_snapshot,
      cycles: input.cycles,
      notes: input.notes,
      effective_from: input.effective_from ?? new Date().toISOString().slice(0, 10),
      is_current: true,
    })
    .select("id")
    .single();

  if (insErr || !newMenu) {
    return {
      ok: false,
      message: `新規メニュー作成失敗: ${insErr?.message ?? "unknown"}`,
    };
  }

  revalidatePath(`/admin/users/${input.user_id}`, "page");
  revalidatePath("/admin/workout-requests", "page");

  return { ok: true, menu_id: newMenu.id as string };
}

// =====================================================================
// 受講生: リクエスト作成
// =====================================================================

/**
 * 受講生がメニュー変更リクエストを作成。
 */
export async function createWorkoutRequest(
  requestText: string
): Promise<ActionResult<{ request_id: string }>> {
  if (!requestText.trim()) {
    return { ok: false, message: "リクエスト内容を入力してください" };
  }
  if (requestText.length > 2000) {
    return { ok: false, message: "リクエストは 2000 文字以内にしてください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const { data, error } = await supabase
    .from("user_workout_request")
    .insert({
      user_id: user.id,
      request_text: requestText.trim(),
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/workout", "page");
  revalidatePath("/admin/workout-requests", "page");

  return { ok: true, request_id: data.id as string };
}

/**
 * 受講生がカルテ更新リクエストを作成。
 */
export async function createCarteRequest(
  requestText: string
): Promise<ActionResult<{ request_id: string }>> {
  if (!requestText.trim()) {
    return { ok: false, message: "リクエスト内容を入力してください" };
  }
  if (requestText.length > 2000) {
    return { ok: false, message: "リクエストは 2000 文字以内にしてください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "ログインが必要です" };
  }

  const { data, error } = await supabase
    .from("user_carte_request")
    .insert({
      user_id: user.id,
      request_text: requestText.trim(),
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/workout", "page");
  revalidatePath("/admin/carte-requests", "page");

  return { ok: true, request_id: data.id as string };
}

// =====================================================================
// 管理者: リクエスト対応
// =====================================================================

/**
 * 管理者がメニュー変更リクエストを「対応済」に更新。
 * 対応に伴って配布したメニュー ID を resulting_menu_id に紐付け可能。
 */
export async function handleWorkoutRequest(input: {
  request_id: string;
  status: "in_progress" | "handled" | "dismissed";
  resulting_menu_id?: string;
}): Promise<ActionResult<{ handled_at: string | null }>> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const isClosing = input.status === "handled" || input.status === "dismissed";

  const { data, error } = await supabase
    .from("user_workout_request")
    .update({
      status: input.status,
      handled_at: isClosing ? now : null,
      handled_by: isClosing ? admin.id : null,
      resulting_menu_id: input.resulting_menu_id ?? null,
    })
    .eq("id", input.request_id)
    .select("handled_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/workout-requests", "page");

  return { ok: true, handled_at: (data.handled_at as string | null) ?? null };
}

/**
 * 管理者がカルテ更新リクエストを「対応済」に更新。
 */
export async function handleCarteRequest(input: {
  request_id: string;
  status: "in_progress" | "handled" | "dismissed";
}): Promise<ActionResult<{ handled_at: string | null }>> {
  const admin = await getAdminInfo();
  if (!admin) {
    return { ok: false, message: "管理者権限が必要です" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const isClosing = input.status === "handled" || input.status === "dismissed";

  const { data, error } = await supabase
    .from("user_carte_request")
    .update({
      status: input.status,
      handled_at: isClosing ? now : null,
      handled_by: isClosing ? admin.id : null,
    })
    .eq("id", input.request_id)
    .select("handled_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/carte-requests", "page");

  return { ok: true, handled_at: (data.handled_at as string | null) ?? null };
}
