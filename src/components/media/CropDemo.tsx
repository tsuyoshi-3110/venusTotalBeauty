// components/media/CropDemo.tsx
"use client";

import { useState } from "react";
import ImageCropperModal from "./ImageCropperModal";
import Image from "next/image";

export default function CropDemo() {
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.currentTarget.files?.[0] ?? null;
    if (!f) return;
    // ここで HEIC などを弾くならチェック
    setFile(f);
    setOpen(true);
    // input 値クリア（同じファイル選択でも発火させるため）
    try {
      e.currentTarget.value = "";
    } catch {}
  };

  const onCancel = () => {
    setOpen(false);
    setFile(null);
  };

  const onCropped = (blob: Blob) => {
    setOpen(false);
    setFile(null);
    // プレビュー用 URL（実際はこの Blob をそのままアップロードすればOK）
    const url = URL.createObjectURL(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  return (
    <div className="space-y-4">
      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-white border shadow cursor-pointer text-sm">
        <span>画像を選択</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </label>

      {previewUrl && (
        <div className="rounded border p-2">
          <div className="text-xs text-gray-600 mb-1">
            切り抜き結果プレビュー
          </div>
          {/* 注意: Next.js であれば next/image でもOK */}
          <Image
            src={previewUrl}
            alt="preview"
            width={800} // 必須: 適当なサイズを指定
            height={450} // アスペクト比21:9などに合わせる
            className="rounded"
            unoptimized // Blob URL を最適化せずそのまま表示
          />
        </div>
      )}

      {/* モーダル本体：file があるときだけ描画（型 File を保証） */}
      {file && (
        <ImageCropperModal
          file={file}
          open={open}
          onCancel={onCancel}
          onCropped={onCropped}
          title="画像のトリミング（1:1）"
        />
      )}
    </div>
  );
}
