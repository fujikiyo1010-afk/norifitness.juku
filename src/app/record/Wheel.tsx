"use client";

import { useMemo, useRef, useState } from "react";

/**
 * ドラムロール(ホイール)＋丸い±ボタン ・ 2026-07-06 確定(案1縦・B丸±)
 *
 * ライブラリ不使用。縦スクロール + scroll-snap で iOS 風の数値ホイール。
 *   - 整数ホイール + 小数ホイール で「69.5」等を作る。
 *   - 左右の丸ボタンで 0.1 刻み微調整(ホイールが滑らかに追従)。
 *   - 初期値(前回値)からスタート。値は onChange(value) で親へ報告。
 */

const ROW = 40; // 1行の高さ(px)
const VISIBLE = 3; // 見える行数(奇数)
const H = ROW * VISIBLE; // ビューポート高 120
const PAD = (H - ROW) / 2; // 先頭/末尾を中央に来させる余白
const DEC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function NumberWheel({
  initial,
  min,
  max,
  unit,
  onChange,
}: {
  initial: number | null | undefined;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const intValues = useMemo(() => range(min, max), [min, max]);

  const init = clamp(
    initial != null && Number.isFinite(initial) ? initial : (min + max) / 2,
    min,
    max
  );
  const [intVal, setIntVal] = useState(Math.floor(init));
  const [decVal, setDecVal] = useState(Math.round((init - Math.floor(init)) * 10));

  const intRef = useRef<HTMLDivElement | null>(null);
  const decRef = useRef<HTMLDivElement | null>(null);
  const intInit = useRef(false);
  const decInit = useRef(false);
  const intRaf = useRef<number | undefined>(undefined);
  const decRaf = useRef<number | undefined>(undefined);

  function report(i: number, d: number) {
    onChange(i + d / 10);
  }

  const setIntRef = (el: HTMLDivElement | null) => {
    intRef.current = el;
    if (el && !intInit.current) {
      el.scrollTop = (Math.floor(init) - min) * ROW;
      intInit.current = true;
    }
  };
  const setDecRef = (el: HTMLDivElement | null) => {
    decRef.current = el;
    if (el && !decInit.current) {
      el.scrollTop = Math.round((init - Math.floor(init)) * 10) * ROW;
      decInit.current = true;
    }
  };

  function onIntScroll() {
    if (intRaf.current) cancelAnimationFrame(intRaf.current);
    intRaf.current = requestAnimationFrame(() => {
      const el = intRef.current;
      if (!el) return;
      const i = clampIdx(Math.round(el.scrollTop / ROW), intValues.length);
      const v = intValues[i];
      if (v !== intVal) {
        setIntVal(v);
        report(v, decVal);
      }
    });
  }
  function onDecScroll() {
    if (decRaf.current) cancelAnimationFrame(decRaf.current);
    decRaf.current = requestAnimationFrame(() => {
      const el = decRef.current;
      if (!el) return;
      const d = clampIdx(Math.round(el.scrollTop / ROW), DEC.length);
      if (d !== decVal) {
        setDecVal(d);
        report(intVal, d);
      }
    });
  }

  // 0.1 刻みで動かす(ホイールを smooth スクロールさせ、追従で state 更新)
  function bump(delta: number) {
    const next = clamp(
      Math.round((intVal + decVal / 10 + delta) * 10) / 10,
      min,
      max
    );
    const i = Math.floor(next + 1e-9);
    const d = Math.round((next - i) * 10);
    intRef.current?.scrollTo({ top: (i - min) * ROW, behavior: "smooth" });
    decRef.current?.scrollTo({ top: d * ROW, behavior: "smooth" });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="0.1 減らす"
        onClick={() => bump(-0.1)}
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[#cfe0d4] bg-[#eef5f0] text-[26px] font-extrabold text-[#4a875b] shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:scale-95"
      >
        −
      </button>

      <div
        className="relative flex flex-1 items-center justify-center gap-1 overflow-hidden rounded-xl border border-[#e7dcc9] bg-white"
        style={{ height: H }}
      >
        <div
          ref={setIntRef}
          onScroll={onIntScroll}
          className="wheel-scroll"
          style={{ height: H }}
        >
          <div style={{ height: PAD }} />
          {intValues.map((v) => (
            <div
              key={v}
              className={`wheel-item ${v === intVal ? "wheel-item-on" : ""}`}
              style={{ height: ROW }}
            >
              {v}
            </div>
          ))}
          <div style={{ height: PAD }} />
        </div>

        <span className="text-[20px] font-extrabold text-[#2b2620]">.</span>

        <div
          ref={setDecRef}
          onScroll={onDecScroll}
          className="wheel-scroll"
          style={{ height: H, minWidth: 44 }}
        >
          <div style={{ height: PAD }} />
          {DEC.map((v) => (
            <div
              key={v}
              className={`wheel-item ${v === decVal ? "wheel-item-on" : ""}`}
              style={{ height: ROW }}
            >
              {v}
            </div>
          ))}
          <div style={{ height: PAD }} />
        </div>

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

      <button
        type="button"
        aria-label="0.1 増やす"
        onClick={() => bump(0.1)}
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[#cfe0d4] bg-[#eef5f0] text-[26px] font-extrabold text-[#4a875b] shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:scale-95"
      >
        ＋
      </button>

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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function clampIdx(i: number, len: number): number {
  return Math.max(0, Math.min(len - 1, i));
}
