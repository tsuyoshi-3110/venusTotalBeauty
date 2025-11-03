"use client";

import { useEffect } from "react";
import { atomWithStorage } from "jotai/utils";
import { LANGS, type LangKey } from "@/lib/langs";

export type UILang = "ja" | LangKey;
const LS_KEY = "ui-lang";
const CK_KEY = "ui_lang";

// localStorage に永続化される UI 言語
export const uiLangAtom = atomWithStorage<UILang>(LS_KEY, "ja");

// ブラウザ言語から初期値を推定（初回のみ）
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
      if (raw.includes("tw") || raw.includes("hk") || raw.includes("hant"))
        return "zh-TW";
      return "zh";
    }
  }
  return "ja";
}

// フック：atom を使いつつ Cookie / <html lang> 同期＆初期化
import { useAtom } from "jotai";
export function useUILang() {
  const [uiLang, setUiLang] = useAtom(uiLangAtom);

  // 初回：保存が無ければブラウザから推定
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (!stored) setUiLang(detectDefault());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 変更時：<html lang> と Cookie を同期
  useEffect(() => {
    try {
      const lang = uiLang === "ja" ? "ja" : uiLang;
      document.documentElement.lang = lang;
      document.documentElement.setAttribute("data-ui-lang", lang);
      document.cookie = `${CK_KEY}=${encodeURIComponent(lang)}; path=/; max-age=31536000`;
    } catch {}
  }, [uiLang]);

  return { uiLang, setUiLang };
}
