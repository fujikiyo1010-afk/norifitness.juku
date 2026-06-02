/**
 * 筋トレメニュー機能 Supabase 読み取り関数群
 *
 * 設計方針:
 *   - Server Component から直接呼ぶ前提 ("use server" 不要)
 *   - RLS により受講生は自分のみ、管理者は全行アクセス
 *   - 案 C: user_profiles.birthday を JOIN で取得して age_band を TS 側で計算
 *
 * 関連:
 *   - 純粋スコア計算: ./matching.ts
 *   - 型定義: ./types.ts
 *   - 書き込み (Server Action): ./actions.ts
 */

import { createClient } from "@/lib/supabase/server";
import {
  type WorkoutTemplateRow,
  type UserWorkoutCarteRow,
  type UserWorkoutMenuRow,
  type UserWorkoutRequestRow,
  type UserCarteRequestRow,
  type MenuCandidate,
  type AgeBand,
  type BodyPartGroup,
  type Gender,
  calcAgeBand,
} from "./types";
import { pickTopCandidates } from "./matching";

// =====================================================================
// 型: カルテ + 年齢層 (案 C 後の戻り値)
// =====================================================================

/**
 * カルテに、user_profiles.birthday から計算した age_band を付与した型。
 * UI / マッチング で使いやすいよう、calcAgeBand 結果を同梱。
 */
export type CarteWithAgeBand = UserWorkoutCarteRow & {
  birthday: string | null;
  age_band: AgeBand | null;
};

// =====================================================================
// 共通: row → record 変換
// =====================================================================

