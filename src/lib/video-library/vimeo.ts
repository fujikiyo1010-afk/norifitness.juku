/**
 * Vimeo URL ユーティリティ + oEmbed メタ取得 (動画ライブラリ B-2/B-3 2026-06-26)
 *
 * - normalizeVimeoUrl: クエリ等を落として https://vimeo.com/{id} に正規化
 * - fetchVimeoMeta: oEmbed (認証不要) で title / thumbnail / duration を取得
 *   失敗時 (限定公開 等) は null フィールドで返し、呼び出し側でフォールバックする。
 */

export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  // https://vimeo.com/123456789 / player.vimeo.com/video/123 / ?以降は無視
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** クエリ・フラグメントを除いた https://vimeo.com/{id} を返す。id が取れなければ trim だけ。 */
export function normalizeVimeoUrl(url: string): string {
  const id = extractVimeoId(url);
  return id ? `https://vimeo.com/${id}` : url.trim();
}

export type VimeoMeta = {
  title: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
};

/**
 * oEmbed で Vimeo 動画のメタを取得。ネットワーク/権限エラー時は全 null。
 * 認証不要のエンドポイントを使う (限定公開でも domain 許可されていれば取れる)。
 */
export async function fetchVimeoMeta(url: string): Promise<VimeoMeta> {
  const norm = normalizeVimeoUrl(url);
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(norm)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return { title: null, thumbnailUrl: null, durationSec: null };
    const j = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      duration?: number;
    };
    return {
      title: j.title ?? null,
      thumbnailUrl: j.thumbnail_url ?? null,
      durationSec: typeof j.duration === "number" ? j.duration : null,
    };
  } catch {
    return { title: null, thumbnailUrl: null, durationSec: null };
  }
}

/** 秒 → "mm:ss" / "h:mm:ss" 表示。null は空文字。 */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
