import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { isStaffPreviewUser } from "@/lib/auth/staff-preview";
import { MemberHeader } from "@/components/MemberHeader";
import { getFormReviewFirstDone } from "@/lib/form-review/status";
import {
  FORM_REVIEW_URL_FIRST,
  FORM_REVIEW_URL_REPEAT,
  FORM_REVIEW_PRICE_REPEAT,
} from "@/lib/form-review/config";
import styles from "./form-review.module.css";

export const dynamic = "force-dynamic";

/**
 * フォーム添削(5大機能②)。
 * - 社員4人(staff-preview)には LP調の新デザインを先行表示(仮反映)。
 * - それ以外のベータ利用者には従来の文章＋ボタンを表示。
 * 全体公開時は staffPreview 分岐を外して新デザインに寄せる。
 * 動線は案B: 初回未完了→初回0円ボタン有効 / 初回完了→0円ボタンを無効化(有料URLへ誘導)。
 */
export default async function FormReviewPage() {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const firstDone = await getFormReviewFirstDone();
  const staffPreview = await isStaffPreviewUser();

  return (
    <>
      <MemberHeader title="フォーム添削" fallbackHref="/" />
      {staffPreview ? (
        <NewDesign firstDone={firstDone} />
      ) : (
        <LegacyDesign firstDone={firstDone} />
      )}
    </>
  );
}

