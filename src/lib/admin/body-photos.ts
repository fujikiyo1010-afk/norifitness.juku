import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminBodyPhoto } from "./body-photos-shared";

/**
 * 管理: 受講生の体型写真(body_photos)を閲覧用に取得(サーバ専用・service role)。
 * 画像はプライベート bucket `body-photos`。表示は都度 署名URL を発行する
 * (受講生側 lib/body-photos/queries.ts と同方式・こちらは service role で全受講生分を取得可)。
 *
 * 型 AdminBodyPhoto と純粋関数 deriveBeforeAfter は body-photos-shared.ts(クライアント安全)に置き、
 * クライアント部品はそちらから import する。ここは取得(サーバ)だけを担う。
 *
 * 使い先:
 *   - デイリー添削「写真」タブ (全件ギャラリー)
 *   - 受講生ハブ 体組成タブ (ビフォーアフター + タイムライン)
 *   - 月次添削 個別作業 (対象月のビフォーアフター + その月の撮影)
 */

const SIGNED_TTL = 3600; // 1 時間 (meals.ts と揃える)

export type { AdminBodyPhoto } from "./body-photos-shared";

/**
 * 指定受講生の体型写真を新しい順で返す。
 * opts.month(YYYY-MM) を渡すと、その月に撮影されたぶんだけに絞る(月次添削用)。
 */
export async function listBodyPhotosForUser(
  userId: string,
  opts?: { month?: string }
): Promise<AdminBodyPhoto[]> {
  const admin = createAdminClient();

  let q = admin
    .from("body_photos")
    .select("id, recorded_at, note, storage_path, thumb_path")
    .eq("user_id", userId);

  if (opts?.month) {
    const { start, end } = monthRange(opts.month);
    q = q.gte("recorded_at", start).lt("recorded_at", end);
  }

  const { data } = await q
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

  // フル + サムネ を一括で署名(重複排除)。トークン生成のみで画像DLは <img> 描画時。
  const allPaths = new Set<string>();
  for (const r of rows) {
    allPaths.add(r.storage_path);
    allPaths.add(r.thumb_path ?? r.storage_path);
  }
  const { data: signed } = await admin.storage
    .from("body-photos")
    .createSignedUrls([...allPaths], SIGNED_TTL);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    recordedAt: r.recorded_at,
    note: r.note,
    thumbUrl: urlByPath.get(r.thumb_path ?? r.storage_path) ?? null,
    fullUrl: urlByPath.get(r.storage_path) ?? null,
  }));
}

/** "YYYY-MM" → { start:"YYYY-MM-01", end:翌月1日 } (recorded_at は date) */
function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { start, end };
}
