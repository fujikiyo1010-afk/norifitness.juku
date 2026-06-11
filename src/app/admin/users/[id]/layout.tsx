import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserHubTabs } from "./_components/UserHubTabs";

/**
 * 受講生ハブ画面 共通レイアウト
 *
 * モック準拠: docs/03_design_mocks/recovered/管理画面_受講生ハブ_マルチタブ.html
 *
 * 7 タブ: 概要 / 体組成推移 / 月次添削履歴 / 筋トレメニュー / カルテ / 目標シート / 学習進捗
 *
 * 既存サブルート (/carte, /goal-sheet, /menu, /match) は触らず、
 * layout でタブナビだけ被せる「最小侵襲」方針。
 * 概要タブ (page.tsx) の独自ヘッダーはそのまま温存。
 */
export default async function UserHubLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  // ユーザー存在確認のみ (sub ルートに不正な userId で来た場合 404)
  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) notFound();

  return (
    <>
      <UserHubTabs userId={userId} />
      {children}
    </>
  );
}
