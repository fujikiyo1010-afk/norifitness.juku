/**
 * お問い合わせ窓口(/support) 共有型 (2026-08-27 新設)
 *
 * 目的: アプリの不具合・動作や操作の相談を専用窓口1本に集約する
 * (チャット/LINE/エルメに散らばる問い合わせをここへ。返信はスレッド内で完結)。
 */

export const SUPPORT_KINDS = [
  "うまく動かない",
  "使い方が分からない",
  "その他",
] as const;

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
  kind: string;
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
  /** 管理から返信が付いているか(一覧の「返信あり」表示用) */
  has_admin_reply: boolean;
  /** 最後のやりとりの時刻(一覧の並び順。受講生は updated_at を更新できないため) */
  last_at: string;
};
