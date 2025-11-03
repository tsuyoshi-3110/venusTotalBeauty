// components/PreviewWithSpinner.tsx
"use client";

import { useState, useEffect } from "react";
import CardSpinner from "./CardSpinner";

export default function PreviewWithSpinner(props: {
  file: File;
  url: string;          // URL.createObjectURL で作った一時 URL
  className?: string;
}) {
  const { file, url, className = "" } = props;
  const [loaded, setLoaded] = useState(false);
  const isVideo = file.type.startsWith("video/");

  useEffect(() => setLoaded(false), [url]);

  return (
    <div className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
          <CardSpinner />
        </div>
      )}

      {isVideo ? (
        <video
          src={url}
          className="w-full h-full object-cover"
          muted
          controls
          onLoadedData={() => setLoaded(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="preview"
          className="w-full h-full object-cover"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
