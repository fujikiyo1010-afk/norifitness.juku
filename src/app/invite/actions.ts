"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { sendPushToUser } from "@/lib/push/send";

export type AcceptInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptInvitation(
  token: string,
  password: string
): Promise<AcceptInvitationResult> {
  // ───── 1. 入力バリデーション ─────
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, error: "招待トークンが無効です" };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "パスワードは 8 文字以上にしてください" };
  }

  const admin = createAdminClient();

  // ───── 2. トークン再検証(race condition 対策) ─────
  const { data: inv, error: invError } = await admin
    .from("invitations")
    .select("id, email, name, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (invError || !inv) {
    return { ok: false, error: "招待が見つかりませんでした" };
  }
  if (inv.accepted_at) {
    return { ok: false, error: "この招待は既に使用済みです" };
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "招待の有効期限が切れています" };
  }

  // ───── 3. Supabase Auth にユーザー作成 ─────
  // email_confirm: true で「メール確認済み」状態でアカウントを発行
  // (招待メール = メアド到達確認の代わり)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    user_metadata: { name: inv.name, invited_via: "invitations" },
  });

  if (createError || !created?.user) {
    // 既存メアドの場合のメッセージを丁寧に
    if (createError && /already (registered|exists)/i.test(createError.message)) {
      return {
        ok: false,
        error: "このメールアドレスは既に登録されています。ログイン画面からお進みください。",
      };
    }
    return {
      ok: false,
      error: createError?.message ?? "アカウント作成に失敗しました",
    };
  }

  const newUserId = created.user.id;

  // ───── 4. public.users 行作成 ─────
  const { error: usersError } = await admin.from("users").insert({
    id: newUserId,
    email: inv.email,
    name: inv.name,
    status: "active",
  });

  if (usersError) {
    // ロールバック: 作成した auth ユーザーを削除
    await admin.auth.admin.deleteUser(newUserId);
    return {
      ok: false,
      error: `ユーザー情報の登録に失敗しました: ${usersError.message}`,
    };
  }

  // ───── 4.5. user_profiles 空行を生成 ─────
  // 設計上 user_profiles は「カルテ提出時に birthday を upsert」「将来のプロフィール編集で
  // その他カラムを update」する受け皿。 行が無いと UPDATE 経路が成立しないため、 入会時点で
  // 空行 (birthday は NULL) を作っておく。 acceptInvitation 経由しない既存ユーザー向けには
  // カルテ提出 server action 側でも安全側に upsert する。
  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert({ user_id: newUserId }, { onConflict: "user_id" });

  if (profileError) {
    // 致命的ではない (カルテ提出時の upsert で復旧する)。 ログのみ。
    console.error("user_profiles 初期化失敗(致命的ではない):", profileError);
  }

  // ───── 5. invitations を accepted に更新 ─────
  const { error: updateError } = await admin
    .from("invitations")
    .update({
      accepted_at: new Date().toISOString(),
      user_id: newUserId,
    })
    .eq("id", inv.id);

  if (updateError) {
    // ここで失敗しても auth user / public.users は残す(再ログイン可能)
    console.error("invitations 更新失敗(致命的ではない):", updateError);
  }

  // ───── 6. 自動ログイン(Cookie に session を発行) ─────
  const server = await createServerClient();
  const { error: signInError } = await server.auth.signInWithPassword({
    email: inv.email,
    password,
  });

  if (signInError) {
    // アカウント作成は完了しているのでログイン画面へ誘導
    return {
      ok: false,
      error: `アカウント作成は完了しましたが、自動ログインに失敗しました。ログイン画面からお進みください: ${signInError.message}`,
    };
  }

  // ───── 6.5. Welcome 通知 (= 線① B-1 メール + Push、 失敗してもメイン処理は成功扱い) ─────
  //   - メール: email_notification_enabled に関係なく必ず送る (入会必須通知)
  //   - Push : この時点では subscription 未登録 (= 設定画面で許可後に登録される) ため、
  //            送信先 0 件で no-op になる。 初回は機能しないが将来の再ログイン等で意味出る。
  void sendWelcomeEmail({ email: inv.email, name: inv.name }).catch((e) =>
    console.error("[email] welcome failed", e)
  );
  void sendPushToUser(newUserId, {
    title: "ようこそ のりfitness 筋肉塾へ",
    body: `${inv.name} さん、 入会ありがとうございます。 まずは画面右下「設定」 から通知を有効にしてください`,
    url: "/account",
    tag: "welcome",
  }).catch((e) => console.error("[push] welcome failed", e));

  // ───── 7. オンボ判定リダイレクト ─────
  // 新規登録なので通常 shipments 行は無い = /onboarding へ
  // (念のため判定: 既に shipments 行があれば / へ)
  const { data: existingShipment } = await admin
    .from("shipments")
    .select("id")
    .eq("user_id", newUserId)
    .maybeSingle();

  if (existingShipment) {
    redirect("/");
  }
  redirect("/onboarding");
}
