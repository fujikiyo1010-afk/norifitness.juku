"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchVimeoMeta,
  normalizeVimeoUrl,
  extractVimeoId,
} from "@/lib/video-library/vimeo";
import { listExercisesWithVideo } from "@/lib/workout/video-master";

export type ActionResult = { ok: true } | { ok: false; message: string };

export type PickerVideo = {
  title: string;
  vimeo_url: string;
  thumbnail_url: string | null;
  usage: "lesson" | "menu";
};

/** ライブラリから選ぶモーダル用: レッスン用(DB) + メニュー用(マスター) を返す。 */
export async function getPickerVideos(): Promise<{
  lesson: PickerVideo[];
  menu: PickerVideo[];
}> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("video_library")
    .select("title, vimeo_url, thumbnail_url")
    .eq("usage", "lesson")
    .order("created_at", { ascending: false });

  const lesson: PickerVideo[] = (data ?? []).map((v) => ({
    title: v.title as string,
    vimeo_url: v.vimeo_url as string,
    thumbnail_url: (v.thumbnail_url as string | null) ?? null,
    usage: "lesson",
  }));

  const seen = new Set<string>();
  const menu: PickerVideo[] = [];
  for (const e of listExercisesWithVideo()) {
    const url = normalizeVimeoUrl(e.video_url);
    if (seen.has(url)) continue;
    seen.add(url);
    menu.push({
      title: e.動画名 || e.確定代表名,
      vimeo_url: url,
      thumbnail_url: null,
      usage: "menu",
    });
  }
  return { lesson, menu };
}

const PATH = "/admin/videos";

/** ライブラリに1本追加 (usage='lesson' 固定。メニュー用は既存マスター読み取りのため登録不可)。 */
export async function addVideo(input: {
  title: string;
  vimeo_url: string;
}): Promise<ActionResult> {
  await requireAdmin();
  const url = normalizeVimeoUrl(input.vimeo_url || "");
  if (!extractVimeoId(url)) {
    return { ok: false, message: "Vimeo の URL を入力してください (例: https://vimeo.com/123456789)" };
  }

  const supabase = createAdminClient();

  // 重複チェック (同一 usage 内)
  const { data: existing } = await supabase
    .from("video_library")
    .select("id")
    .eq("usage", "lesson")
    .eq("vimeo_url", url)
    .maybeSingle();
  if (existing) {
    return { ok: false, message: "その動画は既にライブラリに登録されています" };
  }

  const meta = await fetchVimeoMeta(url);
  const title = (input.title || "").trim() || meta.title || url;

  const { error } = await supabase.from("video_library").insert({
    title,
    vimeo_url: url,
    usage: "lesson",
    thumbnail_url: meta.thumbnailUrl,
    duration_sec: meta.durationSec,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(PATH);
  return { ok: true };
}

/** タイトルを編集。 */
export async function updateVideoTitle(
  id: string,
  title: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!title.trim()) return { ok: false, message: "タイトルは必須です" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("video_library")
    .update({ title: title.trim() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** ライブラリから削除 (= 引き出しから消す。レッスンに貼られた URL 自体は消えない)。 */
export async function deleteVideo(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("video_library").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * 既存レッスンの動画 URL のうち、まだライブラリ(usage='lesson')に無いものを一括取り込み。
 * タイトルは Vimeo oEmbed → 取れなければ そのレッスンのタイトル → URL の順でフォールバック。
 * 戻り値: 取り込んだ件数。
 */
export async function bulkImportLessonVideos(): Promise<
  ActionResult & { imported?: number }
> {
  await requireAdmin();
  const supabase = createAdminClient();

  // 1. レッスンの (title, vimeo_url) を全取得 → URL 正規化して url→代表タイトル を作る
  const { data: lessons, error: lErr } = await supabase
    .from("lessons")
    .select("title, vimeo_url")
    .not("vimeo_url", "is", null);
  if (lErr) return { ok: false, message: lErr.message };

  const urlToTitle = new Map<string, string>();
  for (const l of lessons ?? []) {
    const url = normalizeVimeoUrl(l.vimeo_url as string);
    if (!extractVimeoId(url)) continue;
    if (!urlToTitle.has(url)) urlToTitle.set(url, (l.title as string) ?? url);
  }

  // 2. 既存ライブラリ(lesson) の URL を除外
  const { data: existing } = await supabase
    .from("video_library")
    .select("vimeo_url")
    .eq("usage", "lesson");
  const have = new Set((existing ?? []).map((e) => e.vimeo_url as string));
  const targets = [...urlToTitle.keys()].filter((u) => !have.has(u));
  if (targets.length === 0) {
    return { ok: true, imported: 0 };
  }

  // 3. oEmbed メタ取得 (10並列ずつ)
  const rows: {
    title: string;
    vimeo_url: string;
    usage: string;
    thumbnail_url: string | null;
    duration_sec: number | null;
  }[] = [];
  const CHUNK = 10;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const slice = targets.slice(i, i + CHUNK);
    const metas = await Promise.all(slice.map((u) => fetchVimeoMeta(u)));
    slice.forEach((url, idx) => {
      const meta = metas[idx];
      rows.push({
        title: meta.title || urlToTitle.get(url) || url,
        vimeo_url: url,
        usage: "lesson",
        thumbnail_url: meta.thumbnailUrl,
        duration_sec: meta.durationSec,
      });
    });
  }

  // 4. 一括 INSERT
  const { error: iErr } = await supabase.from("video_library").insert(rows);
  if (iErr) return { ok: false, message: iErr.message };

  revalidatePath(PATH);
  return { ok: true, imported: rows.length };
}
