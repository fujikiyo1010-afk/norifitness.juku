"use client";

import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";

/**
 * 食事写真のアップロード部品(V2・2026-08-19)。
 * 旧MealSheetの堅牢化ロジック(リトライ/タイムアウト/upsert上書き)を共有部品化。
 * 1日の画面(食事カードの写真追加)と、将来のシート系から共用する。
 */

export class UploadError extends Error {
  stage: string;
  userMessage: string;
  detail?: unknown;
  constructor(stage: string, userMessage: string, detail?: unknown) {
    super(userMessage);
    this.name = "UploadError";
    this.stage = stage;
    this.userMessage = userMessage;
    this.detail = detail;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function uploadWithRetry(
  supabase: ReturnType<typeof createClient>,
  path: string,
  blob: Blob,
  attempts = 3,
  timeoutMs = 20000
): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await withTimeout(
        supabase.storage
          .from("meal-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true }),
        timeoutMs
      );
      if (result.error) throw new Error(result.error.message);
      return;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(600 * (i + 1));
    }
  }
  throw new UploadError(
    "upload",
    "写真の保存に失敗しました。電波の良い場所やWi-Fiで、もう一度お試しください。",
    lastErr
  );
}

/** 圧縮→アップロードして storage パスを返す。パス規則は旧シートを踏襲。 */
export async function uploadMealPhoto(
  userId: string,
  date: string,
  typeCode: string,
  file: File
): Promise<string> {
  const path = `${userId}/${date}-${typeCode}-${Date.now()}-day.jpg`;
  let blob: Blob;
  try {
    blob = await compressImage(file, 1080, 0.82);
  } catch {
    blob = file; // 圧縮に失敗しても原本で続行(サイズ上限はストレージ側)
  }
  const supabase = createClient();
  await uploadWithRetry(supabase, path, blob);
  return path;
}
