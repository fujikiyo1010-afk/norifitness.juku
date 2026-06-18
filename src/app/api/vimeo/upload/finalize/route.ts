import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMonthlyAuditPublishedEmail } from "@/lib/email/monthly-audit-published";
import { sendPushToUser } from "@/lib/push/send";

export const dynamic = "force-dynamic";
export const maxDuration = 90; // transcode 完了ポーリングのため

/**
 * Vimeo Upload 3/3: finalize (transcode 完了待ち + DB 更新)
 *
 * POST /api/vimeo/upload/finalize
 *
 * 受け取り (application/json):
 *   - auditId: string
 *   - vimeoUri: string (例: "/videos/1234567890")
 *   - durationSec: number
 *
 * 処理:
 *   1. Vimeo に GET {vimeoUri} を最大 60 秒ポーリング (status: "available" まで待つ)
 *   2. タイムアウト時は URL を仮構築 (Vimeo 側は transcode 続行する、再生時には完了済)
 *   3. monthly_audits テーブルを更新:
 *      - nori_video_vimeo_url
 *      - nori_video_vimeo_id
 *      - nori_video_published_at
 *      - nori_video_duration_sec
 *
 * クライアントは Step 2 (PATCH) 完了後にこの finalize を呼ぶ。
 */
export async function POST(request: NextRequest) {
  await requireAdmin();

  const PAT = process.env.VIMEO_ACCESS_TOKEN;
  if (!PAT) {
    return jsonError("Vimeo アクセストークンが設定されていません", 500);
  }

  let body: {
    auditId?: string;
    vimeoUri?: string;
    durationSec?: number;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("リクエスト形式が不正です (JSON パース失敗)", 400);
  }

  const auditId = body.auditId;
  const vimeoUri = body.vimeoUri;
  const durationSec = body.durationSec ?? 0;

  if (!auditId) return jsonError("auditId が指定されていません", 400);
  if (!vimeoUri) return jsonError("vimeoUri が指定されていません", 400);

  const vimeoId = vimeoUri.split("/").pop() ?? "";
  if (!vimeoId) return jsonError("vimeoUri から id を抽出できません", 400);

  const VIMEO_API = "https://api.vimeo.com";
  const VIMEO_HEADERS = {
    Authorization: `bearer ${PAT}`,
    Accept: "application/vnd.vimeo.*+json;version=3.4",
  };

  // ===== Step 1: transcode 完了ポーリング (最大 60 秒) =====
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

  // タイムアウト時は URL を仮構築 (Vimeo 側は transcode 続行する、再生時には完了済)
  const playerEmbedUrl =
    finalEmbedUrl ?? `https://player.vimeo.com/video/${vimeoId}`;
  const watchUrl = finalLink ?? `https://vimeo.com/${vimeoId}`;

  // ===== Step 2: DB 更新 =====
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
      return jsonError(
        `DB 更新失敗 (Vimeo にはアップ済): ${dbError.message}`,
        500
      );
    }
  } catch (e) {
    console.error("DB 更新例外:", e);
    return jsonError("DB 更新中に例外発生", 500);
  }

  // ===== Step 3: 公開メール送信 (受講生に通知 ・ 2026-06-17 メール作戦) =====
  // 失敗しても finalize 全体は成功扱い (= upload は無事完了している)
  const emailResult = await sendMonthlyAuditPublishedEmail(auditId);
  if (!emailResult.sent) {
    console.warn(
      "[monthly-audit-published-email] not sent:",
      emailResult.reason
    );
  }

  // ===== Step 4: push 通知 (= 2026-06-18 #2 push 横展開) =====
  // user_id + target_month は audit から逆引き
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("monthly_audits")
      .select("user_id, target_month")
      .eq("id", auditId)
      .maybeSingle();
    const targetUserId = (row as { user_id?: string } | null)?.user_id;
    const targetMonth =
      (row as { target_month?: string } | null)?.target_month ?? null;
    if (targetUserId) {
      const monthLabel = targetMonth
        ? `${new Date(targetMonth).getFullYear()}年${new Date(targetMonth).getMonth() + 1}月`
        : "今月";
      void sendPushToUser(targetUserId, {
        title: `${monthLabel} の月次添削 動画が届きました`,
        body: "のりfitness からの動画返信をタップで再生",
        url: targetMonth ? `/monthly-review/detail/${targetMonth}` : "/monthly-review",
        tag: "monthly-video-published",
      }).catch((e) => console.error("[push] monthly video failed", e));
    }
  } catch (e) {
    console.error("[push] monthly video lookup failed", e);
  }

  return Response.json({
    ok: true,
    vimeoUrl: watchUrl,
    playerEmbedUrl,
    vimeoId,
    transcodeCompleted: finalLink !== null,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason ?? null,
  });
}

type VimeoVideo = {
  uri: string;
  link?: string;
  player_embed_url?: string;
  status?: string;
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
