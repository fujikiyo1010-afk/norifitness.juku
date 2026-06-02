"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  handleCarteRequest,
  handleWorkoutRequest,
} from "@/lib/workout/actions";
import type {
  CarteRequestWithUser,
  WorkoutRequestWithUser,
} from "@/lib/workout/queries";

/**
 * リクエスト 1 件分のカード (Client Component)
 *
 * - 「対応する →」: 受講生ハブ画面に Link 遷移
 * - 「却下」: Server Action で status='dismissed' に更新後、router.refresh()
 *
 * 設計元: /tmp/admin_inbox_v1.html
 */
export function RequestCard({
  type,
  request,
}: {
  type: "carte" | "workout";
  request: CarteRequestWithUser | WorkoutRequestWithUser;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { user_info } = request;
  const userId = user_info.id;
  const hubHref = `/admin/users/${userId}`;

  function handleDismiss() {
    startTransition(async () => {
      const result =
        type === "carte"
          ? await handleCarteRequest({
              request_id: request.id,
              status: "dismissed",
            })
          : await handleWorkoutRequest({
              request_id: request.id,
              status: "dismissed",
            });
      if (result.ok) {
        router.refresh();
      } else {
        alert(`却下に失敗しました: ${result.message}`);
      }
    });
  }

  return (
    <article
      className={`px-5 py-4 border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 transition-colors grid grid-cols-[1fr_auto] gap-4 items-center ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div>
        <div className="mb-2 flex items-center gap-2.5">
          <Link
            href={hubHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-900 transition-colors"
          >
            {user_info.display_name}
            <span className="text-[11px] font-normal text-zinc-500">
              {user_info.age_band ?? "—"} / {user_info.gender ?? "—"}
            </span>
          </Link>
          <span className="text-[11px] text-zinc-400 font-mono">
            {formatRequestTime(request.created_at)}
          </span>
        </div>
        <div className="text-[13px] text-zinc-800 leading-relaxed bg-zinc-50 border-l-[3px] border-[#00897b] px-3.5 py-2.5 rounded-r-md whitespace-pre-wrap">
          {request.request_text}
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-[160px]">
        <Link
          href={hubHref}
          className="rounded-[4px] bg-amber-100 hover:bg-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-800 transition-colors"
        >
          対応する →
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          className="self-center rounded-[4px] border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
        >
          {isPending ? "..." : "却下"}
        </button>
      </div>
    </article>
  );
}

function formatRequestTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
