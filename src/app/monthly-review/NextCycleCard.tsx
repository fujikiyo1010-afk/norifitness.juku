/**
 * 月次「次回のご案内」カード(2026-07-30)。提出後の完了画面/トップの提出済みカード、
 * および入会30日未満(第1回前)の案内に共通で使う表示専用コンポーネント。
 */
export function NextCycleCard({
  title,
  dateText,
  rangeText,
  note,
}: {
  title: string; // 例: 次回：第2回 / 第1回
  dateText: string; // 例: 8/25 から
  rangeText: string; // 例: 対象期間 7/26〜8/25
  note?: string; // 例: その日になったら、通知でお知らせします。
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-[1.5px] border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-3 text-left">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#e2efe6] text-[#34603f]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold tracking-wide text-[#34603f]">{title}</div>
        <div className="mt-0.5 text-[15px] font-extrabold text-[#2b2620]">{dateText}</div>
        <div className="mt-0.5 text-[11px] font-bold text-[#6a6256]">{rangeText}</div>
        {note && <div className="mt-1 text-[10.5px] text-[#a59b8c]">{note}</div>}
      </div>
    </div>
  );
}
