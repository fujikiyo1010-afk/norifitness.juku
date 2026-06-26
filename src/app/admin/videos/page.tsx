import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeVimeoUrl, extractVimeoId } from "@/lib/video-library/vimeo";
import { listExercisesWithVideo } from "@/lib/workout/video-master";
import {
  VideoLibraryClient,
  type LessonVideo,
  type MenuVideo,
} from "./VideoLibraryClient";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // レッスン用 (新DB ・ 編集可)
  const { data: lib } = await supabase
    .from("video_library")
    .select("id, title, vimeo_url, thumbnail_url, duration_sec")
    .eq("usage", "lesson")
    .order("created_at", { ascending: false });

  const lessonVideos: LessonVideo[] = (lib ?? []).map((v) => ({
    id: v.id as string,
    title: v.title as string,
    vimeo_url: v.vimeo_url as string,
    thumbnail_url: (v.thumbnail_url as string | null) ?? null,
    duration_sec: (v.duration_sec as number | null) ?? null,
  }));

  // 未登録数 (= レッスンで使用中だがライブラリ未登録の動画 ・ バナー用)
  const { data: lessons } = await supabase
    .from("lessons")
    .select("vimeo_url")
    .not("vimeo_url", "is", null);
  const lessonUrls = new Set<string>();
  for (const l of lessons ?? []) {
    const u = normalizeVimeoUrl(l.vimeo_url as string);
    if (extractVimeoId(u)) lessonUrls.add(u);
  }
  const have = new Set(lessonVideos.map((v) => v.vimeo_url));
  const unimported = [...lessonUrls].filter((u) => !have.has(u)).length;

  // メニュー用 (既存マスター読み取り ・ URL でユニーク化)
  const seen = new Set<string>();
  const menuVideos: MenuVideo[] = [];
  for (const e of listExercisesWithVideo()) {
    const url = normalizeVimeoUrl(e.video_url);
    if (seen.has(url)) continue;
    seen.add(url);
    menuVideos.push({ title: e.動画名 || e.確定代表名, vimeo_url: url });
  }

  return (
    <VideoLibraryClient
      lessonVideos={lessonVideos}
      menuVideos={menuVideos}
      unimported={unimported}
    />
  );
}
