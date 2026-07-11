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
export async function getMyCurrentMenu(
  userId?: string
): Promise<UserWorkoutMenuRow | null> {
  const supabase = await createClient();
  // S2-C: 呼び出し元が user を持っていれば getUser(往復)を省く(未指定なら従来どおり)。
  let uid = userId;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }

  const { data } = await supabase
    .from("user_workout_menu")
    .select(MENU_COLS)
    .eq("user_id", uid)
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

// =====================================================================
// 受講生一覧用 サマリ
// =====================================================================

export type UserListSummary = {
  id: string;
  displayName: string;
  age: number | null;
  ageBand: AgeBand | null;
  gender: Gender | null;
  joinedAt: string | null;

  latestAuditStatus: "a_empty" | "b_in_progress" | "c_submitted" | "d_replied";
  latestAuditTargetMonth: string | null;

  hasCarteSubmitted: boolean;
  hasCurrentMenu: boolean;
  pendingRequestCount: number;
  menuReviewNeeded: boolean;
  /** 目標シート 状態 */
  goalSheetState: "not_started" | "in_review" | "review_requested" | "reviewed";

  /** 最終アクション日時 (各ソースの最新の更新日時の最大値) */
  lastActionAt: string | null;
};

/**
 * 受講生一覧 (/admin/users) 用: 全受講生 + 各受講生の状態を集計。
 *
 * N+1 を避けるため、ID リストを使って各テーブルから一括取得し、
 * Map で突合して合成する。
 *
 * 50-100 人規模では実用十分。それ以上に増えたら専用ビューを検討。
 */
export async function listAllUsersWithStatus(): Promise<UserListSummary[]> {
  const supabase = await createClient();

  // 1. 全受講生取得
  const { data: usersData } = await supabase
    .from("users")
    .select("id, name, nickname, joined_at")
    .order("joined_at", { ascending: false });
  const users = usersData ?? [];
  if (users.length === 0) return [];
  const userIds = users.map((u) => u.id as string);

  // 2-8. 関連テーブルを並列取得
  const [
    profilesRes,
    cartesRes,
    menusRes,
    auditsRes,
    carteReqRes,
    workoutReqRes,
    goalSheetsRes,
  ] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("user_id, birthday")
        .in("user_id", userIds),
      supabase
        .from("user_workout_carte")
        .select("user_id, gender, menu_review_needed, updated_at")
        .in("user_id", userIds),
      supabase
        .from("user_workout_menu")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .eq("is_current", true),
      supabase
        .from("monthly_audits")
        .select(
          "id, user_id, target_month, submitted_at, nori_video_published_at, updated_at"
        )
        .in("user_id", userIds)
        .order("target_month", { ascending: false }),
      supabase
        .from("user_carte_request")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .eq("status", "pending"),
      supabase
        .from("user_workout_request")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .eq("status", "pending"),
      supabase
        .from("goal_sheets")
        .select("user_id, reviewed_at, last_review_requested_at, updated_at")
        .in("user_id", userIds),
    ]);

  // Map 化
  const profileMap = new Map<string, string | null>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.user_id as string, (p.birthday as string | null) ?? null);
  }
  const carteMap = new Map<
    string,
    { gender: Gender | null; flag: boolean; updated_at: string }
  >();
  for (const c of cartesRes.data ?? []) {
    carteMap.set(c.user_id as string, {
      gender: (c.gender as Gender) ?? null,
      flag: (c.menu_review_needed as boolean) ?? false,
      updated_at: c.updated_at as string,
    });
  }
  const menuMap = new Map<string, string>(); // user_id -> created_at (現役メニューがあれば)
  for (const m of menusRes.data ?? []) {
    menuMap.set(m.user_id as string, m.created_at as string);
  }
  // 各 user の「最新の audit」を抽出 (target_month 降順なので最初の出現が最新)
  const latestAuditMap = new Map<
    string,
    {
      status: "a_empty" | "b_in_progress" | "c_submitted" | "d_replied";
      targetMonth: string;
      updated_at: string;
    }
  >();
  for (const a of auditsRes.data ?? []) {
    const uid = a.user_id as string;
    if (latestAuditMap.has(uid)) continue;
    const submitted = (a.submitted_at as string | null) ?? null;
    const published = (a.nori_video_published_at as string | null) ?? null;
    const status: "a_empty" | "b_in_progress" | "c_submitted" | "d_replied" =
      !submitted
        ? "b_in_progress"
        : !published
          ? "c_submitted"
          : "d_replied";
    latestAuditMap.set(uid, {
      status,
      targetMonth: a.target_month as string,
      updated_at: a.updated_at as string,
    });
  }
  const reqCountMap = new Map<string, { count: number; latest: string }>();
  for (const r of [
    ...(carteReqRes.data ?? []),
    ...(workoutReqRes.data ?? []),
  ]) {
    const uid = r.user_id as string;
    const created = r.created_at as string;
    const prev = reqCountMap.get(uid);
    if (prev) {
      reqCountMap.set(uid, {
        count: prev.count + 1,
        latest: created > prev.latest ? created : prev.latest,
      });
    } else {
      reqCountMap.set(uid, { count: 1, latest: created });
    }
  }

  // 目標シート: state 判定
  //   - 行なし                                                 → not_started
  //   - 行あり + reviewed_at = null                            → in_review (添削待ち)
  //   - 行あり + last_review_requested_at > reviewed_at        → review_requested (再添削依頼)
  //   - 行あり + reviewed_at あり + 再依頼なし                  → reviewed (添削済)
  const goalSheetMap = new Map<
    string,
    {
      state: "in_review" | "review_requested" | "reviewed";
      updated_at: string;
    }
  >();
  for (const g of goalSheetsRes.data ?? []) {
    const uid = g.user_id as string;
    const reviewedAt = (g.reviewed_at as string | null) ?? null;
    const lastRequestedAt = (g.last_review_requested_at as string | null) ?? null;
    const state: "in_review" | "review_requested" | "reviewed" = !reviewedAt
      ? "in_review"
      : lastRequestedAt && lastRequestedAt > reviewedAt
        ? "review_requested"
        : "reviewed";
    goalSheetMap.set(uid, {
      state,
      updated_at: (g.updated_at as string) ?? reviewedAt ?? lastRequestedAt ?? "",
    });
  }

  // 合成
  return users.map((u) => {
    const id = u.id as string;
    const name = (u.nickname as string | null) || (u.name as string);
    const joinedAt = (u.joined_at as string | null) ?? null;
    const birthday = profileMap.get(id) ?? null;
    const carte = carteMap.get(id);
    const menuCreatedAt = menuMap.get(id);
    const latestAudit = latestAuditMap.get(id);
    const req = reqCountMap.get(id);

    // 最終アクション = 各ソースの updated_at/created_at の最大値
    const goalSheet = goalSheetMap.get(id);
    const candidates: string[] = [];
    if (carte) candidates.push(carte.updated_at);
    if (menuCreatedAt) candidates.push(menuCreatedAt);
    if (latestAudit) candidates.push(latestAudit.updated_at);
    if (req) candidates.push(req.latest);
    if (goalSheet?.updated_at) candidates.push(goalSheet.updated_at);
    const lastActionAt =
      candidates.length > 0
        ? candidates.sort().slice(-1)[0]
        : joinedAt ?? null;

    return {
      id,
      displayName: name,
      age: birthday ? calcAge(birthday) : null,
      ageBand: birthday ? calcAgeBand(birthday) : null,
      gender: carte?.gender ?? null,
      joinedAt,
      latestAuditStatus: latestAudit?.status ?? "a_empty",
      latestAuditTargetMonth: latestAudit?.targetMonth ?? null,
      hasCarteSubmitted: !!carte,
      hasCurrentMenu: !!menuCreatedAt,
      pendingRequestCount: req?.count ?? 0,
      menuReviewNeeded: !!carte?.flag,
      goalSheetState: goalSheet?.state ?? "not_started",
      lastActionAt,
    };
  });
}

