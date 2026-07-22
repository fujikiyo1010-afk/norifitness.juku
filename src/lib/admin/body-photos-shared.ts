/**
 * 体型写真の「クライアント安全」な型・純粋関数(2026-07-22)。
 * body-photos.ts は service role の createAdminClient を使うサーバ専用モジュールなので、
 * クライアント部品(PhotoTab / MetricsPhotoSection / MonthlyPhotoPanel)はこちらから
 * 型と純粋関数だけを import する(サーバコードをクライアントバンドルに混ぜない)。
 */

export type AdminBodyPhoto = {
  id: string;
  recordedAt: string; // YYYY-MM-DD
  note: string | null;
  thumbUrl: string | null; // 一覧グリッド用(軽い)
  fullUrl: string | null; // 拡大(ライトボックス)用
};

/**
 * 新しい順の配列から ビフォーアフター(初回=最古 / 最新=最新) と枚数を取り出す。
 * 最新は 2 枚以上あるときだけ(1 枚のときは初回のみ)。
 */
export function deriveBeforeAfter(photos: AdminBodyPhoto[]): {
  count: number;
  first: AdminBodyPhoto | null; // 初回(最古)
  last: AdminBodyPhoto | null; // 最新(2枚以上のとき)
} {
  const count = photos.length;
  if (count === 0) return { count: 0, first: null, last: null };
  const first = photos[count - 1]; // 新しい順配列の末尾が最古
  const last = count >= 2 ? photos[0] : null;
  return { count, first, last };
}
