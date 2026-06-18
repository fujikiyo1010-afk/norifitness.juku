/**
 * Vimeo 動画を 16:9 で埋め込む Server Component。
 *
 * 速度変更: Vimeo プレイヤー内蔵の歯車アイコン > 再生速度 を利用する
 * (0.5x / 1x / 1.25x / 1.5x / 2x)。自前 UI は持たない。
 *
 * 対応 URL 形式:
 *   https://vimeo.com/123456789               (公開)
 *   https://vimeo.com/123456789/abcdef        (限定公開、ハッシュ付き)
 *   https://player.vimeo.com/video/123456789  (直接埋め込み URL)
 */

type ParsedVimeo = { id: string; hash: string | null };

export function parseVimeoUrl(url: string): ParsedVimeo | null {
  if (!url) return null;
  // vimeo.com/{id} or vimeo.com/{id}/{hash} or player.vimeo.com/video/{id}
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!match) return null;
  return { id: match[1], hash: match[2] ?? null };
}

function buildEmbedUrl({ id, hash }: ParsedVimeo): string {
  // クリーンな表示にするためのパラメータ
  // - title=0: 動画タイトルをプレイヤー内に表示しない (ページ側で表示済み)
  // - byline=0: アップロード者名を非表示
  // - portrait=0: アップロード者プロフ画像を非表示
  // - dnt=1: Vimeo の Do Not Track (プライバシー)
  const params = new URLSearchParams({
    title: "0",
    byline: "0",
    portrait: "0",
    dnt: "1",
  });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

export function VimeoEmbed({ url }: { url: string }) {
  const parsed = parseVimeoUrl(url);

  if (!parsed) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 text-sm space-y-2">
        <p className="text-amber-900 dark:text-amber-100">
          ⚠️ Vimeo URL を認識できませんでした。管理画面で正しい URL を設定してください。
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-200">
          対応形式: <code className="px-1 bg-amber-100 dark:bg-amber-900 rounded">https://vimeo.com/動画ID</code>
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-amber-700 dark:text-amber-300 underline break-all"
        >
          {url} ↗
        </a>
      </div>
    );
  }

  const embedUrl = buildEmbedUrl(parsed);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-black">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          title="動画プレイヤー"
        />
      </div>
      <p className="text-xs text-[#6a6256]">
        💡 再生速度の変更: 動画再生中、右下の⚙(歯車アイコン) → 再生速度 を選択
      </p>
    </div>
  );
}
