"use client";
import React from "react";

type Props = {
  open: boolean;
  uploading: boolean;
  progress: number | null;
  /** 親側で選ばれたファイルがあるか（disabled制御用） */
  canUpload: boolean;
  /** ファイル選択後に親へ渡す（File or File[] or null） */
  onSelect: (f: File | File[] | null) => void;
  onUpload: () => void;
  onClose: () => void;
};

export default function MediaEditModal({
  open,
  uploading,
  progress,
  canUpload,
  onSelect,
  onUpload,
  onClose,
}: Props) {
  if (!open) return null;

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      onSelect(null);
      return;
    }

    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter((f) => f.type.startsWith("video/"));
    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));

    // 動画と画像の混在 → NG
    if (videoFiles.length > 0 && imageFiles.length > 0) {
      alert("動画と画像は同時に選択できません。どちらか一方のみ選んでください。");
      e.currentTarget.value = "";
      onSelect(null);
      return;
    }
    // 動画2本以上 → NG
    if (videoFiles.length > 1) {
      alert("動画は1本だけ選択できます。");
      e.currentTarget.value = "";
      onSelect(null);
      return;
    }
    // 画像4枚以上 → NG
    if (imageFiles.length > 3) {
      alert("画像は最大3枚まで選択できます。");
      e.currentTarget.value = "";
      onSelect(null);
      return;
    }
    // 動画1本のみ
    if (videoFiles.length === 1 && imageFiles.length === 0) {
      onSelect(videoFiles[0]);
      return;
    }
    // 画像のみ（1〜3枚）
    if (imageFiles.length > 0 && videoFiles.length === 0) {
      onSelect(imageFiles);
      return;
    }

    alert("ファイルの形式が正しくありません。");
    e.currentTarget.value = "";
    onSelect(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg">
        <h2 className="text-lg font-bold text-center mb-4">メディアを更新</h2>

        <div className="flex flex-col space-y-1 mb-3">
          <label>・動画は1本</label>
          <label>・画像は1~3枚</label>
        </div>

        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
          className="w-full bg-gray-100 border px-3 py-2 rounded text-sm mb-4"
          disabled={uploading}
        />

        {uploading && (
          <div className="mb-4">
            <p className="text-sm text-center mb-1">アップロード中… {progress ?? 0}%</p>
            <div className="w-full h-2 bg-gray-300 rounded">
              <div className="h-full bg-green-500 rounded" style={{ width: `${progress ?? 0}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={onUpload}
            disabled={!canUpload || uploading}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
          >
            アップロード
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded"
            disabled={uploading}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
