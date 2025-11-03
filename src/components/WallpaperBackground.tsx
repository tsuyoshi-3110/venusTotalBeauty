// components/WallpaperBackground.tsx
"use client";

import { useWallpaperUrl } from "@/hooks/useWallpaper";

export default function WallpaperBackground() {
  const url = useWallpaperUrl();

  if (!url || url.trim() === "") {
    return null; // URLが存在しない場合は表示しない
  }

  return (
    <div
  aria-hidden
  className="pointer-events-none fixed left-0 top-0 w-screen h-[100dvh] -z-20 bg-contain bg-center bg-no-repeat"
  style={{ backgroundImage: `url(${url})` }}
/>
  );
}
