"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { saveShipmentAddress } from "./actions";
import { toggleEmailNotification } from "@/lib/account/actions";
import {
  detectBrowserEnv,
  isStandaloneDisplay,
  type BrowserEnv,
} from "@/lib/browser-check";

const TOTAL_STEPS = 8;

export function OnboardingClient({
  defaultRecipientName,
}: {
  defaultRecipientName: string;
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 環境判定 (= 共通ヘルパー browser-check.ts を使用)
  //   - "loading"        : SSR 直後 / 判定中
  //   - "ready"          : PWA standalone 起動 → Step 1 ようこそ から開始
  //   - "ios-safari"     : iOS Safari = ホーム追加促し (= Step 0 / 共有メニュー手順)
  //   - "android-chrome" : Android Chrome = ホーム追加促し (= 三点メニュー手順)
  //   - "ios-other" / "android-other" / "desktop" : ブラウザ切替案内 (= 別画面)
  type EnvState = "loading" | "ready" | BrowserEnv;
  const [envState, setEnvState] = useState<EnvState>("loading");
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) {
      setEnvState("ready");
      return;
    }
    setCurrentUrl(window.location.href);
    setEnvState(detectBrowserEnv());
  }, []);

  const [postalCode, setPostalCode] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [building, setBuilding] = useState("");
  const [recipientName, setRecipientName] = useState(defaultRecipientName);

  const step6Valid =
    postalCode.trim().length > 0 &&
    addressLine.trim().length > 0 &&
    recipientName.trim().length > 0;

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleStep6Submit() {
    if (!step6Valid || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveShipmentAddress({
        postalCode: postalCode.trim(),
        addressLine: addressLine.trim(),
        building: building.trim(),
        recipientName: recipientName.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep(7);
    });
  }

  function finish() {
    router.push("/");
  }

  // 判定中 (= SSR / hydration 直後) は空白で待つ (= 一瞬のちらつき防止)
  if (envState === "loading" || envState === "unknown") {
    return <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen" />;
  }

  // PWA 化不可ブラウザ (= iOS 他 / Android 他 / PC) → 切替案内
  if (
    envState === "ios-other" ||
    envState === "android-other" ||
    envState === "desktop"
  ) {
    return <BrowserSwitchGuide env={envState} currentUrl={currentUrl} />;
  }

  // iOS Safari (= PWA 未追加) → 共有メニュー手順 (= Step 0)
  if (envState === "ios-safari") {
    return <Step0InstallGuide variant="ios-safari" />;
  }

  // Android Chrome (= PWA 未追加) → 三点メニュー手順 (= Step 0)
  if (envState === "android-chrome") {
    return <Step0InstallGuide variant="android-chrome" />;
  }

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <div
          className="flex-1 flex flex-col px-5 pt-6 pb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
        >
          <div className="absolute -top-20 -right-20 w-[200px] h-[200px] rounded-full bg-[#4a875b]/[0.04] pointer-events-none" />

          <StepIndicator current={step} total={TOTAL_STEPS} />

          <div className="flex-1 flex flex-col z-10 min-h-0">
            {step === 1 && <Step1 />}
            {step === 2 && <Step2 />}
            {step === 3 && <StepIntro
              icon={<DocIcon />}
              title="カルテ"
              lead={<>あなた専用の<br/><b>筋トレメニュー</b>を作るための情報</>}
              detail="性別 / 年齢 / 重点部位 / 環境 / 頻度 / 経験 / けが など"
              after="ホーム画面からあとで記入してください"
            />}
            {step === 4 && <StepIntro
              icon={<TargetIcon />}
              title="目標管理シート"
              lead={<><b>ゴールの言語化</b>が<br/>達成への第一歩</>}
              detail="目標体重 / 短期目標 / 長期目標 / プロセス / PFC など"
              after="ホーム画面からあとで記入してください"
            />}
            {step === 5 && <StepIntro
              icon={<ChartIcon />}
              title="体組成記録"
              lead={<>成長のための<br/><b>基準値</b>を把握する</>}
              detail="体重 / 体脂肪率 / ウエスト / 首回り / 身長 など"
              after="ホーム画面からあとで記録してください"
            />}
            {step === 6 && (
              <Step6Form
                postalCode={postalCode}
                onPostalCodeChange={setPostalCode}
                addressLine={addressLine}
                onAddressLineChange={setAddressLine}
                building={building}
                onBuildingChange={setBuilding}
                recipientName={recipientName}
                onRecipientNameChange={setRecipientName}
                disabled={isPending}
              />
            )}
            {step === 7 && (
              <Step7Permission
                onPermit={async () => {
                  await toggleEmailNotification(true);
                  setStep(8);
                }}
                onSkip={async () => {
                  await toggleEmailNotification(false);
                  setStep(8);
                }}
              />
            )}
            {step === 8 && <Step8 />}
          </div>

          {error && (
            <div className="z-10 mb-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}

          {step < 8 ? (
            <Footer
              showBack={step > 1}
              onBack={back}
              onNext={step === 6 ? handleStep6Submit : next}
              nextLabel={
                step === 6
                  ? isPending
                    ? "登録中..."
                    : "登録して次へ →"
                  : "次へ →"
              }
              nextDisabled={step === 6 ? !step6Valid || isPending : false}
              nextFaded={step === 7}
            />
          ) : (
            <div className="z-10 pt-3 border-t border-dashed border-[#4a875b]/15">
              <button
                onClick={finish}
                className="w-full bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl py-3.5 text-sm font-bold shadow-md shadow-[#4a875b]/25 transition-colors"
              >
                筋肉塾を始める →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// Step Indicator (上部 8 ドット)
// =====================================================================

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-1 mb-5 z-10">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const state =
          idx < current ? "done" : idx === current ? "active" : "todo";
        return (
          <div
            key={idx}
            className={`w-[18px] h-[4px] rounded-sm transition-colors ${
              state === "todo"
                ? "bg-[#4a875b]/[0.18]"
                : state === "active"
                  ? "bg-[#4a875b]"
                  : "bg-[#34603f]"
            }`}
          />
        );
      })}
    </div>
  );
}

