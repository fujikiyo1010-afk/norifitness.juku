/**
 * 目標管理シート (goal_sheets) の jsonb content 型定義
 *
 * 設計元:
 *   - docs/00_premises/_consolidated_agreements_2026-05-25.md
 *   - /tmp/goal_sheet_v3.html (編集モック)
 *   - /tmp/goal_sheet_overview.html (閲覧モック)
 *
 * 設計方針:
 *   - 5 セクション構造を jsonb で柔軟に保持 (マイグレーション不要)
 *   - 添削データも同じ jsonb 内に持つ (シンプル、現在分のみ)
 *   - 過去の添削履歴は goal_sheet_revisions テーブルでスナップショット保存
 */

// =============================================================
// セクション 1: 現状を把握 (体組成 + メンテ kcal)
// =============================================================
export type CurrentStatus = {
  weight_kg?: number;          // 体重 kg
  height_cm?: number;          // 身長 cm (※ user_profiles から自動取得が理想)
  waist_cm?: number;           // ウエスト cm
  neck_cm?: number;            // 首回り cm
  body_fat_pct?: number;       // 体脂肪率 % (海軍式で自動計算)
  maintenance_kcal?: number;   // メンテナンスカロリー (必要カロリー計算ツールから反映)
  measured_at?: string;        // 測定日 ISO date (YYYY-MM-DD)
};

// =============================================================
// セクション 2: 目標の選定
// =============================================================
export type GoalSelection = {
  target_weight_kg?: number;   // 目標体重 kg
  target_date?: string;        // 到達予定日 ISO date (減量期間逆算ツールから自動)
  short_term?: string;         // 短期目標 (テキスト)
  long_term?: string;          // 長期目標 (テキスト)
  process?: string;            // プロセス (行動の目標、テキスト)
};

// =============================================================
// セクション 3: 栄養設計 (PFC + カーボサイクル)
// =============================================================
export type PFC = {
  p?: number;  // たんぱく質 g
  f?: number;  // 脂質 g
  c?: number;  // 糖質 g
};

export type CarbCycleDay = 'low' | 'mid' | 'high';

export type CarbCycle = {
  weekly_pattern?: CarbCycleDay[];  // 7 日分 [月,火,水,木,金,土,日]
  // ※ 「今日の目安」表示は MVP 外 (2026-05-25 きよむさん決定 C 案)
};

export type Nutrition = {
  target_calorie?: number;     // 目標カロリー kcal/日
  pfc?: PFC;                   // PFC g 数
  carb_cycle?: CarbCycle;      // カーボサイクル週パターン
};

// =============================================================
// セクション 4: プラスの感情を含むゴール
// =============================================================
export type PositiveGoals = {
  achievement_feeling?: string;  // 達成時の気持ち (テキスト)
};

// =============================================================
// セクション 5: セルフイメージ改善 (8 項目)
// =============================================================
export type SelfImageItem = {
  key: string;       // 項目キー (例: 'item_1')
  label: string;     // 項目ラベル (例: '自分の体に対して批判的な思考を減らし、ありのままの自分を受け入れる')
  before?: number;   // 改善前 (今) 0-10
  after?: number;    // 改善後 (目標) 0-10
};

// セルフイメージの 8 項目定義
// 出典: 01_tokuten/tokuten_25.html (のり氏 特典 25 「目標設定シートテンプレート」 selfItems)
// 2026-06-16 線① ローンチ前に きよむさん指摘 + Claude 調査で確定反映
// ⚠️ label 変更時は migration 必須 (過去データの意味付けが変わる)
export const SELF_IMAGE_ITEMS: readonly { key: string; label: string }[] = [
  { key: 'item_1', label: '自分の体に対して批判的な思考を減らし、ありのままの自分を受け入れることを学ぶ' },
  { key: 'item_2', label: 'メディアで描かれる体のイメージが現実とは異なることを理解しその影響を減らす' },
  { key: 'item_3', label: '自分の体重やウエストを記録して客観的な数値の感覚を身につける' },
  { key: 'item_4', label: '自分の肉体はどうやって動くのか?どのような体型なのか?に関する意識を高める' },
  { key: 'item_5', label: 'ボディイメージからくるストレスをやわらげる' },
  { key: 'item_6', label: 'そもそもボディイメージとは何かを学ぶ' },
  { key: 'item_7', label: '自分が感じたネガティブなイメージを日記に書く' },
  { key: 'item_8', label: 'ネガティブな感情をプラスの感情にする' },
] as const;

