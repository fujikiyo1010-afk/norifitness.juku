/**
 * 部位の色・略称(クライアント安全・サーバ依存なし)。
 * weekly.ts はサーバ専用(supabase)を含むため、クライアント(MenuView 等)から色/略称だけ
 * 使えるよう 2026-07-29 に分離。weekly.ts は本モジュールを import+再export する。
 */

export type DistKind = "train" | "rest" | "personal";

// 部位 → バッジ色(一覧・棚・日タブのバッジ用)。
const TARGET_COLOR: Record<string, string> = {
  脚: "#5b7a9d",
  胸: "#c88a4a",
  背中: "#7a9d5b",
  肩: "#c86a6a",
  腕: "#8a6ac8",
  腹筋: "#4a9d9d",
  全身: "#6a8a9d",
};
export function targetColor(target: string | null | undefined): string {
  if (!target) return "#6a6256";
  const first = target.split("・")[0];
  return TARGET_COLOR[first] ?? "#6a6256";
}

// 略称対応表(再設計§2-1・案A)。無い名前は「・」「の日」を除いた先頭2文字にフォールバック。
const ABBR_TABLE: Record<string, string> = {
  "胸・背中の日": "胸背",
  "腕・肩の日": "腕肩",
  "腹筋・脚の日": "腹脚",
  "体幹の日": "体幹",
  "脚の日": "脚",
  "肩の日": "肩",
  "胸の日": "胸",
  "背中の日": "背中",
  "腕の日": "腕",
  "腹筋の日": "腹筋",
  "休養日": "休",
  "休養日・ストレッチ": "休",
};
export function menuAbbr(name: string, kind?: DistKind): string {
  if (kind === "rest") return "休";
  if (ABBR_TABLE[name]) return ABBR_TABLE[name];
  const stripped = name.replace(/の日$/, "").replace(/・/g, "");
  return stripped.slice(0, 2) || "他";
}
