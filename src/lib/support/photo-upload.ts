"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";

/**
 * お問い合わせ写真のアップロード部品 (2026-08-27 新設)
 *
 * meals/photo-upload.ts と同じ堅牢化 (圧縮 / リトライ / タイムアウト) を
 * support-photos バケット向けに写したもの。
 * パス規則は `{userId}/{時刻}-{乱数}.jpg` ─ storage の RLS が
 * 「フォルダ先頭 = 自分の uid」を見るため、先頭は必ず userId。
 * (フォームの写真はスレッドが生まれる前に上げるので ticketId は使わない)
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function uploadSupportPhoto(
  userId: string,
  file: File
): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.jpg`;

  let blob: Blob;
  try {
    blob = await compressImage(file, 1080, 0.82);
  } catch {
    blob = file; // 圧縮に失敗しても原本で続行
  }

  const supabase = createClient();
  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      const result = await withTimeout(
        supabase.storage
          .from("support-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true }),
        20000
      );
      if (result.error) throw new Error(result.error.message);
      return path;
    } catch (e) {
      lastErr = e;
      if (i < 2) await sleep(600 * (i + 1));
    }
  }
  console.error("[support] photo upload failed", lastErr);
  throw new Error(
    "写真の保存に失敗しました。電波の良い場所やWi-Fiで、もう一度お試しください。"
  );
}