/** ボタン左のカレンダーアイコン */
function CalIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function Check() {
  return (
    <svg className={styles.chk} width="17" height="17" viewBox="0 0 24 24" fill="#2f6b3f">
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8 12.5l2.5 2.5 5-5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <div className={styles.arrow}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function NewDesign({ firstDone }: { firstDone: boolean }) {
  return (
    <main className={styles.page}>
      {/* ヒーロー（完成画像・横フルブリード） */}
      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.heroImg}
          src="/form-review/hero.png"
          alt="受講者は初回 完全無料でフォーム添削が受けられます"
        />
      </section>

      <div className={styles.body}>
        {/* 特徴チップ */}
        <div className={styles.feats}>
          <div className={styles.feat}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.featIc} src="/form-review/icon-chip-phone.png" alt="" />
            <span>
              スマホ1台で
              <br />
              参加OK
            </span>
          </div>
          <div className={styles.feat}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.featIc} src="/form-review/icon-chip-bubble.png" alt="" />
            <span>
              その場で
              <br />
              詳しく解説
            </span>
          </div>
          <div className={styles.feat}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.featIc} src="/form-review/icon-chip-shield.png" alt="" />
            <span>
              怪我予防・
              <br />
              効かせ方UP
            </span>
          </div>
        </div>

        {/* 安心カード */}
        <section className={styles.assure}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.assureIc} src="/form-review/icon-assure-heart.png" alt="" />
          <div>
            <h3>フォームに自信がなくても大丈夫</h3>
            <ul>
              <li>
                <Check />
                見せられるフォームがなくてもOK
              </li>
              <li>
                <Check />
                今のフォームをそのまま見せれば大丈夫
              </li>
              <li>
                <Check />
                良くないところがあるのは普通です
              </li>
            </ul>
          </div>
        </section>

        {/* 料金カード */}
        <div className={styles.prices}>
          {/* 初回0円（案B: 初回完了なら無効化） */}
          <div className={`${styles.price} ${firstDone ? styles.done : ""}`}>
            <span className={styles.pPill}>初回</span>
            <div className={styles.pAmt}>
              <b>0</b>
              <small>円</small>
            </div>
            <div className={styles.pNote}>
              {firstDone ? "初回はご利用済みです" : "受講者は初回、必ず無料"}
            </div>
            {firstDone ? (
              <span className={`${styles.pBtn} ${styles.btnGreen}`}>ご利用済み</span>
            ) : (
              <a
                className={`${styles.pBtn} ${styles.btnGreen}`}
                href={FORM_REVIEW_URL_FIRST}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalIcon />
                初回フォーム添削を
                <br />
                予約する →
              </a>
            )}
            <div className={styles.pFoot}>
              {firstDone ? "ありがとうございました" : "初めてご利用の方はこちら"}
            </div>
          </div>

          {/* 2回目以降（常に有効） */}
          <div className={`${styles.price} ${styles.gold}`}>
            <span className={styles.pPill}>2回目以降</span>
            <div className={`${styles.pAmt} ${styles.pAmtGold}`}>
              <b>{FORM_REVIEW_PRICE_REPEAT.toLocaleString()}</b>
              <small>円</small>
            </div>
            <div className={styles.pNote}>
              2回目以降も{FORM_REVIEW_PRICE_REPEAT.toLocaleString()}円で
              <br />
              何度でも受けられます
            </div>
            <a
              className={`${styles.pBtn} ${styles.btnGold}`}
              href={FORM_REVIEW_URL_REPEAT}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalIcon />
              2回目以降のフォーム添削を
              <br />
              予約する →
            </a>
            <div className={styles.pFoot}>2回目以降ご利用の方はこちら</div>
          </div>
        </div>

        {/* ご利用の流れ 3ステップ */}
        <div className={styles.flowT}>ご利用の流れ（3ステップ）</div>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.num}>1</div>
            <div className={styles.sic}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.stepIc} src="/form-review/icon-step-calendar.png" alt="" />
            </div>
            <span>予約する</span>
          </div>
          <Arrow />
          <div className={styles.step}>
            <div className={styles.num}>2</div>
            <div className={styles.sic}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.stepIc} src="/form-review/icon-step-mail.png" alt="" />
            </div>
            <span>メール確認</span>
          </div>
          <Arrow />
          <div className={styles.step}>
            <div className={styles.num}>3</div>
            <div className={styles.sic}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.stepIc} src="/form-review/icon-step-video.png" alt="" />
            </div>
            <span>Google Meetで実施</span>
          </div>
        </div>

        {/* ご利用の流れ ↔ 受講者の声 の区切り */}
        <div className={styles.secDivider} />

        {/* 受講者の声（完成画像） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.voicesImg} src="/form-review/voices.png" alt="受講者の声" />
      </div>
    </main>
  );
}

/** 従来デザイン(4人以外のベータ利用者向け)。文章＋単一ボタン。 */
function LegacyDesign({ firstDone }: { firstDone: boolean }) {
  const url = firstDone ? FORM_REVIEW_URL_REPEAT : FORM_REVIEW_URL_FIRST;
  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed]">
      <div className="mx-auto max-w-[460px] px-4 py-5">
        <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-5 py-6">
          {firstDone ? (
            <>
              <h1 className="text-[18px] font-extrabold text-[#2b2620]">
                フォーム、さらに磨きましょう
              </h1>
              <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-[#4a4436]">
                <p>
                  気になったときが、伸ばしどきです。トレーナーがオンラインで直接見て、その場で一緒に整えていきます。
                </p>
                <p>ボタンから予約ページへ進み、日にちと時間を指定してください。</p>
              </div>
              <div className="mt-4 rounded-xl bg-[#f3ede0] px-4 py-3 text-[12.5px] font-bold text-[#5b5344]">
                2回目以降は1回{" "}
                <span className="text-[#c2693f]">
                  {FORM_REVIEW_PRICE_REPEAT.toLocaleString()}円
                </span>
                。何度でも受けられます。1回あたり1時間前後が目安です。
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[18px] font-extrabold text-[#2b2620]">
                フォーム、いっしょに仕上げましょう
              </h1>
              <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-[#4a4436]">
                <p>
                  あなたのトレーニングフォームを、トレーナーが直接見ます。オンラインで画面をつなぎ、その場でやり取りしながら、気になるところをその日のうちに整えていきます。
                </p>
                <p>ボタンから予約ページへ進み、ご希望の日にちと時間を指定してください。</p>
              </div>
              <div className="mt-4 rounded-xl bg-[#eaf3ec] px-4 py-3 text-[12.5px] font-bold text-[#34603f]">
                初回は無料。まずは一度、今のフォームを見せてください。1回あたり1時間前後、じっくり向き合います。
              </div>
            </>
          )}

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex min-h-[52px] items-center justify-center rounded-xl btn3d px-5 text-[15px] font-bold text-white transition-colors"
          >
            フォーム添削を依頼する →
          </a>
          <p className="mt-2.5 text-center text-[11px] text-[#9a917f]">
            予約ページ（外部）が開きます
          </p>
        </div>
      </div>
    </main>
  );
}
