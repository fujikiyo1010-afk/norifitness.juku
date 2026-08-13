import Link from "next/link";

/**
 * チャット本文の描画(2026-07-31)。本文中のURLを自動でクリック可能にする。
 * - アプリ内(juku.norifitness.com)のURL → Next Link でアプリ内遷移(外部に飛ばさない)。
 *   例: 「この動画見て」でレッスンURLを貼る → タップでアプリ内レッスンが開く。
 * - それ以外(YouTube等) → 別タブで開く外部リンク。
 * 管理側・受講生側の両方の吹き出しで共通利用(見え方を揃える)。
 */
const URL_RE = /(https?:\/\/[^\s]+)/g;
const INTERNAL_HOSTS = ["juku.norifitness.com", "www.juku.norifitness.com"];
// レッスン視聴ページのパス(/courses/../chapters/../lessons/..) → カード風チップで表示。
const LESSON_PATH_RE = /^\/courses\/[^/]+\/chapters\/[^/]+\/lessons\/[^/]+/;

/** アプリ内URLならパス(?query#hash込み)を返す。外部なら null。 */
function toInternalPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (INTERNAL_HOSTS.includes(u.host)) return u.pathname + u.search + u.hash;
    return null;
  } catch {
    return null;
  }
}

export function MessageBody({ text }: { text: string }) {
  // URL で分割(キャプチャ付き split なので奇数インデックスが URL)。
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        const internal = toInternalPath(part);
        if (internal) {
          // レッスンURLは「▶ レッスンを開く」チップに(生URLは隠す・タップでアプリ内へ)。
          if (LESSON_PATH_RE.test(internal)) {
            return (
              <Link
                key={i}
                href={internal}
                className="my-0.5 inline-flex items-center gap-1.5 rounded-lg border border-[#d8e4d0] bg-white px-2.5 py-1.5 text-[12px] font-bold text-[#00695c] no-underline align-middle hover:bg-[#f0f7f5]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
                レッスンを開く
              </Link>
            );
          }
          return (
            <Link
              key={i}
              href={internal}
              className="text-[#1d4ed8] underline break-all"
            >
              {part}
            </Link>
          );
        }
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1d4ed8] underline break-all"
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
