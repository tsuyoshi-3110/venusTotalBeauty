"use client";
import React, { useEffect, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ThemeKey } from "@/lib/themes";

import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";
import BroomDustLoader from "../FeatherDusterLoader";

import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { RenderMedia } from "./RenderMedia";
import AdminControls from "./AdminControls";
import MediaEditModal from "./MediaEditModal";

const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);
const POSTER_EXT = ".jpg";

type MediaType = "video" | "image";

type MetaDoc = {
  url?: string;
  type?: MediaType;
  themeGradient?: ThemeKey;
  imageUrls?: string[];
};

export default function BackgroundMedia() {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<MediaType>("video");
  const [poster, setPoster] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | File[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("brandA");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPortrait, setIsPortrait] = useState<boolean | null>(null);

  const [status, setStatus] = useState<
    "loading" | "paid" | "unpaid" | "pending" | "canceled" | "setup"
  >("loading");

  const [authChecked, setAuthChecked] = useState(false);

  const uploading = progress !== null;

  useEffect(() => {
    const checkPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      const apiUrl = sessionId
        ? `/api/stripe/verify-subscription?session_id=${sessionId}`
        : `/api/stripe/check-subscription?siteKey=${SITE_KEY}`;

      const res = await fetch(apiUrl);
      const json = await res.json();

      if (json.status === "active") setStatus("paid");
      else if (json.status === "pending_cancel") setStatus("pending");
      else if (json.status === "canceled") setStatus("canceled");
      else if (json.status === "setup_mode") setStatus("setup");
      else setStatus("unpaid");

      if (sessionId) {
        const cur = new URL(window.location.href);
        cur.searchParams.delete("session_id");
        window.history.replaceState({}, "", cur.toString());
      }
    };

    checkPayment();
  }, []);

  const loading =
    (type === "video" && !ready && !!url) ||
    (type === "image" && !ready && imageUrls.length > 0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (type === "image" && imageUrls.length > 0) {
      setReady(false);
      const timer = setTimeout(() => setReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [imageUrls, type]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) return;
      const data = snap.data() as MetaDoc;

      if (data.imageUrls) setImageUrls(data.imageUrls);
      if (data.url) setUrl(data.url);

      if (data.type) {
        setType(data.type);
        if (data.type === "video" && data.url) {
          setPoster(data.url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
        }
      }

      if (data.themeGradient) setTheme(data.themeGradient);
    })().catch((err) => console.error("背景データ取得失敗:", err));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setReady(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  const upload = async () => {
    if (!file) return;

    const MAX_SIZE_MB = 400;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    // ✅ 動画アップロード処理
    if (file instanceof File && file.type.startsWith("video/")) {
      if (file.size > MAX_SIZE_BYTES) {
        alert(`動画サイズが大きすぎます。最大 ${MAX_SIZE_MB}MB までです。`);
        return;
      }

      const ext = "mp4";
      const path = `videos/public/${SITE_KEY}/homeBackground.${ext}`;
      const storageRef = ref(getStorage(), path);

      try {
        await deleteObject(storageRef);
      } catch {}

      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      setProgress(0);

      task.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(percent);
        },
        (error) => {
          console.error("動画アップロード失敗:", error);
          alert("アップロード失敗");
          setProgress(null);
        },
        async () => {
          const downloadURL = await getDownloadURL(storageRef);
          const bust = `?ts=${Date.now()}`;

          // ✅ この場でポスター生成
          const genPoster = async (f: File) => {
            const objectUrl = URL.createObjectURL(f);
            try {
              const video = document.createElement("video");
              video.preload = "metadata";
              video.src = objectUrl;
              video.muted = true;
              video.playsInline = true;

              const durationSec: number | undefined = await new Promise(
                (resolve, reject) => {
                  video.onloadedmetadata = () =>
                    resolve(
                      isFinite(video.duration)
                        ? Math.round(video.duration)
                        : undefined
                    );
                  video.onerror = () =>
                    reject(new Error("動画メタデータの読み込みに失敗"));
                }
              );

              const seekTo = Math.min(
                1,
                Math.max(0.1, (video.duration || 1) * 0.1)
              );
              await new Promise<void>((resolve, reject) => {
                video.currentTime = seekTo;
                video.onseeked = () => resolve();
                video.onerror = () => reject(new Error("動画シークに失敗"));
              });

              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth || 1280;
              canvas.height = video.videoHeight || 720;
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const blob: Blob = await new Promise((resolve, reject) =>
                canvas.toBlob(
                  (b) =>
                    b ? resolve(b) : reject(new Error("ポスター生成に失敗")),
                  "image/jpeg",
                  0.82
                )
              );

              return { blob, durationSec };
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          };

          // ポスター生成 → Storage へ保存
          let posterUrl: string | undefined = undefined;
          let durationSec: number | undefined = undefined;
          try {
            const { blob, durationSec: dsec } = await genPoster(file);
            durationSec = dsec;

            const posterPath = `videos/public/${SITE_KEY}/homeBackground.jpg`;
            const posterRef = ref(getStorage(), posterPath);
            try {
              await deleteObject(posterRef);
            } catch {}

            const posterTask = uploadBytesResumable(posterRef, blob, {
              contentType: "image/jpeg",
            });
            await new Promise<void>((resolve, reject) => {
              posterTask.on("state_changed", null, reject, () => resolve());
            });
            posterUrl = await getDownloadURL(posterRef);
          } catch (e) {
            console.warn("ポスター生成に失敗。フォールバックを使用します:", e);
          }

          await setDoc(
            META_REF,
            {
              url: downloadURL,
              type: "video",
              themeGradient: theme,
              heroVideo: {
                name: `${SITE_KEY} 紹介動画`,
                description: "サービス紹介動画です。",
                contentUrl: downloadURL,
                uploadDate: new Date().toISOString(),
                ...(posterUrl ? { thumbnailUrl: posterUrl } : {}),
                ...(durationSec
                  ? { durationSec, duration: `PT${Math.max(1, durationSec)}S` }
                  : {}),
              },
            },
            { merge: true }
          );

          setUrl(downloadURL + bust);
          setType("video");
          setPoster(
            ((posterUrl as string) ||
              downloadURL.replace(/\.mp4(\?.*)?$/, POSTER_EXT)) + bust
          );
          setReady(false);
          setProgress(null);
          setFile(null);
          setEditing(false);
          alert("メディアを更新しました！");
        }
      );
    }

    // ✅ 画像複数枚アップロード処理
    else if (Array.isArray(file)) {
      const validFiles = file.slice(0, 3);
      const urls: string[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const image = validFiles[i];
        const imagePath = `images/public/${SITE_KEY}/wallpaper_${i}.jpg`;
        const imageRef = ref(getStorage(), imagePath);

        try {
          await deleteObject(imageRef);
        } catch {}

        setProgress(Math.round(((i + 1) / validFiles.length) * 100));

        const up = uploadBytesResumable(imageRef, image);
        await new Promise<void>((resolve, reject) => {
          up.on(
            "state_changed",
            null,
            (error) => {
              console.error("画像アップロード失敗:", error);
              reject(error);
            },
            async () => {
              urls.push(await getDownloadURL(imageRef));
              resolve();
            }
          );
        });
      }

      setProgress(null);

      await setDoc(
        META_REF,
        {
          imageUrls: urls,
          type: "image",
          themeGradient: theme,
          heroVideo: deleteField(), // 画像へ切替時は動画メタを消す
        },
        { merge: true }
      );

      setImageUrls(urls);
      setType("image");
      setReady(false);
      setFile(null);
      setEditing(false);
      alert("画像を更新しました！");
    }

    // ✅ その他：不正ファイル形式
    else {
      alert(
        "不正なファイル形式です。画像は最大3枚、動画は1本のみ対応しています。"
      );
    }
  };

  const uploadImage = async (imageFile: File) => {
    const imagePath = `images/public/${SITE_KEY}/wallpaper.jpg`;
    const imageRef = ref(getStorage(), imagePath);

    try {
      await deleteObject(imageRef);
    } catch {}

    const task = uploadBytesResumable(imageRef, imageFile);

    setProgress(0);

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(percent);
      },
      (error) => {
        console.error("画像アップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const imageUrl = await getDownloadURL(imageRef);
        await setDoc(META_REF, { imageUrl }, { merge: true });

        setProgress(null);
        alert("画像を更新しました！");
      }
    );
  };

  const uploadHeaderImage = async (file: File) => {
    const imagePath = `images/public/${SITE_KEY}/headerLogo.jpg`;
    const imageRef = ref(getStorage(), imagePath);

    const compressedFile = await imageCompression(file, {
      maxWidthOrHeight: 160,
      maxSizeMB: 0.5,
      initialQuality: 0.9,
      useWebWorker: true,
    });

    try {
      await deleteObject(imageRef);
    } catch {}

    const task = uploadBytesResumable(imageRef, compressedFile);
    setProgress(0);

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(percent);
      },
      (error) => {
        console.error("ロゴアップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const downloadURL = await getDownloadURL(imageRef);
        await setDoc(
          doc(db, "siteSettingsEditable", SITE_KEY),
          { headerLogoUrl: downloadURL },
          { merge: true }
        );
        setProgress(null);
        alert("ヘッダー画像を更新しました！");
      }
    );
  };

  const pendingButton =
    status === "pending" &&
    isAdmin && (
      <Button
        className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-white shadow-lg"
        onClick={async () => {
          try {
            const res = await fetch("/api/stripe/resume-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ siteKey: SITE_KEY }),
            });
            if (res.ok) {
              alert("解約予約を取り消しました！");
              location.reload();
            } else {
              alert("再開に失敗しました");
            }
          } catch {
            alert("再開に失敗しました");
          }
        }}
      >
        解約を取り消す
      </Button>
    );

  return (
    <div className="fixed inset-0 top-12">
      {pendingButton}
      <RenderMedia
        poster={poster}
        setReady={setReady}
        type={type}
        url={url}
        imageUrls={imageUrls}
        isPortrait={isPortrait}
        setIsPortrait={setIsPortrait}
      />

      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <BroomDustLoader
            label={`アップロード中… ${progress ?? 0}%`}
            size={100}
            speed={1}
          />
        </div>
      )}

      {authChecked && isAdmin && (
        <>
          {progress !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-white rounded-lg p-6 shadow-md w-full max-w-sm">
                <p className="text-center text-gray-800 mb-2">
                  アップロード中… {progress}%
                </p>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <AdminControls
            editing={editing}
            setEditing={setEditing}
            uploading={uploading}
            uploadImage={uploadImage}
            uploadHeaderImage={uploadHeaderImage}
          />

          <MediaEditModal
            open={authChecked && isAdmin && editing}
            uploading={uploading}
            progress={progress}
            canUpload={!!file}
            onSelect={(f) => setFile(f)}
            onUpload={upload}
            onClose={() => {
              if (!uploading) {
                setEditing(false);
                setFile(null);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
