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
 *   - アップロードは裏で 3 ステップで継続
 *   - 右下の UploadIndicator がジョブ状態を表示する
 *
 * アップロードフロー (2026-06-09 クライアント直アップ方式に変更):
 *   1. /api/vimeo/upload/create-link に動画メタを送る → upload_link + vimeoUri 取得
 *   2. upload_link に対して **直接 tus PATCH** で動画ファイル送信 (サーバー経由しない)
 *      → Next.js のメモリ制約 (~50MB) を回避、Vimeo Pro 上限 5GB まで安定
 *   3. /api/vimeo/upload/finalize で transcode 完了確認 + DB 更新
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
      // ===== Step 1/3: create-link で Vimeo 動画オブジェクト作成 =====
      const createRes = await fetch("/api/vimeo/upload/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: params.auditId,
          userName: params.userName,
          targetMonthLabel: params.targetMonthLabel,
          fileSize: params.blob.size,
        }),
      });
      if (!createRes.ok) {
        throw new Error(await extractError(createRes, "動画オブジェクト作成失敗"));
      }
      const createData = (await createRes.json()) as {
        ok: boolean;
        uploadLink: string;
        vimeoUri: string;
      };
      if (!createData.ok || !createData.uploadLink) {
        throw new Error("Vimeo upload_link を取得できませんでした");
      }

      // ===== Step 2/3: Vimeo に直接 tus PATCH (サーバー経由しない) =====
      const patchRes = await fetch(createData.uploadLink, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Offset": "0",
          "Content-Type": "application/offset+octet-stream",
        },
        body: params.blob,
      });
      if (patchRes.status !== 204) {
        throw new Error(`Vimeo アップロード失敗 (HTTP ${patchRes.status})`);
      }

      // ===== Step 3/3: finalize で transcode 待ち + DB 更新 =====
      const finalizeRes = await fetch("/api/vimeo/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: params.auditId,
          vimeoUri: createData.vimeoUri,
          durationSec: params.durationSec,
        }),
      });
      if (!finalizeRes.ok) {
        throw new Error(await extractError(finalizeRes, "DB 更新失敗"));
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

/**
 * Response からエラーメッセージを抽出 (JSON ボディに { error: "..." } があればそれを使う)。
 * JSON でない場合は HTTP ステータスを返す。
 */
async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error) return body.error;
  } catch {
    // JSON でない場合は fallback
  }
  return `${fallback} (HTTP ${res.status})`;
}
