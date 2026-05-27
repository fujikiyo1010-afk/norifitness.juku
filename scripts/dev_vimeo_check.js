/**
 * dev_vimeo_check.js
 *
 * Vimeo API の Personal Access Token (PAT) が正しく動くかをサニティチェック。
 * GET /me を叩いてアカウント情報・プラン・アップロード残量を確認する。
 *
 * 使い方:
 *   node --env-file=.env.local scripts/dev_vimeo_check.js
 *
 * 期待結果:
 *   - アカウント名: のりfitness (or 類似)
 *   - プラン: business / plus / pro / premium のいずれか
 *   - upload_quota.space.free: 残り容量 (バイト数)
 *
 * エラー時の対処:
 *   - 401: PAT が間違っている、または有効期限切れ → 再生成
 *   - 403: scope 不足 → public/private/upload/edit/video_files が必要
 *   - その他: ネットワーク・Vimeo 側障害の可能性
 */

const PAT = process.env.VIMEO_ACCESS_TOKEN;

if (!PAT || PAT.startsWith("xxxxx")) {
  console.error("❌ VIMEO_ACCESS_TOKEN が未設定です (.env.local を確認)");
  process.exit(1);
}

(async () => {
  console.log("🔍 Vimeo API に接続中...\n");

  const res = await fetch("https://api.vimeo.com/me", {
    headers: {
      Authorization: `bearer ${PAT}`,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    },
  });

  if (!res.ok) {
    console.error(`❌ HTTP ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    if (res.status === 401) {
      console.error("\n→ PAT が無効です。Vimeo Developer Portal で再生成してください。");
    } else if (res.status === 403) {
      console.error("\n→ scope 不足の可能性。upload/edit/video_files が必要です。");
    }
    process.exit(1);
  }

  const me = await res.json();

  console.log("=".repeat(60));
  console.log("✅ PAT 認証成功");
  console.log("=".repeat(60));
  console.log(`アカウント名:        ${me.name}`);
  console.log(`URI:                ${me.uri}`);
  console.log(`プラン:              ${me.account}`);
  console.log(`メンバーシップ:       ${me.membership?.subscription?.product?.name ?? "(不明)"}`);
  console.log(`プロフィール URL:    ${me.link}`);

  console.log("\n=== Upload Quota (アップロード容量) ===");
  if (me.upload_quota) {
    const fmt = (b) => `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
    console.log(`  Periodic (週/月の制限):`);
    console.log(`    Free:  ${fmt(me.upload_quota.periodic?.free ?? 0)}`);
    console.log(`    Max:   ${fmt(me.upload_quota.periodic?.max ?? 0)}`);
    console.log(`    Reset: ${me.upload_quota.periodic?.reset_date ?? "(なし)"}`);
    console.log(`  Lifetime (合計):`);
    console.log(`    Free:  ${fmt(me.upload_quota.lifetime?.free ?? 0)}`);
    console.log(`    Max:   ${fmt(me.upload_quota.lifetime?.max ?? 0)}`);
    console.log(`    Used:  ${fmt(me.upload_quota.lifetime?.used ?? 0)}`);
    console.log(`  Space (今すぐ使える):`);
    console.log(`    Free:  ${fmt(me.upload_quota.space?.free ?? 0)}`);
    console.log(`    Max:   ${fmt(me.upload_quota.space?.max ?? 0)}`);
    console.log(`    Used:  ${fmt(me.upload_quota.space?.used ?? 0)}`);
  } else {
    console.log("  (upload_quota 情報なし - scope に upload が含まれていない可能性)");
  }

  console.log("\n=== 動画数 ===");
  console.log(`  videos.total:        ${me.metadata?.connections?.videos?.total ?? "?"}`);
  console.log(`  videos uploaded:     ${me.metadata?.connections?.videos?.total ?? "?"}`);

  console.log("\n=== Scope の確認 ===");
  // PAT 自体の scope は GET /me では取れないが、他エンドポイントを叩けるかで判別
  console.log("  GET /me 成功 → public + private scope OK");

  // upload scope を確認するため、Upload 確認エンドポイント (POST しない、HEAD相当) を試す
  // POST /me/videos を試すと実際に動画が作られてしまうので、ここではしない
  console.log("  upload scope は POST /me/videos を実際に叩いて確認 (次のステップ)");

  console.log("\n" + "=".repeat(60));
  console.log("次のステップ: tus アップロードフロー検証");
  console.log("=".repeat(60));
})().catch((e) => {
  console.error("❌ 例外:", e);
  process.exit(1);
});
