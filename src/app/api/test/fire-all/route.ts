import { NextRequest } from "next/server";
import { sendPushToUser } from "@/lib/push/send";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { sendSignupRequestNoticeToAdmins } from "@/lib/email/signup-request-notice";
import { sendPasswordChangedEmail } from "@/lib/email/password-changed";
import { sendShipmentShippedEmail } from "@/lib/email/shipment-shipped";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 一括テスト通知 発射エンドポイント (2026-06-19 動作確認用 ・ 後で削除)
 *
 * - Authorization: Bearer ${CRON_SECRET} 必須
 * - test-launch-03 受講生 (= きよむさん iPhone PWA ログイン中) 宛に
 *   全 Push 種類 + 全 Email 種類を 1 リクエストで発射
 * - 各通知に try/catch ・ 1 件失敗しても次に進む
 * - 結果 JSON で 「sent / failed」 を返す → 答え合わせ
 *
 * 一時的 ・ 動作確認終了後 削除する
 */

const TEST_USER_ID = "25364047-0425-48d1-93f0-38bdc41d9402";
const TEST_EMAIL = "fujikiyo1010+test-launch-03@gmail.com";
const TEST_NAME = "テスト ローンチ太郎";

type LogEntry = { kind: string; key: string; ok: boolean; error?: string };

