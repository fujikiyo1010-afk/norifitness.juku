"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { createMealLog, updateMealLog, type MealItemInput } from "@/lib/meals/actions";
import { MEAL_TYPES, MEAL_LABEL, type MealType } from "@/lib/meals/types";

/**
 * 食事 投稿/編集 画面 (M5・v1-a=写真だけ運用)。
 *  - 食事タイプ(現在時刻で自動選択) + 写真(複数可・なしでもOK) + 品目名リスト + メモ。
 *  - 「写真だけでも記録できます」。PFC数値/food_tableチップ は v1-b。
 *  - 同日同タイプが既にある時は、呼び出し元(page)が編集モードへ誘導。
 */

type ExistingPhoto = { path: string; url: string };

export function MealPostForm({
  userId,
  date,
  initialType,
  editId,
  initialMemo,
  initialItems,
  initialPhotos,
}: {
  userId: string;
  date: string;
  initialType: MealType;
  editId?: string | null;
  initialMemo?: string | null;
  initialItems?: { name: string }[];
  initialPhotos?: ExistingPhoto[];
}) {
  const router = useRouter();
  const isEdit = !!editId;

  const [mealType, setMealType] = useState<MealType>(initialType);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [itemNames, setItemNames] = useState<string[]>(
    (initialItems ?? []).map((i) => i.name)
  );
  const [itemDraft, setItemDraft] = useState("");
  // 既存写真(編集時) + 新規追加ファイル
  const [keepPhotos, setKeepPhotos] = useState<ExistingPhoto[]>(initialPhotos ?? []);
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    const v = itemDraft.trim();
    if (!v) return;
    setItemNames((prev) => [...prev, v]);
    setItemDraft("");
  }
  function removeItem(i: number) {
    setItemNames((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).slice(0, 4);
    setNewFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }
  function removeNewFile(i: number) {
    setNewFiles((prev) => {
      const t = prev[i];
      if (t) URL.revokeObjectURL(t.preview);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      // 新規写真をアップロード
      for (const nf of newFiles) {
        const path = `${userId}/${date}-${mealType}-${Date.now()}-${uploaded.length}.jpg`;
        const blob = await compressImage(nf.file, 1080, 0.82);
        const up = await supabase.storage
          .from("meal-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw new Error(up.error.message);
        uploaded.push(path);
      }
      const photos = [...keepPhotos.map((p) => p.path), ...uploaded];
      const items: MealItemInput[] = itemNames.map((name) => ({ name, source: "none" }));

      if (isEdit && editId) {
        const r = await updateMealLog(editId, { memo, photos, items });
        if (!r.ok) throw new Error(r.message);
        router.replace(`/meals?date=${date}`);
        router.refresh();
      } else {
        const r = await createMealLog({ date, meal_type: mealType, memo, photos, items });
        if (!r.ok) throw new Error(r.message);
        router.replace(`/meals?date=${date}`);
        router.refresh();
      }
    } catch (e) {
      // 失敗時は今回上げたファイルを後始末(孤立防止)
      if (uploaded.length) {
        try {
          await supabase.storage.from("meal-photos").remove(uploaded);
        } catch {}
      }
      setError(
        e instanceof Error
          ? `${e.message}（もう一度お試しください）`
          : "保存に失敗しました。もう一度お試しください。"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      {/* 食事タイプ */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">食事の種類</div>
        <div className="flex gap-1.5">
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={isEdit}
              onClick={() => setMealType(t)}
              className={`flex-1 rounded-xl py-2.5 text-[12px] font-bold transition-colors ${
                mealType === t
                  ? "bg-[#4a875b] text-white"
                  : "bg-[#f0ece2] text-[#6a6256]"
              } ${isEdit ? "opacity-60" : ""}`}
            >
              {MEAL_LABEL[t]}
            </button>
          ))}
        </div>
        {isEdit && (
          <p className="mt-1 text-[10px] text-[#a59b8c]">
            編集中は食事の種類は変更できません。
          </p>
        )}
      </div>

      {/* 写真 */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">
          写真（なしでもOK）
        </div>
        <div className="flex flex-wrap gap-2">
          {keepPhotos.map((p, i) => (
            <div key={p.path} className="relative h-20 w-20 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setKeepPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
              >
                ×
              </button>
            </div>
          ))}
          {newFiles.map((nf, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nf.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeNewFile(i)}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
              >
                ×
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8cdba] text-[#a59b8c]">
            <span className="text-[20px] leading-none">＋</span>
            <span className="text-[9px]">写真</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* 品目 */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">
          食べたもの（任意）
        </div>
        {itemNames.length > 0 && (
          <ul className="mb-2 space-y-1">
            {itemNames.map((n, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-[#fffdf8] border border-[#e7dcc9] px-3 py-2 text-[13px]"
              >
                <span className="text-[#2b2620]">{n}</span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-[11px] text-[#a59b8c]"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={itemDraft}
            onChange={(e) => setItemDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="例: もち麦ごはん"
            className="flex-1 rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-[#f0ece2] px-4 text-[12px] font-bold text-[#5b5344]"
          >
            追加
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[#a59b8c]">
          栄養の数値は、のり監修の食材リストがそろったら自動で計算できるようになります。
        </p>
      </div>

      {/* メモ */}
      <div>
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">メモ（任意）</div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="一言あれば"
          className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
      </div>

      {error && (
        <p className="text-[12px] font-bold text-red-700">❌ {error}</p>
      )}

      {/* 送信(下部固定) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[460px]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="w-full rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "保存中…" : isEdit ? "変更を保存する" : "これで記録する"}
          </button>
          {!isEdit && (
            <p className="mt-1.5 text-center text-[10px] text-[#a59b8c]">
              品目も数値もなしで、写真だけでも記録できます。
            </p>
          )}
          <Link
            href={`/meals?date=${date}`}
            className="mt-1 block text-center text-[11px] text-[#6a6256]"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </div>
  );
}
