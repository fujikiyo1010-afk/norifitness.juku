import Link from "next/link";
import { resolveBackLink } from "@/lib/navigation/back-link";

/**
 * 動的な戻り動線リンク
 *
 * `?from=xxx` が指定されていれば「← xxx に戻る」リンクを出す。
 * 未指定 / 未知のキーなら何も表示しない (= 通常のパンくず動線にお任せ)。
 *
 * 使い方:
 *   const { from } = await searchParams;
 *   <BackLink from={from} />
 *
 * カスタマイズしたい場合は className を上書き。
 */
export function BackLink({
  from,
  className,
}: {
  from?: string | null;
  className?: string;
}) {
  const target = resolveBackLink(from);
  if (!target) return null;

  return (
    <Link
      href={target.href}
      className={
        className ??
        "inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-[#00695c] underline decoration-zinc-300 hover:decoration-[#00897b] underline-offset-2"
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      {target.label}
    </Link>
  );
}
