"use client";

import React from "react";
import clsx from "clsx";

type Props = {
  label?: string;
  size?: number;   // 絵文字サイズ(px)
  speed?: number;  // 1 = 標準
  className?: string;
};

export default function BroomDustLoader({
  label = "お掃除中…",
  size = 15,
  speed = 1,
  className = "",
}: Props) {
  const base = 1.1; // s
  const duration = `${base / Math.max(speed, 0.1)}s`;

  const dustCount = 14; // 少し増やす
  const dusts = Array.from({ length: dustCount });

  return (
    <div
      className={clsx(
        "relative inline-flex flex-col items-center justify-center gap-2 select-none",
        "pointer-events-none",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
      style={
        {
          "--t": duration,
          "--px": `${size}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="relative"
        style={{ width: "calc(var(--px) * 1.3)", height: "calc(var(--px) * 0.95)" }}
      >
        {/* 左右に掃く動き（直立のまま） */}
        <div className="broom-wrap absolute inset-0 flex items-end justify-center">
          {/* 直立したホウキ */}
          <div className="broom text-[length:var(--px)] leading-none">
            🧹
          </div>

          {/* 白っぽい埃（毛先から舞う） */}
          {dusts.map((_, i) => {
            const delay = `calc(var(--t) * ${(i % 7) / 7})`;
            const sign = i % 2 === 0 ? 1 : -1;
            const spread = 20 + (i % 4) * 7;  // 横拡散
            const lift = 18 + (i % 3) * 7;    // 縦揚力
            const scaleTo = 1.15 + (i % 3) * 0.12;
            return (
              <div
                key={i}
                className="dust absolute"
                style={
                  {
                    animationDelay: delay,
                    "--dx": `${sign * spread}px`,
                    "--dy": `${-lift}px`,
                    "--s": scaleTo,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      </div>

      {label !== "" && (
        <div className="text-xs font-medium text-gray-800/85">{label}</div>
      )}

      <style jsx>{`
        /* 直立のまま左右へ。幅は控えめでキビキビ */
        .broom-wrap {
          animation: sweepX var(--t) ease-in-out infinite alternate;
        }
        @keyframes sweepX {
          0%   { transform: translateX(-16%); }
          100% { transform: translateX( 16%); }
        }

        /* 直立維持。少しだけ上下移動で“掃く”感を追加（回転は無し） */
        .broom {
          display: inline-block;
          transform-origin: 50% 100%;
          animation: sweepLift var(--t) ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes sweepLift {
          0%   { transform: translateY(1px); }
          100% { transform: translateY(-1px); }
        }

        /* 背景は透明のまま */

        /* 白っぽい埃：サイズや明度を上げ、ドロップシャドウで視認性UP */
        .dust {
          left: 16%;
          bottom: 10%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background:
            radial-gradient(
              circle,
              rgba(255,255,255,0.95) 0%,   /* 中心ほぼ白 */
              rgba(255,255,255,0.75) 45%,  /* 外側も白寄り */
              rgba(255,255,255,0.00) 72%
            );
          /* わずかなぼかし + 光彩で背景上でも目立つ */
          filter: blur(0.2px) drop-shadow(0 0 2px rgba(255,255,255,0.85));
          opacity: 0;
          animation: dustPuff calc(var(--t) * 1.15) ease-out infinite;
          will-change: transform, opacity;
        }

        @keyframes dustPuff {
          0%   { transform: translate(0, 0) scale(0.65); opacity: 0; }
          10%  { opacity: 0.95; }
          100% {
            transform: translate(var(--dx), var(--dy)) scale(var(--s));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
