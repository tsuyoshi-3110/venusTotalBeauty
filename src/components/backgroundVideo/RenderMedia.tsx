import Slideshow from "../Slideshow";
import NextImage from "next/image";
import React from "react";

type MediaType = "video" | "image";

type RenderMediaProps = {
  poster?: string | null;
  setReady: (ready: boolean) => void;
  type: MediaType;
  url?: string | null;
  imageUrls?: string[];
  isPortrait: boolean | null; // ← 親から受け取る
  setIsPortrait: (value: boolean) => void; // ← 親から受け取る
};

export function RenderMedia({
  poster,
  setReady,
  type,
  url,
  imageUrls = [],
  isPortrait,
  setIsPortrait,
}: RenderMediaProps) {
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    setIsPortrait(ratio < 1);
    setReady(true);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setIsPortrait(video.videoWidth < video.videoHeight);
    setReady(true);
  };

  if (type === "video" && url) {
    return (
      <video
        key={url}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={poster ?? ""}
        onLoadedMetadata={handleLoadedMetadata}
        className={`absolute inset-0 w-full h-full ${
          isPortrait ? "object-cover" : "object-contain"
        }`}
      >
        <source src={url} type="video/mp4" />
      </video>
    );
  }

  if (type === "image" && imageUrls.length === 1) {
    return (
      <NextImage
        src={imageUrls[0]}
        alt="背景画像"
        fill
        sizes="100vw"
        priority
        className={`absolute inset-0 w-full h-full ${
          isPortrait ? "object-cover" : "object-contain"
        }`}
        onLoad={handleImageLoad}
      />
    );
  }

  if (type === "image" && imageUrls.length > 1) {
    return <Slideshow urls={imageUrls} onFirstLoad={() => setReady(true)} />;
  }

  return null;
}
