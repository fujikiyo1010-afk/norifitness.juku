import type { ChatMessage } from "@/lib/chat/types";

/**
 * チャット吹き出し内の画像(段4)。サムネ表示→タップで拡大(親のライトボックス)。
 * 送信30日超は cron でファイルが消えるので「期限切れ」表示。管理側・受講生側で共通。
 */
export function ChatImage({
  message,
  onImageClick,
}: {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
}) {
  if (message.image_expired) {
    return (
      <div className="mb-1 rounded-lg bg-black/5 px-3 py-4 text-center text-[11px] text-zinc-500">
        画像は期限切れ（送信から30日）
      </div>
    );
  }
  const thumb = message.image_thumb_url ?? message.image_url;
  const full = message.image_url ?? message.image_thumb_url;
  if (!thumb || !full) return null;

  return (
    <button
      type="button"
      onClick={() => onImageClick?.(full)}
      className="mb-1 block cursor-zoom-in overflow-hidden rounded-lg"
      aria-label="画像を拡大"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        loading="lazy"
        className="max-h-[220px] max-w-[220px] rounded-lg object-cover"
      />
    </button>
  );
}
