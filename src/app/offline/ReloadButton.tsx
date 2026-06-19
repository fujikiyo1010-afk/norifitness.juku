"use client";

export function ReloadButton() {
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      className="block w-full bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl px-4 py-3 text-sm font-bold transition-colors"
    >
      再接続を試す
    </button>
  );
}
