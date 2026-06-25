/**
 * 筋トレメニュー機能 型定義 + 純粋関数
 *
 * 設計元:
 *   - supabase/migrations/20260601000001_workout_system.sql
 *   - memory/project_kinniku_juku_workout_menu.md
 *   - docs/00_premises/_handoff_to_workout_review_2026-06-01.md
 *
 * 設計方針:
 *   - DB レコード型は *Row サフィックス (既存パターン、monthly-audit / goal-sheet 統一)
 *   - type を使用、interface は使わない (既存パターン統一)
 *   - 受講生の生年月日は user_profiles.birthday を正、ここでは age_band を TS 側で計算
 *   - medical_limits の「なし」は空配列で表現 (二重表現を避ける)
 */

// =====================================================================
// 共通: enum 相当の文字列リテラル
// =====================================================================

export type Gender = "男" | "女" | "その他";

export type AgeBand =
  | "10代" | "20代" | "30代" | "40代" | "50代" | "60代" | "70代";

export type Frequency =
  | "毎日コツコツ"
  | "毎日"
  | "週6"
  | "週5"
  | "週4"
  | "週3-4"
  | "週3"
  | "週2-3"
  | "週2"
  | "週1"
  | "任せる";

export type Environment =
  | "何もない"
  | "ダンベル"
  | "ベンチ"
  | "懸垂機"
  | "ジム"
  | "家トレ";

// 部位8カテゴリ (2026-06-25 統一: 旧「全身バランス」→「全身」、「お尻」追加)
export type BodyPartGroup =
  | "胸"
  | "背中"
  | "肩"
  | "腕"
  | "脚"
  | "お尻"
  | "腹筋"
  | "全身";

export type Purpose =
  | "ダイエット"
  | "筋肉増"
  | "健康維持"
  | "体力向上"
  | "見た目改善";

export type Experience = "全くない" | "たまに" | "週次" | "毎日";

// medical_limits: 空配列 = 該当なし
export type MedicalLimit = "腰痛" | "膝痛" | "心臓" | "高血圧" | "その他";

export type IdealBody =
  | "健康+適度に筋肉"
  | "細マッチョ"
  | "マッチョ"
  | "曲線美"
  | "モデル体型";

// =====================================================================
// メニュー本体 (cycles の jsonb 構造)
// =====================================================================

export type Exercise = {
  順番: string;            // "1.0" or "交互にする" 等
  種目名: string;          // "ダンベルスクワット"
  回数: string;            // "10回±2、2セット"
  インターバル: string;    // "2分"
  主部位: string[];        // ["脚"]
  補部位: string[];        // ["全身"]
  // 動画 (W1 配線 2026-06-25):
  //   - undefined = 種目名からマスター (name_to_url) で既定動画を解決
  //   - 文字列 = この種目に明示的に紐づけた動画 (管理画面「この動画に変更」= このメニュー限定の上書き)
  //   - 空文字 "" = 明示的に「動画なし」(既定があっても出さない)
  // 解決は resolveExerciseVideo() を使う (src/lib/workout/video-master.ts)
  video_url?: string;
};

export type DayMenu = {
  日: string;              // "1日目" / "月曜日" / "Aメニュー"
  種目: Exercise[];
};

export type CycleStage = {
  段階: string;            // "小" | "中" | "大" | "強化版"
  シート名: string;
  週: DayMenu[];
};

export type WorkoutCycles = CycleStage[];

// =====================================================================
// DB レコード型
// =====================================================================

