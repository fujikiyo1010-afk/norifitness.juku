import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sentry 動作確認用 一時エンドポイント (2026-06-19 線① D-β)
 *
 * - Authorization: Bearer ${CRON_SECRET} 必須
 * - GET でわざとエラーを throw
 * - Sentry のイベント画面に出れば成功 → 確認後 削除
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return Response.json({ error: "no secret" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });

  // わざと エラーを throw して Sentry に送る
  throw new Error("Sentry test error from /api/test/sentry-error (2026-06-19)");
}
