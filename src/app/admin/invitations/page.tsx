import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * 管理画面 ・ 招待 (マジックリンク発行)
 *
 * モック: docs/03_design_mocks/recovered/管理画面_招待マジックリンク.html
 *
 * Supabase Auth の招待メール = リンク方式 = magic link 同等。
 * ステータスはカラードット (発行中 / 登録済 / 期限切れ) で統一。
 */
export default async function AdminInvitationsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, name, expires_at, accepted_at, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = (invitations ?? []) as InvitationRow[];

  const counts = list.reduce(
    (acc, inv) => {
      const now = Date.now();
      if (inv.accepted_at) acc.registered++;
      else if (new Date(inv.expires_at).getTime() < now) acc.expired++;
      else acc.pending++;
      return acc;
    },
    { pending: 0, registered: 0, expired: 0 }
  );

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">
          招待 (マジックリンク発行)
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          新規受講生にマジックリンク付きメールを発行 ・ パスワード不要で登録完了
        </p>
      </header>

      {/* 新規招待ブロック */}
      <section className="bg-gradient-to-br from-white to-[#e0f2f1]/30 border border-[#b2dfdb] rounded-[12px] p-5 mb-7">
        <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00897b]" />
          新規招待
        </h2>
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mb-3 text-[11px] text-amber-800 leading-relaxed">
          <b>MVP 制限:</b> Resend ドメイン未認証のため、 現在は
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono">
            fujikiyo1010@gmail.com
          </code>
          にのみ送信可。 ドメイン認証後に解禁。
        </div>
        <InviteSendForm />
      </section>

      {/* 履歴 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-zinc-900">招待履歴</h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            全 {list.length} 件
          </span>
          <div className="ml-auto flex gap-1.5 text-[11px]">
            <FilterChip
              label="発行中"
              count={counts.pending}
              tone="pending"
            />
            <FilterChip
              label="登録済"
              count={counts.registered}
              tone="success"
            />
            <FilterChip
              label="期限切れ"
              count={counts.expired}
              tone="muted"
            />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
            まだ招待発行はありません
          </div>
        ) : (
          <div className="bg-white border border-[#e8ebe9] rounded-[10px] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#e8ebe9] text-[11px] font-bold text-zinc-500 tracking-widest">
                  <th className="text-left px-4 py-3" style={{ width: "30%" }}>
                    メールアドレス
                  </th>
                  <th className="text-left px-4 py-3" style={{ width: "20%" }}>
                    氏名
                  </th>
                  <th className="text-left px-4 py-3" style={{ width: "20%" }}>
                    発行日時
                  </th>
                  <th className="text-left px-4 py-3" style={{ width: "15%" }}>
                    {/* 余白 */}
                  </th>
                  <th className="text-left px-4 py-3" style={{ width: "15%" }}>
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((inv) => (
                  <InvitationRow key={inv.id} inv={inv} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "pending" | "success" | "muted";
}) {
  const cls =
    tone === "pending"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-zinc-50 text-zinc-500 border-zinc-200";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-semibold ${cls}`}
    >
      {label} {count}
    </span>
  );
}

function InvitationRow({ inv }: { inv: InvitationRow }) {
  const now = Date.now();
  const isAccepted = Boolean(inv.accepted_at);
  const isExpired = !isAccepted && new Date(inv.expires_at).getTime() < now;

  return (
    <tr className="border-b border-[#e8ebe9] last:border-b-0 hover:bg-zinc-50">
      <td className="px-4 py-3 text-[12px] font-mono text-[#00695c] break-all">
        {inv.email}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
        {inv.name}
      </td>
      <td className="px-4 py-3 text-[11px] text-zinc-600 font-mono">
        {formatJst(inv.created_at)}
      </td>
      <td className="px-4 py-3 text-[11px] text-zinc-500">
        {isAccepted
          ? `承認: ${formatJst(inv.accepted_at!)}`
          : `期限: ${formatJst(inv.expires_at)}`}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          state={isAccepted ? "registered" : isExpired ? "expired" : "pending"}
        />
      </td>
    </tr>
  );
}

function StatusBadge({
  state,
}: {
  state: "pending" | "registered" | "expired";
}) {
  if (state === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        発行中
      </span>
    );
  }
  if (state === "registered") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        登録済
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      期限切れ
    </span>
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
