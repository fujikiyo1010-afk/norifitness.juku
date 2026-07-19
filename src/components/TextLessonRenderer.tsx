"use client";

import { useState } from "react";
import { LessonImageZoom } from "@/components/LessonImageZoom";

/**
 * テキストレッスン レンダラー (= 2026-06-23 きよむさん指示)
 *
 * 動画じゃないレッスン (= モンクモード解説 等) を アコーディオン形式で表示。
 * 縦長問題回避: 初期は全閉じ = 目次だけ表示 → タップで展開。
 *
 * データ構造 (= lessons.content_json):
 *   {
 *     "sections": [
 *       {
 *         "title": "第 1 部 ・ 時間管理術",
 *         "steps": [
 *           { "title": "1. 活動記録シートを準備する", "body": "...", "images": ["/lessons/.../1.jpeg"] }
 *         ]
 *       }
 *     ]
 *   }
 */

export type TextLessonStep = {
  title: string;
  /** 段落区切りは \n\n / リスト項目は 行頭「- 」 */
  body: string;
  images?: string[];
};

export type TextLessonSection = {
  title: string;
  steps: TextLessonStep[];
};

export type TextLessonContent = {
  sections: TextLessonSection[];
};

export function TextLessonRenderer({
  content,
  fullBleedImages = false,
}: {
  content: TextLessonContent;
  /** 画像を枠内フルブリード(左右上下の余白ゼロ)で表示。レシピ写真用。 */
  fullBleedImages?: boolean;
}) {
  return (
    <div className="space-y-5">
      {content.sections.map((section, sIdx) => (
        <Section key={sIdx} section={section} fullBleedImages={fullBleedImages} />
      ))}
    </div>
  );
}

function Section({
  section,
  fullBleedImages,
}: {
  section: TextLessonSection;
  fullBleedImages?: boolean;
}) {
  return (
    <div>
      {section.title.trim() && (
        <h3 className="text-[13px] font-bold text-[#34603f] border-l-4 border-[#4a875b] pl-2.5 mb-2.5">
          {section.title}
        </h3>
      )}
      <div className="space-y-1.5">
        {section.steps.map((step, idx) => (
          <StepAccordion key={idx} step={step} fullBleedImages={fullBleedImages} />
        ))}
      </div>
    </div>
  );
}

function StepAccordion({
  step,
  fullBleedImages,
}: {
  step: TextLessonStep;
  fullBleedImages?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3.5 py-3 flex items-center gap-2 text-left hover:bg-[#f5f1e8] transition-colors"
        aria-expanded={open}
      >
        <span
          className={`text-[10px] text-[#34603f] font-mono transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <span className="text-[13px] font-semibold text-[#2b2620] flex-1">
          {step.title}
        </span>
      </button>
      {open && (
        <div className="px-4 py-3.5 border-t border-[#e7dcc9] space-y-3 text-[13px] text-[#2b2620] leading-[1.8]">
          <StepBody body={step.body} />
          {step.images && step.images.length > 0 && (
            <div
              className={
                fullBleedImages ? "-mx-4 -mt-3.5 -mb-3.5 space-y-0" : "space-y-2 pt-1"
              }
            >
              {step.images.map((src, idx) =>
                fullBleedImages ? (
                  <LessonImageZoom
                    key={idx}
                    src={src}
                    thumbClassName="w-full block"
                  />
                ) : (
                  <img
                    key={idx}
                    src={src}
                    alt=""
                    className="w-full rounded-md border border-[#e7dcc9]"
                    loading="lazy"
                  />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 段落 / リスト の最小限のレンダリング。
 * - 空行 = 段落区切り
 * - 行頭「- 」 = リスト項目 (= 連続した行はまとめて 1 つの <ul>)
 */
function StepBody({ body }: { body: string }) {
  const blocks: Array<{ type: "p" | "ul"; lines: string[] }> = [];
  const paragraphs = body.split(/\n{2,}/);
  for (const para of paragraphs) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const isList = lines.every((l) => l.startsWith("- "));
    if (isList) {
      blocks.push({ type: "ul", lines: lines.map((l) => l.slice(2)) });
    } else {
      blocks.push({ type: "p", lines });
    }
  }
  return (
    <>
      {blocks.map((block, idx) => {
        if (block.type === "ul") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {block.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-line">
            {block.lines.join("\n")}
          </p>
        );
      })}
    </>
  );
}
