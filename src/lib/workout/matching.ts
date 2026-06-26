/**
 * マッチングスコア計算 (純粋関数のみ)
 *
 * 設計元:
 *   - memory/project_kinniku_juku_workout_menu.md
 *   - memory/project_kinniku_juku_workout_data_progress.md
 *   - Python プロトタイプ /tmp/match_v2_body_focus.py の TypeScript 移植
 *
 * 優先度 (重み順):
 *   1. 性別      : フィルタ (異性除外、queries 側で実施)
 *   2. 重点部位  : 100点 (body_strong モード、複数選択可)
 *   3. 年齢層    : 50点 (±1階層=30点、±2階層=10点)
 *   ─────────── 上位3つ (きよむさん希望)
 *   4. 頻度      : 30点 (カテゴリ判定)
 *   5. 環境(器具): 30点 (家系/ジム系、不一致は-10点)
 *
 * 注意: このファイルは純粋関数のみ。Supabase 呼び出しは queries.ts 側。
 */

import {
  type AgeBand,
  type BodyPartGroup,
  type Environment,
  type WorkoutTemplateRow,
  type MenuCandidate,
  ageBandDistance,
  classifyEnvironment,
  classifyInstrument,
  classifyFrequency,
} from "./types";

// =====================================================================
// 部位グループ → メニュー側「主部位」キーワードのマップ
// =====================================================================
// 注: workout_data.json の主部位表記に依存。
// 「三角筋後部」は背中と肩の両方に紐付く意図 (Python プロトタイプ踏襲)
// 実データ検証で問題があれば調整 (2026-06-01 レビュー D2)
// 2026-06-26 主部位8カテ正規化に伴い両対応化:
//   - 8カテ(胸/背中/…) = 正規化後の主部位/body_parts_main
//   - 解剖学名(大胸筋/広背筋/…) = 正規化前の旧データ
//   両方をキーワードに含めることで、データ移行の前後どちらでも照合できる(移行の隙間ゼロ)。
//   大殿筋系→お尻 / 三角筋後部→肩 / カーフ→脚 (確定マッピングに一致)。
const BODY_GROUP_KEYWORDS: Record<BodyPartGroup, string[]> = {
  胸:   ["胸", "大胸筋", "大胸筋上部"],
  背中: ["背中", "広背筋", "僧帽筋", "僧帽筋上部"],
  肩:   ["肩", "三角筋", "三角筋前部", "三角筋後部"],
  腕:   ["腕", "二頭筋", "三頭筋", "前腕"],
  脚:   ["脚", "脚全体", "大腿四頭筋", "ハムストリングス", "カーフ"],
  お尻: ["お尻", "大殿筋", "大臀筋"],
  腹筋: ["腹筋", "腹直筋", "腹斜筋"],
  全身: [],          // 特殊扱い: 偏りが少ない = 高評価 (旧「全身バランス」)
};

// =====================================================================
// 重点部位カバー率計算
// =====================================================================

/**
 * テンプレの body_parts_main (主部位カウント) と
 * カルテの focus_body_parts (希望部位) を照合してカバー率を返す (0-1)。
 *
 * 「全身」のみ選択時は、偏りが少ないメニューを高評価する特殊ロジック。
 */
export function calcBodyCoverage(
  template: WorkoutTemplateRow,
  focusParts: BodyPartGroup[]
): number {
  const counts = template.body_parts_main;
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

  // 「全身」のみ選択 → 偏りが少ない = 高評価
  if (focusParts.length === 1 && focusParts[0] === "全身") {
    const values = Object.values(counts);
    const top = values.length > 0 ? Math.max(...values) : 0;
    return 1 - top / total;
  }

  // それ以外: 選択した部位のキーワード合計カバー率
  const keywords = new Set<string>();
  for (const fp of focusParts) {
    for (const kw of BODY_GROUP_KEYWORDS[fp] || []) {
      keywords.add(kw);
    }
  }
  let hit = 0;
  for (const kw of keywords) {
    hit += counts[kw] || 0;
  }
  return hit / total;
}

// =====================================================================
// 年齢層スコア (0-50)
// =====================================================================

/**
 * 年齢層の近さスコア。
 *   完全一致 = 50点 / ±1階層 = 30点 / ±2階層 = 10点 / それ以上 = 0点
 */
