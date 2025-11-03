// lib/cropImage.ts
export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// 画像を読み込んで HTMLImageElement を返す
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // Storage の公開URLでもクロスオリジンで canvas に描けるように
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * react-easy-crop が返す areaPixels をもとに、切り抜き Blob を生成
 * 出力はデフォルト JPEG（type/quality は変更可）
 */
export async function getCroppedBlob(
  imageSrc: string,
  area: CropArea,
  type = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // 出力サイズ = 切り抜きピクセルサイズ
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));

  // 画像の指定領域をそのまま 0,0 から描画
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob failed"));
      resolve(blob);
    }, type, quality);
  });
}
