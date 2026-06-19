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
  const dsnFull = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
  const dsnPrefix = dsnFull.slice(0, 30);
  let dsnHost = "?";
  let dsnPath = "?";
  try {
    const u = new URL(dsnFull);
    dsnHost = u.host;
    dsnPath = u.pathname;
  } catch {}
  const nodeEnv = process.env.NODE_ENV;

  // 明示的に Sentry にエラー送信
  let eventId: string | undefined;
  let flushed: boolean | undefined;
  let flushError: string | undefined;
  try {
    eventId = Sentry.captureMessage("Sentry test message (= explicit captureMessage)", {
      level: "warning",
      tags: { source: "test-endpoint" },
    });
    console.log("[sentry test] captureMessage eventId:", eventId);
    flushed = await Sentry.flush(15000); // 15 秒待ち
    console.log("[sentry test] flush result:", flushed);
  } catch (e) {
    flushError = e instanceof Error ? e.message : "unknown";
    console.error("[sentry test] flush failed:", flushError);
  }

  return Response.json({
    ok: true,
    diagnostic: {
      dsnPresent,
      dsnPrefix,
      dsnHost,
      dsnPath,
      nodeEnv,
      sentryClientLoaded: !!Sentry,
      eventId,
      flushed,
      flushError,
    },
  });
}
