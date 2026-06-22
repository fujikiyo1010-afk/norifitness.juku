import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddAdminForm } from "./AddAdminForm";
import { ToggleActiveButton } from "./ToggleActiveButton";

export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  is_active: boolean;
  created_at: string;
};

/**
 * 管理画面 ・ 管理者管理 (/admin/admins)
 *
 * 役割:
 *   - 既存管理者一覧表示 (= 名前 / メアド / 役割 / 有効/無効)
 *   - superadmin が新規管理者を追加できる
 *   - superadmin が他の管理者を 有効/無効 トグルできる (= 自分自身は禁止)
 *
 * デザイン: 既存 /admin/invitations のスタイルに準拠 (= ティール緑 アクセント)
 */
export default async function AdminsPage() {
  const caller = await requireAdmin();
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("admin_users")
    .select("id, email, name, role, is_active, created_at")
    .order("created_at", { ascending: true });

  const list = (rows ?? []) as AdminRow[];
  const activeCount = list.filter((r) => r.is_active).length;
  const inactiveCount = list.length - activeCount;
  const isSuperadmin = caller.role === "superadmin";

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">管理者の管理</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {isSuperadmin
            ? "管理者を追加 / 無効化できます (= superadmin 権限)"
            : "現在の管理者一覧を表示します (= admin 権限の閲覧のみ)"}
        </p>
      </header>

      {/* 追加フォーム (= superadmin のみ) */}
      {isSuperadmin ? (
        <section className="bg-gradient-to-br from-white to-[#e0f2f1]/30 border border-[#b2dfdb] rounded-[12px] p-5 mb-7">
          <h2 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00897b]" />
            管理者を追加
          </h2>
          <AddAdminForm />
        </section>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 mb-5">
          管理者の追加 / 無効化 は superadmin 権限が必要です。
        </div>
      )}

      {/* 一覧 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-zinc-900">管理者 一覧</h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            全 {list.length} 件 (有効 {activeCount} / 無効 {inactiveCount})
          </span>
        </div>

        {list.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-8 text-center text-sm text-zinc-500">
            管理者がまだ登録されていません
          </div>
        ) : (
          <div className="bg-white border border-[#e8ebe9] rounded-[10px] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#e8ebe9] text-[11px] font-bold text-zinc-500 tracking-widest">
                  <th className="text-left px-4 py-3" style={{ width: "20%" }}>
                    氏名
                  </th>
                  <th className="text-left px-3 py-3" style={{ width: "30%" }}>
                    メールアドレス
                  </th>
                  <th className="text-left px-3 py-3" style={{ width: "15%" }}>
                    役割
                  </th>
                  <th className="text-left px-3 py-3" style={{ width: "15%" }}>
                    状態
                  </th>
                  <th className="text-left px-3 py-3" style={{ width: "10%" }}>
                    登録日
                  </th>
                  <th className="text-right px-4 py-3" style={{ width: "10%" }}>
                    {isSuperadmin ? "操作" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#e8ebe9] last:border-b-0 hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      {row.name}
                    </td>
                    <td className="px-3 py-3 text-[12px] font-mono text-[#00695c] break-all">
                      {row.email}
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={row.role} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge active={row.is_active} />
                    </td>
                    <td className="px-3 py-3 text-[11px] text-zinc-600 font-mono">
                      {formatJst(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuperadmin ? (
                        <ToggleActiveButton
                          adminId={row.id}
                          isActive={row.is_active}
                          isSelf={row.id === caller.id}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: "superadmin" | "admin" }) {
  if (role === "superadmin") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 border border-violet-200">
        superadmin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
      admin
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        有効
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      無効
    </span>
  );
}

function formatJst(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
