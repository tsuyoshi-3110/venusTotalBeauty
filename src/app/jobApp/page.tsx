// components/job/JobPage.tsx
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { useUILang } from "@/lib/atoms/uiLangAtom";

/* ===============================
   言語キー（日本語＋指定の15言語）
================================ */
type LangKey =
  | "ja" | "en" | "zh" | "zh-TW" | "ko" | "fr" | "es" | "de"
  | "pt" | "it" | "ru" | "th" | "vi" | "id" | "hi" | "ar";

/* ===============================
   UI 文言型
================================ */
type UIStrings = {
  title: string;
  subtitle: string;
  namePH: string;
  kanaPH: string;      // 日本語のときだけ使用
  emailPH: string;
  messagePH: string;
  send: string;
  sending: string;
  sent: string;
  success: string;
};

/* ===============================
   各言語の文言（必要に応じて調整可）
================================ */
const JA: UIStrings = {
  title: "求人応募フォーム",
  subtitle: "以下の内容をご入力のうえ、「送信」ボタンを押してください。",
  namePH: "お名前（例：大阪 太郎）",
  kanaPH: "ふりがな（例：おおさか たろう）",
  emailPH: "メールアドレス",
  messagePH: "志望動機・自己PRなど",
  send: "送信",
  sending: "送信中...",
  sent: "送信完了 🎉",
  success: "応募が完了しました。ご応募ありがとうございます。",
};

const EN: UIStrings = {
  title: "Job Application Form",
  subtitle: "Please fill in the fields below and press “Send”.",
  namePH: "Name (e.g., Taro Osaka)",
  kanaPH: "Furigana (for Japanese only)",
  emailPH: "Email address",
  messagePH: "Motivation / Self-PR",
  send: "Send",
  sending: "Sending...",
  sent: "Sent 🎉",
  success: "Your application has been submitted. Thank you.",
};

const ZH: UIStrings = {
  title: "求职申请表",
  subtitle: "请填写以下内容并点击“发送”。",
  namePH: "姓名（例：大阪 太郎）",
  kanaPH: "假名（仅日语）",
  emailPH: "邮箱地址",
  messagePH: "求职动机 / 自我介绍",
  send: "发送",
  sending: "发送中...",
  sent: "已发送 🎉",
  success: "您的申请已提交，感谢您的关注。",
};

const ZH_TW: UIStrings = {
  title: "求職申請表",
  subtitle: "請填寫以下內容並點選「送出」。",
  namePH: "姓名（例：大阪 太郎）",
  kanaPH: "假名（僅限日文）",
  emailPH: "電子郵件",
  messagePH: "求職動機 / 自我推薦",
  send: "送出",
  sending: "傳送中...",
  sent: "已送出 🎉",
  success: "您的申請已提交，感謝您的申請。",
};

const KO: UIStrings = {
  title: "채용 지원 폼",
  subtitle: "아래 내용을 입력한 후 ‘보내기’를 눌러 주세요.",
  namePH: "이름 (예: Osaka Taro)",
  kanaPH: "후리가나 (일본어 전용)",
  emailPH: "이메일 주소",
  messagePH: "지원 동기 / 자기 PR",
  send: "보내기",
  sending: "전송 중...",
  sent: "전송 완료 🎉",
  success: "지원이 완료되었습니다. 감사합니다.",
};

const FR: UIStrings = {
  title: "Formulaire de candidature",
  subtitle: "Veuillez remplir les champs ci-dessous puis cliquer « Envoyer ».",
  namePH: "Nom (ex. Taro Osaka)",
  kanaPH: "Furigana (pour le japonais)",
  emailPH: "Adresse e-mail",
  messagePH: "Motivation / Auto-présentation",
  send: "Envoyer",
  sending: "Envoi...",
  sent: "Envoyé 🎉",
  success: "Votre candidature a été envoyée. Merci.",
};

const ES: UIStrings = {
  title: "Formulario de solicitud",
  subtitle: "Complete los campos y pulse “Enviar”.",
  namePH: "Nombre (ej.: Taro Osaka)",
  kanaPH: "Furigana (solo japonés)",
  emailPH: "Correo electrónico",
  messagePH: "Motivación / Autopresentación",
  send: "Enviar",
  sending: "Enviando...",
  sent: "Enviado 🎉",
  success: "Su solicitud ha sido enviada. Gracias.",
};

