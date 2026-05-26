/**
 * 月次添削 (monthly_audits) の型定義
 *
 * 設計元:
 *   - /tmp/monthly_review_form.html (Phase 2-7 モック)
 *   - docs/00_premises/_consolidated_agreements_2026-05-25.md セクション 6-B
 *   - supabase/migrations/20260525000001_monthly_audits.sql
 *
 * 設計方針:
 *   - 17 項目 / 6 カテゴリ
 *   - Q1-Q2: 体重・ウエスト (先月/今月の 2 列数値入力 + 自由記述)
 *   - Q3-Q15: 0-10 スコア + 自由記述
 *   - Q16: 自由記述のみ (任意)
 *   - Q17: 自由記述のみ (必須)
 *   - jsonb で柔軟保持、項目定義は定数として保持
 */

// =============================================================
// 項目タイプ (入力 UI の種類)
// =============================================================
export type AuditQuestionType =
  | "body_measure"  // Q1, Q2: 先月/今月の 2 列数値入力 + 自由記述
  | "score"         // Q3-Q15: 0-10 ボタン + 自由記述
  | "text";         // Q16, Q17: 自由記述のみ

// =============================================================
// カテゴリキー (6 カテゴリ)
// =============================================================
export type AuditCategoryKey =
  | "body_shape"      // 体・体型 (2 項目)
  | "diet"            // 食事 (5 項目)
  | "exercise"        // 運動 (4 項目)
  | "rest"            // 休息 (2 項目)
  | "mind_learning"   // マインド・学習 (2 項目)
  | "reflection";     // 振り返り (2 項目)

// カテゴリのメタ情報 (UI 表示用)
export const AUDIT_CATEGORIES: Record<
  AuditCategoryKey,
  { label: string; count: number; order: number }
> = {
  body_shape:    { label: "体・体型",         count: 2, order: 1 },
  diet:          { label: "食事",             count: 5, order: 2 },
  exercise:      { label: "運動",             count: 4, order: 3 },
  rest:          { label: "休息",             count: 2, order: 4 },
  mind_learning: { label: "マインド・学習",   count: 2, order: 5 },
  reflection:    { label: "振り返り",         count: 2, order: 6 },
};

// =============================================================
// 17 項目の定義 (定数、UI と整合)
// =============================================================
export type AuditQuestion = {
  key: string;                  // 'q1' 〜 'q17'
  category: AuditCategoryKey;
  type: AuditQuestionType;
  label: string;                // 「体重の変化」等
  required: boolean;            // ★ 必須かどうか (Q16 のみ false)
  unit?: string;                // 'kg' / 'cm' (body_measure のみ)
  textPlaceholder?: string;     // 自由記述のプレースホルダ
  // body_measure (数値入力) 専用設定
  numberStep?: number;          // 増減幅 (体重 0.1 / ウエスト 0.5 等)
  numberMin?: number;           // 最小値
  numberMax?: number;           // 最大値
  numberDecimals?: number;      // 小数桁数 (整形用)
  numberPlaceholder?: string;   // 数値入力欄のプレースホルダ
};

