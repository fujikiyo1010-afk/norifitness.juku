"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  replyToRequest,
  type RequestType,
} from "@/lib/admin/request-actions";

/**
 * リクエスト返信フォーム (Client Component)
 *
 * 即時モデル原則:
 *   - 編集 → 返信 の順序を視覚化 (editStarted フラグで送信ボタン制御)
 *   - 完了形テンプレ「変更しました」標準
 *   - 中間ステータス無し ・ 送信 = 対応済
 */
const TEMPLATES: Record<RequestType, string[]> = {
  carte: [
    "ご連絡ありがとうございます。 環境変更を反映してカルテを更新しました。 今後の月次添削に反映されます。",
    "ご要望承知しました。 カルテに反映しましたので、 今日からこのカルテで運用していきます。",
  ],
  workout: [
    "ご連絡ありがとうございます。 ご要望の種目変更を反映しました。 新しいメニューで進めてください。",
    "代替種目に変更しました。 フォームを意識しつつ、 無理せず取り組んでください。",
  ],
};

export function RequestReplyForm({
  type,
  requestId,
  editHref,
}: {
  type: RequestType;
  requestId: string;
  editHref: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function insertTemplate(template: string) {
    setText((prev) => (prev ? `${prev}\n${template}` : template));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await replyToRequest(type, requestId, text);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/admin/requests");
      router.refresh();
    });
  }

  const templates = TEMPLATES[type];

  return (
    <div className="border-t border-[#e8ebe9] bg-white px-6 py-4">
      {/* 編集動線案内 */}
      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 mb-3 text-[12px] text-amber-800 flex items-start gap-2">
        <span className="font-bold">編集 → 返信</span>
        <span>
          先にカルテ / メニューを編集してから、 完了形の返信を送信してください。
        </span>
      </div>

      {/* テンプレ挿入 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[11px]">
        <span className="text-zinc-500 font-bold">テンプレ:</span>
        {templates.map((tpl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => insertTemplate(tpl)}
            className="px-2 py-1 bg-zinc-50 border border-[#e8ebe9] rounded-md text-zinc-700 hover:border-[#00897b] hover:text-[#00695c]"
          >
            #{idx + 1} 挿入
          </button>
        ))}
      </div>

      {/* テキストエリア */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="返信内容を入力 (テンプレからも挿入可)..."
        rows={4}
        className="w-full px-3 py-2.5 text-sm border border-[#e8ebe9] rounded-md focus:outline-none focus:border-[#00897b] resize-y"
        disabled={isPending}
      />
      <div className="mt-1 text-[10px] text-zinc-400 text-right">
        {text.length} / 2000
      </div>

      {/* エラー */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          {error}
        </div>
      )}

      {/* アクション */}
      <div className="mt-3 flex items-center gap-2">
        <a
          href={editHref}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#e8ebe9] rounded-md text-xs font-semibold text-zinc-900 hover:border-[#00897b] hover:text-[#00695c]"
        >
          {type === "carte" ? "カルテを編集" : "メニューを編集"} →
        </a>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !text.trim()}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-[#00897b] hover:bg-[#00695c] text-white rounded-md text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "送信中..." : "送信 + 対応済"}
        </button>
      </div>
    </div>
  );
}
