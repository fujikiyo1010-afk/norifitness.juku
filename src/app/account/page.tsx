import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { EmailNotificationToggle } from "./EmailNotificationToggle";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

/**
 * 設定画面 ・ /account (2026-06-17 線① 新設)
 *
 * 設計元: docs/03_design_mocks/latest/タブ残り_検索_設定_LINE.html L104-195
 *
 * 構成:
 *   - プロフィールカード (アバター / 氏名 / メール)  → /account/profile
 *   - アカウント
 *       - プロフィール編集    → /account/profile
 *       - パスワード変更      → 準備中 (マジックリンク認証なので不要)
 *       - メールアドレス変更  → 準備中 (Supabase auth flow 別実装)
 *   - 通知
 *       - アプリ通知          → 準備中 (push 基盤未実装)
 *       - メール通知          → 実機トグル (users.email_notification_enabled)
 *       - LINE 連携           → 準備中 (Phase 4 LINE Bot 連携)
 *   - その他
 *       - ヘルプ              → /account/help
 *       - 利用規約            → /account/terms
 *       - プライバシーポリシー → /account/privacy
 *   - ログアウト (赤字)
 *   - v1.0.0 表示
 *
 * ホーム右上の緑丸プロフィールアイコン (src/app/page.tsx) + 下部ナビ「設定」 (MemberBottomNav.tsx)
 * の両方から流入する。
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, email_notification_enabled")
    .eq("id", user.id)
    .maybeSingle();

  const name = (profile?.name as string | null) ?? "受講生";
  const email = (profile?.email as string | null) ?? user.email ?? "";
  const emailNotificationEnabled = Boolean(
    profile?.email_notification_enabled ?? true
  );

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <MemberHeader title="設定" />

        {/* プロフィールカード */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href="/account/profile"
            className="block bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-4 hover:border-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#f8f9fa] flex items-center justify-center text-base font-bold text-zinc-700 border border-[#e7dcc9]">
                {name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#2b2620] truncate">
                  {name}
                </div>
                <div className="text-[11px] text-[#6a6256] mt-0.5 truncate">
                  {email}
                </div>
              </div>
              <span className="text-[#a59b8c] text-sm">→</span>
            </div>
          </Link>
        </div>

        {/* アカウント (アプリ通知 / LINE 連携 = 線② で復活、 メール変更 = 明日実装) */}
        <Section title="アカウント">
          <LinkRow icon={<UserIcon />} label="プロフィール編集" href="/account/profile" />
          <LinkRow icon={<LockIcon />} label="パスワード変更" href="/account/password" last />
        </Section>

        {/* 通知 */}
        <Section title="通知">
          <ToggleRow
            icon={<MailIcon />}
            label="メール通知"
            slot={<EmailNotificationToggle initial={emailNotificationEnabled} />}
            last
          />
        </Section>

        {/* その他 */}
        <Section title="その他">
          <LinkRow icon={<InfoIcon />} label="ヘルプ" href="/account/help" />
          <LinkRow icon={<DocIcon />} label="利用規約" href="/account/terms" />
          <LinkRow icon={<ShieldIcon />} label="プライバシーポリシー" href="/account/privacy" last />
        </Section>

        {/* ログアウト */}
        <div className="px-4 pt-4 pb-4">
          <LogoutButton />
        </div>

        <p className="text-center text-[10px] text-[#a59b8c] font-mono mb-6">
          のりfitness 筋肉塾 ・ v1.0.0
        </p>
      </div>
    </main>
  );
}

// =====================================================================
// セクションコンテナ
// =====================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <div className="text-[10px] font-bold text-[#6a6256] tracking-widest mb-2">
        {title}
      </div>
      <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// =====================================================================
// 行 (リンク / 準備中 / トグル)
// =====================================================================

function LinkRow({
  icon,
  label,
  href,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-[#f9f5ed] transition-colors ${
        last ? "" : "border-b border-[#e7dcc9]"
      }`}
    >
      <span className="w-4 h-4 text-zinc-700">{icon}</span>
      <span className="flex-1 text-[13px] text-[#2b2620]">{label}</span>
      <span className="text-[#a59b8c] text-sm">→</span>
    </Link>
  );
}

function ToggleRow({
  icon,
  label,
  slot,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  slot: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        last ? "" : "border-b border-[#e7dcc9]"
      }`}
    >
      <span className="w-4 h-4 text-zinc-700">{icon}</span>
      <span className="flex-1 text-[13px] text-[#2b2620]">{label}</span>
      {slot}
    </div>
  );
}

// =====================================================================
// 線画 SVG アイコン (絵文字禁止ルール準拠)
// =====================================================================

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
