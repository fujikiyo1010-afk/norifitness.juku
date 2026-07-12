import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 受講生の受信面「のりfitnessから」掲示板 / お知らせ一覧のデータ層（P2b-1）。
 *
 * ソース（既存テーブルを読むだけ・新テーブルなし）:
 *   - daily_feedbacks（sent・本人宛）… のりの日次ひとこと。本文をそのまま表示（着地なし）
 *   - announcements（sent）… 全体お知らせ。タップで /notices/[id] 詳細へ
 *
 * ※既読で薄くなる「NEW」制御は P2b-2（notifications テーブル）で追加。
 *   ここでは isNew は常に false（未実装）。
 */

export type BoardItemKind = "daily_feedback" | "announcement";

export type BoardItem = {
  kind: BoardItemKind;
  key: string;
  sortAt: string; // 並べ替え用の ISO 文字列
  dateLabel: string; // M/D
  title: string; // 掲示板の見出し（FBは本文冒頭 / お知らせは件名）
  body: string; // 全文
  href: string | null; // お知らせ=詳細URL / 日次FB=null（本文がそのまま中身）
  isNew: boolean; // P2b-2 で既読連動。今は false 固定
};

function mdLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "";
  return `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}`;
}

export async function getMyBoardItems(limit?: number): Promise<BoardItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const [fbRes, annRes, betaRes] = await Promise.all([
    admin
      .from("daily_feedbacks")
      .select("date, body, status")
      .eq("user_id", user.id)
      .eq("status", "sent")
      .order("date", { ascending: false })
      .limit(30),
    admin
      .from("announcements")
      .select("id, subject, body_text, sent_at")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(30),
    // 総2: ベータは日次FB行の着地を「その日の食事詳細」に揃える(バナー通知=細9と同じ)
    admin.from("users").select("is_beta").eq("id", user.id).maybeSingle(),
  ]);
  const isBeta = betaRes.data?.is_beta === true;

  const items: BoardItem[] = [];

  for (const f of fbRes.data ?? []) {
    const body = (f.body as string | null) ?? "";
    if (!body) continue;
    const date = f.date as string;
    items.push({
      kind: "daily_feedback",
      key: `fb-${date}`,
      sortAt: `${date}T20:00:00Z`,
      dateLabel: mdLabel(date),
      title: body,
      body,
      // 総2: ベータは食事詳細へ着地(通知と同じ)。非ベータは従来どおり本文がそのまま中身。
      href: isBeta ? `/meals?date=${date}` : null,
      isNew: false,
    });
  }

  for (const a of annRes.data ?? []) {
    const sentAt = (a.sent_at as string | null) ?? "";
    items.push({
      kind: "announcement",
      key: `ann-${a.id}`,
      sortAt: sentAt,
      dateLabel: mdLabel(sentAt.slice(0, 10)),
      title: a.subject as string,
      body: a.body_text as string,
      href: `/notices/${a.id as string}`,
      isNew: false,
    });
  }

  items.sort((x, y) => (x.sortAt < y.sortAt ? 1 : -1));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export type AnnouncementDetail = {
  id: string;
  subject: string;
  body_text: string;
  sentAtLabel: string;
};

export async function getAnnouncementForMember(
  id: string
): Promise<AnnouncementDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("announcements")
    .select("id, subject, body_text, sent_at, status")
    .eq("id", id)
    .eq("status", "sent")
    .maybeSingle();
  if (!data) return null;

  const sentAt = (data.sent_at as string | null) ?? "";
  const label = sentAt
    ? new Date(sentAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "";
  return {
    id: data.id as string,
    subject: data.subject as string,
    body_text: data.body_text as string,
    sentAtLabel: label,
  };
}
