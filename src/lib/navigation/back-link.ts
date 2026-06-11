/**
 * 戻り動線の共通基盤
 *
 * 各画面が「どこから来たか」を `?from=xxx` クエリで受け取り、
 * 適切な「戻る」リンクを出すための仕組み。
 *
 * 設計原則 (memory: project_kinniku_juku_navigation_refactor):
 *   - 戻り先はテーブルで一元管理、 各画面でハードコードしない
 *   - 新しい戻り元が出てきたら KNOWN_TARGETS に 1 行追加するだけ
 *   - components/BackLink.tsx と併用
 *
 * 使い方:
 *   遷移元: <Link href={`/courses/.../lessons/[id]?from=reviews`} />
 *   遷移先 (page.tsx):
 *     const { from } = await searchParams;
 *     <BackLink from={from} />
 */

export type BackTarget = {
  /** リンク先 URL */
  href: string;
  /** 表示ラベル (例: 「振り返り一覧に戻る」) */
  label: string;
};

/**
 * 既知の戻り先テーブル
 *
 * 新しい戻り元を追加するときは ここに 1 行追加。
 * 動的 URL (受講生 ID 等を含む) が必要な場合は別途 resolver を作る。
 */
export const KNOWN_TARGETS: Record<string, BackTarget> = {
  // 受講生 UI
  reviews: { href: "/my-log/reviews", label: "振り返り一覧に戻る" },
  "my-log": { href: "/my-log", label: "学習ハブに戻る" },
  courses: { href: "/courses", label: "コース一覧に戻る" },
  home: { href: "/", label: "ホームに戻る" },

  // 管理画面
  "admin-home": { href: "/admin", label: "管理者ホームに戻る" },
  "admin-users": { href: "/admin/users", label: "受講生一覧に戻る" },
  requests: { href: "/admin/requests", label: "リクエスト一覧に戻る" },
  monthly: { href: "/admin/monthly-reviews", label: "月次添削受信箱に戻る" },
  shipments: { href: "/admin/shipments", label: "発送管理に戻る" },
  invitations: { href: "/admin/invitations", label: "招待一覧に戻る" },
};

/**
 * `?from=xxx` の値から戻り先を解決
 *
 * @param from クエリパラメータの値 (undefined / null / 未知のキーなら null)
 * @returns 解決された戻り先、 または null
 */
export function resolveBackLink(from?: string | null): BackTarget | null {
  if (!from) return null;
  return KNOWN_TARGETS[from] ?? null;
}