// calcAge は types で定義済み (export 済) だが、ファイル内で import 直す
function calcAge(birthday: string): number {
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * 管理者ダッシュボード用: 全体メトリクスを 1 関数で集計。
 *
 * 取得項目:
 *   - 受講生総数 (users)
 *   - 月次未返信件数 (monthly_audits: submitted_at あり かつ nori_video_published_at null)
 *   - 個別対応 pending 件数 (carte/workout 両方)
 *   - カルテ変更あり件数 (user_workout_carte.menu_review_needed)
 *
 * 各クエリは count: 'exact' / head: true で本文取得を回避。
 */
export async function countAdminDashboardMetrics(): Promise<{
  totalUsers: number;
  pendingAudits: number;
  pendingCarteRequests: number;
  pendingWorkoutRequests: number;
  pendingTotal: number;
  carteReviewFlagged: number;
}> {
  const supabase = await createClient();
  const [usersRes, auditRes, carteReqRes, workoutReqRes, flagRes] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase
        .from("monthly_audits")
        .select("id", { count: "exact", head: true })
        .not("submitted_at", "is", null)
        .is("nori_video_published_at", null),
      supabase
        .from("user_carte_request")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("user_workout_request")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("user_workout_carte")
        .select("user_id", { count: "exact", head: true })
        .eq("menu_review_needed", true),
    ]);
  const carteReq = carteReqRes.count ?? 0;
  const workoutReq = workoutReqRes.count ?? 0;
  return {
    totalUsers: usersRes.count ?? 0,
    pendingAudits: auditRes.count ?? 0,
    pendingCarteRequests: carteReq,
    pendingWorkoutRequests: workoutReq,
    pendingTotal: carteReq + workoutReq,
    carteReviewFlagged: flagRes.count ?? 0,
  };
}

/**
 * ハブ画面用: 特定ユーザーの未対応リクエスト件数を取得。
 * 件数だけ知りたいので head + count='exact' で軽量化。
 */
export async function countPendingRequestsForUser(
  userId: string
): Promise<{ carte: number; workout: number; total: number }> {
  const supabase = await createClient();
  const [carteRes, workoutRes] = await Promise.all([
    supabase
      .from("user_carte_request")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
    supabase
      .from("user_workout_request")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
  ]);
  const carte = carteRes.count ?? 0;
  const workout = workoutRes.count ?? 0;
  return { carte, workout, total: carte + workout };
}

/**
 * ハブ画面用: 特定ユーザーの pending リクエスト本文一覧を取得 (最新 N 件)。
 * 件数だけでなく本文も見たい場合に使う (ハブで対応事項として引用)。
 */
export async function listPendingRequestsForUser(
  userId: string,
  limit: number = 3
): Promise<{
  carte: UserCarteRequestRow[];
  workout: UserWorkoutRequestRow[];
}> {
  const supabase = await createClient();
  const [carteRes, workoutRes] = await Promise.all([
    supabase
      .from("user_carte_request")
      .select(CARTE_REQ_COLS)
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("user_workout_request")
      .select(WORKOUT_REQ_COLS)
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  return {
    carte: (carteRes.data ?? []).map((d) =>
      carteRequestRow(d as Record<string, unknown>)
    ),
    workout: (workoutRes.data ?? []).map((d) =>
      workoutRequestRow(d as Record<string, unknown>)
    ),
  };
}

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
