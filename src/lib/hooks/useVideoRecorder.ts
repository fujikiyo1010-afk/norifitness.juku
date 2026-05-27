"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVideoRecorder: MediaRecorder API ラッパー。
 *
 * 設計元: /tmp/tech_check_mediarecorder.html (Tech Check 2 で検証済)
 * 採用方針:
 *   - MP4 優先のコーデック選択 (Safari 互換性のため)
 *   - 1 秒ごとに chunk 取得 (メモリ膨張対策)
 *   - 720p / 2.5 Mbps デフォルト
 *   - cleanup でカメラ確実停止 (バッテリー消費防止)
 */

export type RecorderState =
  | "idle"          // 何もしてない
  | "starting"      // カメラ起動中
  | "ready"         // カメラ起動完了、録画待ち
  | "recording"     // 録画中
  | "stopped";      // 録画停止、Blob 生成済

export type VideoRecorderHook = {
  state: RecorderState;
  videoStream: MediaStream | null;
  recordedBlob: Blob | null;
  recordedMimeType: string;
  elapsedSec: number;
  error: string | null;
  startCamera: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  stopCamera: () => void;
  discardRecording: () => void;
};

// Safari 互換のため MP4 を優先 (Tech Check 2 で確定)
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useVideoRecorder(): VideoRecorderHook {
  const [state, setState] = useState<RecorderState>("idle");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState<string>("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // カメラ起動
  const startCamera = useCallback(async () => {
    if (streamRef.current) return; // 既に起動中
    setState("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      setVideoStream(stream);
      setState("ready");
    } catch (e) {
      const err = e as Error;
      let msg = "カメラ起動に失敗しました";
      if (err.name === "NotAllowedError") {
        msg =
          "カメラの権限が拒否されました。ブラウザの設定からカメラ・マイクを許可してください。";
      } else if (err.name === "NotFoundError") {
        msg = "カメラデバイスが見つかりません。Web カメラを接続してください。";
      } else if (err.message) {
        msg = `${msg}: ${err.message}`;
      }
      setError(msg);
      setState("idle");
    }
  }, []);

  // 録画開始
  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      setError("カメラが起動していません");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("このブラウザは対応する動画形式がありません");
      return;
    }

    setError(null);
    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedMimeType(mimeType);
        setState("stopped");
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      recorder.start(1000); // 1 秒ごとに chunk 取得 (Tech Check 2 確定)
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      setState("recording");

      // 経過秒タイマー
      timerRef.current = setInterval(() => {
        setElapsedSec(
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        );
      }, 1000);
    } catch (e) {
      const err = e as Error;
      setError(`録画開始に失敗: ${err.message}`);
    }
  }, []);

  // 録画停止
  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }
    recorderRef.current.stop();
    // onstop ハンドラで blob 生成 + state を 'stopped' に
  }, []);

  // カメラ停止 (cleanup)
  const stopCamera = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setVideoStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current = null;
    setState("idle");
  }, []);

  // 録画破棄 (Blob を消す、カメラはそのまま起動状態を維持)
  const discardRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordedMimeType("");
    setElapsedSec(0);
    chunksRef.current = [];
    if (streamRef.current) {
      setState("ready");
    } else {
      setState("idle");
    }
  }, []);

  // ページ離脱時の cleanup
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    state,
    videoStream,
    recordedBlob,
    recordedMimeType,
    elapsedSec,
    error,
    startCamera,
    startRecording,
    stopRecording,
    stopCamera,
    discardRecording,
  };
}

/**
 * 経過秒数を "mm:ss" 形式に変換する補助関数。
 */
export function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
