export type Conversation = {
  id: string;
  user_id: string;
  created_at: string;
  last_message_at: string;
  last_read_at_user: string | null;
  last_read_at_admin: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_kind: "user" | "admin";
  sender_id: string;
  body: string;
  created_at: string;
  // 画像添付(段4・管理者送信のみ)。chat-images バケットのパス。
  image_path?: string | null;
  image_thumb_path?: string | null;
  // サーバで付与する署名URL(表示用)。30日超は image_expired=true で URL は null。
  image_url?: string | null;
  image_thumb_url?: string | null;
  image_expired?: boolean;
};

/** admin 受信箱 行 */
export type AdminConversationRow = {
  conversation: Conversation;
  user_name: string;
  user_email: string;
  last_message_body: string | null;
  last_message_sender: "user" | "admin" | null;
  unread_count: number; // 未対応の受講生メッセージ数(最後の対応より後)
  unhandled: boolean; // 未対応(受講生の最終発言が返信/完了より後)= 一覧で強調・バッジ対象
};
