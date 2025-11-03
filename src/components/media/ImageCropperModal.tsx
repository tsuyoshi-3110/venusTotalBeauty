// components/media/ImageCropperModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area, MediaSize } from "react-easy-crop";
import { Button } from "@/components/ui/button";

/* utils */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
async function getCroppedBlob(
  imageSrc: string,
  area: Area,
  type = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, canvas.width, canvas.height
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

/* 前面グリッド（3x3） */
function GridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)
        `,
        backgroundSize: "calc(100% / 3) 100%, 100% calc(100% / 3)",
        boxShadow: "0 0 0 1px rgba(255,255,255,.6) inset",
      }}
    />
  );
}

type Props = {
  file?: File;
  src?: string;
  open: boolean;
  title?: string;
  outputType?: string;
  outputQuality?: number;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
};

export default function ImageCropperModal({
  file,
  src,
  open,
  title = "画像のトリミング (1:1)",
  outputType = "image/jpeg",
  outputQuality = 0.92,
  onCancel,
  onCropped,
}: Props) {
  const [objUrl, setObjUrl] = useState("");
  const srcForView = useMemo(() => (file ? objUrl : src || ""), [file, objUrl, src]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [media, setMedia] = useState<MediaSize | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWH, setContainerWH] = useState({ w: 0, h: 0 });

  const [frameScale, setFrameScale] = useState(1); // 0.4〜1.0
  const cropSize = useMemo(() => {
    const pad = 8;
    const W = Math.max(0, containerWH.w - pad * 2);
    const H = Math.max(0, containerWH.h - pad * 2);
    const base = Math.min(W, H);
    const s = Math.round(base * frameScale);
    return { width: s, height: s };
  }, [containerWH, frameScale]);

  /* iOS/Safari向け: 画面高を安定させる --vh セット */
  useEffect(() => {
    if (!open) return;
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, [open]);

  /* File→URL */
  useEffect(() => {
    if (!open) return;
    if (file) {
      const u = URL.createObjectURL(file);
      setObjUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setObjUrl("");
  }, [file, open]);

  /* コンテナ計測 */
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setContainerWH({ w: r.width, h: r.height });
  }, []);
  useEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  /* cover 計算 */
  const calcCover = useCallback(
    (m: MediaSize, cs: { width: number; height: number }) =>
      Math.max(cs.width / m.naturalWidth, cs.height / m.naturalHeight),
    []
  );

  /* 初期化 */
  const handleMediaLoaded = useCallback((m: MediaSize) => {
    setMedia(m);
    setTimeout(() => {
      if (!cropSize.width) return;
      const cover = calcCover(m, cropSize);
      setMinZoom(cover);
      setZoom(cover);
      setCrop({ x: 0, y: 0 });
    }, 0);
  }, [calcCover, cropSize]);

  /* フレーム/レイアウト変更時も contain を維持 */
  useEffect(() => {
    if (!media || !cropSize.width) return;
    const cover = calcCover(media, cropSize);
    setMinZoom(cover);
    setZoom((z) => (z < cover ? cover : z));
    setCrop({ x: 0, y: 0 });
  }, [media, cropSize, calcCover]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), []);

  const doConfirm = useCallback(async () => {
    if (!srcForView || !areaPixels) return;
    const blob = await getCroppedBlob(srcForView, areaPixels, outputType, outputQuality);
    onCropped(blob);
  }, [srcForView, areaPixels, outputType, outputQuality, onCropped]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* 本体：画面内に収まる可変高さ（スマホ安定） */}
      <div
        className="w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
        style={{
          maxHeight: "calc(var(--vh, 1vh) * 92)", // 画面の92%
        }}
      >
        <div className="px-4 py-3 border-b font-semibold">{title}</div>

        {/* 画像エリア + 調整UI を含むスクロール領域 */}
        <div
          className="flex-1 overflow-auto"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            ref={containerRef}
            className="relative bg-black"
            style={{
              height: "calc(var(--vh, 1vh) * 55)", // 55vh 相当：端末でも確実に収まる
            }}
          >
            {srcForView && cropSize.width > 0 && (
              <>
                {/* Cropper は下層 */}
                <div className="absolute inset-0 z-10">
                  <Cropper
                    image={srcForView}
                    crop={crop}
                    zoom={zoom}
                    minZoom={minZoom}
                    maxZoom={5}
                    aspect={1}
                    cropSize={cropSize}
                    objectFit="contain"
                    restrictPosition
                    showGrid={false} // 自前グリッド使用
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    onMediaLoaded={handleMediaLoaded}
                  />
                </div>
                {/* 前面グリッド */}
                <GridOverlay />
              </>
            )}
          </div>

          {/* コントロール群 */}
          <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="text-xs text-gray-600">ズーム</label>
              <input
                type="range"
                min={minZoom}
                max={5}
                step={0.001}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full sm:w-56"
              />
              <label className="text-xs text-gray-600 sm:ml-4">フレーム</label>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.01}
                value={frameScale}
                onChange={(e) => setFrameScale(Number(e.target.value))}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </div>

        {/* フッター：通常フロー（常に画面内に残る高さ配分） */}
        <div
          className="border-t px-4 py-3 flex gap-2 justify-end"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <Button variant="secondary" onClick={onCancel}>キャンセル</Button>
          <Button
            onClick={doConfirm}
            disabled={!areaPixels}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            切り抜いて決定
          </Button>
        </div>
      </div>
    </div>
  );
}
