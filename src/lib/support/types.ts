/**
 * お問い合わせ窓口(/support) 共有型 (2026-08-27 新設)
 *
 * 目的: アプリの不具合・動作や操作の相談を専用窓口1本に集約する
 * (チャット/LINE/エルメに散らばる問い合わせをここへ。返信はスレッド内で完結)。
 *
 * 2026-08-27 改: 「どんなことですか?」の3択は廃止(読めば分かる/対応が変わらない)。
 * 残すのは「どの画面か」だけ ─ これだけが「どこで起きたか」の往復1回分を消せる。
 */

export const SUPPORT_SCREENS = [
  "食事の記録",
  "筋トレ",
  "体重・体組成",
  "学習",
  "チャット",
  "ログイン",
  "その他",
] as const;

export type TicketStatus = "open" | "in_progress" | "resolved";

export type SupportTicket = {
  id: string;
  user_id: string | null;
  screen: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_kind: "user" | "admin";
  body: string;
  photo_path: string | null;
  created_at: string;
  /** photo_path から生成した署名URL(閲覧用・サーバで付与) */
  photo_url?: string | null;
};

/** 一覧1行ぶん(最初のメッセージ冒頭を件名がわりに使う) */
export type TicketListItem = SupportTicket & {
  subject: string;
  /** 未読の返事があるか(= 最新の admin メッセージ > 最後に開いた時刻) */
  unread: boolean;
  /** 最後のやりとりの時刻(一覧の並び順。受講生は updated_at を更新できないため) */
  last_at: string;
};