function templateRow(d: Record<string, unknown>): WorkoutTemplateRow {
  return {
    id: d.id as string,
    source_name: (d.source_name as string | null) ?? null,
    source_filename: (d.source_filename as string | null) ?? null,
    source_user_id: (d.source_user_id as string | null) ?? null,
    gender: d.gender as WorkoutTemplateRow["gender"],
    age_band: d.age_band as AgeBand,
    instrument: (d.instrument as string | null) ?? null,
    frequency: (d.frequency as string | null) ?? null,
    primary_body: (d.primary_body as string | null) ?? null,
    cycles: (d.cycles as WorkoutTemplateRow["cycles"]) ?? [],
    body_parts_main:
      (d.body_parts_main as Record<string, number>) ?? {},
    total_exercises: (d.total_exercises as number) ?? 0,
    cycle_count: (d.cycle_count as number) ?? 0,
    karte_match: (d.karte_match as string | null) ?? null,
    is_active: (d.is_active as boolean) ?? true,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

function carteRow(d: Record<string, unknown>): UserWorkoutCarteRow {
  return {
    user_id: d.user_id as string,
    gender: d.gender as UserWorkoutCarteRow["gender"],
    environments:
      (d.environments as UserWorkoutCarteRow["environments"]) ?? [],
    frequency_wish:
      (d.frequency_wish as UserWorkoutCarteRow["frequency_wish"]) ?? null,
    focus_body_parts:
      (d.focus_body_parts as UserWorkoutCarteRow["focus_body_parts"]) ?? [],
    purposes: (d.purposes as UserWorkoutCarteRow["purposes"]) ?? [],
    experience: (d.experience as UserWorkoutCarteRow["experience"]) ?? null,
    medical_limits:
      (d.medical_limits as UserWorkoutCarteRow["medical_limits"]) ?? [],
    ideal_body: (d.ideal_body as UserWorkoutCarteRow["ideal_body"]) ?? null,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
    menu_review_needed: (d.menu_review_needed as boolean) ?? false,
    last_machine_field_changed_at:
      (d.last_machine_field_changed_at as string | null) ?? null,
  };
}

function menuRow(d: Record<string, unknown>): UserWorkoutMenuRow {
  return {
    id: d.id as string,
    user_id: d.user_id as string,
    template_id: (d.template_id as string | null) ?? null,
    template_snapshot:
      (d.template_snapshot as WorkoutTemplateRow | null) ?? null,
    cycles: (d.cycles as UserWorkoutMenuRow["cycles"]) ?? [],
    notes: (d.notes as string | null) ?? null,
    effective_from: d.effective_from as string,
    is_current: (d.is_current as boolean) ?? false,
    created_at: d.created_at as string,
    updated_at: d.updated_at as string,
  };
}

// 列名定数 (select で繰り返さないため)
const TEMPLATE_COLS =
  "id, source_name, source_filename, source_user_id, gender, age_band, instrument, frequency, primary_body, cycles, body_parts_main, total_exercises, cycle_count, karte_match, is_active, created_at, updated_at";

const CARTE_COLS =
  "user_id, gender, environments, frequency_wish, focus_body_parts, purposes, experience, medical_limits, ideal_body, created_at, updated_at, menu_review_needed, last_machine_field_changed_at";

const MENU_COLS =
  "id, user_id, template_id, template_snapshot, cycles, notes, effective_from, is_current, created_at, updated_at";

// =====================================================================
// カルテ取得
// =====================================================================

/**
 * 受講生 (本人) のカルテを取得。RLS で自分の行のみアクセス可。
 * user_profiles.birthday も同時取得して age_band を計算済の状態で返す。
 */
export async function getMyCarte(): Promise<CarteWithAgeBand | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [carteRes, profileRes] = await Promise.all([
    supabase
      .from("user_workout_carte")
      .select(CARTE_COLS)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!carteRes.data) return null;

  const carte = carteRow(carteRes.data as Record<string, unknown>);
  const birthday = (profileRes.data?.birthday as string | null) ?? null;
  const age_band = birthday ? calcAgeBand(birthday) : null;

  return { ...carte, birthday, age_band };
}

/**
 * 管理者が任意の受講生のカルテを取得。
 * RLS により管理者なら全件アクセス可。
 */
export async function getCarteForAdmin(
  userId: string
): Promise<CarteWithAgeBand | null> {
  const supabase = await createClient();

  const [carteRes, profileRes] = await Promise.all([
    supabase
      .from("user_workout_carte")
      .select(CARTE_COLS)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!carteRes.data) return null;

  const carte = carteRow(carteRes.data as Record<string, unknown>);
  const birthday = (profileRes.data?.birthday as string | null) ?? null;
  const age_band = birthday ? calcAgeBand(birthday) : null;

  return { ...carte, birthday, age_band };
}

// =====================================================================
// メニュー取得
// =====================================================================

/**
 * 受講生 (本人) の現役メニュー (is_current = true) を 1 件取得。
 */
export async function getMyCurrentMenu(): Promise<UserWorkoutMenuRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_workout_menu")
    .select(MENU_COLS)
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!data) return null;
  return menuRow(data as Record<string, unknown>);
}

/**
 * 管理者用: 任意受講生の現役メニューを取得。
 */
export async function getCurrentMenuForAdmin(
  userId: string
): Promise<UserWorkoutMenuRow | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_workout_menu")
    .select(MENU_COLS)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (!data) return null;
  return menuRow(data as Record<string, unknown>);
}

/**
 * 受講生 (本人) のメニュー履歴 (新しい順)。
 */
export async function listMyMenuHistory(
  limit: number = 12
): Promise<UserWorkoutMenuRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_workout_menu")
    .select(MENU_COLS)
    .eq("user_id", user.id)
    .order("effective_from", { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => menuRow(d as Record<string, unknown>));
}

// =====================================================================
// マッチング検索 (管理者用)
// =====================================================================

export type FindCandidatesResult =
  | { ok: true; candidates: MenuCandidate[] }
  | { ok: false; message: string };