// =============================================================
// 添削データ (3 階層: フィールド単位 / セクション単位 / 全体総評)
// =============================================================
export type AuditComment = {
  text: string;        // コメント本文
  who: string;         // 添削者名 (例: 'のりfitness')
  date: string;        // 添削日 ISO date (YYYY-MM-DD)
};

export type GoalSheetAudits = {
  // フィールド単位コメント (キー = フィールド名)
  // 例: { "body_fat_pct": {...}, "target_weight_kg": {...} }
  field_comments?: Record<string, AuditComment>;

  // セクション単位コメント (キー = SectionKey)
  section_comments?: Partial<Record<SectionKey, AuditComment>>;

  // 全体総評
  summary?: AuditComment;
};

// =============================================================
// セクションキー定義
// =============================================================
export type SectionKey =
  | 'current_status'
  | 'goal_selection'
  | 'nutrition'
  | 'positive_goals'
  | 'self_image';

// セクションのメタ情報 (UI 表示用)
export const SECTION_META: Record<SectionKey, { num: number; title: string }> = {
  current_status:  { num: 1, title: '現状を把握' },
  goal_selection:  { num: 2, title: '目標の選定' },
  nutrition:       { num: 3, title: '栄養設計' },
  positive_goals:  { num: 4, title: 'プラスの感情を含むゴール' },
  self_image:      { num: 5, title: 'セルフイメージ改善' },
};

// =============================================================
// 全体構造 (goal_sheets.content jsonb の中身)
// =============================================================
export type GoalSheetContent = {
  current_status?: CurrentStatus;
  goal_selection?: GoalSelection;
  nutrition?: Nutrition;
  positive_goals?: PositiveGoals;
  self_image?: SelfImageItem[];     // 配列で 8 項目
  audits?: GoalSheetAudits;          // 添削データ
  filled_sections?: SectionKey[];    // 記入済セクションのリスト (進捗バー計算用)
};

// =============================================================
// DB レコード型 (goal_sheets テーブル)
// =============================================================
export type GoalSheetRow = {
  user_id: string;
  content: GoalSheetContent;
  admin_notes: string | null;        // 既存カラム (現在は audits を優先するため未使用)
  reviewed_by: string | null;        // 既存カラム (admin_user の uuid)
  reviewed_at: string | null;        // 既存カラム
  created_at: string;
  updated_at: string;
};

// =============================================================
// 補助関数: 進捗計算
// =============================================================

/**
 * jsonb content から記入済セクション数を計算
 * @param content goal_sheets.content
 * @returns 0-5 (記入済セクション数)
 */
export function countFilledSections(content: GoalSheetContent): number {
  let count = 0;
  if (isCurrentStatusFilled(content.current_status)) count++;
  if (isGoalSelectionFilled(content.goal_selection)) count++;
  if (isNutritionFilled(content.nutrition)) count++;
  if (isPositiveGoalsFilled(content.positive_goals)) count++;
  if (isSelfImageFilled(content.self_image)) count++;
  return count;
}

export function isCurrentStatusFilled(s?: CurrentStatus): boolean {
  return !!(s?.weight_kg && s?.waist_cm && s?.neck_cm);
}

export function isGoalSelectionFilled(s?: GoalSelection): boolean {
  return !!(s?.target_weight_kg && s?.short_term && s?.long_term && s?.process);
}

export function isNutritionFilled(s?: Nutrition): boolean {
  return !!(s?.target_calorie && s?.pfc?.p && s?.pfc?.f && s?.pfc?.c);
}

export function isPositiveGoalsFilled(s?: PositiveGoals): boolean {
  return !!(s?.achievement_feeling && s.achievement_feeling.trim().length > 0);
}

export function isSelfImageFilled(s?: SelfImageItem[]): boolean {
  // 全 8 項目で before/after が両方記入されているかチェック
  // null も undefined も「未記入」 扱い (UI で SliderWithValue が null 時に "— 未記入" を表示)
  if (!s || s.length < 8) return false;
  return s.every(
    (item) =>
      item.before !== undefined && item.before !== null &&
      item.after !== undefined && item.after !== null,
  );
}
