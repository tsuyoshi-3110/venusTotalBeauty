/* components/ProductMedia.tsx */
"use client";

import Image, { StaticImageData } from "next/image";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import CardSpinner from "./CardSpinner";
import { useOnScreen } from "@/lib/useOnScreen";

type Src = string | StaticImageData;
interface Props {
  src: Src;
  type: "image" | "video";
  className?: string;
  autoPlay?: boolean; // 既定: true
  loop?: boolean;     // 既定: true
  muted?: boolean;    // 既定: true
  alt?: string;
}

export default function ProductMedia({
  src,
  type,
  className = "",
  autoPlay = true,
  loop = true,
  muted = true,
  alt = "",
}: Props) {
  const [loaded, setLoaded] = useState(false);
  // 画面に入る少し前からプリロードを始めたいので rootMargin を広めに
  const [ref, visible] = useOnScreen<HTMLDivElement>("600px");

  /* =======================
     VIDEO
  ======================= */
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 可視/不可視で再生制御（即時）
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) {
      const p = v.play();
      // iOS等でまれにrejectされても無害なので握りつぶす
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
      // 省エネしたい場合はコメントアウト解除
      // v.currentTime = 0;
    }
  }, [visible]);

  if (type === "video") {
    return (
      <div
        ref={ref}
        className={clsx("relative w-full aspect-square overflow-hidden", className)}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <CardSpinner />
          </div>
        )}

        <video
          ref={videoRef}
          // ← ここがポイント：常に src を与えて先に読み込ませる
          src={typeof src === "string" ? src : undefined}
          className={clsx(
            "absolute inset-0 w-full h-full object-cover",
            loaded ? "visible" : "invisible"
          )}
          playsInline
          muted={muted}        // iOSの自動再生要件
          autoPlay={autoPlay}  // 属性も立てておくとブラウザが好む
          loop={loop}
          // 可視手前でメタデータだけ、入ったら全量プリロード
          preload={visible ? "auto" : "metadata"}
          onLoadedMetadata={() => setLoaded(true)}
          onLoadedData={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
    );
  }

  /* =======================
     IMAGE
  ======================= */
  return (
    <div ref={ref} className={clsx("relative w-full aspect-square overflow-hidden", className)}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <CardSpinner />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={clsx("object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw"
        onLoadingComplete={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        priority={false}
        unoptimized
      />
    </div>
  );
}
