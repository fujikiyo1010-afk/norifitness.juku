"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveSignupRequest,
  rejectSignupRequest,
} from "./actions";

export type PendingSignupRequest = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export function PendingRequestsList({
  requests,
}: {
  requests: PendingSignupRequest[];
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#e8ebe9] bg-white p-6 text-center text-sm text-zinc-500">
        現在、 受講生からの申請はありません
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e8ebe9] rounded-[10px] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-[#e8ebe9] text-[11px] font-bold text-zinc-500 tracking-widest">
            <th className="text-left px-4 py-3" style={{ width: "20%" }}>
              申請日時
            </th>
            <th className="text-left px-4 py-3" style={{ width: "20%" }}>
              氏名
            </th>
            <th className="text-left px-4 py-3" style={{ width: "30%" }}>
              メールアドレス
            </th>
            <th className="text-right px-4 py-3" style={{ width: "30%" }}>
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <PendingRow key={req.id} req={req} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingRow({ req }: { req: PendingSignupRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    if (isPending) return;
    const confirmed = window.confirm(
      `${req.name} さん (${req.email}) のアカウント発行を承認しますか?\n\n承認すると、 アカウント有効化リンクが自動でメール送信されます。`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await approveSignupRequest(req.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleReject() {
    if (isPending) return;
    const reason = window.prompt(
      `${req.name} さん (${req.email}) の申請を却下します。\n\n却下理由を入力してください (管理画面のメモとして残ります):`
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      window.alert("却下理由を入力してください");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectSignupRequest(req.id, trimmed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <tr className="border-b border-[#e8ebe9] last:border-b-0 hover:bg-zinc-50">
        <td className="px-4 py-3 text-[11px] text-zinc-600 font-mono">
          {formatJst(req.created_at)}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
          {req.name}
        </td>
        <td className="px-4 py-3 text-[12px] font-mono text-[#00695c] break-all">
          {req.email}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md border border-zinc-300 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              却下
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md bg-[#00897b] hover:bg-[#00695c] text-xs font-bold text-white shadow-sm shadow-[#00897b]/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "処理中..." : "承認"}
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={4} className="px-4 py-2 bg-red-50 border-b border-red-200">
            <span className="text-[11px] text-red-700">{error}</span>
          </td>
        </tr>
      )}
    </>
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
