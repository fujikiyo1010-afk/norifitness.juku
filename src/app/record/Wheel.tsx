"use client";

import { useRef } from "react";

/**
 * ドラムロール(ホイール)ピッカー ・ 2026-07-06
 *
 * ライブラリ不使用。縦スクロール + scroll-snap で iOS 風の数値ホイール。
 *   - 中央にスナップした要素が選択値 (index)。
 *   - 初期表示は index 位置にスクロール (前回値からスタート)。
 *
 * NumberWheel が 整数ホイール + 小数ホイール を組み合わせて「69.5」等を作る。
 */

const ROW = 40; // 1行の高さ(px)
const VISIBLE = 3; // 見える行数(奇数)
const H = ROW * VISIBLE; // ビューポート高
const PAD = (H - ROW) / 2; // 先頭/末尾を中央に来させる余白

function Wheel({
  values,
  index,
  onIndexChange,
  width,
}: {
  values: (number | string)[];
  index: number;
  onIndexChange: (i: number) => void;
  width: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inited = useRef(false);
  const raf = useRef<number | undefined>(undefined);

  // マウント時に index までスクロール (描画前に設定=チラつき無し)
  const setRef = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (el && !inited.current) {
      el.scrollTop = index * ROW;
      inited.current = true;
    }
  };

  function handleScroll() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(
        0,
        Math.min(values.length - 1, Math.round(el.scrollTop / ROW))
      );
      if (i !== index) onIndexChange(i);
    });
  }

  return (
    <div
      ref={setRef}
      onScroll={handleScroll}
      className="wheel-scroll"
      style={{ width, height: H }}
    >
      <div style={{ height: PAD }} />
      {values.map((v, i) => (
        <div
          key={i}
          className={`wheel-item ${i === index ? "wheel-item-on" : ""}`}
          style={{ height: ROW }}
        >
          {v}
        </div>
      ))}
      <div style={{ height: PAD }} />

      <style jsx>{`
        .wheel-scroll {
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .wheel-scroll::-webkit-scrollbar {
          display: none;
        }
        .wheel-item {
          display: flex;
          align-items: center;
          justify-content: center;
          scroll-snap-align: center;
          font-family: ui-monospace, monospace;
          font-weight: 700;
          font-size: 18px;
          color: #c3bcab;
        }
        .wheel-item-on {
          color: #2b2620;
          font-size: 24px;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}

/**
 * 整数.小数 の複合ホイール。値 = intValues[intIndex] + decIndex/10
 */
export function NumberWheel({
  intValues,
  intIndex,
  setIntIndex,
  decIndex,
  setDecIndex,
  unit,
}: {
  intValues: number[];
  intIndex: number;
  setIntIndex: (i: number) => void;
  decIndex: number;
  setDecIndex: (i: number) => void;
  unit: string;
}) {
  return (
    <div
      className="relative flex items-center justify-center gap-1 overflow-hidden rounded-xl border border-[#e7dcc9] bg-white"
      style={{ height: H }}
    >
      <Wheel
        values={intValues}
        index={intIndex}
        onIndexChange={setIntIndex}
        width={64}
      />
      <span className="text-[20px] font-extrabold text-[#2b2620]">.</span>
      <Wheel
        values={DECIMALS}
        index={decIndex}
        onIndexChange={setDecIndex}
        width={44}
      />
      <span className="ml-1 text-[13px] font-bold text-[#6a6256]">{unit}</span>

      {/* 中央の選択バンド + 上下フェード (操作を邪魔しない) */}
      <div
        className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-md"
        style={{
          height: ROW - 4,
          background: "rgba(74,135,91,.08)",
          borderTop: "1px solid #dbe7de",
          borderBottom: "1px solid #dbe7de",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: PAD + 6,
          background: "linear-gradient(#fff,rgba(255,255,255,0))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: PAD + 6,
          background: "linear-gradient(rgba(255,255,255,0),#fff)",
        }}
      />
    </div>
  );
}

export const DECIMALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** [min, max] の整数配列を作る */
export function intRange(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