export function calcAgeScore(
  templateAgeBand: AgeBand,
  carteAgeBand: AgeBand
): number {
  const d = ageBandDistance(templateAgeBand, carteAgeBand);
  if (d === 0) return 50;
  if (d === 1) return 30;
  if (d === 2) return 10;
  return 0;
}

// =====================================================================
// 重点部位スコア (0-100)
// =====================================================================

/**
 * body_strong モード = カバー率 × 100 × 1.5 (上限 100)。
 * 1.5 倍は body_strong 増幅係数 (Python プロトタイプ回帰テストで決定)
 */
export function calcBodyFocusScore(coverage: number): number {
  return Math.min(100, Math.round(100 * coverage * 1.5));
}

// =====================================================================
// 頻度スコア (0-30)
// =====================================================================

/**
 * 頻度カテゴリの一致度。
 *   完全一致 = 30点
 *   半分一致 (毎日系 ↔ 高頻度系 / 中頻度系 ↔ 低頻度系) = 15点
 *   それ以外 = 0点
 */
export function calcFrequencyScore(
  templateFreq: string | null,
  carteFreqWish: string | null
): number {
  const a = classifyFrequency(templateFreq);
  const b = classifyFrequency(carteFreqWish);
  if (a === "不明" || b === "不明") return 0;
  if (a === b) return 30;
  const highGroup = ["毎日系", "高頻度系"];
  const lowGroup = ["中頻度系", "低頻度系"];
  if (highGroup.includes(a) && highGroup.includes(b)) return 15;
  if (lowGroup.includes(a) && lowGroup.includes(b)) return 15;
  return 0;
}

// =====================================================================
// 環境スコア (-10 to 30)
// =====================================================================

/**
 * 環境 (器具) の一致度。
 *   一致 = 30点 / 不一致 (両方判明) = -10点 / 不明 = 0点
 */
export function calcEnvironmentScore(
  templateInstrument: string | null,
  carteEnvironments: Environment[]
): number {
  const t = classifyInstrument(templateInstrument);
  const c = classifyEnvironment(carteEnvironments);
  if (t === "不明" || c === "不明") return 0;
  if (t === c) return 30;
  return -10;
}

// =====================================================================
// 総合スコア (メイン)
// =====================================================================

/**
 * カルテ機械マッチング項目とテンプレを照合し、総合スコアを返す。
 *
 * 性別フィルタはこの関数の責務外 (queries.ts 側で SQL レベルで実施済前提)。
 *
 * @param template  候補テンプレ
 * @param carteAgeBand     カルテ側の年齢層 (calcAgeBand(user_profiles.birthday) で計算済)
 * @param carteEnvs        カルテ側の利用可能環境
 * @param carteFreqWish    カルテ側の希望頻度
 * @param focusParts       カルテ側の重点部位 (空なら全身扱い)
 */
export function calcMenuScore(
  template: WorkoutTemplateRow,
  carteAgeBand: AgeBand,
  carteEnvs: Environment[],
  carteFreqWish: string | null,
  focusParts: BodyPartGroup[]
): MenuCandidate {
  // 重点部位が空ならフォールバックで「全身」
  const effectiveParts: BodyPartGroup[] =
    focusParts.length > 0 ? focusParts : ["全身"];

  const coverage = calcBodyCoverage(template, effectiveParts);
  const bodyScore = calcBodyFocusScore(coverage);
  const ageScore = calcAgeScore(template.age_band, carteAgeBand);
  const freqScore = calcFrequencyScore(template.frequency, carteFreqWish);
  const envScore = calcEnvironmentScore(template.instrument, carteEnvs);

  return {
    template,
    score: ageScore + bodyScore + freqScore + envScore,
    breakdown: {
      age: ageScore,
      body_focus: bodyScore,
      frequency: freqScore,
      environment: envScore,
    },
    body_coverage_ratio: coverage,
  };
}

/**
 * テンプレ配列からスコア計算 → 上位 N 件を返す。
 *
 * 性別フィルタは事前に SQL で済ませた配列を渡す前提。
 */
export function pickTopCandidates(
  templates: WorkoutTemplateRow[],
  carteAgeBand: AgeBand,
  carteEnvs: Environment[],
  carteFreqWish: string | null,
  focusParts: BodyPartGroup[],
  topN: number = 3
): MenuCandidate[] {
  const scored = templates.map((t) =>
    calcMenuScore(t, carteAgeBand, carteEnvs, carteFreqWish, focusParts)
  );
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
