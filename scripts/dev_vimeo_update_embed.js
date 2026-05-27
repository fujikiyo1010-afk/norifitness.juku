/**
 * dev_vimeo_update_embed.js
 *
 * Vimeo 動画の埋め込みプレイヤー設定を「受講生向け最適化」する。
 * 主に「関連動画 OFF」「Vimeo ロゴ OFF」「いいね/シェア等ボタン OFF」を適用。
 *
 * 使い方:
 *   node --env-file=.env.local scripts/dev_vimeo_update_embed.js <Vimeo ID>
 *
 * 想定の本番用途:
 *   Step 9 実装時、月次添削動画作成 (POST /me/videos) の embed フィールドに
 *   ここで検証した設定を最初から含める。
 */

const PAT = process.env.VIMEO_ACCESS_TOKEN;
const VIDEO_ID = process.argv[2];

if (!PAT) {
  console.error("❌ VIMEO_ACCESS_TOKEN 未設定");
  process.exit(1);
}
if (!VIDEO_ID) {
  console.error("❌ Vimeo ID を指定してください");
  console.error(
    "   例: node --env-file=.env.local scripts/dev_vimeo_update_embed.js 1195828849"
  );
  process.exit(1);
}

const API = "https://api.vimeo.com";
const HEADERS = {
  Authorization: `bearer ${PAT}`,
  Accept: "application/vnd.vimeo.*+json;version=3.4",
};

// 「受講生向け最適化」設定: 関連動画なし、ボタン最小、Vimeo ロゴなし、テーマカラー
const RECOMMENDED_EMBED_SETTINGS = {
  buttons: {
    like: false,
    share: false,
    watchlater: false,
    embed: false,
    hd: false,
    fullscreen: true,
    scaling: true,
  },
  logos: {
    vimeo: false,
  },
  title: {
    name: "hide",
    owner: "hide",
    portrait: "hide",
  },
  color: "00897b", // のりfitness ティール緑
  playbar: true,
  volume: true,
  speed: false,
  // ↓ ここが関連動画 OFF の鍵
  end_screen: [], // 空配列 = 「終了画面に何も表示しない」(関連動画もなし)
};

(async () => {
  // ===== 現状確認 =====
  console.log("=== BEFORE: 現在の embed 設定 ===");
  const beforeRes = await fetch(`${API}/videos/${VIDEO_ID}`, {
    headers: HEADERS,
  });
  if (!beforeRes.ok) {
    console.error(`❌ HTTP ${beforeRes.status}`);
    console.error(await beforeRes.text());
    process.exit(1);
  }
  const before = await beforeRes.json();
  console.log(JSON.stringify(before.embed, null, 2));

  // ===== PATCH 設定変更 =====
  console.log("\n=== 設定変更中 (PATCH /videos/{id}) ===");
  const patchRes = await fetch(`${API}/videos/${VIDEO_ID}`, {
    method: "PATCH",
    headers: {
      ...HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embed: RECOMMENDED_EMBED_SETTINGS,
    }),
  });

  if (!patchRes.ok) {
    console.error(`❌ HTTP ${patchRes.status}`);
    console.error(await patchRes.text());
    process.exit(1);
  }

  const after = await patchRes.json();
  console.log("✅ 設定変更成功");
  console.log("\n=== AFTER: 変更後の embed 設定 ===");
  console.log(JSON.stringify(after.embed, null, 2));

  console.log("\n📌 ブラウザで再確認:");
  console.log(`   ${after.player_embed_url}`);
  console.log(
    "   ※ ブラウザのキャッシュで古い設定が見える場合は強制リロード (Cmd+Shift+R)"
  );
})().catch((e) => {
  console.error("❌ 例外:", e);
  process.exit(1);
});
