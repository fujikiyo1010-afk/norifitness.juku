/**
 * メニュー表示用の純粋関数群
 *
 * 設計元:
 *   - /tmp/workout_menu_view_v6.html (確定モック)
 *   - 2026-06-02 きよむさん合意の表示ルール
 */

import type { WorkoutCycles } from "./types";

// 主部位 → 一般名称 (狙い表示用)
const PART_MAP: Record<string, string> = {
  大胸筋: "胸",
  三角筋: "肩",
  三角筋前部: "肩",
  三角筋後部: "肩",
  二頭筋: "腕",
  三頭筋: "腕",
  広背筋: "背中",
  僧帽筋: "背中",
  脚: "脚",
  脚全体: "脚",
  大腿四頭筋: "脚",
  ハムストリングス: "脚",
  大殿筋: "脚",
  腹直筋: "腹筋",
  腹筋: "腹筋",
  全身: "全身",
};

/**
 * 種目名から【部位】タグを除去
 * 例: "ダンベルショルダープレス【肩】" → "ダンベルショルダープレス"
 */
export function cleanExerciseName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/【[^】]+】/g, "").trim();
}

/**
 * 主部位配列 → 「狙い」表示用の一般名称
 * 例: ["広背筋", "僧帽筋"] → "背中"
 * 複数異なる部位の場合は最大 2 つ ・ で連結
 */
export function getExerciseTarget(
  mainParts: string[] | null | undefined
): string {
  if (!mainParts || mainParts.length === 0) return "全身";
  const generic = mainParts.map((p) => PART_MAP[p] || p);
  const unique = [...new Set(generic)];
  return unique.slice(0, 2).join("・");
}

/**
 * 回数表記を簡潔化
 * 例: "10回±2、2セット" → "10回 2セット"
 *     "http://youtube..." → "(動画参照)"
 */
export function cleanReps(s: string | null | undefined): string {
  if (!s) return "—";
  if (s.startsWith("http") || s.toLowerCase().includes("youtube")) {
    return "(動画参照)";
  }
  return s.replace(/±\d+、?/, "").replace(/、/g, " / ").trim();
}

/**
 * 日ラベル整形
 * 例: "Bメニュー\nオフでも\n可" → "Bメニュー"
 */
export function cleanDayLabel(s: string | null | undefined): string {
  if (!s) return "";
  let label = s.replace(/\n/g, " ").trim();
  label = label.replace(/オフでも.*$/, "").replace(/\s+/g, "").trim();
  if (label.length > 6) label = label.slice(0, 6);
  return label;
}

/**
 * シート名 (内部識別子) から「【小】」等のプレフィックスを除去
 * 受講生画面では使わない (内部用)
 */
export function cleanSheetName(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/【.*?】/g, "").trim();
}

/**
 * サイクル数に応じたデフォルトのりメモ文 (管理画面で配布時に自動入力)
 */
export function defaultNoriNote(cycleCount: number): string {
  if (cycleCount === 1) {
    return [
      "まずはこのメニューに 2 週間取り組んでみてください。",
      "フォームを意識して、無理せず続けましょう。",
      "気になったことがあれば変更リクエストでお伝えください。",
    ].join("\n");
  }
  if (cycleCount >= 4) {
    return [
      "最初の強度から順番に取り組んでください。",
      "各強度 4-6 週間が目安です。",
      "気になったことがあれば変更リクエストでお伝えください。",
    ].join("\n");
  }
  return [
    "まずは「小」から始めてください。",
    "フォームが慣れてきたら「中」「大」に進めましょう。",
    "気になったことがあれば変更リクエストでお伝えください。",
  ].join("\n");
}

/**
 * notes 文字列を箇条書き行に分割
 * 改行で分割、空行は除去
 */
export function notesToBullets(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^[・\-\*\s]+/, "").trim())
    .filter((l) => l.length > 0);
}

/**
 * 配布日のフォーマット
 * 例: ISO date → "2026/06/02"
 */
export function formatDistributionDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * 配布日時 (時刻まで) のフォーマット
 * 例: ISO datetime → "2026/06/02 16:30"
 */
export function formatDistributionDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

/**
 * 配布前バリデーション。きよむさん合意 (2026-06-02) の項目を検査し、
 * 違反があれば具体的な位置情報付きでエラーを返す。
 *
 * チェック項目:
 *   1. サイクルが 0 件
 *   2. サイクル内の「日」が 0 件
 *   3. 「日」内の種目が 0 件
 *   4. 種目名が空欄
 *   5. 種目の狙い (主部位) が空欄  ← 2026-06-04 追加 (受講生側の「狙い」表示が「全身」になる回避)
 *   6. のり氏メモが空欄
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateMenuForDistribution(
  cycles: WorkoutCycles,
  notes: string | null | undefined
): ValidationResult {
  const errors: string[] = [];

  // 1. 強度 0 件
  if (!cycles || cycles.length === 0) {
    errors.push("強度が 1 つも登録されていません");
  } else {
    cycles.forEach((cycle, ci) => {
      const cycleLabel = cycle["段階"] || `第${ci + 1}強度`;
      const days = cycle["週"] ?? [];

      // 2. サイクル内の日 0 件
      if (days.length === 0) {
        errors.push(`${cycleLabel}: 日が 1 つも登録されていません`);
        return;
      }

      days.forEach((day, di) => {
        const dayLabel = cleanDayLabel(day["日"]) || `${di + 1}日目`;
        const exercises = day["種目"] ?? [];

        // 休息日 / パーソナル日 は「こちらのメニュー無し」が正しい状態 → 種目0でOK
        if (day["種別"]) {
          return;
        }

        // 3. 日内の種目 0 件
        if (exercises.length === 0) {
          errors.push(`${cycleLabel} / ${dayLabel}: 種目がありません`);
          return;
        }

        exercises.forEach((ex, ei) => {
          // 4. 種目名が空欄
          const name = (ex["種目名"] ?? "").trim();
          if (name === "") {
            errors.push(
              `${cycleLabel} / ${dayLabel} / ${ei + 1}番目: 種目名が空欄です`
            );
          }
          // 5. 主部位 (狙い) が空欄
          const mainParts = (ex["主部位"] ?? []).filter(
            (p) => (p ?? "").trim() !== ""
          );
          if (mainParts.length === 0) {
            errors.push(
              `${cycleLabel} / ${dayLabel} / ${ei + 1}番目: 狙い (主部位) が未入力です`
            );
          }
        });
      });
    });
  }

  // 6. のり氏メモが空欄
  if (!notes || notes.trim() === "") {
    errors.push("のりfitness メモが空欄です");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}