export type WorkoutTemplateRow = {
  id: string;
  source_name: string | null;
  source_filename: string | null;
  source_user_id: string | null;

  // 機械マッチング属性
  gender: Gender;
  age_band: AgeBand;
  instrument: string | null;
  frequency: string | null;
  primary_body: string | null;

  // メニュー本体
  cycles: WorkoutCycles;

  // 集計
  body_parts_main: Record<string, number>;  // { "脚": 10, "胸": 5 }
  total_exercises: number;
  cycle_count: number;

  // メタ
  karte_match: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserWorkoutCarteRow = {
  user_id: string;

  // 機械マッチング (4項目、age_band は user_profiles.birthday から TS 側で計算)
  gender: Gender;
  environments: Environment[];
  frequency_wish: Frequency | null;
  focus_body_parts: BodyPartGroup[];

  // 判断補助 (4項目)
  purposes: Purpose[];
  experience: Experience | null;
  medical_limits: MedicalLimit[];  // 空配列 = 該当なし
  ideal_body: IdealBody | null;

  // メタ
  created_at: string;
  updated_at: string;
  menu_review_needed: boolean;
  last_machine_field_changed_at: string | null;
};

export type UserWorkoutMenuRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_snapshot: WorkoutTemplateRow | null;  // テンプレ削除されても参照できるよう
  cycles: WorkoutCycles;
  notes: string | null;
  effective_from: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type RequestStatus = "pending" | "in_progress" | "handled" | "dismissed";

export type UserWorkoutRequestRow = {
  id: string;
  user_id: string;
  request_text: string;
  status: RequestStatus;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  resulting_menu_id: string | null;
};

export type UserCarteRequestRow = {
  id: string;
  user_id: string;
  request_text: string;
  status: RequestStatus;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
};

// =====================================================================
// マッチング結果型
// =====================================================================

export type MenuCandidate = {
  template: WorkoutTemplateRow;
  score: number;                 // 合計スコア (環境ペナルティで負もありうる)
  breakdown: {
    age: number;                 // 0-50
    body_focus: number;          // 0-100
    frequency: number;           // 0-30
    environment: number;         // -10 to 30
  };
  body_coverage_ratio: number;   // カルテで選択した重点部位のカバー率 (0-1)
};

// =====================================================================
// ハブ画面用集約データ
// =====================================================================

export type UserHubData = {
  user: {
    id: string;
    name: string;
    gender: Gender;
    age: number;
    age_band: AgeBand;
    joined_at: string;
  };
  carte: UserWorkoutCarteRow | null;
  current_menu: UserWorkoutMenuRow | null;
  recent_metrics: {
    // 直近5ヶ月分、古い順 (例: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"])
    months: string[];
    weights: (number | null)[];      // 未測定月は null
    body_fats: (number | null)[];
    waists: (number | null)[];
  };
  goals: {
    weight: number | null;
    body_fat: number | null;
    waist: number | null;
  };
  monthly_audit_status: {
    latest_month: string;        // "2026-05"
    submitted: boolean;
    reply_sent: boolean;
  };
  pending_actions: Array<{
    type: "menu_review_needed" | "carte_request" | "workout_request";
    detail: string;
  }>;
};

// =====================================================================
// 純粋関数: 年齢層計算
// =====================================================================

/**
 * 生年月日 ISO date (YYYY-MM-DD) から年齢層を計算。
 * 案 C 適用: user_profiles.birthday を引数で受け取る。
 */
export function calcAgeBand(birthday: string): AgeBand {
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  if (age < 20) return "10代";
  if (age < 30) return "20代";
  if (age < 40) return "30代";
  if (age < 50) return "40代";
  if (age < 60) return "50代";
  if (age < 70) return "60代";
  return "70代";
}

/**
 * 生年月日から満年齢を返す (UI 表示用)。
 */
export function calcAge(birthday: string): number {
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// =====================================================================
// 純粋関数: カルテの完成判定
// =====================================================================

/**
 * カルテが完全記入済か判定 (機械マッチング 4 + 判断補助 4 のすべて)。
 */
export function isCarteComplete(carte: UserWorkoutCarteRow): boolean {
  if (!carte.gender) return false;
  if (carte.environments.length === 0) return false;
  if (!carte.frequency_wish) return false;
  if (carte.focus_body_parts.length === 0) return false;
  if (carte.purposes.length === 0) return false;
  if (!carte.experience) return false;
  // medical_limits は空配列でも OK (該当なし)
  if (!carte.ideal_body) return false;
  return true;
}

/**
 * マッチング検索可能か判定 (機械マッチング 4 項目のみ完了で OK)。
 */
export function isCarteMachineReady(carte: UserWorkoutCarteRow): boolean {
  return (
    !!carte.gender &&
    carte.environments.length > 0 &&
    !!carte.frequency_wish &&
    carte.focus_body_parts.length > 0
  );
}

// =====================================================================
// 純粋関数: メニュー有無
// =====================================================================

export function hasCurrentMenu(menu: UserWorkoutMenuRow | null): boolean {
  return !!menu && menu.is_current;
}

// =====================================================================
// 純粋関数: 環境カテゴリ分類 (家系 / ジム系)
// =====================================================================

export type EnvironmentCategory = "家系" | "ジム系" | "不明";

/**
 * 環境配列を「家系 / ジム系」に分類。マッチングロジックで使用。
 * - "ジム" を含む → ジム系
 * - それ以外で何か選択あり → 家系
 * - 空 → 不明
 */
export function classifyEnvironment(envs: Environment[]): EnvironmentCategory {
  if (envs.length === 0) return "不明";
  if (envs.some((e) => e === "ジム")) return "ジム系";
  return "家系";
}

/**
 * テンプレ側の instrument 文字列を「家系 / ジム系」に分類。
 */
export function classifyInstrument(
  instrument: string | null | undefined
): EnvironmentCategory {
  if (!instrument) return "不明";
  if (instrument.includes("ジム")) return "ジム系";
  return "家系";
}

// =====================================================================
// 純粋関数: 頻度カテゴリ分類
// =====================================================================

export type FrequencyCategory =
  | "毎日系"
  | "高頻度系"
  | "中頻度系"
  | "低頻度系"
  | "不明";

/**
 * 頻度文字列を 4 カテゴリに分類。マッチングロジックで使用。
 * カルテとテンプレ両方で使える共通ロジック。
 */
export function classifyFrequency(
  freq: string | null | undefined
): FrequencyCategory {
  if (!freq) return "不明";
  if (freq.includes("毎日")) return "毎日系";
  if (freq.includes("週6") || freq.includes("週5")) return "高頻度系";
  if (freq.includes("週3") || freq.includes("週4")) return "中頻度系";
  if (freq.includes("週1") || freq.includes("週2")) return "低頻度系";
  return "不明";
}

// =====================================================================
// 純粋関数: 年齢層距離
// =====================================================================

const AGE_ORDER: Record<AgeBand, number> = {
  "10代": 1,
  "20代": 2,
  "30代": 3,
  "40代": 4,
  "50代": 5,
  "60代": 6,
  "70代": 7,
};

/**
 * 2 つの年齢層の距離 (整数)。同じ = 0、1 階層差 = 1、等。
 */
export function ageBandDistance(a: AgeBand, b: AgeBand): number {
  return Math.abs(AGE_ORDER[a] - AGE_ORDER[b]);
}
