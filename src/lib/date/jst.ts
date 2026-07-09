/**
 * JST(UTC+9) 基準の日付ユーティリティ (2026-07-09 回答§7 修正リスト③⑦)
 *
 * DB の date 型 ("YYYY-MM-DD") は「JSTの暦日」として保存されている前提。
 * `new Date("YYYY-MM-DD")` は UTC 深夜と解釈されるため、Date.now()(実時刻) と
 * 引き算すると JST とは最大9時間ズレて「◯日ぶり/◯日前」が稀に1日ずれる。
 * ここでは両端を UTC 深夜アンカーに揃えて「暦日差」を正確に出す (共通ルール4 JST と整合)。
 * 受講生(/record) と 管理側(alerts 等) の両方でこれを使う。
 */

/** JST の「今日」の日付文字列 "YYYY-MM-DD"。 */
export function jstTodayStr(nowMs: number = Date.now()): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD"(JST暦日) から JSTの今日 までの経過日数(暦日差)。同日=0。 */
export function daysSinceDateJST(dateStr: string, nowMs: number = Date.now()): number {
  const a = Date.parse(`${dateStr}T00:00:00Z`);
  const b = Date.parse(`${jstTodayStr(nowMs)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
