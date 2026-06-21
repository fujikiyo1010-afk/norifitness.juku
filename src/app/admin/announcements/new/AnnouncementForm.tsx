"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnnouncementDraft } from "@/lib/announcements/actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * 一斉アナウンス 新規作成フォーム (2026-06-18 C-1)
 *
 * - 件名 (200 文字以内)
 * - 本文 (20000 文字以内)
 * - 「メール OFF の人にも送る」 トグル (= 規約改定 / インシデント告知では ON 推奨)
 * - 下書き保存ボタンで createAnnouncementDraft → 確認画面に遷移
 */
export function AnnouncementForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [includeOptOut, setIncludeOptOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    if (!subject.trim()) {
      setError("件名を入力してください");
      return;
    }
    if (!body.trim()) {
      setError("本文を入力してください");
      return;
    }
    startTransition(async () => {
      const r = await createAnnouncementDraft({
        subject,
        body_text: body,
        include_opt_out_users: includeOptOut,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push(`/admin/announcements/${r.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* 件名 */}
      <div>
        <label className="block text-xs font-bold text-zinc-700 mb-2">
          件名 <span className="text-rose-600">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="例: 利用規約改定のお知らせ"
          className="w-full px-4 py-2.5 text-sm border border-[#e8ebe9] rounded-md focus:outline-none focus:border-[#00897b]"
        />
        <p className="mt-1 text-[10px] text-zinc-500 text-right">
          {subject.length} / 200
        </p>
      </div>

      {/* 本文 */}
      <div>
        <label className="block text-xs font-bold text-zinc-700 mb-2">
          本文 <span className="text-rose-600">*</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={15}
          placeholder={`受講生のみなさまへ\n\nのりfitness 筋肉塾 です。\n\n[アナウンス本文]\n\nご確認のほどよろしくお願いいたします。`}
          className="w-full px-4 py-3 text-sm border border-[#e8ebe9] rounded-md focus:outline-none focus:border-[#00897b] font-mono resize-y leading-relaxed"
        />
        <p className="mt-1 text-[10px] text-zinc-500 text-right">
          {body.length} / 20000
        </p>
      </div>

      {/* メール OFF の人にも送るか */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeOptOut}
            onChange={(e) => setIncludeOptOut(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-600"
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-900">
              メール通知 OFF の受講生にも強制送信する
            </div>
            <div className="text-[11px] text-amber-800 mt-1 leading-relaxed">
              利用規約改定 / プライバシーポリシー改定 / インシデント告知 など、
              <strong>法的に全員へ通知が必要な場合は ON にしてください</strong>。
              <br />
              通常のお知らせ (= メンテ告知 / 業務案内) では OFF のままで OK。
            </div>
          </div>
        </label>
      </div>

      {/* エラー */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          ⚠ {error}
        </div>
      )}

      {/* 送信ボタン */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-[4px] bg-[#00897b] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#00695c] disabled:opacity-50"
        >
          {isPending ? (
            <>
              <LoadingSpinner /> 保存中…
            </>
          ) : (
            "下書き保存 → 確認画面へ"
          )}
        </button>
      </div>
    </div>
  );
}
