"use client";

import { useEffect } from "react";
import { atomWithStorage } from "jotai/utils";
import { useAtom, useAtomValue } from "jotai";
import { LANGS, type LangKey } from "@/lib/langs";

export type UILang = "ja" | LangKey;

const LS_KEY = "ui-lang";
const CK_KEY = "ui_lang";

// 初回は 'ja' で描画（SSRと一致）。マウント後に storage/ブラウザ言語で更新
export const uiLangAtom = atomWithStorage<UILang>(LS_KEY, "ja");

// 保存が無い初回のみ、ブラウザ言語から推定
function detectDefault(): UILang {
  if (typeof window === "undefined") return "ja";
  const keys = new Set<UILang>(["ja", ...LANGS.map((l) => l.key as UILang)]);
  const prefs = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map((x) => x.toLowerCase());

  for (const raw of prefs) {
    if (keys.has(raw as UILang)) return raw as UILang;
    const base = raw.split("-")[0] as UILang;
    if (keys.has(base)) return base;
    if (raw.startsWith("zh")) {
      if (raw.includes("tw") || raw.includes("hk") || raw.includes("hant")) return "zh-TW";
      return "zh";
    }
  }
  return "ja";
}

export function useUILang() {
  const [uiLang, setUiLang] = useAtom(uiLangAtom);

  // 初期化：保存が無ければブラウザから（マウント後のみ）
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (!stored) setUiLang(detectDefault());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 変更時：<html lang> と Cookie 同期
  useEffect(() => {
    try {
      const lang = uiLang;
      document.documentElement.lang = lang;
      document.documentElement.setAttribute("data-ui-lang", lang);
      document.cookie = `${CK_KEY}=${encodeURIComponent(lang)}; path=/; max-age=31536000`;
    } catch {}
  }, [uiLang]);

  return { uiLang, setUiLang };
}

// 値だけ必要な時
export const useUILangValue = () => useAtomValue(uiLangAtom);
