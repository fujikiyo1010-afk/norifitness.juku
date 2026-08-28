import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getSupportTicketForAdmin } from "@/lib/support/admin-queries";
import { currentAppVersion } from "@/lib/support/app-version";
import { EnvBar } from "./EnvBar";
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

      {/* 環境の帯(画面/端末/送信 + 古い版の警告。版・UA等は折りたたみの中) */}
      <EnvBar
        screen={data.ticket.screen}
        platform={str(dev.platform)}
        sentAt={jstDateTime(data.ticket.created_at)}
        appVersion={appVersion}
        currentVersion={now}
        ua={str(dev.ua)}
        screenSize={str(dev.screen)}
        language={str(dev.language)}
        standalone={typeof dev.standalone === "boolean" ? dev.standalone : null}
      />

      <SupportThread
        ticketId={data.ticket.id}
        status={data.ticket.status}
        messages={data.messages}
        readAt={data.readAt}
      />
    </>
  );
}


/** JST で 月/日 時:分 (サーバはUTCで動くので必ず +9h) */
function jstDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
