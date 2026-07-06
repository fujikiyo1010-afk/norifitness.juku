/**
 * クライアント側 画像圧縮 + EXIF 除去 (2026-07-06 P6)
 *
 * canvas に再描画 → JPEG 書き出しするため、位置情報を含む EXIF は自動的に
 * 剥がれる。回転だけは createImageBitmap({imageOrientation:"from-image"}) で
 * 見た目どおりに焼き込む。
 *
 * 用途: 体型写真アップロード前の軽量化 (長辺 ~1080px / JPEG)。
 */
export async function compressImage(
  file: File,
  maxDim = 1080,
  quality = 0.82
): Promise<Blob> {
  // EXIF 回転を反映して読み込む (未対応ブラウザは既定動作にフォールバック)
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("画像処理に対応していない端末です");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("画像の変換に失敗しました");
  return blob;
}
