"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = { siteKey: string };

export default function AddressAutocomplete({ siteKey }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "siteSettingsEditable", siteKey));
      const s = snap.data() as any;
      const a = s?.address;
      setAddress([a?.region, a?.locality, a?.street].filter(Boolean).join("") || "");
    })();
  }, [siteKey]);

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let mounted = true;

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!,
      version: "weekly",
      libraries: ["places"],
    });

    loader.load().then(() => {
      if (!mounted || !inputRef.current) return;
      autocomplete = new google.maps.places.Autocomplete(inputRef.current!, {
        fields: ["formatted_address", "geometry", "address_components"],
        componentRestrictions: { country: ["jp"] },
      });

      autocomplete.addListener("place_changed", async () => {
        const place = autocomplete!.getPlace();
        if (!place || !place.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formatted = place.formatted_address || "";

        // 住所要素を抽出（都道府県・市区町村・町丁目）
        const comps = place.address_components || [];
        const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name || "";
        const region = get("administrative_area_level_1"); // 都道府県
        const locality = get("locality") || get("sublocality") || get("administrative_area_level_2"); // 市区町村
        const postalCode = get("postal_code");
        // 残りを street として単純格納（必要ならより厳密に）
        const street = formatted.replace(region, "").replace(locality, "").trim();

        setLoading(true);
        await updateDoc(doc(db, "siteSettingsEditable", siteKey), {
          address: {
            postalCode: postalCode || "",
            region: region || "",
            locality: locality || "",
            street: street || formatted,
            countryCode: "JP",
            lat,
            lng,
          },
        });
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
    };
  }, [siteKey]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">店舗所在地（Google検索に使われます）</label>
      <Input
        ref={inputRef}
        defaultValue={address}
        placeholder="例）大阪府高槻市〇〇〇…"
      />
      <div className="text-xs text-muted-foreground">
        候補から住所を選ぶと、緯度経度を自動で保存します。
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.focus()}
        disabled={loading}
      >
        {loading ? "保存中…" : "住所候補を検索"}
      </Button>
    </div>
  );
}
