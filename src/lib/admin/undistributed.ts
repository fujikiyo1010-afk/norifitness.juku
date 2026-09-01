/**
 * 未配布アカウントの非表示 (2026-09-01 きよむ決定 / 発行元=トレクラ移行欄)
 *
 * トレクラ移行 B組19人は「アカウント発行済み・本人未配布」。管理画面の一覧・キュー・
 * アラートに「一度も来ていない人」として混ざり紛らわしいため、配布まで完全に見えなくする。
 *
 * 判定は users.undistributed (boolean NOT NULL default false) の1列だけを見る。
 * メールリスト等での重複管理はしない。解除は移行欄が配布時に false へ戻す。
 *
 * ★この列は「管理画面の表示」専用。満了判定・配信・受講生側の挙動には使わない。
 * ★受講生ハブ /admin/users/[id] への直リンクは生かす(隠すのは一覧・集計だけ)。
 *   個別URLで開けることが、非表示にした人を確認する逃げ道になる。
 *
 * 使い方はどちらか:
 *   1) クエリで絞る   … applyVisible(query)  ← 件数(count)や大きい表はこちら
 *   2) 取得後に絞る   … isVisibleUser / filterVisibleUsers  ← 既に配列で持っている時
 *
 * ★新しく受講生を列挙する画面を作る時は、必ずここを通すこと。
 *   各所に .eq("undistributed", false) を散らすと付け忘れが必ず起きる。
 */

/**
 * users を引くクエリに「未配布を除く」を足す。
 *
 * 型引数に自己参照の制約(T extends { eq(): T })を付けると、Supabase の長い
 * チェーンで型の展開が深くなりすぎて TS2589 になる。そのため T は素通しにし、
 * eq の呼び出しだけ内部でキャストする(戻り値の型は呼び出し元のまま保たれる)。
 */
export function applyVisible<T>(query: T): T {
  return (query as unknown as { eq: (col: string, val: unknown) => T }).eq(
    "undistributed",
    false
  );
}

export type MaybeUndistributed = { undistributed?: boolean | null };

/** 取得済みの1件が管理画面に出してよいか */
export function isVisibleUser(u: MaybeUndistributed | null | undefined): boolean {
  return !u?.undistributed;
}

/** 取得済みの配列から未配布を落とす (select に undistributed を含めておくこと) */
export function filterVisibleUsers<T extends MaybeUndistributed>(rows: T[]): T[] {
  return rows.filter((r) => !r.undistributed);
}
