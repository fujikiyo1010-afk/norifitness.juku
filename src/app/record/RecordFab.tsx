"use client";

/**
 * 記録FAB (2026-07-06 確定: 円形ビビッド緑 + 立体(球体陰影) + 単一脈動リング)
 *
 * 右下に常駐。押すと体組成の記録シートが下からせり上がる。
 * 下部ナビ(約60px+safe-area)の上に浮かせる。
 */
export function RecordFab({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="record-fab-wrap"
      style={{
        position: "fixed",
        right: 16,
        bottom: "calc(70px + env(safe-area-inset-bottom))",
        width: 60,
        height: 60,
        zIndex: 30,
      }}
    >
      <span className="record-fab-sonar" aria-hidden />
      <button
        type="button"
        onClick={onClick}
        aria-label="体組成を記録する"
        className="record-fab-orb"
      >
        <span>＋</span>
      </button>

      <style jsx>{`
        .record-fab-orb {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          color: #fff;
          font-size: 30px;
          font-weight: 700;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(
            circle at 34% 28%,
            #63c98a,
            #2fa35d 58%,
            #218a4c
          );
          box-shadow:
            0 10px 22px rgba(33, 138, 76, 0.5),
            0 3px 6px rgba(0, 0, 0, 0.28),
            inset 0 2px 3px rgba(255, 255, 255, 0.6),
            inset 0 -5px 9px rgba(0, 0, 0, 0.24);
          transition: transform 0.12s ease;
        }
        .record-fab-orb:active {
          transform: scale(0.94);
        }
        .record-fab-orb span {
          margin-top: -2px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }
        .record-fab-sonar {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid rgba(47, 163, 93, 0.55);
          z-index: -1;
          animation: record-fab-sonar 1.9s ease-out infinite;
        }
        @keyframes record-fab-sonar {
          0% {
            transform: scale(0.92);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .record-fab-sonar {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
