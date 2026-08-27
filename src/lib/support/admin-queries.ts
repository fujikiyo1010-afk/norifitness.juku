import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSubject } from "./queries";
import type { SupportMessage, SupportTicket, TicketStatus } from "./types";

/**
 * お問い合わせ窓口 ・ 管理側の読み取り (2026-08-27 新設)
 *
 * 指示書: _指示_管理画面_お問い合わせ窓口_2026-08-27.md
 * 補足  : _共有_管理画面へ_お問い合わせ動線と経緯_2026-08-27.md
 *
 * ・RLS が support_tickets/support_messages とも「admin all」なので通常の
 *   サーバクライアントで読める(service_role は不要)。受講生名の解決だけ
 *   users を跨ぐため admin client を使う。
 * ・件名は受講生側と同じ toSubject() を共用する(表記がズレないように)。
 * ・「受講生が読んだか」は support_ticket_reads と最新 admin メッセージの比較。
 * ・状態の意味 (トリガ trg_support_reopen_on_user_message により status が正になる):
 *     open        = 返信待ち  (新規 or 返信後に受講生が追記して戻ってきた) = こちらの番
 *     in_progress = 返信済み  (受講生の反応待ち)                           = 相手の番
 *     resolved    = 解決済み  (受講生は書けない)
 */

export type AdminTicketRow = {
  id: string;
  userId: string | null;
  userName: string;
  subject: string;
  screen: string | null;
  status: TicketStatus;
  createdAt: string;
  /** 最後のやりとり(並び順・経過時間の表示に使う) */
  lastAt: string;
  /** こちらが最後に返信した時刻(無ければ null) */
  lastAdminAt: string | null;
  hasPhoto: boolean;
  appVersion: string | null;
  platform: string | null;
  ua: string | null;
  /** こちらが返信済みの件だけ: 受講生がその返信を読んだか */
  studentRead: boolean | null;
  /** 返信後に受講生が追記して戻ってきた件 */
  isFollowUp: boolean;
};

type TicketRow = SupportTicket & { device_info: Record<string, unknown> | null };

/** 一覧(全件・最後のやりとりが新しい順)。タブの絞り込みは表示側で行う */
export async function listSupportTicketsForAdmin(): Promise<AdminTicketRow[]> {
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, user_id, screen, status, created_at, updated_at, device_info");

  const rows = (tickets ?? []) as TicketRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((t) => t.id);
  const userIds = Array.from(
    new Set(rows.map((t) => t.user_id).filter((v): v is string => !!v))
  );

  const admin = createAdminClient();
  const [{ data: msgs }, { data: reads }, { data: users }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("ticket_id, sender_kind, body, photo_path, created_at")
      .in("ticket_id", ids)
      .order("created_at", { ascending: true }),
    supabase.from("support_ticket_reads").select("ticket_id, read_at").in("ticket_id", ids),
    userIds.length > 0
      ? admin.from("users").select("id, name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameById = new Map<string, string>();
  for (const u of (users ?? []) as { id: string; name: string | null }[]) {
    nameById.set(u.id, u.name ?? "（名前なし）");
  }
  const readAt = new Map<string, string>();
  for (const r of (reads ?? []) as { ticket_id: string; read_at: string }[]) {
    readAt.set(r.ticket_id, r.read_at);
  }

  const firstBody = new Map<string, string>();
  const lastAt = new Map<string, string>();
  const lastAdminAt = new Map<string, string>();
  const lastUserAt = new Map<string, string>();
  const hasPhoto = new Set<string>();
  for (const m of (msgs ?? []) as {
    ticket_id: string;
    sender_kind: string;
    body: string;
    photo_path: string | null;
    created_at: string;
  }[]) {
    if (m.sender_kind === "user" && !firstBody.has(m.ticket_id)) {
      firstBody.set(m.ticket_id, m.body);
    }
    if (m.sender_kind === "admin") lastAdminAt.set(m.ticket_id, m.created_at);
    else lastUserAt.set(m.ticket_id, m.created_at);
    if (m.photo_path) hasPhoto.add(m.ticket_id);
    lastAt.set(m.ticket_id, m.created_at); // 昇順なので最後に入る値が最新
  }

  return rows
    .map((t) => {
      const dev = (t.device_info ?? {}) as Record<string, unknown>;
      const adminAt = lastAdminAt.get(t.id) ?? null;
      const userAt = lastUserAt.get(t.id) ?? null;
      const seenAt = readAt.get(t.id);
      const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
      return {
        id: t.id,
        userId: t.user_id,
        userName: t.user_id ? nameById.get(t.user_id) ?? "（不明）" : "アプリ外",
        subject: toSubject(firstBody.get(t.id) ?? ""),
        screen: t.screen,
        status: t.status,
        createdAt: t.created_at,
        lastAt: lastAt.get(t.id) ?? t.created_at,
        lastAdminAt: adminAt,
        hasPhoto: hasPhoto.has(t.id),
        appVersion: str(dev.app_version),
        platform: str(dev.platform),
        ua: str(dev.ua),
        studentRead: adminAt ? !!seenAt && seenAt >= adminAt : null,
        // 返信済みなのに、そのあと受講生が書いた = 戻ってきた件
        isFollowUp: !!adminAt && !!userAt && userAt > adminAt,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** サイドバーの赤バッジ = 返信待ち(open)の件数。解決済みは含まない */
export async function countOpenSupportTickets(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}

export type AdminTicketDetail = {
  ticket: SupportTicket & { device_info: Record<string, unknown> | null };
  userName: string;
  userEmail: string | null;
  subject: string;
  messages: SupportMessage[];
  /** 受講生が最後にこの件を開いた時刻 */
  readAt: string | null;
};

/** 1件の詳細(本文 + 写真の署名URL付き) */
export async function getSupportTicketForAdmin(
  ticketId: string
): Promise<AdminTicketDetail | null> {
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, screen, status, created_at, updated_at, device_info")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return null;
  const t = ticket as TicketRow;

  const [{ data: rows }, { data: read }] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, ticket_id, sender_kind, body, photo_path, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase
      .from("support_ticket_reads")
      .select("read_at")
      .eq("ticket_id", ticketId)
      .maybeSingle(),
  ]);

  const messages = (rows ?? []) as SupportMessage[];
  const paths = messages.map((m) => m.photo_path).filter((p): p is string => !!p);
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

  let userName = "アプリ外";
  let userEmail: string | null = null;
  if (t.user_id) {
    const admin = createAdminClient();
    const { data: u } = await admin
      .from("users")
      .select("name, email")
      .eq("id", t.user_id)
      .maybeSingle();
    const row = u as { name?: string | null; email?: string | null } | null;
    userName = row?.name ?? "（不明）";
    userEmail = row?.email ?? null;
  }

  const firstUser = messages.find((m) => m.sender_kind === "user");

  return {
    ticket: t,
    userName,
    userEmail,
    subject: toSubject(firstUser?.body ?? ""),
    messages,
    readAt: (read as { read_at?: string } | null)?.read_at ?? null,
  };
}
