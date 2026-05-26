/**
 * 数値入力文字列の正規化 (全角 → 半角、不正文字除去)
 *
 * 用途:
 *   - PC で IME ON 状態で全角入力された数字を半角に変換
 *   - 全角ピリオド「。」「．」を半角「.」に変換
 *   - 数字以外の文字を除去 (誤入力対策)
 *
 * 使い方:
 *   onChange={(e) => {
 *     const normalized = normalizeNumberInput(e.target.value);
 *     setDisplay(normalized);
 *     onChange(normalized === "" ? undefined : parseFloat(normalized));
 *   }}
 */
export function normalizeNumberInput(s: string): string {
  if (!s) return "";

  // 全角数字 (０-９) → 半角 (0-9)
  let normalized = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 全角ピリオド・句点 → 半角ピリオド
  normalized = normalized.replace(/[。．]/g, ".");

  // マイナス記号 (将来用)
  normalized = normalized.replace(/[ー−–—]/g, "-");

  // 数字・ピリオド・マイナスのみ許可 (それ以外は除去)
  normalized = normalized.replace(/[^0-9.\-]/g, "");

  // ピリオドが複数ある場合は最初のものだけ残す (75.5.0 → 75.5)
  const parts = normalized.split(".");
  if (parts.length > 2) {
    normalized = parts[0] + "." + parts.slice(1).join("");
  }

  return normalized;
}