async function safeRun(
  log: LogEntry[],
  kind: string,
  key: string,
  fn: () => Promise<unknown>
) {
  try {
    await fn();
    log.push({ kind, key, ok: true });
  } catch (e) {
    log.push({
      kind,
      key,
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return Response.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });

  const log: LogEntry[] = [];
  const monthLabel = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;

  // ============================================================
  // Phase A: リマインド系 (R-1〜R-4) Push 4 件
  // ============================================================
  await safeRun(log, "push", "R-1 学習が止まっていませんか?", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "学習が止まっていませんか?",
      body: "30 日 動画を見ていません。 続きから 1 本見ましょう",
      url: "/",
      tag: "test-r1",
    })
  );
  await safeRun(log, "push", "R-2 カルテをまだ受け取っていません", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "カルテをまだ受け取っていません",
      body: "あなた専用の筋トレメニュー作成のため、 まずカルテをご記入ください",
      url: "/workout/carte/new",
      tag: "test-r2",
    })
  );
  await safeRun(log, "push", "R-3 目標シートが未記入です", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "目標シートが未記入です",
      body: "現状と目標を整理しましょう。 のりfitness が添削してフィードバックします",
      url: "/goal-sheet/edit",
      tag: "test-r3",
    })
  );
  await safeRun(log, "push", "R-4 体組成の記録が止まっています", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "体組成の記録が止まっています",
      body: "最後の記録から 10 日 経過しています。 記録しましょう",
      url: "/body-metrics",
      tag: "test-r4",
    })
  );

  // ============================================================
  // Phase B: 月次添削リマインド 3 段階
  // ============================================================
  await safeRun(log, "push", "B-6 月次添削 期限 3 日前", () =>
    sendPushToUser(TEST_USER_ID, {
      title: `${monthLabel} の月次添削 期限 3 日前`,
      body: "提出 → のり氏動画返信。 今のうちに記入を始めましょう",
      url: "/monthly-review/form",
      tag: "test-b6-3d",
    })
  );
  await safeRun(log, "push", "B-6 月次添削 本日が期限", () =>
    sendPushToUser(TEST_USER_ID, {
      title: `${monthLabel} の月次添削 本日が期限`,
      body: "今日中に提出すると今月分の添削動画を受け取れます",
      url: "/monthly-review/form",
      tag: "test-b6-due",
    })
  );
  await safeRun(log, "push", "B-6 月次添削 期限超過", () =>
    sendPushToUser(TEST_USER_ID, {
      title: `${monthLabel} の月次添削 期限超過`,
      body: "まだ提出できます。 早めに記入してご提出ください",
      url: "/monthly-review/form",
      tag: "test-b6-over",
    })
  );

  // ============================================================
  // Phase C: イベント連動 Push 系 (受講生宛)
  // ============================================================
  await safeRun(log, "push", "B-1 Welcome (= 入会時 Push)", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "ようこそ のりfitness 筋肉塾へ",
      body: `${TEST_NAME} さん、 入会ありがとうございます。 まずは画面右下「設定」 から通知を有効にしてください`,
      url: "/account",
      tag: "test-welcome",
    })
  );
  await safeRun(log, "push", "B-3 目標シート 添削が届きました", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "目標シート 添削が届きました",
      body: "のりfitness からの添削をタップで確認できます",
      url: "/goal-sheet",
      tag: "test-b3",
    })
  );
  await safeRun(log, "push", "B-4 メニュー配布 Push", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "のりfitness から新しい筋トレメニュー",
      body: "今月のメニューが届きました。 タップで開きます",
      url: "/workout",
      tag: "test-b4",
    })
  );
  await safeRun(log, "push", "B-5 発送通知 Push", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "プロテインを発送しました",
      body: "歓迎ギフトを本日発送しました。 1〜3 日以内にお届け予定です",
      url: "/",
      tag: "test-b5",
    })
  );
  await safeRun(log, "push", "月次添削 動画返信公開 Push", () =>
    sendPushToUser(TEST_USER_ID, {
      title: `${monthLabel} の月次添削 動画が届きました`,
      body: "のりfitness からの動画返信をタップで再生",
      url: "/monthly-review",
      tag: "test-monthly-video",
    })
  );
  await safeRun(log, "push", "カルテ更新リクエストへの返信", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "カルテ更新リクエストへの返信",
      body: "ご連絡ありがとうございます。 環境変更を反映してカルテを更新しました",
      url: "/workout/carte",
      tag: "test-carte-reply",
    })
  );
  await safeRun(log, "push", "メニュー変更リクエストへの返信", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "メニュー変更リクエストへの返信",
      body: "ご要望の種目変更を反映しました。 新しいメニューで進めてください",
      url: "/workout",
      tag: "test-workout-reply",
    })
  );
  await safeRun(log, "push", "チャット (admin → 受講生)", () =>
    sendPushToUser(TEST_USER_ID, {
      title: "のりfitness から新着メッセージ",
      body: "テストメッセージです。 タップで会話を開きます",
      url: "/messages",
      tag: "test-chat",
    })
  );

  // ============================================================
  // Phase D: メール系 (受講生宛 + admin 宛)
  // ============================================================
  await safeRun(log, "email", "B-1 Welcome", () =>
    sendWelcomeEmail({ email: TEST_EMAIL, name: TEST_NAME })
  );
  await safeRun(log, "email", "A-1 signup_request (admin 宛)", () =>
    sendSignupRequestNoticeToAdmins({
      name: "テスト 申請太郎",
      email: "test+signup@example.com",
    })
  );
  await safeRun(log, "email", "#3-b PW 変更通知 (本人宛)", () =>
    sendPasswordChangedEmail(TEST_USER_ID)
  );

  // B-5 shipment email は test 受講生の shipment 行が必要
  {
    const supabase = createAdminClient();
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id")
      .eq("user_id", TEST_USER_ID)
      .limit(1)
      .maybeSingle();
    if (shipment) {
      await safeRun(log, "email", "B-5 発送通知 (受講生宛)", () =>
        sendShipmentShippedEmail((shipment as { id: string }).id)
      );
    } else {
      log.push({
        kind: "email",
        key: "B-5 発送通知 (受講生宛)",
        ok: false,
        error: "no shipment row for test user (skipped)",
      });
    }
  }

  // 全 ok / failed 集計
  const sentCount = log.filter((l) => l.ok).length;
  const failedCount = log.filter((l) => !l.ok).length;

  return Response.json({
    ok: true,
    summary: { sent: sentCount, failed: failedCount, total: log.length },
    log,
  });
}