const DE: UIStrings = {
  title: "Bewerbungsformular",
  subtitle: "Bitte Felder ausfüllen und auf „Senden“ klicken.",
  namePH: "Name (z. B. Taro Osaka)",
  kanaPH: "Furigana (nur Japanisch)",
  emailPH: "E-Mail-Adresse",
  messagePH: "Motivation / Selbst-PR",
  send: "Senden",
  sending: "Senden...",
  sent: "Gesendet 🎉",
  success: "Ihre Bewerbung wurde übermittelt. Vielen Dank.",
};

const PT: UIStrings = {
  title: "Formulário de candidatura",
  subtitle: "Preencha os campos abaixo e clique em “Enviar”.",
  namePH: "Nome (ex.: Taro Osaka)",
  kanaPH: "Furigana (apenas japonês)",
  emailPH: "E-mail",
  messagePH: "Motivação / Apresentação",
  send: "Enviar",
  sending: "Enviando...",
  sent: "Enviado 🎉",
  success: "Sua candidatura foi enviada. Obrigado.",
};

const IT: UIStrings = {
  title: "Modulo di candidatura",
  subtitle: "Compila i campi e premi “Invia”.",
  namePH: "Nome (es.: Taro Osaka)",
  kanaPH: "Furigana (solo giapponese)",
  emailPH: "Indirizzo e-mail",
  messagePH: "Motivazione / Auto-presentazione",
  send: "Invia",
  sending: "Invio...",
  sent: "Inviato 🎉",
  success: "La tua candidatura è stata inviata. Grazie.",
};

const RU: UIStrings = {
  title: "Форма заявки на работу",
  subtitle: "Заполните поля ниже и нажмите «Отправить».",
  namePH: "Имя (напр.: Taro Osaka)",
  kanaPH: "Фуригана (только для японского)",
  emailPH: "Эл. почта",
  messagePH: "Мотивация / Самопрезентация",
  send: "Отправить",
  sending: "Отправка...",
  sent: "Отправлено 🎉",
  success: "Ваша заявка отправлена. Спасибо.",
};

const TH: UIStrings = {
  title: "แบบฟอร์มสมัครงาน",
  subtitle: "กรอกข้อมูลด้านล่างแล้วกด “ส่ง”.",
  namePH: "ชื่อ (เช่น Taro Osaka)",
  kanaPH: "ฟุริางานะ (ใช้กับภาษาญี่ปุ่น)",
  emailPH: "อีเมล",
  messagePH: "แรงจูงใจ / แนะนำตัว",
  send: "ส่ง",
  sending: "กำลังส่ง...",
  sent: "ส่งแล้ว 🎉",
  success: "ส่งใบสมัครเรียบร้อย ขอบคุณค่ะ/ครับ",
};

const VI: UIStrings = {
  title: "Mẫu ứng tuyển",
  subtitle: "Điền thông tin bên dưới và nhấn “Gửi”.",
  namePH: "Họ tên (vd: Taro Osaka)",
  kanaPH: "Furigana (chỉ tiếng Nhật)",
  emailPH: "Email",
  messagePH: "Động lực / Tự giới thiệu",
  send: "Gửi",
  sending: "Đang gửi...",
  sent: "Đã gửi 🎉",
  success: "Đơn của bạn đã được gửi. Cảm ơn.",
};

const IDN: UIStrings = {
  title: "Formulir lamaran",
  subtitle: "Isi bidang di bawah lalu klik “Kirim”.",
  namePH: "Nama (cth: Taro Osaka)",
  kanaPH: "Furigana (khusus Jepang)",
  emailPH: "Alamat email",
  messagePH: "Motivasi / Perkenalan diri",
  send: "Kirim",
  sending: "Mengirim...",
  sent: "Terkirim 🎉",
  success: "Lamaran Anda telah terkirim. Terima kasih.",
};

