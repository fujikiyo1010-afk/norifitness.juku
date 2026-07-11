import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { markAsShipped, undoShipped } from "@/lib/admin/shipment-actions";
import { ShipmentMarkButton, ShipmentUndoButton } from "./SubmitButton";

export const dynamic = "force-dynamic";

type ShipmentRow = {
  id: string;
  user_id: string;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string | null;
  recipient_name: string | null;
  status: "pending" | "shipped" | "cancelled";
  shipped_at: string | null;
  created_at: string;
  users?: { name: string; joined_at: string } | null;
};

type Search = { filter?: "all" | "pending" | "shipped" };

/**
 * 管理画面 ・ 発送管理 (プロテイン歓迎ギフト)
 *
 * モック: docs/03_design_mocks/recovered/管理画面_発送管理.html
 *
 * 抜け漏れ防止優先 ・ 「発送済」チェックで管理。
 * 取消可能 (誤操作対応)。
 */
export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.filter ?? "all";

  const admin = createAdminClient();
  let query = admin
    .from("shipments")
    .select(
      "id, user_id, postal_code, prefecture, city, address_line, recipient_name, status, shipped_at, created_at, users(name, joined_at)"
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("status", "pending");
  if (filter === "shipped") query = query.eq("status", "shipped");

  // S2: 一覧本体 + 件数3本は互いに独立→並列(4直列→1波)。挙動・受け取り方は不変。
  const [{ data: rawData }, { data: pendingCount }, { data: shippedCount }, { data: totalCount }] =
    await Promise.all([
      query,
      admin
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("status", "shipped"),
      admin.from("shipments").select("id", { count: "exact", head: true }),
    ]);
  const rows = ((rawData ?? []) as unknown) as ShipmentRow[];

  const pending = (pendingCount as unknown as { count: number })?.count ?? 0;
  const shipped = (shippedCount as unknown as { count: number })?.count ?? 0;
  const total = (totalCount as unknown as { count: number })?.count ?? 0;
  const percent = total > 0 ? Math.round((shipped / total) * 100) : 0;

  return (
    <div className="px-7 py-6 max-w-[1180px] mx-auto">
      {/* ヘッダー + 進捗 */}
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6b46c1]" />
            発送管理 (プロテイン歓迎ギフト)
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            新規入会者に 1 個ずつ発送 ・ 抜け漏れゼロを最優先
          </p>
        </div>
        {total > 0 && (
          <div className="flex flex-col items-end gap-1 min-w-[240px]">
            <div className="flex items-baseline gap-2.5 text-xs">
              <span className="font-mono font-bold text-[#004d40] text-sm">
                {shipped} / {total}
              </span>
              <span className="font-mono font-bold text-[#00695c]">
                {percent}%
              </span>
              <span className="text-orange-600 text-[11px] font-bold">
                未発送 {pending} 件
              </span>
            </div>
            <div className="w-[240px] h-1.5 bg-zinc-100 border border-[#e8ebe9] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00897b] to-[#00695c] rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* 案内 */}
      <div className="rounded-[10px] border border-[#b2dfdb] bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-4 py-3 mb-5 text-xs text-[#004d40] leading-relaxed flex gap-2 items-start">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 mt-0.5 text-[#00695c]"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <b>発送ルール:</b> 入会後 1 週間以内にプロテイン 1 個を発送。 オンボーディングで受講生が入力した住所を使用。
          完了後「発送済」チェックで漏れを防ぐ (取消可能)。
          <br />
          <span className="text-zinc-500">
            ※ 受講生側の住所入力 UI (オンボ Step 6) は別タスクで実装予定。 現状は発送データは集まりません。
          </span>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex gap-2 mb-4">
        <FilterTab label="すべて" count={total} active={filter === "all"} href="/admin/shipments" />
        <FilterTab label="未発送" count={pending} active={filter === "pending"} href="/admin/shipments?filter=pending" tone="pending" />
        <FilterTab label="発送済" count={shipped} active={filter === "shipped"} href="/admin/shipments?filter=shipped" />
      </div>

      {/* テーブル */}
      {rows.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-10 text-center">
          <div className="text-sm font-bold text-zinc-700 mb-1">
            {total === 0
              ? "まだ発送対象がありません"
              : "該当する発送がありません"}
          </div>
          <div className="text-xs text-zinc-500">
            {total === 0
              ? "受講生がオンボ Step 6 で住所を入力すると、 ここに発送リストが追加されます"
              : "フィルタを変えてみてください"}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e8ebe9] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-[#e8ebe9] text-[11px] font-bold text-zinc-500 tracking-widest">
                <th className="text-left px-4 py-3" style={{ width: "22%" }}>
                  受講生
                </th>
                <th className="text-left px-4 py-3" style={{ width: "40%" }}>
                  送り先住所
                </th>
                <th className="text-left px-4 py-3" style={{ width: "11%" }}>
                  入会日
                </th>
                <th className="text-left px-4 py-3" style={{ width: "13%" }}>
                  ステータス
                </th>
                <th className="text-left px-4 py-3" style={{ width: "14%" }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ShipmentRowComponent key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  href,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  tone?: "pending";
}) {
  const baseCls = active
    ? "bg-zinc-900 text-white border-zinc-900"
    : "bg-white text-zinc-700 border-[#e8ebe9] hover:border-[#00897b]";

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 border rounded-full text-xs font-semibold transition-colors ${baseCls}`}
    >
      {tone === "pending" && count > 0 && (
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
      )}
      {label}
      <span className="font-mono">{count}</span>
    </a>
  );
}

function ShipmentRowComponent({ row }: { row: ShipmentRow }) {
  const isShipped = row.status === "shipped";
  const userName = row.users?.name ?? "(不明)";
  const joinedAtLabel = row.users?.joined_at
    ? new Date(row.users.joined_at).toLocaleDateString("ja-JP")
    : "—";

  return (
    <tr
      className={`border-b border-[#e8ebe9] last:border-b-0 hover:bg-zinc-50 ${isShipped ? "opacity-60" : ""}`}
    >
      {/* 受講生 */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0 text-white ${isShipped ? "bg-zinc-400" : "bg-[#00897b]"}`}
          >
            {userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-zinc-900">{userName}</span>
            {/* 管E12: 発送前に本人情報・住所を確かめたい → 受講生ハブへ */}
            <Link
              href={`/admin/users/${row.user_id}`}
              className="text-[11px] font-bold text-[#00897b] hover:underline"
            >
              詳細 → ハブ
            </Link>
          </div>
        </div>
      </td>

      {/* 住所 */}
      <td className="px-4 py-3 text-[12px] text-zinc-700 leading-relaxed align-top">
        {row.postal_code && (
          <span className="font-mono text-[11px] text-zinc-500 mr-1.5">
            〒{row.postal_code}
          </span>
        )}
        {row.prefecture}
        {row.city}
        {row.address_line}
        {row.recipient_name && (
          <div className="text-[10px] text-zinc-500 mt-0.5">
            宛名: {row.recipient_name}
          </div>
        )}
      </td>

      {/* 入会日 */}
      <td className="px-4 py-3 text-[11px] text-zinc-600 font-mono align-top">
        {joinedAtLabel}
      </td>

      {/* ステータス */}
      <td className="px-4 py-3 align-top">
        {isShipped ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            発送済
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            未発送
          </span>
        )}
      </td>

      {/* 操作 */}
      <td className="px-4 py-3 align-top">
        {isShipped ? (
          <div className="flex flex-col items-start gap-1">
            {row.shipped_at && (
              <span className="text-[10px] text-zinc-500 font-mono">
                {new Date(row.shipped_at).toLocaleDateString("ja-JP")}
              </span>
            )}
            <form action={undoActionWith(row.id)}>
              <ShipmentUndoButton />
            </form>
          </div>
        ) : (
          <form action={markActionWith(row.id)}>
            <ShipmentMarkButton />
          </form>
        )}
      </td>
    </tr>
  );
}

function markActionWith(id: string) {
  return async () => {
    "use server";
    await markAsShipped(id);
  };
}

function undoActionWith(id: string) {
  return async () => {
    "use server";
    await undoShipped(id);
  };
}
