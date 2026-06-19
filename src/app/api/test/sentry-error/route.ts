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
    flushed = await Sentry.flush(15000);
    console.log("[sentry test] flush result:", flushed);
  } catch (e) {
    flushError = e instanceof Error ? e.message : "unknown";
    console.error("[sentry test] flush failed:", flushError);
  }

  // ─── 直接 HTTP POST ・ Sentry envelope エンドポイントに直送 ───
  // SDK 経由が機能してない場合の切り分け
  let directPostStatus: number | string = "skipped";
  let directPostError: string | undefined;
  try {
    const url = new URL(dsnFull);
    const publicKey = url.username; // DSN の "https://<key>@host/..." の <key>
    const projectId = url.pathname.replace(/^\//, "");
    const sentryHost = url.host;
    const envelopeUrl = `https://${sentryHost}/api/${projectId}/envelope/`;
    const now = new Date().toISOString();
    const eventDirect = {
      event_id: "abcdef1234567890abcdef1234567890",
      timestamp: now,
      platform: "node",
      level: "warning",
      message: { formatted: "Direct HTTP POST test (= bypass SDK)" },
      tags: { source: "direct-post" },
    };
    const envelope = [
      JSON.stringify({ event_id: eventDirect.event_id, sent_at: now, dsn: dsnFull }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(eventDirect),
    ].join("\n");

    const resp = await fetch(envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=manual/1.0`,
      },
      body: envelope,
    });
    directPostStatus = resp.status;
    if (!resp.ok) {
      directPostError = await resp.text().then((t) => t.slice(0, 200));
    }
  } catch (e) {
    directPostError = e instanceof Error ? e.message : "unknown";
    directPostStatus = "throw";
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
      directPostStatus,
      directPostError,
    },
  });
}
