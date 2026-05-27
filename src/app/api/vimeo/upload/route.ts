import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 分 (Vercel 等の serverless 制限内)

/**
 * Vimeo Upload API Route (月次添削の動画返信用)
 *
 * POST /api/vimeo/upload
 *
 * 受け取り (multipart/form-data):
 *   - auditId: string (送信先 audit の ID)
 *   - userName: string (動画タイトル用、受講生名)
 *   - targetMonthLabel: string (動画タイトル用、対象月)
 *   - durationSec: number (録画長さ)
 *   - file: Blob (動画ファイル本体、mp4 or webm)
 *
 * 処理:
 *   1. Vimeo 動画オブジェクト作成 (POST /me/videos with tus + Tech Check 4 確定 embed 設定)
 *   2. tus PATCH で動画ファイルを Vimeo にアップロード
 *   3. transcode 完了をポーリング (最大 60 秒、不達でも DB は更新)
 *   4. monthly_audits テーブルに Vimeo URL + ID を保存
 *   5. 成功レスポンスを返す
 *
 * 受講生通知 (LINE) は Step 9d で実装予定 (この route には含めない)。
 */
export async function POST(request: NextRequest) {
  // 認証
  await requireAdmin();

  const PAT = process.env.VIMEO_ACCESS_TOKEN;
  if (!PAT) {
    return jsonError("Vimeo アクセストークンが設定されていません", 500);
  }

  // フォームデータ取得
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("リクエスト形式が不正です", 400);
  }

  const auditId = formData.get("auditId") as string | null;
  const userName = (formData.get("userName") as string | null) ?? "受講生";
  const targetMonthLabel =
    (formData.get("targetMonthLabel") as string | null) ?? "月次添削";
  const durationSecRaw = formData.get("durationSec") as string | null;
  const durationSec = durationSecRaw ? parseInt(durationSecRaw, 10) : 0;
  const file = formData.get("file") as File | null;

  if (!auditId) return jsonError("auditId が指定されていません", 400);
  if (!file) return jsonError("動画ファイルが指定されていません", 400);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileSize = fileBuffer.length;

  const VIMEO_API = "https://api.vimeo.com";
  const VIMEO_HEADERS = {
    Authorization: `bearer ${PAT}`,
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };

  // ===== Step 1: Vimeo 動画オブジェクト作成 =====
  let video: VimeoVideo;
  try {
    const createRes = await fetch(`${VIMEO_API}/me/videos`, {
      method: "POST",
      headers: {
        ...VIMEO_HEADERS,
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
      const body = await createRes.text();
      console.error("Vimeo 動画作成失敗:", createRes.status, body);
      return jsonError(
        `Vimeo 動画作成失敗 (HTTP ${createRes.status})`,
        502
      );
    }
    video = (await createRes.json()) as VimeoVideo;
  } catch (e) {
    console.error("Vimeo 動画作成例外:", e);
    return jsonError("Vimeo 動画作成中にネットワークエラー", 502);
  }

  const uploadLink = video.upload?.upload_link;
  if (!uploadLink) {
    return jsonError("Vimeo から upload_link が返ってきませんでした", 502);
  }

  // ===== Step 2: tus PATCH で動画ファイルアップロード =====
  try {
    const uploadRes = await fetch(uploadLink, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: fileBuffer,
    });
    if (uploadRes.status !== 204) {
      const body = await uploadRes.text();
      console.error("Vimeo PATCH 失敗:", uploadRes.status, body);
      return jsonError(`Vimeo アップロード失敗 (HTTP ${uploadRes.status})`, 502);
    }
  } catch (e) {
    console.error("Vimeo PATCH 例外:", e);
    return jsonError("Vimeo アップロード中にネットワークエラー", 502);
  }

  // ===== Step 3: transcode 完了ポーリング =====
  // 完了せずタイムアウトしても、URL は確定するので DB に保存する
  // (transcode 完了は Vimeo 側で自動進行、再生時には完了済になる)
  const vimeoUri = video.uri;
  const vimeoId = vimeoUri.split("/").pop() ?? "";
  let finalLink: string | null = null;
  let finalEmbedUrl: string | null = null;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const checkRes = await fetch(`${VIMEO_API}${vimeoUri}`, {
        headers: VIMEO_HEADERS,
      });
      if (!checkRes.ok) continue;
      const status = (await checkRes.json()) as VimeoVideo;
      if (status.status === "available") {
        finalLink = status.link ?? null;
        finalEmbedUrl = status.player_embed_url ?? null;
        break;
      }
    } catch {
      // 一時的なエラーはリトライで吸収
    }
  }

  // タイムアウト時は URL を仮構築 (Vimeo 側は transcode 続行する)
  const playerEmbedUrl =
    finalEmbedUrl ?? `https://player.vimeo.com/video/${vimeoId}`;
  const watchUrl = finalLink ?? `https://vimeo.com/${vimeoId}`;

  // ===== Step 4: DB 更新 =====
  try {
    const supabase = createAdminClient();
    const { error: dbError } = await supabase
      .from("monthly_audits")
      .update({
        nori_video_vimeo_url: watchUrl,
        nori_video_vimeo_id: vimeoId,
        nori_video_published_at: new Date().toISOString(),
        nori_video_duration_sec: durationSec,
      })
      .eq("id", auditId);

    if (dbError) {
      console.error("DB 更新失敗:", dbError);
      // 動画はアップロード済なので、URL を返してクライアント側で残し対応
      return jsonError(
        `DB 更新失敗 (Vimeo にはアップ済): ${dbError.message}`,
        500
      );
    }
  } catch (e) {
    console.error("DB 更新例外:", e);
    return jsonError("DB 更新中に例外発生", 500);
  }

  // ===== 成功レスポンス =====
  return Response.json({
    success: true,
    vimeoUrl: watchUrl,
    playerEmbedUrl,
    vimeoId,
    transcodeCompleted: finalLink !== null,
  });
}

// =====================================================================
// 補助
// =====================================================================

type VimeoVideo = {
  uri: string;
  link?: string;
  player_embed_url?: string;
  status?: string;
  upload?: {
    upload_link?: string;
  };
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
