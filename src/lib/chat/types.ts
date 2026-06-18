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
};

/** admin 受信箱 行 */
export type AdminConversationRow = {
  conversation: Conversation;
  user_name: string;
  user_email: string;
  last_message_body: string | null;
  last_message_sender: "user" | "admin" | null;
  unread_count: number; // admin 視点 (= 受講生からの未読数)
};
