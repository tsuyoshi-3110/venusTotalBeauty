// src/app/ai/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

type Message = {
  role: "user" | "assistant";
  content: string;
};

/** 最小限のUI文言（未定義言語は英語にフォールバック） */
const UI_TEXT: Partial<
  Record<
    UILang,
    {
      heading: string;
      placeholder: string;
      send: string;
      sending: string;
      netErr: string;
    }
  >
> = {
  ja: {
    heading: "専属AIサポート",
    placeholder: "質問を入力…",
    send: "送信",
    sending: "送信中…",
    netErr: "通信エラーが発生しました。",
  },
  en: {
    heading: "AI Support",
    placeholder: "Type your question…",
    send: "Send",
    sending: "Sending…",
    netErr: "A network error occurred.",
  },
  zh: {
    heading: "专属AI支持",
    placeholder: "请输入您的问题…",
    send: "发送",
    sending: "发送中…",
    netErr: "发生网络错误。",
  },
  "zh-TW": {
    heading: "專屬AI支援",
    placeholder: "輸入您的問題…",
    send: "送出",
    sending: "送出中…",
    netErr: "發生網路錯誤。",
  },
  ko: {
    heading: "전용 AI 지원",
    placeholder: "질문을 입력하세요…",
    send: "전송",
    sending: "전송 중…",
    netErr: "네트워크 오류가 발생했습니다.",
  },
  fr: {
    heading: "Assistance IA",
    placeholder: "Saisissez votre question…",
    send: "Envoyer",
    sending: "Envoi…",
    netErr: "Une erreur réseau est survenue.",
  },
  es: {
    heading: "Soporte de IA",
    placeholder: "Escribe tu pregunta…",
    send: "Enviar",
    sending: "Enviando…",
    netErr: "Se produjo un error de red.",
  },
  de: {
    heading: "KI-Support",
    placeholder: "Frage eingeben…",
    send: "Senden",
    sending: "Senden…",
    netErr: "Ein Netzwerkfehler ist aufgetreten.",
  },
  pt: {
    heading: "Suporte de IA",
    placeholder: "Digite sua pergunta…",
    send: "Enviar",
    sending: "Enviando…",
    netErr: "Ocorreu um erro de rede.",
  },
  it: {
    heading: "Supporto IA",
    placeholder: "Scrivi la tua domanda…",
    send: "Invia",
    sending: "Invio…",
    netErr: "Si è verificato un errore di rete.",
  },
  ru: {
    heading: "Поддержка ИИ",
    placeholder: "Введите ваш вопрос…",
    send: "Отправить",
    sending: "Отправка…",
    netErr: "Произошла сетевая ошибка.",
  },
  th: {
    heading: "ผู้ช่วย AI",
    placeholder: "พิมพ์คำถามของคุณ…",
    send: "ส่ง",
    sending: "กำลังส่ง…",
    netErr: "เกิดข้อผิดพลาดของเครือข่าย",
  },
  vi: {
    heading: "Hỗ trợ AI",
    placeholder: "Nhập câu hỏi…",
    send: "Gửi",
    sending: "Đang gửi…",
    netErr: "Đã xảy ra lỗi mạng.",
  },
  id: {
    heading: "Dukungan AI",
    placeholder: "Ketik pertanyaan Anda…",
    send: "Kirim",
    sending: "Mengirim…",
    netErr: "Terjadi kesalahan jaringan.",
  },
  hi: {
    heading: "एआई सहायता",
    placeholder: "अपना प्रश्न लिखें…",
    send: "भेजें",
    sending: "भेजा जा रहा…",
    netErr: "नेटवर्क त्रुटि हुई।",
  },
  ar: {
    heading: "دعم الذكاء الاصطناعي",
    placeholder: "اكتب سؤالك…",
    send: "إرسال",
    sending: "جارٍ الإرسال…",
    netErr: "حدث خطأ في الشبكة.",
  },
};

const pickText = (lang: UILang) => UI_TEXT[lang] ?? UI_TEXT.en!;

export default function AIChatPage() {
  const { uiLang } = useUILang();
  const TXT = useMemo(() => pickText(uiLang), [uiLang]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setIsLoggedIn(!!u));
    return () => unsub();
  }, []);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  const sendMessage = async () => {
    if (loading) return;
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    requestAnimationFrame(() => scrollToBottom(false));

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          siteKey: SITE_KEY,
          uiLang, // ← 現在のUI言語をAPIへ
        }),
      });

      const data = await res.json();
      const aiMessage: Message = {
        role: "assistant",
        content: data.answer || TXT.netErr,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("AI chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: TXT.netErr }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom(true));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      <Card className="w-full max-w-lg flex flex-col p-4 shadow-lg bg-white/50">
        <h1 className="text-xl font-bold mb-2 text-center">{TXT.heading}</h1>

        {/* ログイン時のみ：管理リンク（← 日本語固定） */}
        {isLoggedIn && (
          <div className="mb-3 flex items-center justify-center gap-2">
            <Link
              href="/ai/keywords"
              className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-700"
            >
              AIキーワード登録
            </Link>
            <Link
              href="/ai/training"
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              AI学習（未回答）
            </Link>
          </div>
        )}

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto space-y-3 mb-4 p-2 bg-white rounded-md border overscroll-contain"
          aria-live="polite"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg ${
                msg.role === "user" ? "bg-blue-100 text-right" : "bg-gray-100 text-left"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={TXT.placeholder}
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? TXT.sending : TXT.send}
          </Button>
        </div>
      </Card>
    </div>
  );
}
