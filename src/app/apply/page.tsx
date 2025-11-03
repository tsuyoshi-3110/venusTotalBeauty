// app/job/apply/page.tsx
"use client";

import JobApplyForm from "@/components/job/JobApplyForm";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";
import clsx from "clsx";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

const DARK_KEYS: ThemeKey[] = ["brandH", "brandG", "brandI"];

/** 事前定義の文言（全言語：お問い合わせフォーム用） */
const STRINGS: Record<UILang, { title: string; subtitle: string }> = {
  ja: {
    title: "ご予約フォーム",
    subtitle:
      "必要事項をご入力のうえ送信してください。追って予約確認のご連絡を差し上げます。",
  },
  en: {
    title: "Reservation Form",
    subtitle:
      "Please fill in the required fields and submit. We will contact you shortly to confirm your reservation.",
  },
  zh: {
    title: "预约表单",
    subtitle:
      "请填写必要信息并提交。我们将尽快与您联系以确认预约。",
  },
  "zh-TW": {
    title: "預約表單",
    subtitle:
      "請填寫必要資訊並送出。我們將儘速與您聯繫確認預約。",
  },
  ko: {
    title: "예약 접수 폼",
    subtitle:
      "필수 항목을 작성 후 제출해 주세요. 예약 확인을 위해 곧 연락드리겠습니다.",
  },
  fr: {
    title: "Formulaire de réservation",
    subtitle:
      "Veuillez remplir les champs requis puis envoyer. Nous vous contacterons prochainement pour confirmer votre réservation.",
  },
  es: {
    title: "Formulario de reserva",
    subtitle:
      "Complete los campos requeridos y envíe. Nos pondremos en contacto con usted para confirmar su reserva.",
  },
  de: {
    title: "Reservierungsformular",
    subtitle:
      "Bitte füllen Sie die erforderlichen Felder aus und senden Sie das Formular ab. Wir melden uns zur Bestätigung Ihrer Reservierung.",
  },
  pt: {
    title: "Formulário de reserva",
    subtitle:
      "Preencha os campos obrigatórios e envie. Entraremos em contato em breve para confirmar sua reserva.",
  },
  it: {
    title: "Modulo di prenotazione",
    subtitle:
      "Compila i campi richiesti e invia. Ti contatteremo a breve per confermare la prenotazione.",
  },
  ru: {
    title: "Форма бронирования",
    subtitle:
      "Пожалуйста, заполните обязательные поля и отправьте. Мы свяжемся с вами для подтверждения бронирования.",
  },
  th: {
    title: "แบบฟอร์มจอง",
    subtitle:
      "กรุณากรอกข้อมูลที่จำเป็นและส่ง เราจะติดต่อยืนยันการจองโดยเร็ว",
  },
  vi: {
    title: "Biểu mẫu đặt chỗ",
    subtitle:
      "Vui lòng điền các trường bắt buộc và gửi. Chúng tôi sẽ sớm liên hệ để xác nhận đặt chỗ.",
  },
  id: {
    title: "Formulir pemesanan",
    subtitle:
      "Silakan isi kolom wajib lalu kirim. Kami akan segera menghubungi Anda untuk mengonfirmasi pemesanan.",
  },
  hi: {
    title: "आरक्षण फ़ॉर्म",
    subtitle:
      "कृपया आवश्यक फ़ील्ड भरकर भेजें। हम शीघ्र ही आपसे संपर्क करके आरक्षण की पुष्टि करेंगे।",
  },
  ar: {
    title: "نموذج الحجز",
    subtitle:
      "يرجى تعبئة الحقول المطلوبة ثم الإرسال. سنتواصل معك قريبًا لتأكيد الحجز.",
  },
};



export default function JobApplyPage() {
  const { uiLang } = useUILang();
  const t = STRINGS[uiLang] ?? STRINGS.ja;
  const dir = uiLang === "ar" ? "rtl" : "ltr";

  const gradient = useThemeGradient();
  const isDark =
    !!gradient &&
    DARK_KEYS.includes(
      (Object.keys(THEMES).find((k) => THEMES[k as ThemeKey] === gradient) as ThemeKey) ??
        "brandA"
    );
  const textClass = isDark ? "text-white" : "text-black";

  return (
    <div className={clsx("max-w-3xl mx-auto p-4 space-y-6", textClass)} dir={dir}>
      <h1 className="text-xl font-bold text-white text-outline">{t.title}</h1>
      <p className="text-sm opacity-80 text-white text-outline">{t.subtitle}</p>
      <JobApplyForm />
    </div>
  );
}
