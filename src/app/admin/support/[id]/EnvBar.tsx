"use client";

import { useState } from "react";

/**
 * 問い合わせ詳細 ・ 環境の帯 (2026-08-28 折りたたみ化)
 *
 * 常に見せる = 画面 / 端末 / 最初の送信 ＋ 古い版のときだけ「⚠ アプリが古い版のまま」
 * 折りたたむ = アプリの版 / UA / 画面サイズ / 言語 / ホーム画面アプリか
 *
 * UA が丸ごと1行を占めて帯が2行になっていたのを1行に収める。
 * 警告そのものがボタン(クリックで開く)なので、気になった時に目を動かさずに開ける。
 * ★一覧の行には版を出さない(2026-08-28 きよむ判断・A案)。開けば分かるため。
 */
export function EnvBar({
  screen,
  platform,
  sentAt,
  appVersion,
  currentVersion,
  ua,
  screenSize,
  language,
  standalone,
}: {
  screen: string | null;
  platform: string | null;
  sentAt: string;
  appVersion: string | null;
  currentVersion: string | null;
  ua: string | null;
  screenSize: string | null;
  language: string | null;
  standalone: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  const stale = !!currentVersion && !!appVersion && appVersion !== currentVersion;

  return (
    <div className="flex-shrink-0 border-b border-[#e8ebe9] bg-white px-5 py-1.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Kv k="画面" v={screen ?? "—"} />
        <Kv k="端末" v={platform ?? "—"} />
        <Kv k="最初の送信" v={sentAt} mono />
        {stale && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-[#fbd5bd] bg-[#fdeee6] px-2 py-0.5 text-[11px] font-extrabold text-[#c2410c] transition-colors hover:bg-[#fbe0d2]"
          >
            ⚠ アプリが古い版のまま
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-zinc-500 transition-colors hover:bg-[#f0f7f5] hover:text-[#00695c]"
          aria-expanded={open}
        >
          環境の詳細
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>

      {open && (
        <div className="mt-1.5 border-t border-dashed border-[#e8ebe9] pt-1.5">
          <Row k="アプリの版">
            <span className={`font-bold ${stale ? "text-[#c2410c]" : "text-zinc-700"}`}>
              {appVersion ?? "—"}
              {appVersion && currentVersion && (
                <span className="ml-2 font-normal text-zinc-400">
                  {stale ? `（本番は ${currentVersion}）` : "（最新）"}
                </span>
              )}
            </span>
          </Row>
          <Row k="UA">
            <span className="break-all font-mono text-zinc-500">{ua ?? "—"}</span>
          </Row>
          <Row k="画面サイズ">
            <span className="font-mono font-bold text-zinc-700">{screenSize ?? "—"}</span>
            <span className="ml-5 font-bold text-zinc-400">言語</span>
            <span className="ml-1.5 font-mono font-bold text-zinc-700">{language ?? "—"}</span>
            <span className="ml-5 font-bold text-zinc-400">ホーム画面アプリ</span>
            <span
              className={`ml-1.5 font-bold ${standalone ? "text-[#c2410c]" : "text-zinc-700"}`}
            >
              {standalone === null ? "—" : standalone ? "はい" : "いいえ"}
            </span>
          </Row>
        </div>
      )}
    </div>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <span className="whitespace-nowrap text-[11px]">
      <span className="mr-1.5 font-bold text-zinc-400">{k}</span>
      <span className={`font-bold text-zinc-700 ${mono ? "font-mono" : ""}`}>{v}</span>
    </span>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-[1.9]">
      <span className="w-[76px] flex-shrink-0 font-bold text-zinc-400">{k}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
