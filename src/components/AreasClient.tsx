"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import CardSpinner from "./CardSpinner";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { UILang } from "@/lib/langsState";

type ServiceArea = {
  address?: string; // ← JA 原文（編集対象）
  lat?: number;
  lng?: number;
  radiusKm?: number;
  note?: string; // ← JA 原文（編集対象）
};

// 翻訳済み（表示専用）
type ServiceAreaT = {
  lang: LangKey;
  address?: string;
  note?: string;
};

// imports の下あたりに追加
const AREAS_T: Record<UILang, { page: string; map: string }> = {
  ja: { page: "対応エリア", map: "サービス範囲（地図表示）" },
  en: { page: "Service Area", map: "Service Range (Map)" },
  zh: { page: "服务范围", map: "服务区域（地图）" },
  "zh-TW": { page: "服務範圍", map: "服務範圍（地圖）" },
  ko: { page: "서비스 가능 지역", map: "서비스 범위(지도)" },
  fr: { page: "Zone desservie", map: "Zone de service (carte)" },
  es: { page: "Área de cobertura", map: "Ámbito de servicio (mapa)" },
  de: { page: "Einsatzgebiet", map: "Servicebereich (Karte)" },
  pt: { page: "Área de atendimento", map: "Âmbito de serviço (mapa)" },
  it: { page: "Area di copertura", map: "Area di servizio (mappa)" },
  ru: { page: "Зона обслуживания", map: "Зона обслуживания (карта)" },
  th: { page: "พื้นที่ให้บริการ", map: "ขอบเขตการให้บริการ (แผนที่)" },
  vi: { page: "Khu vực phục vụ", map: "Phạm vi dịch vụ (bản đồ)" },
  id: { page: "Area layanan", map: "Cakupan layanan (peta)" },
  hi: { page: "सेवा क्षेत्र", map: "सेवा दायरा (मानचित्र)" },
  ar: { page: "نطاق الخدمة", map: "نطاق الخدمة (خريطة)" },
};

const SETTINGS_REF = doc(db, "siteSettingsEditable", SITE_KEY);
const PUBLIC_REF = doc(db, "siteSettings", SITE_KEY);

