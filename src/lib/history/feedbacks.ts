import { createClient } from "@/lib/supabase/server";

/**
 * 受講生「デイリー添削」ページ(P7・M17)のデータ。
 *  - 日次FB(daily_feedbacks sent・テキスト)＋月次添削(monthly_audits・動画返信)を時系列に混ぜる。
 *  - しおり(feedback_bookmarks)は日次FBのみ(日付で保存)。
 */

export type FeedbackItem =
  | {
      kind: "daily";
      date: string; // YYYY-MM-DD
      body: string;
      saved: boolean;
      monthKey: string; // YYYY-MM
    }
  | {
      kind: "monthly";
      date: string; // target_month(月初)
      monthLabel: string; // 「6月」
      monthKey: string;
    };

export type FeedbackTimeline = {
  items: FeedbackItem[];
  months: string[]; // 出現する YYYY-MM(新しい順)
  savedCount: number;
};

export async function getMyFeedbackTimeline(): Promise<FeedbackTimeline> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], months: [], savedCount: 0 };

  const [{ data: dailies }, { data: monthlies }, { data: marks }] = await Promise.all([
    supabase
      .from("daily_feedbacks")
      .select("date, body")
      .eq("status", "sent")
      .order("date", { ascending: false }),
    supabase
      .from("monthly_audits")
      .select("target_month, nori_video_published_at")
      .not("nori_video_published_at", "is", null)
      .order("target_month", { ascending: false }),
    supabase.from("feedback_bookmarks").select("fb_date"),
  ]);

  const savedSet = new Set(((marks ?? []) as { fb_date: string }[]).map((m) => m.fb_date));

  const items: FeedbackItem[] = [];
  for (const d of (dailies ?? []) as { date: string; body: string | null }[]) {
    if (!d.body) continue;
    items.push({
      kind: "daily",
      date: d.date,
      body: d.body,
      saved: savedSet.has(d.date),
      monthKey: d.date.slice(0, 7),
    });
  }
  for (const m of (monthlies ?? []) as { target_month: string }[]) {
    const monthKey = m.target_month.slice(0, 7);
    items.push({
      kind: "monthly",
      date: m.target_month,
      monthLabel: `${Number(monthKey.slice(5, 7))}月`,
      monthKey,
    });
  }

  // 日付降順(月次は月初なので同月の日次より下に来やすい=自然)
  items.sort((a, b) => b.date.localeCompare(a.date));

  const months = Array.from(new Set(items.map((i) => i.monthKey))).sort((a, b) =>
    b.localeCompare(a)
  );

  return { items, months, savedCount: savedSet.size };
}
