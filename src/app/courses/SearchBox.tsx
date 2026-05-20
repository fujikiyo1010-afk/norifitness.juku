"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="動画を検索（例: ベンチプレス、胸、PFC）"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-10 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={query.trim().length === 0}
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          検索
        </button>
      </div>
    </form>
  );
}
