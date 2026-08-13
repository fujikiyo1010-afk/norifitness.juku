import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessage } from "./types";

/**
 * チャット画像の署名URL付与(段4)。chat-images は非公開バケットなので、
 * 表示には都度 署名URL を発行する(サーバ=service role 発行・クライアントにはURL文字列だけ渡す)。
 * 送信から30日を超えた画像は cron で実ファイルが消えるため、URLを発行せず image_expired=true にする
 * (表示側は「画像は期限切れ」を出す)。管理側・受講生側の両ローダーから使う共通処理。
 */
const SIGNED_TTL = 3600; // 1時間
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30日

export async function signChatImages(rows: ChatMessage[]): Promise<ChatMessage[]> {
  const now = Date.now();
  const toSign = new Set<string>();
  let hasAny = false;
  for (const m of rows) {
    if (!m.image_path) continue;
    hasAny = true;
    if (now - Date.parse(m.created_at) > EXPIRE_MS) continue; // 期限切れは署名しない
    toSign.add(m.image_path);
    if (m.image_thumb_path) toSign.add(m.image_thumb_path);
  }
  if (!hasAny) return rows;

  const urlByPath = new Map<string, string>();
  if (toSign.size > 0) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("chat-images")
      .createSignedUrls([...toSign], SIGNED_TTL);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return rows.map((m) => {
    if (!m.image_path) return m;
    const expired = now - Date.parse(m.created_at) > EXPIRE_MS;
    if (expired) {
      return { ...m, image_url: null, image_thumb_url: null, image_expired: true };
    }
    return {
      ...m,
      image_url: urlByPath.get(m.image_path) ?? null,
      image_thumb_url: m.image_thumb_path
        ? urlByPath.get(m.image_thumb_path) ?? urlByPath.get(m.image_path) ?? null
        : urlByPath.get(m.image_path) ?? null,
      image_expired: false,
    };
  });
}