// =====================================================================
// Footer (戻る + 次へ)
// =====================================================================

function Footer({
  showBack,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  nextFaded,
}: {
  showBack: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled: boolean;
  nextFaded?: boolean;
}) {
  return (
    <div className="z-10 flex items-center justify-between gap-3 pt-3 border-t border-dashed border-[#4a875b]/15">
      <button
        type="button"
        onClick={onBack}
        className={`text-xs text-[#6a6256] px-3 py-2 ${showBack ? "" : "invisible"}`}
      >
        ← 戻る
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={`bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl px-5 py-2.5 text-[12.5px] font-bold shadow-md shadow-[#4a875b]/25 transition-colors ${
          nextDisabled ? "opacity-45 cursor-not-allowed" : ""
        } ${nextFaded ? "opacity-50" : ""}`}
      >
        {nextLabel}
      </button>
    </div>
  );
}

// =====================================================================
// Step -1: ブラウザ切替案内 (iOS 他 / Android 他 / PC で開かれた時)
//   - 環境ごとに「正しいブラウザ」 を案内 + URL コピーボタン
// =====================================================================

function BrowserSwitchGuide({
  env,
  currentUrl,
}: {
  env: BrowserEnv;
  currentUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const config =
    env === "ios-other"
      ? {
          title: "Safari で\n開いてください",
          lead: (
            <>
              iPhone のホーム画面追加 (= アプリ化) は
              <br />
              <b className="text-[#004d40] font-bold">Safari でのみできます</b>
            </>
          ),
          appName: "Safari",
          appHint: "青い羅針盤アイコン",
        }
      : env === "android-other"
        ? {
            title: "Chrome で\n開いてください",
            lead: (
              <>
                Android のホーム画面追加 (= アプリ化) は
                <br />
                <b className="text-[#004d40] font-bold">Chrome がおすすめです</b>
              </>
            ),
            appName: "Chrome",
            appHint: "赤緑黄青の丸アイコン",
          }
        : {
            title: "スマホで\n開いてください",
            lead: (
              <>
                筋肉塾はスマホでお使いいただくサービスです。
                <br />
                <b className="text-[#004d40] font-bold">
                  iPhone Safari か Android Chrome
                </b>
                でお進みください
              </>
            ),
            appName: "スマホのブラウザ",
            appHint: "iPhone Safari か Android Chrome",
          };

  async function handleCopy() {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <div
          className="flex-1 flex flex-col px-5 pt-6 pb-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
        >
          <div className="absolute -top-20 -right-20 w-[200px] h-[200px] rounded-full bg-[#4a875b]/[0.04] pointer-events-none" />

          <div className="flex-1 flex flex-col items-center justify-center text-center z-10">
            <div className="w-[110px] h-[110px] rounded-full shadow-lg shadow-[#4a875b]/20 mb-5 overflow-hidden bg-[#fffdf8] anim-char-pop">
              <div className="w-full h-full relative scale-[1.2]">
                <Image
                  src="/images/nori-character.png"
                  alt="のりキャラクター"
                  fill
                  sizes="110px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1 whitespace-pre-line">
              {config.title}
            </h1>
            <p className="text-xs text-zinc-600 leading-relaxed anim-fade-up anim-delay-2">
              {config.lead}
            </p>

            <div className="mt-6 w-full bg-[#fffdf8] border border-[#4a875b]/15 rounded-xl px-4 py-4 text-left anim-fade-up anim-delay-3">
              <div className="text-[11px] font-bold text-[#004d40] tracking-widest mb-3">
                開き直す手順
              </div>
              <ol className="space-y-3 text-[12.5px] text-[#2b2620] leading-relaxed">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
                    1
                  </span>
                  <span>下の <b>URL をコピー</b> ボタンをタップ</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
                    2
                  </span>
                  <span>
                    ホーム画面の <b>{config.appName}</b> ({config.appHint}) を起動
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
                    3
                  </span>
                  <span>
                    URL バーを長押し → <b>「ペースト」</b> → 開く
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={handleCopy}
                className="mt-4 w-full bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl py-3 text-[12.5px] font-bold shadow-md shadow-[#4a875b]/25 transition-colors"
              >
                {copied ? "✓ URL をコピーしました" : "URL をコピー"}
              </button>

              <p className="mt-3 text-[10px] text-[#6a6256] break-all font-mono leading-relaxed">
                {currentUrl}
              </p>
            </div>

            <p className="mt-5 text-[10.5px] text-[#6a6256] leading-relaxed anim-fade-up anim-delay-3">
              {config.appName} で開き直すと、 そのまま続きから始まります
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// Step 0: ホーム画面追加促し (= PWA 化前の最終ステップ)
//   - iOS Safari: 画面下の共有ボタン → ホーム画面に追加
//   - Android Chrome: 三点メニュー → アプリをインストール
//   - 進行ボタンなし = PWA から開き直すまで先に進めない
// =====================================================================

function Step0InstallGuide({
  variant,
}: {
  variant: "ios-safari" | "android-chrome";
}) {
  const isAndroid = variant === "android-chrome";

  const steps = isAndroid
    ? [
        <>
          画面右上の <MoreIcon /> <b>三点メニュー</b> をタップ
        </>,
        <>
          メニューから <b>「アプリをインストール」</b> または{" "}
          <b>「ホーム画面に追加」</b> を選ぶ
        </>,
        <>
          ホーム画面の <b>筋肉塾アイコン</b> をタップして再開
        </>,
      ]
    : [
        <>
          画面下の <ShareIcon /> <b>共有ボタン</b> をタップ
        </>,
        <>
          メニューから <b>「ホーム画面に追加」</b> を選ぶ
        </>,
        <>
          ホーム画面の <b>筋肉塾アイコン</b> をタップして再開
        </>,
      ];

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <div
          className="flex-1 flex flex-col px-5 pt-6 pb-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
        >
          <div className="absolute -top-20 -right-20 w-[200px] h-[200px] rounded-full bg-[#4a875b]/[0.04] pointer-events-none" />

          <div className="flex-1 flex flex-col items-center justify-center text-center z-10">
            <div className="w-[110px] h-[110px] rounded-full shadow-lg shadow-[#4a875b]/20 mb-5 overflow-hidden bg-[#fffdf8] anim-char-pop">
              <div className="w-full h-full relative scale-[1.2]">
                <Image
                  src="/images/nori-character.png"
                  alt="のりキャラクター"
                  fill
                  sizes="110px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1">
              アプリとして
              <br />
              開いてください
            </h1>
            <p className="text-xs text-zinc-600 leading-relaxed anim-fade-up anim-delay-2">
              はじめに、 ホーム画面に追加して
              <br />
              <b className="text-[#004d40] font-bold">アプリで進めましょう</b>
            </p>

            <div className="mt-6 w-full bg-[#fffdf8] border border-[#4a875b]/15 rounded-xl px-4 py-4 text-left anim-fade-up anim-delay-3">
              <div className="text-[11px] font-bold text-[#004d40] tracking-widest mb-3">
                ホーム画面 追加の手順
              </div>
              <ol className="space-y-3 text-[12.5px] text-[#2b2620] leading-relaxed">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[11px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-5 text-[10.5px] text-[#6a6256] leading-relaxed anim-fade-up anim-delay-3">
              アプリで開き直すと、
              <br />
              そのまま続きから始まります
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// 共有アイコン (iOS Safari = 四角 + 上矢印)
function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4a875b"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block align-text-bottom mx-0.5"
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

// 三点メニュー アイコン (Android Chrome = 縦 3 点)
function MoreIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="#4a875b"
      className="inline-block align-text-bottom mx-0.5"
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

// =====================================================================
// Step 1: ウェルカム
// =====================================================================

function Step1() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center z-10 pb-4">
      <div className="w-[110px] h-[110px] rounded-full shadow-lg shadow-[#4a875b]/20 mb-5 overflow-hidden bg-[#fffdf8] anim-char-pop">
        <div className="w-full h-full relative scale-[1.2]">
          <Image
            src="/images/nori-character.png"
            alt="のりキャラクター"
            fill
            sizes="110px"
            className="object-cover"
            priority
          />
        </div>
      </div>
      <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1">
        ようこそ
        <br />
        筋肉塾へ
      </h1>
      <p className="text-xs text-zinc-600 leading-relaxed anim-fade-up anim-delay-2">
        のりfitness が運営する
        <br />
        ダイエット学習サービスです
      </p>
    </div>
  );
}

// =====================================================================
// Step 2: 月次添削の説明
// =====================================================================

function Step2() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center z-10 pb-4">
      <div className="w-20 h-20 mb-4 rounded-2xl border border-[rgba(255,235,59,.5)] bg-[rgba(255,235,59,.12)] flex items-center justify-center anim-char-pop">
        <MailIcon />
      </div>
      <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1">
        月に 1 回の
        <br />
        動画返信
      </h1>
      <p className="text-xs text-zinc-600 leading-relaxed anim-fade-up anim-delay-2">
        あなたの月次振り返りに
        <br />
        <b className="text-[#004d40] font-bold">
          のりfitness が動画で返信
        </b>
        します
      </p>
      <p className="text-[10px] text-[#6a6256] mt-3 anim-fade-up anim-delay-3">
        これが筋肉塾の最大の特徴です
      </p>
    </div>
  );
}

// =====================================================================
// Step 3-5: 紹介画面共通 (カルテ / 目標 / 体組成)
// =====================================================================

function StepIntro({
  icon,
  title,
  lead,
  detail,
  after,
}: {
  icon: React.ReactNode;
  title: string;
  lead: React.ReactNode;
  detail: string;
  after: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center z-10 pb-4">
      <div className="w-20 h-20 mb-4 rounded-2xl border border-[rgba(255,235,59,.5)] bg-[rgba(255,235,59,.12)] flex items-center justify-center anim-char-pop">
        {icon}
      </div>
      <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1">
        {title}
      </h1>
      <p className="text-xs text-zinc-600 leading-relaxed mb-2 anim-fade-up anim-delay-2">
        {lead}
      </p>
      <p className="text-[11px] text-[#6a6256] leading-relaxed anim-fade-up anim-delay-2">{detail}</p>

      <div className="mt-5 bg-[#4a875b]/[0.06] border-l-[3px] border-[#4a875b] rounded-sm px-3.5 py-2.5 text-[11px] text-[#004d40] anim-fade-up anim-delay-3">
        {after}
      </div>
    </div>
  );
}

// =====================================================================
// Step 6: プロテイン発送先 (実入力)
// =====================================================================

function Step6Form({
  postalCode,
  onPostalCodeChange,
  addressLine,
  onAddressLineChange,
  building,
  onBuildingChange,
  recipientName,
  onRecipientNameChange,
  disabled,
}: {
  postalCode: string;
  onPostalCodeChange: (v: string) => void;
  addressLine: string;
  onAddressLineChange: (v: string) => void;
  building: string;
  onBuildingChange: (v: string) => void;
  recipientName: string;
  onRecipientNameChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col z-10 pb-3">
      <div className="text-[13px] font-bold text-[#004d40] bg-[#4a875b]/[0.06] border-l-[3px] border-[#4a875b] rounded-sm px-2.5 py-1.5 mb-3">
        プロテイン発送先の登録
      </div>

      <div className="text-base font-bold text-[#004d40] mb-4 leading-snug">
        入塾特典の
        <br />
        プロテインをお届け
      </div>

      <div className="flex flex-col gap-2.5 mb-3">
        <Field
          label="郵便番号"
          required
          value={postalCode}
          onChange={onPostalCodeChange}
          placeholder="123-4567"
          autoComplete="postal-code"
          inputMode="numeric"
          disabled={disabled}
        />
        <Field
          label="住所 (都道府県 + 市区町村 + 番地)"
          required
          value={addressLine}
          onChange={onAddressLineChange}
          placeholder="東京都渋谷区 神宮前 1-2-3"
          autoComplete="street-address"
          disabled={disabled}
        />
        <Field
          label="建物名 ・ 部屋番号 (任意)"
          value={building}
          onChange={onBuildingChange}
          placeholder="○○マンション 101 号室"
          autoComplete="address-line2"
          disabled={disabled}
        />
        <Field
          label="受取人氏名"
          required
          hint="氏名を自動反映、変更可能"
          value={recipientName}
          onChange={onRecipientNameChange}
          autoComplete="name"
          disabled={disabled}
        />
      </div>

      <div className="bg-[rgba(255,235,59,.10)] border border-dashed border-[rgba(255,235,59,.5)] rounded-md px-3 py-2 text-[10.5px] text-zinc-600 leading-relaxed">
        <ul className="space-y-0.5">
          <li>・ のりfitness 自社開発プロテインを 1 個お届けします</li>
          <li>・ 申し込み確認後、 数日以内に発送</li>
          <li>・ 引っ越し等で住所変更したい場合は「プロフィール」から変更可能</li>
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  disabled,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-zinc-600 flex items-center gap-1">
        {label}
        {required && (
          <span className="text-[#c44] text-[8.5px] font-bold">必須</span>
        )}
        {hint && (
          <span className="text-[9px] text-[#a59b8c] font-normal ml-1">
            ({hint})
          </span>
        )}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        className="border border-zinc-300 rounded-md px-2.5 py-1.5 text-[11.5px] bg-[#fffdf8] text-[#2b2620] outline-none focus:border-[#4a875b] focus:ring-2 focus:ring-[#4a875b]/30"
      />
    </div>
  );
}

// =====================================================================
// Step 7: 通知許可
// =====================================================================

function Step7Permission({
  onPermit,
  onSkip,
}: {
  onPermit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center z-10 pb-4">
      <div className="w-20 h-20 mb-4 rounded-2xl border border-[#4a875b]/20 bg-[#4a875b]/[0.08] flex items-center justify-center">
        <BellIcon />
      </div>
      <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5">
        メール通知を
        <br />
        ON にする
      </h1>
      <p className="text-xs text-zinc-600 leading-relaxed">
        のり氏からの月次添削返信や
        <br />
        大切なお知らせをメールで
        <br />
        受け取ります
      </p>

      <div className="w-full mt-4">
        <button
          type="button"
          onClick={onPermit}
          className="w-full bg-[#4a875b] hover:bg-[#34603f] text-white rounded-xl py-3 text-[13px] font-bold shadow-md shadow-[#4a875b]/25 transition-colors mb-2"
        >
          メール通知を ON にする
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="block w-full text-[11px] text-[#a59b8c] py-1.5 hover:text-zinc-600 transition-colors"
        >
          OFF のまま進む (後で /設定 から変更可)
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Step 8: 完了
// =====================================================================

function Step8() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center z-10 pb-4">
      <div className="w-[110px] h-[110px] rounded-full shadow-lg shadow-[#4a875b]/20 mb-5 overflow-hidden bg-[#fffdf8] anim-char-pop">
        <div className="w-full h-full relative scale-[1.2]">
          <Image
            src="/images/nori-character.png"
            alt="のりキャラクター"
            fill
            sizes="110px"
            className="object-cover"
          />
        </div>
      </div>
      <h1 className="text-[20px] font-bold text-[#004d40] leading-snug mb-2.5 anim-fade-up anim-delay-1">
        準備完了!
      </h1>
      <p className="text-xs text-zinc-600 leading-relaxed anim-fade-up anim-delay-2">
        さあ、 学びを
        <br />
        <b className="text-[#004d40] font-bold">はじめましょう</b>
      </p>
    </div>
  );
}

// =====================================================================
// Icons (線画 SVG)
// =====================================================================

const ICO_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#004d40",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function MailIcon() {
  return (
    <svg width="40" height="40" {...ICO_PROPS}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="40" height="40" {...ICO_PROPS}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="40" height="40" {...ICO_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="40" height="40" {...ICO_PROPS}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="40" height="40" {...ICO_PROPS}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