export default function AreasClient() {
  const { uiLang } = useUILang(); // 現在の UI 言語（ja / 他）
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  // JA 原文（編集対象）
  const [addr, setAddr] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [note, setNote] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // 翻訳済み（表示用）
  const [tPacks, setTPacks] = useState<ServiceAreaT[]>([]);

  const T = AREAS_T[uiLang] ?? AREAS_T.ja;

  // Google Maps
  const [gmapsReady, setGmapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string>("");
  const mapsApiKey = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    []
  );
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const autocompleteRef = useRef<HTMLInputElement | null>(null);

  // Map instances
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  // Geocoder（フォールバック用）
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const lastResolvedAddrRef = useRef<string>("");

  // フィット制御
  const didInitialFitRef = useRef(false);
  const fitAfterPickRef = useRef(false);

  // ===== 認可：オーナーのみ編集可 =====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setIsOwner(false);
          return;
        }
        const pub = await getDoc(PUBLIC_REF);
        const ownerId = pub.exists() ? (pub.data() as any)?.ownerId : undefined;
        setIsOwner(!!ownerId && ownerId === u.uid);
      } finally {
      }
    });
    return () => unsub();
  }, []);

  // ===== 初期ロード =====
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(SETTINGS_REF);
        const data = (snap.exists() ? (snap.data() as any) : {}) as {
          serviceArea?: ServiceArea;
          serviceAreaT?: ServiceAreaT[];
        };
        const sa = data.serviceArea || {};
        setAddr(sa.address || "");
        setLat(sa.lat);
        setLng(sa.lng);
        setRadiusKm(typeof sa.radiusKm === "number" ? sa.radiusKm : 10);
        setNote(sa.note || "");
        setTPacks(Array.isArray(data.serviceAreaT) ? data.serviceAreaT : []);
        if (sa.address) lastResolvedAddrRef.current = sa.address;
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ===== Google Maps 読み込み =====
  useEffect(() => {
    if (!mapsApiKey) {
      setMapsError("Google Maps API キーが設定されていません。");
      return;
    }
    const loader = new Loader({
      apiKey: mapsApiKey,
      version: "weekly",
      libraries: ["places"],
    });
    loader
      .load()
      .then(() => setGmapsReady(true))
      .catch((e) => {
        console.error(e);
        setMapsError(
          "Google Maps の読み込みに失敗しました。APIキーの制限設定・課金・有効APIを確認してください。"
        );
      });
  }, [mapsApiKey]);

  // ===== Geocoder 準備 =====
  useEffect(() => {
    if (!gmapsReady) return;
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
  }, [gmapsReady]);

  // ===== マップ描画（中心・マーカー・円） =====
  useEffect(() => {
    if (!gmapsReady || !mapDivRef.current) return;

    const hasCenter = typeof lat === "number" && typeof lng === "number";
    const center = hasCenter
      ? new google.maps.LatLng(lat!, lng!)
      : new google.maps.LatLng(34.6937, 135.5023); // 大阪市（フォールバック）

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapDivRef.current, {
        center,
        zoom: hasCenter ? 12 : 10,
        streetViewControl: false,
        mapTypeControl: false,
      });
    } else {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(hasCenter ? 12 : 10);
    }

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: center,
        map: mapRef.current!,
      });
    } else {
      markerRef.current.setPosition(center);
      markerRef.current.setMap(mapRef.current!);
    }

    const radiusMeters = Math.max(0.5, radiusKm) * 1000;
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillOpacity: 0.08,
        map: mapRef.current!,
        center,
        radius: radiusMeters,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(radiusMeters);
      circleRef.current.setMap(mapRef.current!);
    }
  }, [gmapsReady, lat, lng, radiusKm]);

  // ===== 初回/住所選択直後のフィット =====
  useEffect(() => {
    if (!gmapsReady || !mapRef.current || !circleRef.current) return;

    const bounds = circleRef.current.getBounds?.();
    if (!bounds) return;

    const needFit = !didInitialFitRef.current || fitAfterPickRef.current;
    if (!needFit) return;

    const map = mapRef.current;
    // 一度 idle を待ってからフィット（初回用）
    google.maps.event.addListenerOnce(map, "idle", () => {
      const b = circleRef.current?.getBounds?.();
      if (b) map.fitBounds(b, 64);
      didInitialFitRef.current = true;
      fitAfterPickRef.current = false;
    });
    // 念のため即時にも一度
    map.fitBounds(bounds, 64);
  }, [gmapsReady, lat, lng]);

  // ===== ここが要件：半径変更のたびに毎回フィット（拡大・縮小どちらも追随） =====
  useEffect(() => {
    if (!gmapsReady || !mapRef.current || !circleRef.current) return;
    const b = circleRef.current.getBounds?.();
    if (!b) return;
    const map = mapRef.current;
    map.fitBounds(b, 64);
    // 反映遅延対策：描画反映後にも再フィット
    google.maps.event.addListenerOnce(map, "idle", () => {
      const b2 = circleRef.current?.getBounds?.();
      if (b2) map.fitBounds(b2, 64);
    });
  }, [radiusKm, gmapsReady]);

  // ===== 住所オートコンプリート（原文=JA） =====
  useEffect(() => {
    if (!gmapsReady || !autocompleteRef.current) return;
    const ac = new google.maps.places.Autocomplete(autocompleteRef.current, {
      fields: ["geometry", "formatted_address"],
      componentRestrictions: { country: ["JP"] },
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const formatted = place.formatted_address || "";
      setAddr(formatted);
      setLat(loc.lat());
      setLng(loc.lng());
      lastResolvedAddrRef.current = formatted; // 座標まで解決済み
      fitAfterPickRef.current = true;
    });
    return () => google.maps.event.removeListener(listener);
  }, [gmapsReady]);

  // ===== タイプ入力でも座標更新（フォールバック Geocoding / デバウンス） =====
  useEffect(() => {
    if (!gmapsReady) return;
    const raw = addr.trim();
    if (!raw) return;
    if (lastResolvedAddrRef.current === raw) return;

    const timer = setTimeout(async () => {
      try {
        const gc = geocoderRef.current;
        if (!gc) return;
        const { results } = await gc.geocode({
          address: raw,
          region: "jp", // status は見ない（型エラー回避）
        });
        if (results?.[0]) {
          const loc = results[0].geometry.location;
          setLat(loc.lat());
          setLng(loc.lng());
          lastResolvedAddrRef.current = raw;
          fitAfterPickRef.current = true;
        }
      } catch {
        /* noop */
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [addr, gmapsReady]);

  // ===== 表示用（UI言語で切替） =====
  const displayAddr = useMemo(() => {
    if (uiLang === "ja") return addr;
    const hit = tPacks.find((t) => t.lang === uiLang);
    return hit?.address || addr;
  }, [uiLang, tPacks, addr]);

  const displayNote = useMemo(() => {
    if (uiLang === "ja") return note;
    const hit = tPacks.find((t) => t.lang === uiLang);
    return hit?.note || note;
  }, [uiLang, tPacks, note]);

  // ===== 翻訳API（/api/translate）で全言語作成 =====
  async function translateAll({
    address,
    note,
  }: {
    address: string;
    note: string;
  }): Promise<ServiceAreaT[]> {
    const targets = LANGS.map((l) => l.key).filter(
      (k): k is LangKey => k !== "ja"
    );

    const jobs = targets.map(async (lang) => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: address ?? "",
          body: note ?? "",
          target: lang,
        }),
      });
      if (!res.ok) {
        return { lang, address: "", note: "" } as ServiceAreaT;
      }
      const json = (await res.json()) as { title?: string; body?: string };
      return {
        lang,
        address: String(json?.title ?? "").trim(),
        note: String(json?.body ?? "").trim(),
      } as ServiceAreaT;
    });

    return Promise.all(jobs);
  }

  // ===== 保存（JA 原文を保存 → 全言語をAI翻訳して保存） =====
  const save = async () => {
    if (!isOwner || saving) return;
    setSaveMsg("");
    setSaving(true);
    try {
      // 座標が未確定なら、保存前にフォールバックで解決を試みる
      let nextLat = lat;
      let nextLng = lng;
      const raw = addr.trim();
      if ((typeof nextLat !== "number" || typeof nextLng !== "number") && raw) {
        try {
          const gc = geocoderRef.current;
          if (gmapsReady && gc) {
            const { results } = await gc.geocode({
              address: raw,
              region: "jp",
            });
            if (results?.[0]) {
              const loc = results[0].geometry.location;
              nextLat = loc.lat();
              nextLng = loc.lng();
              lastResolvedAddrRef.current = raw;
            }
          }
        } catch {
          /* noop */
        }
      }

      // 1) JA 原文 + 共有フィールド
      const basePayload: any = {
        serviceArea: {
          address: raw || "",
          radiusKm: Number.isFinite(radiusKm) ? radiusKm : 10,
          note: note || "",
        },
      };
      if (typeof nextLat === "number" && typeof nextLng === "number") {
        basePayload.serviceArea.lat = nextLat;
        basePayload.serviceArea.lng = nextLng;
      }
      await setDoc(SETTINGS_REF, basePayload, { merge: true });

      // 2) 全言語翻訳
      const tAll = await translateAll({ address: raw || "", note: note || "" });

      // 3) 翻訳結果を保存 & ローカル反映
      await setDoc(SETTINGS_REF, { serviceAreaT: tAll }, { merge: true });
      setLat(nextLat);
      setLng(nextLng);
      setTPacks(tAll);

      setSaveMsg("✅ 保存しました。");
    } catch (e: any) {
      console.error("save error:", e);
      setSaveMsg(
        `❌ 保存に失敗：${
          e?.message || "Firestore / 翻訳APIの設定を確認してください。"
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <CardSpinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 space-y-6">
      <h1 className="text-3xl font-semibold text-white text-outline">
        {T.page}
      </h1>

      {/* 閲覧用（UI言語で表示を切替） */}
      <Card className="shadow-md bg-white/50">
        <CardHeader>
          <CardTitle className="text-lg">{T.map}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mapsError && <p className="text-sm text-red-600">{mapsError}</p>}
          {displayAddr ? (
            <p className="text-sm">
              拠点：<span className="font-medium">{displayAddr}</span>
              {Number.isFinite(radiusKm) ? `（半径 約${radiusKm}km）` : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              拠点住所が未設定です。
            </p>
          )}
          {displayNote && (
            <p className="text-sm whitespace-pre-wrap">{displayNote}</p>
          )}
          <div
            ref={mapDivRef}
            className="h-[60vh] w-full rounded-md border"
            aria-label="対応エリア地図"
          />
        </CardContent>
      </Card>

      {/* 編集用（オーナーのみ / 編集は JA 原文のみ） */}
      {isOwner && (
        <Card className="shadow-md">
          <CardHeader>
           <CardTitle className="text-lg">編集（オーナーのみ / 日本語原文）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">拠点住所</label>
                <Input
                  ref={autocompleteRef}
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="例）奈良県奈良市…（候補から選択可／そのまま入力でもOK）"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  表示半径（km）：
                  <span className="font-semibold">{radiusKm}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  スライダー操作に合わせて地図が自動で拡大/縮小します（1〜100km）。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">補足説明</label>
              <textarea
                className="w-full min-h-24 rounded-md border p-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例）エリア外でも状況により対応可能です。まずはご相談ください。"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={save}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? "保存中…" : "保存"}
              </Button>
              {saveMsg && (
                <span className="text-xs whitespace-pre-wrap">{saveMsg}</span>
              )}
              {!gmapsReady && !mapsError && (
                <span className="text-xs text-muted-foreground">
                  地図SDKの準備中…
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
