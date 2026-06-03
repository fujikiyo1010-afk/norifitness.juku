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
 * - recording_ready: 録画準備中 (Step 9b で MediaRecorder 起動)
 * - recording: 録画中
 * - preview: プレビュー
 *
 * URL は /admin/monthly-reviews/[id] のまま (mode は state のみで管理、
 * URL は変えない設計 = 「一画面で完結」目的のため、合意 2026-05-27)。
 *
 * 録画完了 Blob は normal モードに持ち越して動画返信エリアでプレビュー表示。
 * Step 9c で「送信」ボタンから Vimeo にアップロードする。
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
  /** 戻り先 (ハブ or 受信箱)。?from=hub & user_id=xxx で自動判定 */
  back: {
    href: string;
    label: string;
    isHub: boolean;
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

export type RecordedVideo = {
  blob: Blob;
  mimeType: string;
  durationSec: number;
};

export function DetailClient({ data }: { data: DetailViewData }) {
  const [mode, setMode] = useState<DetailMode>("normal");
  const [recorded, setRecorded] = useState<RecordedVideo | null>(null);

  // 録画モードを採用 (採用ボタン押下時)
  const handleAccept = (video: RecordedVideo) => {
    setRecorded(video);
    setMode("normal");
  };

  // 録画モード終了 (採用前に「← 録画モードを終了」)
  const handleExit = () => {
    setMode("normal");
  };

  // 通常モードで「録画済み」を破棄 (録り直したい)
  const handleDiscardRecorded = () => {
    setRecorded(null);
  };

  // ファイル選択 (Step 9e)。スマホ動画や他ツールで撮ったファイルを recorded として受け入れる
  const handleSelectFile = (video: RecordedVideo) => {
    setRecorded(video);
  };

  return (
    <main className="min-h-screen bg-[#e8ebec] p-6">
      <div className="max-w-[1400px] mx-auto bg-white border border-[#e8ebe9] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,.08)] overflow-hidden">
        {mode === "normal" ? (
          <NormalView
            data={data}
            recorded={recorded}
            onStartRecording={() => setMode("recording_ready")}
            onSelectFile={handleSelectFile}
            onDiscardRecorded={handleDiscardRecorded}
          />
        ) : (
          <RecordingView
            data={data}
            mode={mode}
            onChangeMode={setMode}
            onAccept={handleAccept}
            onExit={handleExit}
          />
        )}
      </div>
    </main>
  );
}
