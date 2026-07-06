import { createClient } from "@/lib/supabase/server";

/**
 * 体型ビフォーアフター写真 (body_photos) の取得 (2026-07-06 P6 再設計)
 *
 * 画像はプライベート bucket。表示は都度 署名URL を発行する。
 * 署名URLの発行は「トークン文字列を作るだけ」で画像DLは伴わないため、
 * 全件分の URL を作っても軽い。実際のDLは <img> を描画した時だけ。
 *
 *   - 記録画面(/record)      : ビフォーアフターの 2 枚だけ (getMyBodyPhotoSummary)
 *   - ギャラリー(/record/photos): 全件をサムネで一覧 (listMyBodyPhotosForGallery)
 */

const SIGNED_TTL = 60 * 60; // 1 時間

// ---------------------------------------------------------------------
// 記録画面用: ビフォーアフター(最初/最後) + 総枚数 だけ
// ---------------------------------------------------------------------
export type BodyPhotoSummary = {
  count: number;
  first: { url: string | null; recorded_at: string } | null; // 入会時ごろ
  last: { url: string | null; recorded_at: string } | null; // 現在 (count>=2 のときのみ)
};

export async function getMyBodyPhotoSummary(): Promise<BodyPhotoSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { count: 0, first: null, last: null };

  const [{ count }, { data: firstRow }, { data: lastRow }] = await Promise.all([
    supabase
      .from("body_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("body_photos")
      .select("storage_path, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_photos")
      .select("storage_path, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const total = count ?? 0;
  if (total === 0 || !firstRow) return { count: 0, first: null, last: null };

  const paths = [firstRow.storage_path];
  if (total >= 2 && lastRow) paths.push(lastRow.storage_path);

  const { data: signed } = await supabase.storage
    .from("body-photos")
    .createSignedUrls(paths, SIGNED_TTL);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return {
    count: total,
    first: {
      url: urlByPath.get(firstRow.storage_path) ?? null,
      recorded_at: firstRow.recorded_at,
    },
    last:
      total >= 2 && lastRow
        ? {
            url: urlByPath.get(lastRow.storage_path) ?? null,
            recorded_at: lastRow.recorded_at,
          }
        : null,
  };
}

// ---------------------------------------------------------------------
// ギャラリー用: 全件 (新しい順) ・ サムネURL + フルURL
// ---------------------------------------------------------------------
export type GalleryPhoto = {
  id: string;
  recorded_at: string; // YYYY-MM-DD
  note: string | null;
  thumbUrl: string | null; // 一覧グリッド用 (軽い)
  fullUrl: string | null; // 拡大用
};

export async function listMyBodyPhotosForGallery(): Promise<GalleryPhoto[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("body_photos")
    .select("id, recorded_at, note, storage_path, thumb_path")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    id: string;
    recorded_at: string;
    note: string | null;
    storage_path: string;
    thumb_path: string | null;
  }[];
  if (rows.length === 0) return [];

  // フル + サムネ を一括で署名 (重複排除)
  const allPaths = new Set<string>();
  for (const r of rows) {
    allPaths.add(r.storage_path);
    allPaths.add(r.thumb_path ?? r.storage_path);
  }
  const { data: signed } = await supabase.storage
    .from("body-photos")
    .createSignedUrls([...allPaths], SIGNED_TTL);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    recorded_at: r.recorded_at,
    note: r.note,
    thumbUrl: urlByPath.get(r.thumb_path ?? r.storage_path) ?? null,
    fullUrl: urlByPath.get(r.storage_path) ?? null,
  }));
}
