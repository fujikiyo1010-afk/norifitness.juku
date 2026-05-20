"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** controlled モードで使うとき */
  value?: string;
  onChange?: (v: string) => void;
  /** クリア時の挙動。指定がない場合は自身で value="" にする */
  onClear?: () => void;
  /** ライブ検索時は不要、ボタン送信時は遷移先(/search) */
  submitOnEnter?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchBox({
  value,
  onChange,
  onClear,
  submitOnEnter = true,
  placeholder = "動画を検索(例: ベンチプレス、胸、PFC)",
  autoFocus = false,
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState("");
  const current = isControlled ? value : internal;

  const router = useRouter();

  function setValue(v: string) {
    if (isControlled) {
      onChange?.(v);
    } else {
      setInternal(v);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitOnEnter) return;
    const trimmed = (current ?? "").trim();
    if (trimmed.length === 0) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleClear() {
    setValue("");
    onClear?.();
  }

  const hasValue = (current ?? "").length > 0;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            🔍
          </span>
          <input
            type="search"
            value={current ?? ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-10 pr-9 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-zinc-900 dark:focus:border-zinc-50 focus:outline-none"
          />
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="クリア"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          )}
        </div>
        {submitOnEnter && (
          <button
            type="submit"
            disabled={!hasValue}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            検索
          </button>
        )}
      </div>
    </form>
  );
}
