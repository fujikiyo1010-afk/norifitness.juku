"use client";

import { useEffect, useMemo, useState } from "react";
import { getPickerVideos, type PickerVideo } from "./actions";

type Tab = "lesson" | "menu";

/**
 * 「ライブラリから選ぶ」ボタン + 検索モーダル。
 * 選択すると onSelect(url) を呼ぶ。レッスン編集の Vimeo URL 欄から使う。
 */
export function VideoPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lesson, setLesson] = useState<PickerVideo[]>([]);
  const [menu, setMenu] = useState<PickerVideo[]>([]);
  const [tab, setTab] = useState<Tab>("lesson");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open && !loaded) {
      getPickerVideos().then(({ lesson, menu }) => {
        setLesson(lesson);
        setMenu(menu);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  const q = query.trim().toLowerCase();
  const list = tab === "lesson" ? lesson : menu;
  const filtered = useMemo(
    () =>
      !q
        ? list
        : list.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.vimeo_url.toLowerCase().includes(q)
          ),
    [list, q]
  );

  function pick(url: string) {
    onSelect(url);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-[#00897b] px-3 text-xs font-bold text-white hover:bg-[#00796b]"
      >
        ライブラリから選ぶ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center border-b border-zinc-200 px-5 py-4">
              <h3 className="text-[15px] font-bold text-zinc-900">
                ライブラリから動画を選ぶ
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto text-xl leading-none text-zinc-400 hover:text-zinc-600"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="px-5 pb-2 pt-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="タイトル ・ URL で検索"
                autoFocus
                className="w-full rounded-[9px] border border-zinc-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div className="flex gap-1.5 px-5 pb-2">
              <PillTab
                active={tab === "lesson"}
                label={`レッスン用 (${lesson.length})`}
                onClick={() => setTab("lesson")}
              />
              <PillTab
                active={tab === "menu"}
                label={`メニュー用 (${menu.length})`}
                onClick={() => setTab("menu")}
              />
            </div>

            <div className="flex-1 overflow-auto px-3 pb-4">
              {!loaded ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">
                  読み込み中…
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">
                  該当する動画がありません。
                </p>
              ) : (
                filtered.map((v) => (
                  <button
                    type="button"
                    key={`${v.usage}:${v.vimeo_url}`}
                    onClick={() => pick(v.vimeo_url)}
                    className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2.5 text-left hover:bg-zinc-50"
                  >
                    <div className="relative aspect-video w-[74px] shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900">
                      {v.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" className="ml-0.5 fill-white">
                            <polygon points="6 4 20 12 6 20" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[12.5px] font-bold leading-snug text-zinc-900">
                        {v.title}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-400">
                        {v.vimeo_url.replace(/^https?:\/\//, "")}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-zinc-900 px-3.5 py-1.5 text-[11.5px] font-bold text-white">
                      選択
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PillTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
        active
          ? "border-[#00897b] bg-[#00897b] text-white"
          : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
