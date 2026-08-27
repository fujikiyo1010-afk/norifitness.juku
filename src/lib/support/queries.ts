import { createClient } from "@/lib/supabase/server";
import { isSupportUser } from "@/lib/auth/support-gate";
import type { SupportMessage, SupportTicket, TicketListItem } from "./types";

/**
 * お問い合わせ窓口(/support) 受講生側の読み取り (2026-08-27 新設)
 *
 * RLS: support_tickets / support_messages とも「自分の件だけ」。
 * 写真は private バケット support-photos なので、表示のたび署名URLを作る。
 *
 * 未読の判定: その件の最新の admin メッセージ > support_ticket_reads.read_at
 * (読んだ記録が無ければ未読)。ホームの歯車と設定の行に出す印の元になる。
 */

const SUBJECT_MAX = 40;

function toSubject(body: string): string {
  const t = (body ?? "").replace(/\s+/g, " ").trim();
  if (t.length === 0) return "お問い合わせ";
  return t.length <= SUBJECT_MAX ? t : t.slice(0, SUBJECT_MAX - 1) + "…";
}

/** 自分のお問い合わせ一覧 (最後のやりとりが新しい順) */
export async function listMyTickets(): Promise<TicketListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, user_id, screen, status, created_at, updated_at")
    .eq("user_id", user.id);

  const rows = (tickets ?? []) as SupportTicket[];
  if (rows.length === 0) return [];

  const ids = rows.map((t) => t.id);

  const [{ data: msgs }, { data: reads }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("ticket_id, sender_kind, body, created_at")
      .in("ticket_id", ids)
      .order("created_at", { ascending: true }),
    supabase
      .from("support_ticket_reads")
      .select("ticket_id, read_at")
      .in("ticket_id", ids),
  ]);

  const readAt = new Map<string, string>();
  for (const r of (reads ?? []) as { ticket_id: string; read_at: string }[]) {
    readAt.set(r.ticket_id, r.read_at);
  }

  const firstBody = new Map<string, string>();
  const lastAt = new Map<string, string>();
  const lastAdminAt = new Map<string, string>();
  for (const m of (msgs ?? []) as {
    ticket_id: string;
    sender_kind: string;
    body: string;
    created_at: string;
  }[]) {
    if (m.sender_kind === "user" && !firstBody.has(m.ticket_id)) {
      firstBody.set(m.ticket_id, m.body);
    }
    if (m.sender_kind === "admin") lastAdminAt.set(m.ticket_id, m.created_at);
    lastAt.set(m.ticket_id, m.created_at); // 昇順なので最後に入る値が最新
  }

  return rows
    .map((t) => {
      const adminAt = lastAdminAt.get(t.id);
      const seenAt = readAt.get(t.id);
      return {
        ...t,
        subject: toSubject(firstBody.get(t.id) ?? "お問い合わせ"),
        unread: !!adminAt && (!seenAt || adminAt > seenAt),
        last_at: lastAt.get(t.id) ?? t.created_at,
      };
    })
    .sort((a, b) => b.last_at.localeCompare(a.last_at));
}

/**
 * 未読の返事があるか (ホーム右上の歯車の赤ドット / 設定の行の NEW ピル用)。
 * ページ表示のたびに呼ぶので、必要最小限の2クエリで済ませる。
 */
export async function hasUnreadSupportReply(): Promise<boolean> {
  if (!(await isSupportUser())) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("user_id", user.id);
  const ids = ((tickets ?? []) as { id: string }[]).map((t) => t.id);
  if (ids.length === 0) return false;

  const [{ data: adminMsgs }, { data: reads }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("ticket_id, created_at")
      .in("ticket_id", ids)
      .eq("sender_kind", "admin")
      .order("created_at", { ascending: true }),
    supabase
      .from("support_ticket_reads")
      .select("ticket_id, read_at")
      .in("ticket_id", ids),
  ]);

  const readAt = new Map<string, string>();
  for (const r of (reads ?? []) as { ticket_id: string; read_at: string }[]) {
    readAt.set(r.ticket_id, r.read_at);
  }
  const lastAdminAt = new Map<string, string>();
  for (const m of (adminMsgs ?? []) as {
    ticket_id: string;
    created_at: string;
  }[]) {
    lastAdminAt.set(m.ticket_id, m.created_at); // 昇順 = 最後が最新
  }

  for (const [ticketId, adminAt] of lastAdminAt) {
    const seenAt = readAt.get(ticketId);
    if (!seenAt || adminAt > seenAt) return true;
  }
  return false;
}

/** 1件のスレッド (本文 + 写真の署名URL付き)。自分の件でなければ null */
export async function getTicketThread(ticketId: string): Promise<{
  ticket: SupportTicket;
  subject: string;
  messages: SupportMessage[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, screen, status, created_at, updated_at")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) return null;

  const { data: rows } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender_kind, body, photo_path, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  const messages = (rows ?? []) as SupportMessage[];

  const paths = messages
    .map((m) => m.photo_path)
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("support-photos")
      .createSignedUrls(paths, 3600);
    const map = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) map.set(s.path, s.signedUrl);
    }
    for (const m of messages) {
      if (m.photo_path) m.photo_url = map.get(m.photo_path) ?? null;
    }
  }

  const firstUser = messages.find((m) => m.sender_kind === "user");

  return {
    ticket: ticket as SupportTicket,
    subject: toSubject(firstUser?.body ?? "お問い合わせ"),
    messages,
  };
}
