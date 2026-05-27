"use client";

import { useState } from "react";
import type { MonthlyAuditItems } from "@/lib/monthly-audit/types";
import { NormalView } from "./NormalView";
import { RecordingView } from "./RecordingView";

/**
 * 個別作業画面のクライアント側エントリー。
 * mode state で 4 つの表示モードを切り替える。
 *
 * - normal: Step 8 で実装した通常 UI (17 項目 + 動画返信エリア)
 * - recording_ready: 録画準備中 (Step 9a で UI スケルトン)
 * - recording: 録画中 (Step 9b で実装)
 * - preview: プレビュー (Step 9b で実装)
 *
 * URL は /admin/monthly-reviews/[id] のまま (mode は state のみで管理、
 * URL は変えない設計 = 「一画面で完結」目的のため、合意 2026-05-27)。
 */

export type DetailMode = "normal" | "recording_ready" | "recording" | "preview";

export type DetailViewData = {
  audit: {
    id: string;
    items: MonthlyAuditItems;
    targetMonth: string;
    monthLabel: string;
    daysSinceSubmit: number;
    avgScore: number | null;
  };
  user: {
    name: string;
    joinedAtLabel: string;
    monthsSinceJoin: number;
    initial: string;
  };
  pastReplied: Array<{
    id: string;
    targetMonthLabel: string;
    publishedDateLabel: string | null;
    durationLabel: string | null;
  }>;
  replyCount: number;
  remainingCount: number;
  nextAuditId: string | null;
  adminName: string;
  adminInitial: string;
};

export function DetailClient({ data }: { data: DetailViewData }) {
  const [mode, setMode] = useState<DetailMode>("normal");

  return (
    <main className="min-h-screen bg-[#e8ebec] p-6">
      <div className="max-w-[1400px] mx-auto bg-white border border-[#e8ebe9] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,.08)] overflow-hidden">
        {mode === "normal" ? (
          <NormalView
            data={data}
            onStartRecording={() => setMode("recording_ready")}
          />
        ) : (
          <RecordingView
            data={data}
            mode={mode}
            onChangeMode={setMode}
            onExitRecording={() => setMode("normal")}
          />
        )}
      </div>
    </main>
  );
}
