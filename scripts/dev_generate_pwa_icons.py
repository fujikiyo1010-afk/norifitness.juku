#!/usr/bin/env python3
"""
dev_generate_pwa_icons.py

PWA アイコンを「ティール緑 (のりfitness ブランドカラー #00897b) 円背景 + のりキャラ画像」で生成する。
透過 PNG のキャラ画像だと OS のデフォルト背景色で表示される問題を解消し、
ブランド統一感のあるアプリアイコンに置き換える (2026-05-27 きよむさん要望)。

実行:
    source ~/Desktop/norifitness/.venv/bin/activate
    python scripts/dev_generate_pwa_icons.py

出力:
    public/icons/icon-192.png  (PWA manifest)
    public/icons/icon-512.png  (PWA manifest)
    public/icons/apple-touch-icon.png  (iOS Safari)
"""

from pathlib import Path
from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).parent.parent
SRC_PATH = BASE_DIR / "public" / "images" / "nori-character.png"
ICONS_DIR = BASE_DIR / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

# 大きめキャンバスで生成してから縮小 (アンチエイリアス品質のため)
CANVAS_SIZE = 1024

# ティール緑 (#00897b、Phase 2-7 で確定したブランドカラー)
THEME_COLOR = (0, 137, 123, 255)

# キャラ画像が円内に収まる比率 (大きすぎると円からはみ出る)
CHAR_RATIO = 0.78

# 出力サイズ
OUTPUT_SIZES = {
    "icon-192.png": 192,
    "icon-512.png": 512,
    "apple-touch-icon.png": 180,
}


def main() -> None:
    if not SRC_PATH.exists():
        raise FileNotFoundError(f"元画像が見つかりません: {SRC_PATH}")

    # キャンバス作成 + ティール緑の円
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    # アンチエイリアスで縁の透過を残さないよう、ピッタリではなく内側に描画
    draw.ellipse((0, 0, CANVAS_SIZE, CANVAS_SIZE), fill=THEME_COLOR)

    # キャラ画像を読み込み、リサイズして中央に貼り付け
    src = Image.open(SRC_PATH).convert("RGBA")
    char_size = int(CANVAS_SIZE * CHAR_RATIO)
    char = src.resize((char_size, char_size), Image.LANCZOS)
    offset = (CANVAS_SIZE - char_size) // 2
    canvas.paste(char, (offset, offset), char)  # 3 つ目の引数 = マスクとして透過考慮

    # 各サイズで出力
    print(f"生成元: {SRC_PATH.name} ({src.size[0]}×{src.size[1]})")
    print(f"テーマ色: #00897b (ティール緑)")
    print(f"キャラサイズ: 円の {CHAR_RATIO * 100:.0f}%\n")

    for filename, px in OUTPUT_SIZES.items():
        out = canvas.resize((px, px), Image.LANCZOS)
        out_path = ICONS_DIR / filename
        out.save(out_path, "PNG", optimize=True)
        size_kb = out_path.stat().st_size / 1024
        print(f"  ✓ {filename}  ({px}×{px}, {size_kb:.1f} KB)")

    print("\n完了。ブラウザで強制リロード (Cmd+Shift+R) で新アイコン反映。")


if __name__ == "__main__":
    main()
