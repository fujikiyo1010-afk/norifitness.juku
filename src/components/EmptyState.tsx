import Link from "next/link";

/**
 * 共通「空状態」部品(B9・M11)。
 * 行き止まりを作らず、必ず次の一歩(CTA)を添える。
 * ベータ画面から順次適用し、既存の素の「まだありません」を置き換える。
 */
export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] p-8 text-center">
      <p className="text-[13px] font-bold leading-relaxed text-[#2b2620]">{title}</p>
      {description && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#6a6256]">
          {description}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <div className="mt-4 flex justify-center">
          <Link
            href={ctaHref}
            className="rounded-full btn3d px-5 py-2 text-[12px] font-bold text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
