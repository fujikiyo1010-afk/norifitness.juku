"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/video-library/vimeo";
import {
  addVideo,
  deleteVideo,
  updateVideoTitle,
  bulkImportLessonVideos,
} from "./actions";

export type LessonVideo = {
  id: string;
  title: string;
  vimeo_url: string;
  thumbnail_url: string | null;
  duration_sec: number | null;
};
export type MenuVideo = { title: string; vimeo_url: string };

type Tab = "lesson" | "menu";

export function VideoLibraryClient({
  lessonVideos,
  menuVideos,
  unimported,
}: {
  lessonVideos: LessonVideo[];
  menuVideos: MenuVideo[];
  unimported: number;
}) {
  const [tab, setTab] = useState<Tab>("lesson");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const filteredLesson = useMemo(
    () =>
      !q
        ? lessonVideos
        : lessonVideos.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.vimeo_url.toLowerCase().includes(q)
          ),
    [lessonVideos, q]
  );
  const filteredMenu = useMemo(
    () =>
      !q
        ? menuVideos
        : menuVideos.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.vimeo_url.toLowerCase().includes(q)
          ),
    [menuVideos, q]
  );

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const res = await bulkImportLessonVideos();
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">動画ライブラリ</h1>
        <p className="text-xs text-zinc-500 mt-1">
          動画を登録しておき、レッスン編集などで検索して選べます。
        </p>
      </header>

      {/* 一括取り込みバナー (レッスンタブ ・ 未登録あり時のみ) */}
      {tab === "lesson" && unimported > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[10px] border border-[#a7f3d0] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            既存レッスンで使われている動画のうち{" "}
            <b className="font-bold">{unimported} 本</b> がまだ未登録です。
          </span>
          <button
            type="button"
            onClick={handleImport}
            disabled={pending}
            className="ml-auto rounded-md bg-[#00897b] px-4 py-2 text-xs font-bold text-white hover:bg-[#00796b] disabled:opacity-50"
          >
            {pending ? "取り込み中…" : "レッスン用として一括取り込み"}
          </button>
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-1 border-b border-zinc-200">
        <TabButton
          active={tab === "lesson"}
          label="レッスン用"
          count={lessonVideos.length}
          onClick={() => setTab("lesson")}
        />
        <TabButton
          active={tab === "menu"}
          label="メニュー用"
          count={menuVideos.length}
          onClick={() => setTab("menu")}
        />
      </div>

      {/* ツールバー */}
      <div className="mt-4 flex items-center gap-2.5">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル ・ URL で検索"
            className="w-full rounded-[9px] border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        {tab === "lesson" && (
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="whitespace-nowrap rounded-[9px] bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-700"
          >
            ＋ 動画を追加
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* 追加フォーム (レッスンタブのみ) */}
      {tab === "lesson" && showAdd && (
        <AddVideoForm
          onDone={() => {
            setShowAdd(false);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      {/* メニュータブの注記 */}
      {tab === "menu" && (
        <p className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          メニュー用の動画は筋トレメニュー側のマスターで管理しているため、ここでは閲覧のみです（追加・削除はできません）。
        </p>
      )}

      {/* グリッド */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {tab === "lesson"
          ? filteredLesson.map((v) => (
              <LessonCard key={v.id} video={v} />
            ))
          : filteredMenu.map((v) => (
              <MenuCard key={v.vimeo_url} video={v} />
            ))}
      </div>

      {((tab === "lesson" && filteredLesson.length === 0) ||
        (tab === "menu" && filteredMenu.length === 0)) && (
        <div className="mt-5 rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
          {q
            ? "該当する動画がありません。"
            : tab === "lesson"
              ? "まだ動画がありません。上のバナーから一括取り込みするか、「＋動画を追加」で登録してください。"
              : "メニュー用の動画がありません。"}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${
        active
          ? "border-[#00897b] text-[#00897b]"
          : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
      <span className="ml-1.5 text-[11px] font-bold text-zinc-400">{count}</span>
    </button>
  );
}

function Thumb({
  thumbnailUrl,
  durationSec,
}: {
  thumbnailUrl?: string | null;
  durationSec?: number | null;
}) {
  const dur = formatDuration(durationSec);
  return (
    <div className="relative aspect-video bg-gradient-to-br from-zinc-700 to-zinc-900">
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
            <svg width="14" height="14" viewBox="0 0 24 24" className="ml-0.5 fill-zinc-900">
              <polygon points="6 4 20 12 6 20" />
            </svg>
          </div>
        </div>
      )}
      {dur && (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
          {dur}
        </span>
      )}
    </div>
  );
}

function LessonCard({ video }: { video: LessonVideo }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateVideoTitle(video.id, title);
      if (!res.ok) setError(res.message);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }
  function remove() {
    setError(null);
    if (!window.confirm(`「${video.title}」をライブラリから削除します。\n(レッスンに貼られた動画URL自体は消えません)\n\nよろしいですか?`))
      return;
    startTransition(async () => {
      const res = await deleteVideo(video.id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e8ebe9] bg-white">
      <Thumb thumbnailUrl={video.thumbnail_url} durationSec={video.duration_sec} />
      <div className="p-3">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            autoFocus
          />
        ) : (
          <div className="line-clamp-2 min-h-[2.4em] text-sm font-bold leading-snug text-zinc-900">
            {video.title}
          </div>
        )}
        <div className="mt-1.5 truncate font-mono text-[11px] text-zinc-400">
          {video.vimeo_url.replace(/^https?:\/\//, "")}
        </div>
        <div className="mt-2">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            レッスン用
          </span>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-700">{error}</p>}
      </div>
      <div className="flex border-t border-zinc-100">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex-1 border-r border-zinc-100 py-2 text-xs font-bold text-[#00897b] hover:bg-zinc-50 disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTitle(video.title);
              }}
              className="flex-1 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-50"
            >
              キャンセル
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 border-r border-zinc-100 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
            >
              編集
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="flex-1 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              削除
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MenuCard({ video }: { video: MenuVideo }) {
  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e8ebe9] bg-white">
      <Thumb />
      <div className="p-3">
        <div className="line-clamp-2 min-h-[2.4em] text-sm font-bold leading-snug text-zinc-900">
          {video.title}
        </div>
        <div className="mt-1.5 truncate font-mono text-[11px] text-zinc-400">
          {video.vimeo_url.replace(/^https?:\/\//, "")}
        </div>
        <div className="mt-2">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            メニュー用
          </span>
        </div>
      </div>
    </div>
  );
}

function AddVideoForm({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (m: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    onError(null);
    startTransition(async () => {
      const res = await addVideo({ title, vimeo_url: url });
      if (!res.ok) onError(res.message);
      else {
        setTitle("");
        setUrl("");
        onDone();
      }
    });
  }

  return (
    <div className="mt-4 rounded-[11px] border border-[#e8ebe9] bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
        <span className="h-2.5 w-2.5 rounded-full bg-[#00897b]" />
        動画を1本追加（レッスン用）
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-zinc-600">
            タイトル（空欄なら Vimeo から自動取得）
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="第6回LIVE講義 アーカイブ"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-zinc-600">
            Vimeo URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://vimeo.com/1204178153"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !url.trim()}
          className="h-[38px] rounded-md bg-[#00897b] px-5 text-sm font-bold text-white hover:bg-[#00796b] disabled:opacity-50"
        >
          {pending ? "追加中…" : "追加"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        ※ URL を貼るだけ。サムネイル・尺・タイトルは Vimeo から自動取得します。
      </p>
    </div>
  );
}
