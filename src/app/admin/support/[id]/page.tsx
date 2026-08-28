import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getSupportTicketForAdmin } from "@/lib/support/admin-queries";
import { currentAppVersion } from "@/lib/support/app-version";
import { SupportThread } from "./SupportThread";

export const dynamic = "force-dynamic";

/**
 * 管理画面 お問い合わせ ・ 詳細(右側)。
 * 一覧は layout(SupportShell)が持つので、ここは選ばれた1件だけを描く。
 */
export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const data = await getSupportTicketForAdmin(id);
  if (!data) notFound();

  const dev = (data.ticket.device_info ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  const appVersion = str(dev.app_version);
  const now = currentAppVersion();
  const stale = !!now && !!appVersion && appVersion !== now;

  const statusPill =
    data.ticket.status === "open"
      ? { label: "未対応", cls: "bg-amber-50 text-amber-700 border-amber-200" }
      : data.ticket.status === "in_progress"
        ? { label: "対応中", cls: "bg-[#eef6f4] text-[#00695c] border-[#cfe3df]" }
        : { label: "解決済み", cls: "bg-[#e3f4ec] text-[#2f9e78] border-[#b7e4d0]" };

  return (
    <>
      {/* ヘッダ */}
      <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[#e8ebe9] bg-white px-5 py-2.5">
        <span className="text-[15px] font-bold text-zinc-900">{data.userName} さん</span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${statusPill.cls}`}
        >
          {statusPill.label}
        </span>
        <span className="text-[11px] text-zinc-500">返信はアプリ内に届きます</span>
        <div className="ml-auto flex items-center gap-2">
          {data.ticket.user_id && (
            <Link
              href={`/admin/users/${data.ticket.user_id}`}
              className="rounded-md border border-[#e8ebe9] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#00695c] transition-colors hover:border-[#00897b] hover:bg-[#00897b]/10"
            >
              受講生ページへ
            </Link>
          )}
        </div>
      </header>

      {/* 環境の帯 */}
      <div className="flex flex-shrink-0 flex-wrap gap-x-6 gap-y-1 border-b border-[#e8ebe9] bg-white px-5 py-2">
        <Env k="画面" v={data.ticket.screen ?? "—"} />
        <Env k="端末" v={str(dev.platform) ?? "—"} />
        <Env
          k="アプリの版"
          v={
            appVersion
              ? stale
                ? `${appVersion}　⚠ 古い版（本番は ${now}）`
                : appVersion
              : "—"
          }
          warn={stale}
        />
        <Env k="最初の送信" v={jstDateTime(data.ticket.created_at)} mono />
        {str(dev.ua) && <Env k="UA" v={str(dev.ua) as string} mono dim />}
      </div>

      <SupportThread
        ticketId={data.ticket.id}
        status={data.ticket.status}
        messages={data.messages}
        readAt={data.readAt}
      />
    </>
  );
}

function Env({
  k,
  v,
  warn,
  mono,
  dim,
}: {
  k: string;
  v: string;
  warn?: boolean;
  mono?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="text-[11px]">
      <span className="mr-1.5 font-bold text-zinc-400">{k}</span>
      <span
        className={`font-bold ${warn ? "text-[#c2410c]" : dim ? "text-zinc-400" : "text-zinc-700"} ${
          mono ? "font-mono" : ""
        }`}
      >
        {v}
      </span>
    </div>
  );
}

/** JST で 月/日 時:分 (サーバはUTCで動くので必ず +9h) */
function jstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
