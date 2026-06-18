"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUploadJob } from "@/lib/upload/UploadJobContext";

/**
 * UploadIndicator: 右下にフローティング表示する月次添削動画送信状態。
 *
 * 表示モード:
 *   - uploading: スピナー + 「○○さんの動画を送信中...」
 *   - success: 緑チェック + 「○○さんに送信完了」 (4 秒後フェードアウト)
 *   - error: 赤バツ + エラー内容 + リトライ/破棄ボタン
 *
 * status が idle の時は何も表示しない (DOM に存在しない)。
 */
export function UploadIndicator() {
  const { job, retry, dismiss } = useUploadJob();
  const router = useRouter();
  const prevStatusRef = useRef(job.status);

  // uploading → success に変わった瞬間に受信箱を自動 refresh
  // (受信箱の楽観表示が本物の DB データに置換される)
  useEffect(() => {
    if (prevStatusRef.current === "uploading" && job.status === "success") {
      router.refresh();
    }
    prevStatusRef.current = job.status;
  }, [job.status, router]);

  if (job.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {job.status === "uploading" && (
        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
          <Spinner />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#2b2620] mb-0.5">
              送信中
            </div>
            <div className="text-[11px] text-zinc-600 truncate">
              {job.userName} さんの動画を Vimeo に送信中...
            </div>
          </div>
        </div>
      )}

      {job.status === "success" && (
        <div
          className="bg-[#e0f2f1] border border-[#4a875b] rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 animate-fade-in cursor-pointer"
          onClick={() => {
            dismiss();
            router.refresh();
          }}
          title="クリックで閉じる"
        >
          <div className="w-8 h-8 rounded-full bg-[#4a875b] text-white flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#004d40] mb-0.5">
              送信完了
            </div>
            <div className="text-[11px] text-[#34603f] truncate">
              {job.userName} さんに動画を配信しました
            </div>
          </div>
        </div>
      )}

      {job.status === "error" && (
        <div className="bg-[#fffdf8] border border-[#d32f2f] rounded-xl shadow-lg px-4 py-3 flex flex-col gap-2 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#fef5f5] text-[#d32f2f] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#d32f2f] mb-0.5">
                送信失敗
              </div>
              <div className="text-[11px] text-zinc-700 break-words">
                {job.userName} さんの動画送信に失敗: {job.errorMessage}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={dismiss}
              className="text-[11px] px-3 py-1.5 bg-[#fffdf8] text-zinc-600 border border-[#e7dcc9] rounded-md hover:bg-zinc-100"
            >
              破棄
            </button>
            <button
              onClick={retry}
              className="text-[11px] px-3 py-1.5 bg-[#4a875b] text-white rounded-md hover:bg-[#34603f]"
            >
              リトライ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
      <div className="w-5 h-5 border-2 border-[#e7dcc9] border-t-[#4a875b] rounded-full animate-spin" />
    </div>
  );
}
