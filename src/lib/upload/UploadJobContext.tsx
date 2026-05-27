"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * UploadJobContext: 月次添削動画のバックグラウンドアップロード状態管理。
 *
 * 用途: のり氏が「送信して終了」/「送信して次へ」を押した後、
 *   - クライアントは即座に画面遷移できる (体感ノータイム)
 *   - アップロードは裏で fetch promise として継続
 *   - 右下の UploadIndicator がジョブ状態を表示する
 *
 * 同時並行は 1 件のみ (uploading 中に startUpload 呼ばれたら新規無視)。
 * ブラウザ閉じる/リロードでジョブ中断 → 受講生情報は DB に書き込まれない
 *   (リトライは UploadIndicator のリトライボタンから手動再実行)
 */

export type UploadStatus = "idle" | "uploading" | "success" | "error";

type UploadParams = {
  auditId: string;
  userName: string;
  targetMonthLabel: string;
  blob: Blob;
  mimeType: string;
  durationSec: number;
};

type UploadJob = {
  status: UploadStatus;
  auditId: string | null;
  userName: string | null;
  errorMessage: string | null;
  pendingParams: UploadParams | null; // リトライ用
};

type UploadJobContextValue = {
  job: UploadJob;
  startUpload: (params: UploadParams) => void;
  retry: () => void;
  dismiss: () => void;
};

const initialJob: UploadJob = {
  status: "idle",
  auditId: null,
  userName: null,
  errorMessage: null,
  pendingParams: null,
};

const Context = createContext<UploadJobContextValue | null>(null);

export function UploadJobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<UploadJob>(initialJob);

  const runUpload = useCallback(async (params: UploadParams) => {
    setJob({
      status: "uploading",
      auditId: params.auditId,
      userName: params.userName,
      errorMessage: null,
      pendingParams: params,
    });

    try {
      const formData = new FormData();
      formData.append("auditId", params.auditId);
      formData.append("userName", params.userName);
      formData.append("targetMonthLabel", params.targetMonthLabel);
      formData.append("durationSec", String(params.durationSec));
      const ext = params.mimeType.includes("mp4") ? "mp4" : "webm";
      formData.append("file", params.blob, `recording.${ext}`);

      const res = await fetch("/api/vimeo/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody.error) errMsg = errBody.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(errMsg);
      }

      setJob((prev) => ({
        ...prev,
        status: "success",
        pendingParams: null,
      }));

      // 4 秒後に idle に戻して indicator を消す
      setTimeout(() => {
        setJob((prev) => (prev.status === "success" ? initialJob : prev));
      }, 4000);
    } catch (e) {
      const err = e as Error;
      setJob((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err.message ?? "送信失敗",
      }));
    }
  }, []);

  const startUpload = useCallback(
    (params: UploadParams) => {
      if (job.status === "uploading") {
        // 同時並行は禁止 (既に処理中なら無視)
        return;
      }
      runUpload(params);
    },
    [job.status, runUpload]
  );

  const retry = useCallback(() => {
    if (job.pendingParams && job.status === "error") {
      runUpload(job.pendingParams);
    }
  }, [job.pendingParams, job.status, runUpload]);

  const dismiss = useCallback(() => {
    setJob(initialJob);
  }, []);

  return (
    <Context.Provider value={{ job, startUpload, retry, dismiss }}>
      {children}
    </Context.Provider>
  );
}

export function useUploadJob() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useUploadJob must be used inside <UploadJobProvider>");
  }
  return ctx;
}
