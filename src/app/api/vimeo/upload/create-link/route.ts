import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * Vimeo Upload 1/3: create-link (動画オブジェクト作成 + upload_link 取得)
 *
 * POST /api/vimeo/upload/create-link
 *
 * 受け取り (application/json):
 *   - auditId: string
 *   - userName: string
 *   - targetMonthLabel: string
 *   - fileSize: number (バイト数)
 *
 * 処理:
 *   1. Vimeo /me/videos に POST して動画オブジェクト作成 (tus approach + 確定 embed 設定)
 *   2. レスポンスから upload_link (tus PATCH エンドポイント) と vimeoUri を取得
 *   3. クライアントに返す
 *
 * クライアントはこの upload_link に対して直接 PATCH (tus) でファイルを送信する。
 * → サーバーを経由しないため Next.js のメモリ制約 (~50 MB) を回避できる。
 * → Vimeo Pro 上限 5 GB まで安定。
 *
 * embed 設定: Tech Check 4 (2026-05-27) で確定したもの。
 * 関連: project_kinniku_juku_vimeo_embed_settings.md
 */
export async function POST(request: NextRequest) {
  await requireAdmin();

  const PAT = process.env.VIMEO_ACCESS_TOKEN;
  if (!PAT) {
    return jsonError("Vimeo アクセストークンが設定されていません", 500);
  }

  let body: {
    auditId?: string;
    userName?: string;
    targetMonthLabel?: string;
    fileSize?: number;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("リクエスト形式が不正です (JSON パース失敗)", 400);
  }

  const auditId = body.auditId;
  const userName = body.userName ?? "受講生";
  const targetMonthLabel = body.targetMonthLabel ?? "月次添削";
  const fileSize = body.fileSize;

  if (!auditId) return jsonError("auditId が指定されていません", 400);
  if (!fileSize || fileSize <= 0) {
    return jsonError("fileSize が不正です", 400);
  }

  const VIMEO_API = "https://api.vimeo.com";
  try {
    const createRes = await fetch(`${VIMEO_API}/me/videos`, {
      method: "POST",
      headers: {
        Authorization: `bearer ${PAT}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        upload: { approach: "tus", size: fileSize },
        name: `${userName} さん ・ ${targetMonthLabel} ・ のりfitness 返信`,
        description: `月次添削への返信動画。受講生: ${userName}、${targetMonthLabel}`,
        privacy: {
          view: "disable",
          embed: "public",
          download: false,
          add: false,
          comments: "nobody",
        },
        embed: {
          buttons: {
            like: false,
            share: false,
            watchlater: false,
            embed: false,
            hd: false,
            fullscreen: true,
            scaling: true,
          },
          logos: { vimeo: false },
          title: { name: "hide", owner: "hide", portrait: "hide" },
          color: "00897b",
          speed: false,
          end_screen: { type: "empty" },
        },
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      console.error("Vimeo 動画作成失敗:", createRes.status, text);
      return jsonError(
        `Vimeo 動画作成失敗 (HTTP ${createRes.status})`,
        502
      );
    }

    const video = (await createRes.json()) as VimeoCreateResponse;
    const uploadLink = video.upload?.upload_link;
    if (!uploadLink) {
      return jsonError("Vimeo から upload_link が返ってきませんでした", 502);
    }

    return Response.json({
      ok: true,
      uploadLink,
      vimeoUri: video.uri,
      vimeoId: video.uri.split("/").pop() ?? "",
    });
  } catch (e) {
    console.error("Vimeo 動画作成例外:", e);
    return jsonError("Vimeo 動画作成中にネットワークエラー", 502);
  }
}

type VimeoCreateResponse = {
  uri: string;
  upload?: {
    upload_link?: string;
  };
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
