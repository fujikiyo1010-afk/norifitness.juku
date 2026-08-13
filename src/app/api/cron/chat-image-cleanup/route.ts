import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * チャット画像の自動削除 cron(2026-07-31・段4)。
 * 送信から30日を超えた chat-images のファイルをバケットから削除して容量を解放する。
 * (表示側は created_at>30日で「画像は期限切れ」を出すので、行やパスは残してよい。
 *  storage.remove は存在しないパスでもエラーにならない=冪等。)
 *
 * cron 停止が数日続いても取りこぼさないよう、30〜40日前の窓を毎回処理する(冪等なので二重削除は無害)。
 * Vercel Cron: vercel.json の crons に "/api/cron/chat-image-cleanup" を日次登録。
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30日
  const windowStart = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(); // 40日前まで遡って冪等処理

  const { data, error } = await admin
    .from("messages")
    .select("image_path, image_thumb_path")
    .not("image_path", "is", null)
    .gte("created_at", windowStart)
    .lt("created_at", cutoff);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as {
    image_path: string | null;
    image_thumb_path: string | null;
  }[];
  const paths: string[] = [];
  for (const r of rows) {
    if (r.image_path) paths.push(r.image_path);
    if (r.image_thumb_path) paths.push(r.image_thumb_path);
  }

  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error: rmErr } = await admin.storage
      .from("chat-images")
      .remove(chunk);
    if (!rmErr) removed += chunk.length;
  }

  return Response.json({ ok: true, candidates: paths.length, removed });
}
