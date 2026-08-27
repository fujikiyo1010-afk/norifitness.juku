import { createClient } from "@/lib/supabase/server";

/** サービス期間(日数)。開始日 + この日数 を過ぎたら満了版へ自動切替(C1)。 */
export const SERVICE_PERIOD_DAYS = 180;

/**
 * サービス期間(180日)満了ゲート
 * (2026-08-14 部分閉鎖 / 2026-08-19 自動切替C1 / 2026-08-26 grace対応C2)
 *
 * 判定の土台: users.service_started_at + 180日 を過ぎたら満了。全会員に自動適用。
 * その上に「特別(grace)」を個別に載せられる:
 *   - users.grace_until(date) … この日まで(JSTその日いっぱい)特別扱い
 *   - users.grace_scope … 'full'=通常まるごと維持 / 'meal'=満了版UI+食事添削だけ管理側で生かす
 * 期限が過ぎたら自動で純満了版へ落ちる(手作業なし)。
 *
 * 状態は4つ:
 *   active     … 期間内(通常版)
 *   grace_full … 180日は過ぎたが grace で通常版のまま(〜9/30組)
 *   grace_meal … 満了版UI + 食事添削だけ管理対象(田中/川口甲/木富/ももり)
 *   expired    … 純満了版(記録・学習・特典・過去閲覧のみ)
 *
 * 満了版で閉じるもの: 月次添削(提出) / フォーム添削 / カルテ更新系 / 目標シート(編集) / 要望フォーム
 * 満了版で残すもの: 記録系・週間トレ・カレンダー・学習・特典・過去の添削閲覧・
 *                   目標シート閲覧・カルテ閲覧・チャット(1日2通制限)
 *
 * 旧・手動メールリスト(川口甲/田中)は C2 で退役(自動判定+graceで表現できるため)。
 */
export type ServiceState = "active" | "grace_full" | "grace_meal" | "expired";

/** 純粋関数: 開始日と grace からサービス状態を計算(管理画面の一覧などでも再利用する) */
export function computeServiceState(
  started: string | null | undefined,
  graceUntil: string | null | undefined,
  graceScope: string | null | undefined,
  nowMs: number = Date.now(),
): ServiceState {
  if (!started) return "active"; // 開始日なし=判定不能は開けておく(発行時に必ず設定する運用)
  const expiredBase =
    nowMs >= new Date(started).getTime() + SERVICE_PERIOD_DAYS * 86_400_000;
  if (!expiredBase) return "active";
  if (graceUntil) {
    // date列(YYYY-MM-DD)。JSTでその日いっぱいまで有効
    const graceEnd = new Date(`${graceUntil}T23:59:59+09:00`).getTime();
    if (nowMs <= graceEnd) {
      return graceScope === "meal" ? "grace_meal" : "grace_full";
    }
  }
  return "expired";
}

/** ログイン中ユーザーのサービス状態を取得 */
export async function getMyServiceState(): Promise<ServiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "active";
  const { data } = await supabase
    .from("users")
    .select("service_started_at, grace_until, grace_scope")
    .eq("id", user.id)
    .maybeSingle();
  return computeServiceState(
    data?.service_started_at as string | null,
    data?.grace_until as string | null,
    data?.grace_scope as string | null,
  );
}

/**
 * 満了版UIを見せるか(既存8画面の呼び出し互換)。
 * grace_full は通常版のまま(false)。grace_meal は満了版UI(true)。
 */
export async function isServiceExpiredUser(): Promise<boolean> {
  const state = await getMyServiceState();
  return state === "expired" || state === "grace_meal";
}
