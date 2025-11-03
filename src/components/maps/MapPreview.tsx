"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

type Props = { lat?: number; lng?: number; height?: number };

export default function MapPreview({ lat, lng, height = 260 }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!lat || !lng || !mapRef.current) return;

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!,
      version: "weekly",
    });

    loader.load().then(() => {
      const center = { lat, lng };
      const map = new google.maps.Map(mapRef.current!, {
        center,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      new google.maps.Marker({ position: center, map });
      setReady(true);
    });
  }, [lat, lng]);

  if (!lat || !lng) {
    return <div className="text-xs text-muted-foreground">住所選択で位置が自動取得されます。</div>;
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full rounded-md border"
      aria-label={ready ? "地図プレビュー" : "地図読み込み中"}
    />
  );
}
