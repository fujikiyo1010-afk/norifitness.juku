import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push/send";

/**
 * リマインド検知 + 送信 (2026-06-18 線① R-1〜R-4 + B-6 ・ Push のみ)
 *
 * 設計原則:
 *   - 3 段階リマインド = 「最終送信から 7 日経過 AND 条件成立」 で再送
 *     (= R-1: 3, 10, 17 日 / R-2: 5, 12, 19 日 / R-3 R-4: 7, 14, 21 日)
 *   - アクション完了で条件 false → 自動停止 (= 受講生が動いたら止まる)
 *   - B-6 月次添削は 「特定日のみ送る」 (= 月末 -3 / 当日 / +3) + 同 reminder_key 内 同日 重複防止
 *   - 全部 Push のみ (= メール無し ・ 2026-06-18 きよむさん確定)
 *
 * 起動元: /api/cron/reminders/route.ts (Vercel Cron daily 9AM JST = 0 UTC)
 */

const COOLDOWN_DAYS = 7;
const MS_PER_DAY = 86400 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** 最終送信を取得 ・ なければ null */
async function getLastSentAt(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  reminderKey: string
): Promise<Date | null> {
  const { data } = await supabase
    .from("reminder_log")
    .select("sent_at")
    .eq("user_id", userId)
    .eq("reminder_key", reminderKey)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return new Date((data as { sent_at: string }).sent_at);
}

/** cooldown 超えてるか (= 7 日経過 or 未送信) */
async function isCooldownPassed(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  reminderKey: string,
  now: Date
): Promise<boolean> {
  const last = await getLastSentAt(supabase, userId, reminderKey);
  if (!last) return true;
  return daysBetween(last, now) >= COOLDOWN_DAYS;
}

async function logSent(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  reminderKey: string
) {
  await supabase.from("reminder_log").insert({
    user_id: userId,
    reminder_key: reminderKey,
  });
}

// ============================================================
// 受講生 1 人分の全リマインドチェック
// ============================================================
export type ReminderResult = {
  user_id: string;
  sent: string[]; // 送信したキー
  skipped: string[]; // 条件不成立 or cooldown 中
};

type UserInput = {
  id: string;
  joined_at: string;
};

