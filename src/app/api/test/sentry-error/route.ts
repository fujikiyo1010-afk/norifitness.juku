import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * Sentry 動作確認用 一時エンドポイント (2026-06-19 線① D-β)
 *
 * - Authorization: Bearer ${CRON_SECRET} 必須
 * - GET でわざとエラーを throw + 明示的に captureException
 * - Sentry のイベント画面に出れば成功 → 確認後 削除
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return Response.json({ error: "no secret" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });

  const dsnPresent = !!process.env.NEXT_PUBLIC_SENTRY_DSN;
  const dsnPrefix = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").slice(0, 30);
  const nodeEnv = process.env.NODE_ENV;

  // 明示的に Sentry にエラー送信
  try {
    Sentry.captureMessage("Sentry test message (= explicit captureMessage)", {
      level: "warning",
      tags: { source: "test-endpoint" },
    });
    await Sentry.flush(3000); // 強制 flush (= 送信完了待ち)
  } catch (e) {
    return Response.json(
      { error: "sentry call failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    diagnostic: {
      dsnPresent,
      dsnPrefix,
      nodeEnv,
      sentryClientLoaded: !!Sentry,
    },
  });
}
