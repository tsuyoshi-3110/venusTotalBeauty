// components/media/VideoCropperModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area, MediaSize } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Props = {
  file?: File;                 // 端末からの動画ファイル推奨
  src?: string;                // 外部URL（CORS注意）
  open: boolean;
  title?: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void; // 出力MP4
  targetSize?: number;         // 一辺の出力px（1:1）, 例: 1080
  crf?: number;                // 低いほど高画質, 例: 23
  preset?: "ultrafast"|"superfast"|"veryfast"|"faster"|"fast"|"medium"|"slow"|"slower"|"veryslow";
};

function u8ToBlob(u8: Uint8Array, mime = "video/mp4") {
  // SharedArrayBuffer を回避するため ArrayBuffer にコピー
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return new Blob([copy.buffer], { type: mime });
}

export default function VideoCropperModal({
  file,
  src,
  open,
  title = "動画のトリミング (1:1)",
  onCancel,
  onCropped,
  targetSize = 1080,
  crf = 23,
  preset = "veryfast",
}: Props) {
  // 表示ソースURL（File優先）
  const [objUrl, setObjUrl] = useState("");
  const srcForView = useMemo(() => (file ? objUrl : src || ""), [file, objUrl, src]);

  // Cropper 状態
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [media, setMedia] = useState<MediaSize | null>(null);

  // レイアウト
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWH, setContainerWH] = useState({ w: 0, h: 0 });
  const [frameScale, setFrameScale] = useState(1); // 0.6〜1.0 推奨

  const cropSize = useMemo(() => {
    const pad = 8;
    const W = Math.max(0, containerWH.w - pad * 2);
    const H = Math.max(0, containerWH.h - pad * 2);
    const base = Math.min(W, H);
    const s = Math.round(base * frameScale);
    return { width: s, height: s };
  }, [containerWH, frameScale]);

  // --vh 安定化（iOS）
  useEffect(() => {
    if (!open) return;
    const setVh = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, [open]);

  // File → ObjectURL
  useEffect(() => {
    if (!open) return;
    if (file) {
      const u = URL.createObjectURL(file);
      setObjUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setObjUrl("");
  }, [file, open]);

  // コンテナ採寸
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

  // cover 計算
  const calcCover = useCallback(
    (m: MediaSize, cs: { width: number; height: number }) =>
      Math.max(cs.width / m.naturalWidth, cs.height / m.naturalHeight),
    []
  );

  // メディア読み込み時：必ず収まる倍率
  const handleMediaLoaded = useCallback((m: MediaSize) => {
    setMedia(m);
    if (!cropSize.width) return;
    const cover = calcCover(m, cropSize);
    setMinZoom(cover);
    setZoom(cover);
    setCrop({ x: 0, y: 0 });
  }, [calcCover, cropSize]);

  // フレーム変更時にも contain 維持
  useEffect(() => {
    if (!media || !cropSize.width) return;
    const cover = calcCover(media, cropSize);
    setMinZoom(cover);
    setZoom((z) => (z < cover ? cover : z));
    setCrop({ x: 0, y: 0 });
  }, [media, cropSize, calcCover]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), []);

  /* ---------------- FFmpeg (ブラウザ内) ---------------- */
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [progress, setProgress] = useState(0);
  const [isEncoding, setIsEncoding] = useState(false);

  // ★ ffmpeg-core の読み込み：UMD配布物を toBlobURL で同一オリジン化
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (ffmpeg || typeof window === "undefined") return;

      const instance = new FFmpeg();
      instance.on("progress", ({ progress }) => setProgress(Math.round((progress || 0) * 100)));

      try {
        // 1) ローカル（/public/ffmpeg）にあればそれを優先
        const localBase = "/ffmpeg";
        // HEAD で存在チェック
        const test = await fetch(`${localBase}/ffmpeg-core.js`, { method: "HEAD" });
        if (test.ok) {
          const coreURL   = await toBlobURL(`${localBase}/ffmpeg-core.js`, "text/javascript");
          const wasmURL   = await toBlobURL(`${localBase}/ffmpeg-core.wasm`, "application/wasm");
          const workerURL = await toBlobURL(`${localBase}/ffmpeg-core.worker.js`, "text/javascript");
          await instance.load({ coreURL, wasmURL, workerURL });
          if (!cancelled) setFfmpeg(instance);
          return;
        }
      } catch {
        // スルーして CDN へ
      }

      // 2) CDN（UMD配布）→ Blob 化（CSP/COEP 問題を回避）
      const cdnBase = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      const coreURL   = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, "text/javascript");
      const wasmURL   = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, "application/wasm");
      const workerURL = await toBlobURL(`${cdnBase}/ffmpeg-core.worker.js`, "text/javascript");

      await instance.load({ coreURL, wasmURL, workerURL });
      if (!cancelled) setFfmpeg(instance);
    })();
    return () => { cancelled = true; };
  }, [open, ffmpeg]);

  // 書き出し
  const doConfirm = useCallback(async () => {
    if (!srcForView || !areaPixels || !ffmpeg) return;
    try {
      setIsEncoding(true);

      const inputName = "input.mp4";
      if (file) {
        await ffmpeg.writeFile(inputName, await fetchFile(file));
      } else {
        const res = await fetch(srcForView, { credentials: "omit" });
        const buf = new Uint8Array(await res.arrayBuffer());
        await ffmpeg.writeFile(inputName, buf);
      }

      const x = Math.round(areaPixels.x);
      const y = Math.round(areaPixels.y);
      const w = Math.round(areaPixels.width);
      const h = Math.round(areaPixels.height);

      const scaleTo = Math.min(targetSize, Math.max(64, Math.min(w, h)));
      const vf = `crop=${w}:${h}:${x}:${y},scale=${scaleTo}:${scaleTo}:flags=lanczos`;

      const outName = "out.mp4";
      await ffmpeg.exec([
        "-y",
        "-i", inputName,
        "-vf", vf,
        "-c:v", "libx264",
        "-crf", String(crf),
        "-preset", preset,
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "copy", // 音声そのまま（必要なら -an / 再エンコードへ）
        outName,
      ]);

      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      const blob = u8ToBlob(data, "video/mp4");
      onCropped(blob);
    } finally {
      setIsEncoding(false);
    }
  }, [srcForView, areaPixels, ffmpeg, file, targetSize, crf, preset, onCropped]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(var(--vh, 1vh) * 92)" }}
      >
        <div className="px-4 py-3 border-b font-semibold">{title}</div>

        {/* 本文（中央スクロール） */}
        <div className="flex-1 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div
            ref={containerRef}
            className="relative bg-black isolate"
            style={{ height: "calc(var(--vh, 1vh) * 55)" }}
          >
            {srcForView && cropSize.width > 0 && (
              <Cropper
                video={srcForView}      // ← 要素ではなく URL 文字列を渡す
                crop={crop}
                zoom={zoom}
                minZoom={minZoom}
                maxZoom={5}
                aspect={1}
                cropSize={cropSize}
                objectFit="contain"
                restrictPosition
                showGrid={false}        // 内蔵グリッドは使わず前面に自前描画
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onMediaLoaded={handleMediaLoaded}
                style={{
                  containerStyle: { zIndex: 1, isolation: "isolate" },
                  mediaStyle: { zIndex: 1 },
                  cropAreaStyle: {
                    zIndex: 9999,             // ★ 常に前面
                    pointerEvents: "none",
                    boxShadow: "0 0 0 1px rgba(255,255,255,.92) inset",
                    backgroundImage: `
                      linear-gradient(to right, rgba(255,255,255,.92) 1.2px, transparent 1.2px),
                      linear-gradient(to bottom, rgba(255,255,255,.92) 1.2px, transparent 1.2px)
                    `,
                    backgroundSize: "calc(100%/3) 100%, 100% calc(100%/3)",
                    filter: "drop-shadow(0 0 .6px rgba(0,0,0,.65))",
                  },
                }}
                mediaProps={{
                  playsInline: true,
                  muted: true,
                  loop: true,
                  crossOrigin: "anonymous",
                }}
              />
            )}

            {(ffmpeg === null || isEncoding) && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div className="h-full bg-purple-600" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {/* コントロール */}
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
                min={0.6}
                max={1}
                step={0.01}
                value={frameScale}
                onChange={(e) => setFrameScale(Number(e.target.value))}
                className="w-full sm:w-40"
              />
            </div>
          </div>
        </div>

        {/* フッター（safe-area対応） */}
        <div className="border-t px-4 py-3 flex gap-2 justify-end" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <Button variant="secondary" onClick={onCancel} disabled={isEncoding}>キャンセル</Button>
          <Button
            onClick={doConfirm}
            disabled={!areaPixels || ffmpeg === null || isEncoding}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {ffmpeg === null ? "エンジン読込中…" : isEncoding ? `書き出し中… ${progress}%` : "切り抜いて出力"}
          </Button>
        </div>
      </div>
    </div>
  );
}
