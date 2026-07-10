import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ログイン中の受講生が「初回フォーム添削 完了済み」か。
 * false = 初回無料URL / true = 2回目以降(有料)URL に飛ばす。
 * 切替は管理画面(受講生ハブ)のトグルで手動。
 */
export async function getFormReviewFirstDone(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("form_review_first_done")
    .eq("id", user.id)
    .maybeSingle();
  return data?.form_review_first_done === true;
}
