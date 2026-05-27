/**
 * dev_vimeo_upload_test.js
 *
 * Tech Check 4: Vimeo Upload API (tus プロトコル) の検証スクリプト。
 *
 * 使い方:
 *   # Step 1 のみ (動画オブジェクト作成 + upload_link 取得、ファイル不要):
 *   node --env-file=.env.local scripts/dev_vimeo_upload_test.js
 *
 *   # Step 1+2+3 (実ファイル PATCH アップロード + transcode 完了確認):
 *   node --env-file=.env.local scripts/dev_vimeo_upload_test.js <動画ファイルパス>
 *
 * 検証項目:
 *   - upload scope が PAT に含まれているか
 *   - POST /me/videos の挙動 (upload_link 取得)
 *   - tus PATCH の挙動 (Upload-Offset の応答、204 ステータス等)
 *   - transcode 完了までのタイムラグ
 *   - 動画 URL / player_embed_url の形式
 *   - 動画の privacy 設定 (非公開で作成)
 */

const fs = require("node:fs");

const PAT = process.env.VIMEO_ACCESS_TOKEN;
const FILE = process.argv[2];

if (!PAT || PAT.startsWith("xxxxx")) {
  console.error("❌ VIMEO_ACCESS_TOKEN 未設定");
  process.exit(1);
}

const API = "https://api.vimeo.com";
const HEADERS = {
  Authorization: `bearer ${PAT}`,
  Accept: "application/vnd.vimeo.*+json;version=3.4",
};

(async () => {
  // ===== Step 1: 動画オブジェクト作成 =====
  let fileSize;
  if (FILE) {
    if (!fs.existsSync(FILE)) {
      console.error(`❌ ファイルが見つかりません: ${FILE}`);
      process.exit(1);
    }
    fileSize = fs.statSync(FILE).size;
    console.log(`📁 動画ファイル: ${FILE} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    fileSize = 1024 * 1024; // ダミー 1 MB
    console.log(`📁 ファイル未指定 → Step 1 のみ実行 (size は仮 1 MB 申告)`);
  }

  console.log("\n[Step 1] POST /me/videos で動画オブジェクト作成中...");

  const createRes = await fetch(`${API}/me/videos`, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      upload: { approach: "tus", size: fileSize },
      name: "Tech Check 4 / 検証用テスト動画",
      description:
        "Phase 3 Tech Check 4 で作成。実装検証用、確認後削除可。",
      privacy: {
        view: "disable",
        embed: "public",
        download: false,
        add: false,
        comments: "nobody",
      },
    }),
  });

  if (!createRes.ok) {
    console.error(`❌ HTTP ${createRes.status} ${createRes.statusText}`);
    console.error(await createRes.text());
    if (createRes.status === 403) {
      console.error(
        "\n→ upload scope が PAT に含まれていません。Vimeo で PAT 再生成してください。"
      );
    }
    process.exit(1);
  }

  const video = await createRes.json();
  console.log(`✅ 動画オブジェクト作成成功`);
  console.log(`   URI: ${video.uri}`);
  console.log(`   Vimeo ID: ${video.uri?.split("/").pop()}`);
  console.log(`   名前: ${video.name}`);
  console.log(`   upload.approach: ${video.upload?.approach}`);
  console.log(`   upload.status: ${video.upload?.status}`);
  console.log(`   upload.size: ${video.upload?.size} bytes (申告)`);
  console.log(
    `   upload_link: ${video.upload?.upload_link?.substring(0, 120)}...`
  );
  console.log(`   privacy.view: ${video.privacy?.view}`);

  if (!FILE) {
    console.log("\n📝 次: テスト動画を用意して再実行してください:");
    console.log(
      `   node --env-file=.env.local scripts/dev_vimeo_upload_test.js <動画ファイルパス>`
    );
    console.log("\n💡 テスト動画の作り方:");
    console.log(
      "   - QuickTime Player → ファイル → 新規画面収録 → 5 秒録画 → 保存"
    );
    console.log("   - iPhone で 5 秒動画撮影 → AirDrop で Mac へ");
    console.log("   - 任意の MP4 / MOV / WebM ファイル");
    console.log("\n📌 Vimeo に作成したテスト動画:");
    console.log(`   https://vimeo.com/${video.uri?.split("/").pop()}/settings`);
    console.log("   (検証後にここから削除可能)");
    return;
  }

  // ===== Step 2: PATCH で実ファイルアップロード =====
  console.log("\n[Step 2] PATCH で動画ファイルをアップロード (tus)...");
  const fileBuffer = fs.readFileSync(FILE);
  console.log(`   送信サイズ: ${fileBuffer.length} bytes`);
  console.log(`   開始時刻: ${new Date().toLocaleTimeString()}`);
  const t0 = Date.now();

  const uploadRes = await fetch(video.upload.upload_link, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": "0",
      "Content-Type": "application/offset+octet-stream",
    },
    body: fileBuffer,
  });

  const t1 = Date.now();
  console.log(`   HTTP ${uploadRes.status} ${uploadRes.statusText}`);
  console.log(
    `   Upload-Offset (response): ${uploadRes.headers.get("Upload-Offset")}`
  );
  console.log(`   かかった時間: ${((t1 - t0) / 1000).toFixed(2)} 秒`);
  console.log(
    `   スループット: ${((fileBuffer.length / 1024 / 1024) / ((t1 - t0) / 1000)).toFixed(2)} MB/s`
  );

  if (uploadRes.status !== 204) {
    console.error(`❌ アップロード失敗 (期待: 204)`);
    console.error(await uploadRes.text());
    process.exit(1);
  }
  console.log(`✅ アップロード成功`);

  // ===== Step 3: transcode 状態確認 =====
  console.log("\n[Step 3] transcode 完了まで待機 (最大 90 秒)...");
  let finalStatus = null;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const checkRes = await fetch(`${API}${video.uri}`, { headers: HEADERS });
    const status = await checkRes.json();
    process.stdout.write(
      `\r   [${i + 1}/45] status: ${status.status?.padEnd(20)} transcode: ${status.transcode?.status ?? "—"}            `
    );
    if (status.status === "available") {
      finalStatus = status;
      break;
    }
  }
  console.log("");

  if (!finalStatus) {
    console.log("⚠ 90 秒以内に transcode 完了せず (タイムアウト)。");
    console.log(`   Vimeo Dashboard で確認: https://vimeo.com${video.uri}`);
    return;
  }

  console.log(`✅ Transcode 完了!`);
  console.log(`   再生 URL:        ${finalStatus.link}`);
  console.log(`   埋め込み URL:    ${finalStatus.player_embed_url}`);
  console.log(`   Duration:       ${finalStatus.duration} 秒`);
  console.log(`   width × height: ${finalStatus.width} × ${finalStatus.height}`);
  console.log(
    `   files (画質):    ${(finalStatus.files ?? []).map((f) => f.quality).join(", ")}`
  );

  console.log("\n📌 ブラウザで再生確認:");
  console.log(`   ${finalStatus.link}`);
  console.log("\n🧹 後で削除する場合:");
  console.log(`   https://vimeo.com${finalStatus.uri}/settings`);
  console.log("   または DELETE API:");
  console.log(`   curl -X DELETE -H "Authorization: bearer $VIMEO_ACCESS_TOKEN" ${API}${finalStatus.uri}`);
})().catch((e) => {
  console.error("\n❌ 例外:", e);
  process.exit(1);
});
