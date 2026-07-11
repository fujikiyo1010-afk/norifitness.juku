"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyShipmentAddress } from "../actions";

export function AddressForm({
  initialPostalCode,
  initialAddressLine,
  initialRecipientName,
}: {
  initialPostalCode: string;
  initialAddressLine: string;
  initialRecipientName: string;
}) {
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [addressLine, setAddressLine] = useState(initialAddressLine);
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const postalDigits = postalCode.replace(/[^0-9]/g, "");
  const valid =
    postalDigits.length === 7 &&
    addressLine.trim().length > 0 &&
    recipientName.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await updateMyShipmentAddress({
        postalCode: postalCode.trim(),
        addressLine: addressLine.trim(),
        recipientName: recipientName.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/profile");
      router.refresh();
    });
  }

  const fieldClass =
    "w-full rounded-md border border-zinc-300 bg-[#fffdf8] px-3 py-2 text-[13px] text-[#2b2620] outline-none focus:border-[#4a875b] focus:ring-2 focus:ring-[#4a875b]/30 disabled:opacity-50";
  const labelClass = "block text-[11px] font-bold text-[#6a6256] mb-1.5";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="bg-[#fff3e0] border border-[#f0d9b5] rounded-lg px-3 py-2 text-[11px] text-[#a5631f] leading-relaxed">
        発送準備中のみ変更できます。変更内容はすぐ反映されます。
      </div>

      <div>
        <label className={labelClass}>郵便番号</label>
        <input
          type="text"
          inputMode="numeric"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="123-4567"
          autoComplete="postal-code"
          disabled={pending}
          className={fieldClass}
        />
        {postalCode.length > 0 && postalDigits.length !== 7 && (
          <p className="text-[10px] text-[#c44] mt-1">
            郵便番号は 7 桁で入力してください ({postalDigits.length}/7)
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>住所（都道府県＋市区町村＋番地＋建物名）</label>
        <input
          type="text"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="東京都渋谷区神宮前 1-2-3 ○○マンション101"
          autoComplete="street-address"
          disabled={pending}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>受取人氏名</label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          autoComplete="name"
          disabled={pending}
          className={fieldClass}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || pending}
        className="mt-1 w-full btn3d text-white rounded-xl py-3 text-[13px] font-bold disabled:opacity-50 transition-colors"
      >
        {pending ? "保存中…" : "住所を更新する"}
      </button>
    </form>
  );
}
