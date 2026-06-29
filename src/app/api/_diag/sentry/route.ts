import { NextRequest, NextResponse } from "next/server";
import { reportError, reportMessage } from "@/lib/observability/report";

/**
 * Sentry 着弾検証用エンドポイント (2026-06-29)
 *
 * 目的: 「エラーが本当に Sentry に届くか」を本番で安全に確かめる。
 * 使い方: GET /api/_diag/sentry?key=<CRON_SECRET>
 *   → captureException + captureMessage を flush 付きで送信し、結果を返す。
 * 守り: CRON_SECRET 一致時のみ動作 (= 一般公開しない)。検証が済んだら削除可。
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  if (!secret || key !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stamp = new Date().toISOString();
  await reportMessage(`[diag] Sentry message test ${stamp}`, { source: "_diag/sentry" });
  await reportError(new Error(`[diag] Sentry exception test ${stamp}`), {
    source: "_diag/sentry",
  });

  return NextResponse.json({
    ok: true,
    sent: ["captureMessage", "captureException"],
    stamp,
    note: "Sentry のダッシュボードに [diag] で始まるイベントが2件出れば配線OK",
  });
}
