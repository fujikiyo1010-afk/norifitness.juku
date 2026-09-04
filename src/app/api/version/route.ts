import { NextResponse } from "next/server";
import { currentAppVersion } from "@/lib/support/app-version";

/**
 * いま本番に出ているアプリの版を返す (2026-09-04 凍結復元PWA対策C)
 *
 * 用途: ServiceWorkerRegister の復帰時チェック。凍結復元されたページが
 * 自分の版と本番の版を突き合わせ、古ければ読み込み直す(=保存ボタン死亡の予防)。
 * 版の実体は public/sw.js の CACHE_VERSION (currentAppVersion が読む)。
 *
 * 認証なし・公開情報のみ(版文字列だけ)。sw.js は /api/* をキャッシュしない。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { v: currentAppVersion() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