export const AUDIT_QUESTIONS: readonly AuditQuestion[] = [
  // ── カテゴリ 1: 体・体型 (2 項目)
  {
    key: "q1",
    category: "body_shape",
    type: "body_measure",
    label: "体重の変化",
    required: true,
    unit: "kg",
    textPlaceholder: "変化や感想を自由に",
    numberStep: 0.1,
    numberMin: 20,
    numberMax: 300,
    numberDecimals: 1,
    numberPlaceholder: "例: 75.0",
  },
  {
    key: "q2",
    category: "body_shape",
    type: "body_measure",
    label: "ウエストの変化",
    required: true,
    unit: "cm",
    textPlaceholder: "変化や感想を自由に",
    numberStep: 0.5,
    numberMin: 40,
    numberMax: 200,
    numberDecimals: 1,
    numberPlaceholder: "例: 82.0",
  },
  // ── カテゴリ 2: 食事 (5 項目)
  {
    key: "q3",
    category: "diet",
    type: "score",
    label: "食生活の変化について",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q4",
    category: "diet",
    type: "score",
    label: "加工品の摂取頻度について",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q5",
    category: "diet",
    type: "score",
    label: "食欲コントロールについて",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q6",
    category: "diet",
    type: "score",
    label: "PFC バランスは守れたか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q7",
    category: "diet",
    type: "score",
    label: "自炊やダイエットレシピに挑戦できましたか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  // ── カテゴリ 3: 運動 (4 項目)
  {
    key: "q8",
    category: "exercise",
    type: "score",
    label: "筋トレは実施できましたか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q9",
    category: "exercise",
    type: "score",
    label: "筋トレの総負荷量は増えていますか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q10",
    category: "exercise",
    type: "score",
    label: "筋トレのフォーム改善",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q11",
    category: "exercise",
    type: "score",
    label: "有酸素運動 or 歩数はどうですか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  // ── カテゴリ 4: 休息 (2 項目)
  {
    key: "q12",
    category: "rest",
    type: "score",
    label: "睡眠の質について",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q13",
    category: "rest",
    type: "score",
    label: "睡眠時間について",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  // ── カテゴリ 5: マインド・学習 (2 項目)
  {
    key: "q14",
    category: "mind_learning",
    type: "score",
    label: "マインドセットの変化について",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  {
    key: "q15",
    category: "mind_learning",
    type: "score",
    label: "特典動画は視聴できましたか?",
    required: true,
    textPlaceholder: "0-10 点の根拠や具体例を自由に",
  },
  // ── カテゴリ 6: 振り返り (2 項目)
  {
    key: "q16",
    category: "reflection",
    type: "text",
    label: "今月学べたことと成長を感じた点",
    required: false,         // ※ Q16 のみ任意
    textPlaceholder: "自由にお書きください",
  },
  {
    key: "q17",
    category: "reflection",
    type: "text",
    label: "今ある課題と悩んでいる点など",
    required: true,
    textPlaceholder: "自由にお書きください",
  },
] as const;

// =============================================================
// 項目別の回答型 (jsonb の中身)
// =============================================================

// Q1, Q2: 体重・ウエストの先月/今月
export type BodyMeasureAnswer = {
  last_value?: number;     // 先月の数値
  current_value?: number;  // 今月の数値
  text?: string;           // 自由記述
};

// Q3-Q15: 0-10 スコア + 自由記述
export type ScoreAnswer = {
  score?: number;          // 0-10
  text?: string;           // 自由記述
};

// Q16, Q17: 自由記述のみ
export type TextAnswer = {
  text?: string;
};

// 全項目の回答 (jsonb 内、キー = 'q1' 〜 'q17')
export type MonthlyAuditItems = {
  q1?: BodyMeasureAnswer;
  q2?: BodyMeasureAnswer;
  q3?: ScoreAnswer;
  q4?: ScoreAnswer;
  q5?: ScoreAnswer;
  q6?: ScoreAnswer;
  q7?: ScoreAnswer;
  q8?: ScoreAnswer;
  q9?: ScoreAnswer;
  q10?: ScoreAnswer;
  q11?: ScoreAnswer;
  q12?: ScoreAnswer;
  q13?: ScoreAnswer;
  q14?: ScoreAnswer;
  q15?: ScoreAnswer;
  q16?: TextAnswer;
  q17?: TextAnswer;
};

// =============================================================
// 月次添削の状態 (4 状態: A 未記入 / B 記入中 / C 提出済 / D 返信届いた)
// =============================================================
export type AuditStatus =
  | "a_empty"          // A: まだ存在しない (DB レコードなし)
  | "b_in_progress"    // B: 記入中 (途中保存あり、submitted_at なし)
  | "c_submitted"      // C: 提出済み・返信待ち
  | "d_replied";       // D: のり氏返信動画が届いた

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  a_empty:       "未記入",
  b_in_progress: "記入中",
  c_submitted:   "提出済み・返信待ち",
  d_replied:     "返信届いた",
};

// =============================================================
// DB レコード型 (monthly_audits テーブル)
// =============================================================
export type MonthlyAuditRow = {
  id: string;
  user_id: string;
  target_month: string;                  // ISO date (YYYY-MM-01 形式)
  items: MonthlyAuditItems;
  items_filled_count: number;
  last_saved_at: string | null;
  submitted_at: string | null;
  nori_video_vimeo_url: string | null;
  nori_video_vimeo_id: string | null;
  nori_video_published_at: string | null;
  nori_video_duration_sec: number | null;
  created_at: string;
  updated_at: string;
};

// =============================================================
// 補助関数
// =============================================================

/**
 * 1 項目分の回答が「記入済み」か判定。
 * - body_measure: current_value が入っていれば記入済 (last_value は任意)
 * - score: score が入っていれば記入済
 * - text: text が空でなければ記入済
 */
export function isItemFilled(
  question: AuditQuestion,
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined
): boolean {
  if (!answer) return false;
  if (question.type === "body_measure") {
    return (answer as BodyMeasureAnswer).current_value !== undefined;
  }
  if (question.type === "score") {
    return (answer as ScoreAnswer).score !== undefined;
  }
  // text
  const text = (answer as TextAnswer).text;
  return !!text && text.trim().length > 0;
}

/**
 * 17 項目のうち、記入済み項目数を返す (進捗バー用)。
 */
export function countFilledItems(items: MonthlyAuditItems): number {
  let count = 0;
  for (const q of AUDIT_QUESTIONS) {
    const answer = items[q.key as keyof MonthlyAuditItems];
    if (isItemFilled(q, answer)) count++;
  }
  return count;
}

/**
 * 月次添削の状態を判定 (A/B/C/D)。
 * row が null = A 未記入。
 */
export function getAuditStatus(row: MonthlyAuditRow | null): AuditStatus {
  if (!row) return "a_empty";
  if (!row.submitted_at) return "b_in_progress";
  if (!row.nori_video_published_at) return "c_submitted";
  return "d_replied";
}

/**
 * 当月の target_month を返す (YYYY-MM-01 形式)。
 * 例: 2026-05-26 → "2026-05-01"
 */
export function getCurrentTargetMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * target_month を「2026 年 5 月 月次報告」形式の表示文字列に変換。
 */
export function formatTargetMonthLabel(targetMonth: string): string {
  const d = new Date(targetMonth);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 月次報告`;
}

/**
 * 必須項目のうち、未記入のキー一覧を返す (提出前のバリデーション用)。
 */
export function listMissingRequiredKeys(items: MonthlyAuditItems): string[] {
  const missing: string[] = [];
  for (const q of AUDIT_QUESTIONS) {
    if (!q.required) continue;
    const answer = items[q.key as keyof MonthlyAuditItems];
    if (!isItemFilled(q, answer)) missing.push(q.key);
  }
  return missing;
}

/**
 * 提出可能か判定 (必須 16 項目が全部記入済か)。
 */
export function canSubmit(items: MonthlyAuditItems): boolean {
  return listMissingRequiredKeys(items).length === 0;
}
