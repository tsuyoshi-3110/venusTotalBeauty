import { useState } from "react";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL,
} from "firebase/storage";

export function useUploadFile(basePath: string) {
  const [progress, setProgress] = useState<number | null>(null);
  const [task, setTask] = useState<ReturnType<typeof uploadBytesResumable> | null>(null);

  const upload = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const storageRef = ref(getStorage(), `${basePath}/${Date.now()}_${file.name}`);
      const t = uploadBytesResumable(storageRef, file);
      setTask(t);
      t.on(
        "state_changed",
        s => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        async () => resolve(await getDownloadURL(t.snapshot.ref)),
      );
    });

  const reset = () => {
    setProgress(null);
    setTask(null);
  };

  return { progress, task, upload, reset };
}
