"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorkout } from "@/lib/workout/logs-actions";

/** メニュー開始ボタン(M14・押した日が1日目に固定) */
export function StartWorkoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startWorkout();
            if (!r.ok) {
              setError(r.message);
              return;
            }
            router.refresh();
          })
        }
        className="w-full rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "開始中…" : "この内容で開始する"}
      </button>
      {error && <p className="mt-1 text-[12px] text-red-700">❌ {error}</p>}
    </div>
  );
}