const HI: UIStrings = {
  title: "नौकरी आवेदन फ़ॉर्म",
  subtitle: "नीचे विवरण भरें और “भेजें” दबाएँ।",
  namePH: "नाम (उदा.: टारो ओसाका)",
  kanaPH: "फुरिगाना (केवल जापानी)",
  emailPH: "ईमेल पता",
  messagePH: "प्रेरणा / स्वयं-परिचय",
  send: "भेजें",
  sending: "भेजा जा रहा है...",
  sent: "भेज दिया गया 🎉",
  success: "आपका आवेदन भेज दिया गया है। धन्यवाद।",
};

const AR: UIStrings = {
  title: "نموذج التقديم على الوظيفة",
  subtitle: "يرجى تعبئة الحقول أدناه ثم الضغط على «إرسال».",
  namePH: "الاسم (مثال: Taro Osaka)",
  kanaPH: "فوريجانا (لليابانية فقط)",
  emailPH: "البريد الإلكتروني",
  messagePH: "الدافع / التعريف بالنفس",
  send: "إرسال",
  sending: "جارٍ الإرسال...",
  sent: "تم الإرسال 🎉",
  success: "تم إرسال طلبك. شكرًا لك.",
};

const STRINGS: Record<LangKey, UIStrings> = {
  ja: JA, en: EN, zh: ZH, "zh-TW": ZH_TW, ko: KO, fr: FR, es: ES, de: DE,
  pt: PT, it: IT, ru: RU, th: TH, vi: VI, id: IDN, hi: HI, ar: AR,
};

/* ===============================
   本体（Jotaiの uiLang に追従）
================================ */
export default function JobPage() {
  const { uiLang } = useUILang();
  const lang = useMemo<LangKey>(() => {
    const k = (uiLang || "ja") as LangKey;
    return STRINGS[k] ? k : "ja";
  }, [uiLang]);

  const ui = STRINGS[lang];
  const isRTL = lang === "ar";

  // フォーム状態
  const [name, setName] = useState("");
  const [kana, setKana] = useState(""); // 日本語のみ使用
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");

  // 送信
  const handleSubmit = async () => {
    // 日本語のときは kana 必須。他言語では name を kana に入れて送る。
    if (!name || !email || !message || !SITE_KEY || (lang === "ja" && !kana)) {
      alert(lang === "ja" ? "必須項目を入力してください。" : "Please fill in all required fields.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/send-job-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kana: lang === "ja" ? kana : name,
          email,
          message,
          SITE_KEY,
          locale: lang, // 受信側で参照したい場合に利用可
        }),
      });

      if (res.ok) {
        setStatus("sent");
        setName("");
        setKana("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("idle");
        alert(lang === "ja" ? "送信に失敗しました。再度お試しください。" : "Failed to send. Please try again.");
      }
    } catch {
      setStatus("idle");
      alert(lang === "ja" ? "送信に失敗しました。ネットワークをご確認ください。" : "Failed to send. Please check your network.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b py-12 px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-xl mx-auto bg-white/30 rounded-2xl shadow-xl p-8 border border-gray-200">
        <h1 className="text-3xl font-bold mb-4 text-center text-sky-700">{ui.title}</h1>
        <p className="mb-6 text-gray-600 text-center">{ui.subtitle}</p>

        <div className="space-y-4">
          <Input
            placeholder={ui.namePH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-50"
            disabled={status === "loading"}
          />

          {/* 日本語UI時のみ ふりがな表示・必須 */}
          {lang === "ja" && (
            <Input
              placeholder={ui.kanaPH}
              value={kana}
              onChange={(e) => setKana(e.target.value)}
              className="bg-gray-50"
              disabled={status === "loading"}
            />
          )}

          <Input
            type="email"
            placeholder={ui.emailPH}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-50"
            disabled={status === "loading"}
          />

          <Textarea
            placeholder={ui.messagePH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-gray-50 min-h-[150px]"
            disabled={status === "loading"}
          />

          <Button
            onClick={handleSubmit}
            disabled={status === "loading"}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white"
          >
            {status === "loading" ? ui.sending : status === "sent" ? ui.sent : ui.send}
          </Button>
        </div>

        {status === "sent" && (
          <p className="text-green-600 mt-4 text-center">{ui.success}</p>
        )}
      </div>
    </div>
  );
}
