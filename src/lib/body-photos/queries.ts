import { createClient } from "@/lib/supabase/server";

/**
 * 体型ビフォーアフター写真 (body_photos) の取得 (2026-07-06 P6)
 *
 * 画像はプライベート bucket。表示は都度 署名URL を発行する
 * (/record は force-dynamic なのでロードごとに再発行される)。
 */

export type BodyPhoto = {
  id: string;
  recorded_at: string; // YYYY-MM-DD
  note: string | null;
  storage_path: string;
  url: string | null; // 署名URL (発行失敗時 null)
};

const SIGNED_TTL = 60 * 60; // 1 時間

/**
 * 受講生自身の体型写真一覧 (recorded_at 昇順 = 古い→新しい)。
 * ビフォーアフターで「最初=入会時ごろ / 最後=現在」に使いやすい並び。
 */
export async function listMyBodyPhotos(): Promise<BodyPhoto[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("body_photos")
    .select("id, recorded_at, note, storage_path")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Omit<BodyPhoto, "url">[];
  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("body-photos")
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_TTL
    );

  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    ...r,
    url: urlByPath.get(r.storage_path) ?? null,
  }));
}
