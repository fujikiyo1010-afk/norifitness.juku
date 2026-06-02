"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCarteRequest,
  createWorkoutRequest,
} from "@/lib/workout/actions";

/**
 * カルテ更新 / メニュー変更 リクエスト送信フォーム (Client Component)
 *
 * 設計元: /tmp/workout_request_v1.html (確定モック、2026-06-02 きよむさん合意)
 *
 * type で 2 種類のリクエストを切り替え:
 *   - "carte": カルテ更新リクエスト → createCarteRequest
 *   - "menu":  メニュー変更リクエスト → createWorkoutRequest
 */
export type RequestType = "carte" | "menu";

type CurrentInfoItem = { label: string; value: string };

export function RequestForm({
  type,
  currentInfo,
}: {
  type: RequestType;
  currentInfo: CurrentInfoItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const config =
    type === "carte"
      ? {
          title: "カルテ更新リクエスト",
          heroTitle: "カルテを変更したい",
          heroSub:
            "環境や目的が変わった時に、のりfitness にお知らせください。",
          currentInfoLabel: "提出済のカルテ",
          inputHint:
            "どこをどう変えたいか、自由にお書きください。のりfitness が確認してカルテを更新します。",
          placeholder:
            "例: ジムを退会したので「ジム」を環境から外したいです。代わりに自宅でダンベルだけでできるメニューにしたいです。",
          examples: [
            "環境が変わった (ジム入会・退会、引っ越し)",
            "頻度を変えたい (週3 → 週5 に増やしたい)",
            "鍛えたい部位が変わった",
            "体の不調が出た (腰痛になった等)",
          ],
          backHref: "/workout/carte",
          heroIcon: (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M16 13H8M16 17H8" />
            </svg>
          ),
        }
      : {
          title: "メニュー変更リクエスト",
          heroTitle: "メニューを変更したい",
          heroSub:
            "今のメニューで気になる点があれば、のりfitness にお伝えください。",
          currentInfoLabel: "現在のメニュー",
          inputHint:
            "どの種目をどう変えたいか、自由にお書きください。のりfitness が確認してメニューを調整します。",
          placeholder:
            "例: 懸垂が今の自分には難しすぎるので、別の背中種目に変えてほしいです。フォームが安定しなくて怪我しそうです。",
          examples: [
            "特定の種目が合わない・きつすぎる",
            "強度を上げたい / 下げたい",
            "苦手な動作がある",
            "もっと別の種目を試してみたい",
          ],
          backHref: "/workout",
          heroIcon: (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          ),
        };

  function handleSubmit() {
    setError(null);
    if (!text.trim()) {
      setError("変更したい内容を入力してください");
      return;
    }
    startTransition(async () => {
      const action =
        type === "carte" ? createCarteRequest : createWorkoutRequest;
      const result = await action(text.trim());
      if (result.ok) {
        router.push(`/workout/request-complete?type=${type}`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="bg-white border border-[#e8ebe9] rounded-2xl overflow-hidden">
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b border-[#e8ebe9] flex items-center gap-2">
            <Link href={config.backHref} className="text-zinc-900">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex-1 text-center text-sm font-bold text-zinc-900">
              {config.title}
            </div>
            <div className="w-5 h-5" />
          </div>

          {/* ヒーロー */}
          <div className="px-4 py-5 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e8ebe9] text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#e8ebe9] mb-2.5 text-[#00695c]">
              {config.heroIcon}
            </div>
            <div className="text-base font-bold text-zinc-900 leading-tight mb-2">
              {config.heroTitle}
            </div>
            <div className="text-[11px] text-zinc-700 leading-relaxed">
              {config.heroSub}
            </div>
          </div>

          {/* 現状情報 */}
          <div className="m-4 p-3.5 rounded-[10px] bg-[#fafafa] border border-[#e8ebe9]">
            <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-1.5">
              {config.currentInfoLabel}
            </div>
            <dl className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-3 text-xs">
              {currentInfo.map((item) => (
                <div key={item.label} className="contents">
                  <dt className="text-zinc-500 text-[11px]">{item.label}</dt>
                  <dd className="text-zinc-900 font-semibold m-0">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* テキストエリア */}
          <div className="px-4 pb-4">
            <div className="flex items-baseline gap-1.5 mb-2">
              <label className="text-xs font-bold text-zinc-900">
                変更したい内容
              </label>
              <span className="text-[10px] text-rose-600 font-medium">必須</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-2.5">
              {config.inputHint}
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={config.placeholder}
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2.5 text-[13px] border border-[#e8ebe9] rounded-[10px] bg-white text-zinc-900 resize-y leading-relaxed focus:outline-none focus:border-[#00897b]"
            />
            <div className="mt-1.5 text-[10px] text-zinc-400 text-right">
              {text.length} / 2000
            </div>
          </div>

          {/* 例文 */}
          <div className="mx-4 mb-4 p-3 rounded-lg bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)]">
            <div className="text-[10px] font-bold text-[#b8860b] mb-1.5">
              こんな時にどうぞ
            </div>
            <ul className="pl-4 text-[11px] text-zinc-900 leading-relaxed space-y-0.5">
              {config.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>

          {/* エラー */}
          {error && (
            <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              ⚠ {error}
            </div>
          )}

          {/* フッタ */}
          <div className="bg-white border-t border-[#e8ebe9] px-4 py-3 flex gap-2 sticky bottom-0">
            <Link
              href={config.backHref}
              className="px-4 py-3 bg-white text-zinc-900 border border-[#e8ebe9] rounded-2xl text-[12px] font-bold text-center"
            >
              キャンセル
            </Link>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-[#00897b] hover:bg-[#00695c] text-white rounded-2xl text-sm font-bold disabled:opacity-50 transition-colors"
            >
              {isPending ? "送信中..." : "送信する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
