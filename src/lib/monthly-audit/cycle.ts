/**
 * 月次添削・入会日起点サイクル(2026-07-30)。クライアント安全(サーバ依存なし・日付計算のみ)。
 *
 * 旧: 暦月固定(getCurrentTargetMonth=当月1日)。
 * 新: 入会日を起点に「30日ごと・全6回」。第N回の起点(=target_month に入れる日付)= 入会日 + 30×N。
 *   - 第1回=入会+30日 … 第6回=入会+180日(サービス180日)。
 *   - 入会直後(入会〜+30日未満)に出した分 = 「0回目」。既存の暦月 target_month 行はここに収まる。
 *   - target_month(date・PK) を「回の起点日」に読み替える(DDL不要)。
 */

const DAY_MS = 86400000;
export const CYCLE_DAYS = 30;
export const MAX_CYCLE = 6;

function toUTC(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}
function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 第N回の起点日(=target_month)。N=0 は入会日そのもの(0回目の目印)。 */
export function anchorFor(joinedDate: string, n: number): string {
  return fromUTC(toUTC(joinedDate) + n * CYCLE_DAYS * DAY_MS);
}

/** target_month(起点日) が入会日基準で第何回か。0以下=0回目(入会直後)。 */
export function cycleNumberOf(joinedDate: string, targetDate: string): number {
  const diff = Math.round((toUTC(targetDate) - toUTC(joinedDate)) / (CYCLE_DAYS * DAY_MS));
  return diff;
}

export type CycleInfo = {
  cycleNumber: number; // 0=まだ第1回前(入会30日未満) / 1..6=第N回
  anchor: string; // target_month に使う起点日(YYYY-MM-DD)
  periodStart: string; // 対象期間の開始(前回起点=入会+30(N-1)、第1回は入会日)
  periodEnd: string; // 対象期間の終了(=anchor)
};

export function cycleInfoFor(joinedDate: string, n: number): CycleInfo {
  const cn = Math.min(MAX_CYCLE, Math.max(0, n));
  return {
    cycleNumber: cn,
    anchor: anchorFor(joinedDate, cn),
    periodStart: anchorFor(joinedDate, Math.max(0, cn - 1)),
    periodEnd: anchorFor(joinedDate, cn),
  };
}

/** 入会日と基準日(today)から、今対象になる回。入会30日未満は cycleNumber=0(第1回前)。 */
export function currentCycle(joinedDate: string, today: string): CycleInfo {
  const elapsed = Math.floor((toUTC(today) - toUTC(joinedDate)) / DAY_MS);
  const n = Math.floor(elapsed / CYCLE_DAYS);
  return cycleInfoFor(joinedDate, n);
}

/** 「第N回」ラベル。0以下=入会直後(0回目)。 */
export function cycleLabel(n: number): string {
  return n <= 0 ? "入会後の初回" : `第${n}回`;
}

/** 2つの日付(YYYY-MM-DD)間の日数(to - from)。 */
export function daysBetweenStr(from: string, to: string): number {
  return Math.floor((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** 「M/D」単日ラベル。 */
export function mdLabel(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

/** 「M/D〜M/D」対象期間ラベル。 */
export function cycleRangeLabel(info: CycleInfo): string {
  return `${mdLabel(info.periodStart)}〜${mdLabel(info.periodEnd)}`;
}
