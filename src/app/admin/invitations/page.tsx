import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/login/actions";
import { InviteSendForm } from "./InviteSendForm";

export const dynamic = "force-dynamic";

type InvitationRow = {
  id: string;
  email: string;
  name: string;
  expires_at: string;
  accepted_at: string | null;
  user_id: string | null;
  created_at: string;
};

export default async function AdminInvitationsPage() {
  const me = await requireAdmin();

  const supabase = createAdminClient();
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, name, expires_at, accepted_at, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const list = (invitations ?? []) as InvitationRow[];

  return (
    <main className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500">管理画面</p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              👥 受講生招待
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {me.name} さん ({me.role}) としてログイン中
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/"
              className="text-sm text-zinc-600 dark:text-zinc-400 underline"
            >
              ← ホームへ
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            📨 新規招待を発行
          </h2>
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-xs text-amber-900 dark:text-amber-100">
            ⚠️ <strong>MVP 期間中の制限:</strong> 現在 Resend のドメイン未認証のため、
            <code className="mx-1 px-1 bg-amber-100 dark:bg-amber-900 rounded">fujikiyo1010@gmail.com</code>
            にしか招待メールを送信できません。他のメアド宛は Phase 3-D 完了後にドメイン認証で解禁。
          </div>
          <InviteSendForm />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            📋 招待履歴 ({list.length} 件)
          </h2>
          {list.length === 0 ? (
            <p className="text-sm text-zinc-500">まだ招待がありません</p>
          ) : (
            <ul className="space-y-2">
              {list.map((inv) => (
                <InvitationItem key={inv.id} inv={inv} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function InvitationItem({ inv }: { inv: InvitationRow }) {
  const now = Date.now();
  const isAccepted = Boolean(inv.accepted_at);
  const isExpired = !isAccepted && new Date(inv.expires_at).getTime() < now;

  const status = isAccepted
    ? { emoji: "✅", label: "登録済み", color: "emerald" as const }
    : isExpired
    ? { emoji: "⏰", label: "期限切れ", color: "zinc" as const }
    : { emoji: "📨", label: "送信済み・未開封", color: "blue" as const };

  return (
    <li className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="font-medium text-zinc-900 dark:text-zinc-50">{inv.name}</div>
          <div className="text-zinc-600 dark:text-zinc-400 break-all">{inv.email}</div>
          <div className="text-xs text-zinc-500">
            発行: {formatJst(inv.created_at)}
            {isAccepted && ` / 承認: ${formatJst(inv.accepted_at!)}`}
            {!isAccepted && ` / 期限: ${formatJst(inv.expires_at)}`}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            status.color === "emerald"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
              : status.color === "blue"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {status.emoji} {status.label}
        </span>
      </div>
    </li>
  );
}

function formatJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