/**
 * 指定受講生のカルテから上位 N 件の候補メニューを返す。
 *
 * 性別はフィルタとして SQL レベルで除外 (異性のテンプレを取得しない)。
 * 年齢層 / 重点部位 / 頻度 / 環境 はスコアリングで重み付け。
 *
 * focusOverride (案 D): 「この検索だけ別の部位で再マッチング」する場合に指定。
 *   - null/undefined → カルテの focus_body_parts を使う (通常)
 *   - 配列指定 → カルテの代わりにこの値で重点部位スコアを計算
 *
 * ageOverride: 「30代だけど40代基準で見たい」のような調整用。
 *   - null/undefined → カルテの age_band を使う (通常)
 *   - 値指定 → その年齢層でスコア計算
 *
 * カルテが取得できない場合は { ok: false, message } を返す。
 */
export async function findCandidateMenus(
  userId: string,
  topN: number = 3,
  focusOverride: BodyPartGroup[] | null = null,
  ageOverride: AgeBand | null = null
): Promise<FindCandidatesResult> {
  const supabase = await createClient();

  // 1. カルテ + 生年月日取得
  const carte = await getCarteForAdmin(userId);
  if (!carte) {
    return { ok: false, message: "カルテが見つかりません" };
  }
  if (!carte.age_band) {
    return {
      ok: false,
      message: "生年月日 (user_profiles.birthday) が未設定のため年齢層を計算できません",
    };
  }

  // 2. 性別フィルタで候補テンプレ取得 (is_active = true のみ)
  const { data: templates, error: tplErr } = await supabase
    .from("workout_templates")
    .select(TEMPLATE_COLS)
    .eq("gender", carte.gender)
    .eq("is_active", true);

  if (tplErr) {
    return { ok: false, message: `テンプレ取得失敗: ${tplErr.message}` };
  }
  if (!templates || templates.length === 0) {
    return { ok: true, candidates: [] };
  }

  const templateRows = templates.map((t) =>
    templateRow(t as Record<string, unknown>)
  );

  // 3. スコア計算 + 上位 N 件 (focus/age オーバーライド適用)
  const effectiveFocus =
    focusOverride && focusOverride.length > 0
      ? focusOverride
      : carte.focus_body_parts;
  const effectiveAgeBand = ageOverride ?? carte.age_band;

  const candidates = pickTopCandidates(
    templateRows,
    effectiveAgeBand,
    carte.environments,
    carte.frequency_wish,
    effectiveFocus,
    topN
  );

  return { ok: true, candidates };
}

// =====================================================================
// 受信箱: 個別対応リクエスト
// =====================================================================

function workoutRequestRow(d: Record<string, unknown>): UserWorkoutRequestRow {
  return {
    id: d.id as string,
    user_id: d.user_id as string,
    request_text: d.request_text as string,
    status: d.status as UserWorkoutRequestRow["status"],
    created_at: d.created_at as string,
    handled_at: (d.handled_at as string | null) ?? null,
    handled_by: (d.handled_by as string | null) ?? null,
    resulting_menu_id: (d.resulting_menu_id as string | null) ?? null,
  };
}

function carteRequestRow(d: Record<string, unknown>): UserCarteRequestRow {
  return {
    id: d.id as string,
    user_id: d.user_id as string,
    request_text: d.request_text as string,
    status: d.status as UserCarteRequestRow["status"],
    created_at: d.created_at as string,
    handled_at: (d.handled_at as string | null) ?? null,
    handled_by: (d.handled_by as string | null) ?? null,
  };
}

const WORKOUT_REQ_COLS =
  "id, user_id, request_text, status, created_at, handled_at, handled_by, resulting_menu_id";
const CARTE_REQ_COLS =
  "id, user_id, request_text, status, created_at, handled_at, handled_by";

/**
 * 個別対応受信箱: pending な (未対応) リクエストを古い順で取得。
 * 管理者用。
 */
export async function listPendingWorkoutRequests(): Promise<
  UserWorkoutRequestRow[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_workout_request")
    .select(WORKOUT_REQ_COLS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []).map((d) => workoutRequestRow(d as Record<string, unknown>));
}

export async function listPendingCarteRequests(): Promise<UserCarteRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_carte_request")
    .select(CARTE_REQ_COLS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []).map((d) => carteRequestRow(d as Record<string, unknown>));
}

