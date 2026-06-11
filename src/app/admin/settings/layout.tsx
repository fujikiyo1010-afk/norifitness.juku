import type { ReactNode } from "react";
import { SettingsSubNav } from "./_components/SettingsSubNav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-zinc-50">
      <div className="px-7 py-6 max-w-[1180px] mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-zinc-900">設定</h1>
          <p className="text-xs text-zinc-500 mt-1">
            のりfitness 管理画面の運用設定
          </p>
        </header>
        <div className="flex bg-white border border-[#e8ebe9] rounded-[10px] overflow-hidden min-h-[500px]">
          <SettingsSubNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
