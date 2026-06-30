/**
 * ローディング skeleton 部品 (= データ取得待ちの間に出す骨組み)
 *
 * - データを一切読まない / 書かない純粋な見た目だけのコンポーネント。
 * - 受講生 UI の世界観 (ベージュ #f9f5ed) に馴染む淡いグレーで pulse。
 * - loading.tsx から組み立てて使う。
 */

export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-black/[0.06] ${className}`}
      aria-hidden="true"
    />
  );
}

/** 受講生ページ共通ヘッダーの骨組み (= MemberHeader の代替) */
export function SkeletonHeader() {
  return (
    <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-black/5 bg-[#f9f5ed] px-4 py-3">
      <SkeletonBox className="h-6 w-6 rounded-md" />
      <SkeletonBox className="mx-auto h-5 w-32" />
      <SkeletonBox className="h-6 w-6 rounded-md" />
    </div>
  );
}

/** カード型コンテンツ数枚の骨組み */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/5 bg-white/60 p-4 space-y-3"
        >
          <SkeletonBox className="h-5 w-2/3" />
          <SkeletonBox className="h-3 w-full" />
          <SkeletonBox className="h-3 w-4/5" />
          <SkeletonBox className="mt-2 h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * 受講生ページの汎用 skeleton (ヘッダー + カード)。
 * root の loading.tsx で全ページ共通の待ち画面として使う。
 */
export function MemberPageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <main className="loading-gate flex flex-1 flex-col bg-[#f9f5ed]">
      <SkeletonHeader />
      <div className="mx-auto w-full max-w-[460px] flex-1 p-4 sm:p-6">
        <SkeletonCards count={cards} />
      </div>
    </main>
  );
}