/**
 * 受講生 (本人) の自分のリクエスト履歴。
 */
export async function listMyWorkoutRequests(): Promise<UserWorkoutRequestRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_workout_request")
    .select(WORKOUT_REQ_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => workoutRequestRow(d as Record<string, unknown>));
}

export async function listMyCarteRequests(): Promise<UserCarteRequestRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_carte_request")
    .select(CARTE_REQ_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => carteRequestRow(d as Record<string, unknown>));
}

// =====================================================================
// 受信箱: 受講生情報付きリクエスト一覧 (管理者用)
// =====================================================================

export type RequestUserInfo = {
  id: string;
  display_name: string;
  gender: Gender | null;
  age_band: AgeBand | null;
};

export type CarteRequestWithUser = UserCarteRequestRow & {
  user_info: RequestUserInfo;
};
export type WorkoutRequestWithUser = UserWorkoutRequestRow & {
  user_info: RequestUserInfo;
};

/**
 * 個別対応受信箱用: pending な (未対応) 両リクエストを取得し、
 * 各受講生の表示名 / 性別 / 年齢層を一括取得して合成して返す。
 *
 * N+1 を避けるため、user_id を集めて in() 一括クエリで取得する。
 */
export async function listPendingRequestsWithUserInfo(): Promise<{
  carte: CarteRequestWithUser[];
  workout: WorkoutRequestWithUser[];
}> {
  const supabase = await createClient();

  // 1. 両 pending リクエストを取得
  const [carteRes, workoutRes] = await Promise.all([
    supabase
      .from("user_carte_request")
      .select(CARTE_REQ_COLS)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("user_workout_request")
      .select(WORKOUT_REQ_COLS)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const carteRows = (carteRes.data ?? []).map((d) =>
    carteRequestRow(d as Record<string, unknown>)
  );
  const workoutRows = (workoutRes.data ?? []).map((d) =>
    workoutRequestRow(d as Record<string, unknown>)
  );

  // 2. 関係する user_id を集める
  const allUserIds = Array.from(
    new Set([
      ...carteRows.map((r) => r.user_id),
      ...workoutRows.map((r) => r.user_id),
    ])
  );

  if (allUserIds.length === 0) {
    return { carte: [], workout: [] };
  }

  // 3. users / profiles / carte を一括取得
  const [usersRes, profilesRes, cartesRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, nickname")
      .in("id", allUserIds),
    supabase
      .from("user_profiles")
      .select("user_id, birthday")
      .in("user_id", allUserIds),
    supabase
      .from("user_workout_carte")
      .select("user_id, gender")
      .in("user_id", allUserIds),
  ]);

  // 4. user_id → RequestUserInfo の Map を作成
  const userInfoMap = new Map<string, RequestUserInfo>();
  for (const u of usersRes.data ?? []) {
    const id = u.id as string;
    const name = (u.nickname as string | null) || (u.name as string);
    userInfoMap.set(id, {
      id,
      display_name: name,
      gender: null,
      age_band: null,
    });
  }
  for (const p of profilesRes.data ?? []) {
    const id = p.user_id as string;
    const birthday = (p.birthday as string | null) ?? null;
    const info = userInfoMap.get(id);
    if (info && birthday) {
      info.age_band = calcAgeBand(birthday);
    }
  }
  for (const c of cartesRes.data ?? []) {
    const id = c.user_id as string;
    const info = userInfoMap.get(id);
    if (info) {
      info.gender = (c.gender as Gender) ?? null;
    }
  }

  // 5. 各リクエストに user_info を合成
  const fallback = (id: string): RequestUserInfo => ({
    id,
    display_name: "(不明な受講生)",
    gender: null,
    age_band: null,
  });

  return {
    carte: carteRows.map((r) => ({
      ...r,
      user_info: userInfoMap.get(r.user_id) ?? fallback(r.user_id),
    })),
    workout: workoutRows.map((r) => ({
      ...r,
      user_info: userInfoMap.get(r.user_id) ?? fallback(r.user_id),
    })),
  };
}
