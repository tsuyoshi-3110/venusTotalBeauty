// components/MediaWithSpinner.tsx
"use client";

import Image, { StaticImageData } from "next/image";
import clsx from "clsx";
import { useState } from "react";
import CardSpinner from "./CardSpinner";
import { useOnScreen } from "@/lib/useOnScreen";

type Src = string | StaticImageData;

interface Props {
  src: Src;
  type: "image" | "video";
  className?: string;
  /* video 用任意オプション */
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /* image 用任意オプション */
  alt?: string;
}

export default function MediaWithSpinner({
  src,
  type,
  className = "",
  autoPlay,
  loop,
  muted,
  alt = "",
}: Props) {
  /* ---------------- 共通 state ---------------- */
  const [loaded, setLoaded]   = useState(false);

  /* 画像向け：縦横判定・比率保持 */
  const [portrait, setPortrait] = useState(false);
  const [ratio, setRatio]       = useState<string | null>(null); // "w / h"

  /* 画面内判定（動画の自動再生／停止用）*/
  const [targetRef, visible] = useOnScreen<HTMLDivElement>("100px");

  /* ===================== VIDEO ===================== */
  if (type === "video") {
    return (
      <div ref={targetRef} className={clsx("relative w-full", className)}>
        {/* スピナー */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <CardSpinner />
          </div>
        )}

        <video
          /* ビューポート内に入ったら src を付与（帯域節約） */
          src={visible && typeof src === "string" ? src : undefined}
          className={clsx(
            "w-full h-full object-cover",
            loaded ? "visible" : "invisible"
          )}
          playsInline
          muted={muted ?? true}
          autoPlay={visible && (autoPlay ?? true)}
          loop={visible && loop}
          preload="metadata"
          onLoadedData={() => setLoaded(true)}
        />
      </div>
    );
  }

  /* ---------------- image ----------------- */
  return (
    <div
      className={clsx(
        "relative w-full", // ★ portrait でも幅100%
        portrait ? "" : "overflow-hidden", // ★ 横長のみトリミング
        className
      )}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <CardSpinner />
        </div>
      )}

      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width:768px) 100vw, 768px"
        className={clsx(
          portrait ? "object-contain" : "object-cover", // ★ 切替
          "rounded transition-opacity",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={({ currentTarget }) => {
          const { naturalWidth: w, naturalHeight: h } = currentTarget;
          if (w && h) {
            setPortrait(h > w); // ★ 判定
            setRatio(`${w} / ${h}`); // ★ aspect-ratio
          }
          setLoaded(true);
        }}
        priority={false}
        unoptimized 
      />
    </div>
  );

}
