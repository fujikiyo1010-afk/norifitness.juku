import { createClient } from "@/lib/supabase/server";
import type {
  SupportMessage,
  SupportTicket,
  TicketListItem,
  TicketStatus,
} from "./types";

/**
 * お問い合わせ窓口(/support) 受講生側の読み取り (2026-08-27 新設)
 *
 * RLS: support_tickets / support_messages とも「自分の件だけ」。
 * 写真は private バケット support-photos なので、表示のたび署名URLを作る。
 */

const SUBJECT_MAX = 40;

function toSubject(body: string): string {
  const t = (body ?? "").replace(/\s+/g, " ").trim();
  if (t.length === 0) return "お問い合わせ";
  return t.length <= SUBJECT_MAX ? t : t.slice(0, SUBJECT_MAX - 1) + "…";
}

/** 自分のお問い合わせ一覧 (新しい順) */
export async function listMyTickets(): Promise<TicketListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, user_id, kind, screen, status, created_at, updated_at")
    .eq("user_id", user.id);

  const rows = (tickets ?? []) as SupportTicket[];
  if (rows.length === 0) return [];

  const { data: msgs } = await supabase
    .from("support_messages")
    .select("ticket_id, sender_kind, body, created_at")
    .in(
      "ticket_id",
      rows.map((t) => t.id)
    )
    .order("created_at", { ascending: true });

  const firstBody = new Map<string, string>();
  const lastAt = new Map<string, string>();
  const hasAdminReply = new Set<string>();
  for (const m of (msgs ?? []) as {
    ticket_id: string;
    sender_kind: string;
    body: string;
    created_at: string;
  }[]) {
    if (m.sender_kind === "user" && !firstBody.has(m.ticket_id)) {
      firstBody.set(m.ticket_id, m.body);
    }
    if (m.sender_kind === "admin") hasAdminReply.add(m.ticket_id);
    lastAt.set(m.ticket_id, m.created_at); // 昇順なので最後に入る値が最新
  }

  return rows
    .map((t) => ({
      ...t,
      subject: toSubject(firstBody.get(t.id) ?? t.kind),
      has_admin_reply: hasAdminReply.has(t.id),
      last_at: lastAt.get(t.id) ?? t.created_at,
    }))
    .sort((a, b) => b.last_at.localeCompare(a.last_at));
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
    .select("id, user_id, kind, screen, status, created_at, updated_at")
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
    subject: toSubject(firstUser?.body ?? (ticket as SupportTicket).kind),
    messages,
  };
}

/** 状態の表示名 (受講生向け。open と in_progress は「対応中」でひとまとめ) */
export function statusLabel(status: TicketStatus): string {
  return status === "resolved" ? "解決済み" : "対応中";
}
