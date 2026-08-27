import fs from "fs";
import path from "path";

/**
 * いま本番に出ているアプリの版 (= public/sw.js の CACHE_VERSION)。
 *
 * 問い合わせ一覧で「受講生の端末に残っている版」と突き合わせ、古ければ警告色にする。
 * 古い版が端末に残っていると直したはずの不具合が再現するため(2026-07-29 PWAキャッシュ反映不達)。
 *
 * ★決め打ちしないこと。sw.js は頻繁に上がる(2026-08-27 は1日で2回)。
 */
let cached: string | null = null;

export function currentAppVersion(): string | null {
  if (cached !== null) return cached;
  try {
    const sw = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
    const m = sw.match(/CACHE_VERSION\s*=\s*["']([^"']+)["']/);
    cached = m ? m[1] : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** その件の端末に残っている版が古いか (どちらか不明なときは警告しない) */
export function isStaleVersion(ticketVersion: string | null | undefined): boolean {
  const now = currentAppVersion();
  if (!now || !ticketVersion) return false;
  return ticketVersion !== now;
}
