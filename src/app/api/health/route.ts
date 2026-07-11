// 軽量ヘルスチェック（サーバレス関数のウォームアップ用）。
// - 認証不要・DBに一切触らない・{ ok: true } を返すだけ。
// - UptimeRobot 等の定期ping(5分)で関数を温め、コールドスタートを緩和する用途。
// - Edge ではなく通常(Node.js)ランタイムで動かす（実ページと同じランタイムを温めるため）。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