export async function checkAndSendForUser(
  user: UserInput,
  now: Date = new Date()
): Promise<ReminderResult> {
  const supabase = createAdminClient();
  const result: ReminderResult = { user_id: user.id, sent: [], skipped: [] };
  const joinedAt = new Date(user.joined_at);
  const daysSinceJoined = daysBetween(joinedAt, now);

  // ─── R-1: 学習動画 未視聴 3 日 ─────────────────────────────
  // 条件: lesson_progress.last_watched_at の最新が 3 日前以前 OR 一度も視聴していない
  // (= 一度も視聴ない場合は joined_at から 3 日経過で送信)
  // 注意: last_watched_at は users 列ではなく lesson_progress テーブル ・1 レッスン 1 行
  {
    const { data: latestLessonRow } = await supabase
      .from("lesson_progress")
      .select("last_watched_at")
      .eq("user_id", user.id)
      .not("last_watched_at", "is", null)
      .order("last_watched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastWatched = latestLessonRow
      ? new Date((latestLessonRow as { last_watched_at: string }).last_watched_at)
      : null;
    const idleDays = lastWatched
      ? daysBetween(lastWatched, now)
      : daysSinceJoined;
    const condition = idleDays >= 3 && daysSinceJoined >= 3;
    if (condition && (await isCooldownPassed(supabase, user.id, "r1_video_idle", now))) {
      await sendPushToUser(user.id, {
        title: "学習が止まっていませんか?",
        body: `${idleDays} 日 動画を見ていません。 続きから 1 本見ましょう`,
        url: "/courses",
        tag: "r1_video_idle",
      });
      await logSent(supabase, user.id, "r1_video_idle");
      result.sent.push("r1_video_idle");
    } else {
      result.skipped.push("r1_video_idle");
    }
  }

  // ─── R-2: カルテ未提出 5 日 ─────────────────────────────
  // 条件: user_workout_carte 行が無い AND 入会 5 日以上
  {
    if (daysSinceJoined >= 5) {
      const { data: carte } = await supabase
        .from("user_workout_carte")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const condition = !carte;
      if (condition && (await isCooldownPassed(supabase, user.id, "r2_carte_blank", now))) {
        await sendPushToUser(user.id, {
          title: "カルテをまだ受け取っていません",
          body: "あなた専用の筋トレメニュー作成のため、 まずカルテをご記入ください",
          url: "/workout/carte/new",
          tag: "r2_carte_blank",
        });
        await logSent(supabase, user.id, "r2_carte_blank");
        result.sent.push("r2_carte_blank");
      } else {
        result.skipped.push("r2_carte_blank");
      }
    }
  }

  // ─── R-3: 目標シート未記入 7 日 ─────────────────────────────
  // 条件: goal_sheets 行が無い OR content 空 AND 入会 7 日以上
  {
    if (daysSinceJoined >= 7) {
      const { data: sheet } = await supabase
        .from("goal_sheets")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const condition = !sheet;
      if (condition && (await isCooldownPassed(supabase, user.id, "r3_goal_sheet_blank", now))) {
        await sendPushToUser(user.id, {
          title: "目標シートが未記入です",
          body: "現状と目標を整理しましょう。 のりfitness が添削してフィードバックします",
          url: "/goal-sheet/edit",
          tag: "r3_goal_sheet_blank",
        });
        await logSent(supabase, user.id, "r3_goal_sheet_blank");
        result.sent.push("r3_goal_sheet_blank");
      } else {
        result.skipped.push("r3_goal_sheet_blank");
      }
    }
  }

  // ─── R-4: 体組成記録 7 日途絶 ─────────────────────────────
  // 条件: body_metrics 最新 recorded_at が 7 日前以前 (= 1 件以上記録あり前提)
  {
    const { data: latest } = await supabase
      .from("body_metrics")
      .select("recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      const lastRec = new Date((latest as { recorded_at: string }).recorded_at);
      const stalledDays = daysBetween(lastRec, now);
      const condition = stalledDays >= 7;
      if (condition && (await isCooldownPassed(supabase, user.id, "r4_body_metrics", now))) {
        await sendPushToUser(user.id, {
          title: "体組成の記録が止まっています",
          body: `最後の記録から ${stalledDays} 日 経過しています。 記録しましょう`,
          url: "/body-metrics",
          tag: "r4_body_metrics",
        });
        await logSent(supabase, user.id, "r4_body_metrics");
        result.sent.push("r4_body_metrics");
      } else {
        result.skipped.push("r4_body_metrics");
      }
    }
  }

  // ─── B-6: 月次添削 提出リマインド ─────────────────────────────
  // 当月分が未提出で、 月末 -3 / 当日 / +3 のいずれか → 同日重複防止のため
  // reminder_key を「b6_audit_YYYY-MM-{stage}」 形式で日付混在防止
  {
    const monthEnd = endOfMonth(now);
    const daysUntilMonthEnd = daysBetween(now, monthEnd);
    let stage: string | null = null;
    if (daysUntilMonthEnd === 3) stage = "3d_before";
    else if (daysUntilMonthEnd === 0) stage = "due";
    else if (daysUntilMonthEnd === -3) stage = "overdue_3d";

    if (stage) {
      const targetMonth = startOfMonth(now).toISOString().slice(0, 10);
      // 当月 audit 取得 (= 未提出か判定)
      const { data: audit } = await supabase
        .from("monthly_audits")
        .select("submitted_at")
        .eq("user_id", user.id)
        .eq("target_month", targetMonth)
        .maybeSingle();
      const notSubmitted = !audit || !(audit as { submitted_at?: string }).submitted_at;
      if (notSubmitted) {
        const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
        const key = `b6_audit_${targetMonth}_${stage}`;
        // 同月同 stage の重複防止 (cooldown 不要、 stage 固有日にのみ走る)
        const { data: existing } = await supabase
          .from("reminder_log")
          .select("id")
          .eq("user_id", user.id)
          .eq("reminder_key", key)
          .maybeSingle();
        if (!existing) {
          const titleAndBody = (() => {
            if (stage === "3d_before") {
              return {
                title: `${monthLabel} の月次添削 期限 3 日前`,
                body: "提出 → のり氏動画返信。 今のうちに記入を始めましょう",
              };
            }
            if (stage === "due") {
              return {
                title: `${monthLabel} の月次添削 本日が期限`,
                body: "今日中に提出すると今月分の添削動画を受け取れます",
              };
            }
            return {
              title: `${monthLabel} の月次添削 期限超過`,
              body: "まだ提出できます。 早めに記入してご提出ください",
            };
          })();
          await sendPushToUser(user.id, {
            ...titleAndBody,
            url: "/monthly-review/form",
            tag: key,
          });
          await logSent(supabase, user.id, key);
          result.sent.push(key);
        } else {
          result.skipped.push(key);
        }
      }
    }
  }

  return result;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  // 翌月 0 日 = 当月最終日
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
