import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingClient, type OnboardingVariant } from "./OnboardingClient";
import { DEMO_PANEL_ENABLED, DEMO_ACCOUNT_EMAILS } from "@/lib/demo-panel/demo";
import { computeServiceState } from "@/lib/auth/service-expired";
import { SUPPORT_PREVIEW_EMAILS } from "@/lib/auth/support-gate";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ onbo?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 注: shipments 行の有無による「2 回目以降スキップ」判定は廃止。
  //     理由: Server Action 完了で page.tsx が再実行される性質上、 Step 6 完了直後にも
  //     誤発火して Step 7/8 を飛ばし、 受講生がオンボ完了感を得られないバグになる。
  //     初回オンボへの誘導は /invite acceptInvitation 側で実施済み (新規ユーザーは確実に
  //     /onboarding 着地)。 既存ユーザーが手動で /onboarding を踏んだ場合は紹介画面が
  //     再表示されるだけで無害。

  // ニックネーム廃止 = users.name (or auth metadata の name) を受取人氏名のデフォルトに使う
  // 満了版の分岐用に service_started_at / grace も同時に取る
  const { data: profile } = await supabase
    .from("users")
    .select("name, service_started_at, grace_until, grace_scope")
    .eq("id", user.id)
    .maybeSingle();

  const defaultRecipientName =
    profile?.name ?? (user.user_metadata?.name as string | undefined) ?? "";

  // ── 満了版の判定 (2026-08-28・閉開仕様 決定4) ──
  // 満了(expired) と 特別食事(grace_meal) は短縮オンボ(お知らせ1ページ入り)。
  // 通常・特別フルは従来の8ステップのまま。
  const state = computeServiceState(
    (profile?.service_started_at as string | null) ?? null,
    (profile?.grace_until as string | null) ?? null,
    (profile?.grace_scope as string | null) ?? null
  );
  let variant: OnboardingVariant =
    state === "expired"
      ? "expired"
      : state === "grace_meal"
        ? "expired_meal"
        : "normal";

  // ── プレビュー切替 (スタッフのみ・実機/PCで見比べる用) ──
  //   ?onbo=manryo → 満了版 / ?onbo=meal → 満了+食事版 / ?onbo=normal → 通常
  //   プレビュー中はブラウザ関門も飛ばす(PWA外・PCでも全ステップを歩けるように)
  const { onbo } = await searchParams;
  const email = user.email?.toLowerCase() ?? "";
  const isStaff = SUPPORT_PREVIEW_EMAILS.includes(email);
  const isPreview = isStaff && !!onbo;
  if (isPreview) {
    variant =
      onbo === "manryo" ? "expired" : onbo === "meal" ? "expired_meal" : "normal";
  }

  // 撮影用デモ垢(dev限定)はブラウザ関門を飛ばし、PCでも8ステップを進められるようにする
  const skipEnvGate =
    isPreview ||
    (DEMO_PANEL_ENABLED &&
      DEMO_ACCOUNT_EMAILS.includes(user.email?.toLowerCase() ?? ""));

  return (
    <OnboardingClient
      defaultRecipientName={defaultRecipientName}
      skipEnvGate={skipEnvGate}
      variant={variant}
    />
  );
}
