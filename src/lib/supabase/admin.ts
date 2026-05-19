import { createClient } from "@supabase/supabase-js";

// Service Role Key を使った管理用 Supabase クライアント
// このクライアントは RLS をバイパスする。Server-side でのみ使うこと。
// クライアント側に漏れると全データに直接アクセス可能になる致命的セキュリティ事故。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
