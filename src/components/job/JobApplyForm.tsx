// components/job/JobApplyForm.tsx
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { MessageSquareMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";
import { useUILang } from "@/lib/atoms/uiLangAtom";

/* ===============================
   言語キー
================================ */
type LangKey =
  | "ja"
  | "en"
  | "zh"
  | "zh-TW"
  | "ko"
  | "fr"
  | "es"
  | "de"
  | "pt"
  | "it"
  | "ru"
  | "th"
  | "vi"
  | "id"
  | "hi"
  | "ar";

const DARK_KEYS: ThemeKey[] = ["brandH", "brandG", "brandI"];

/* ===============================
   時間スロット（30分刻み）
================================ */
const genTimes = (start = "09:00", end = "18:00") => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const arr: string[] = [];
  let h = sh,
    m = sm;
  while (h < eh || (h === eh && m <= em)) {
    arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
  }
  return arr;
};
const TIME_SLOTS = genTimes("09:00", "18:00");

/* ===============================
   連絡方法（UIは多言語、送信メッセージは既定の日本語のまま）
================================ */
const CONTACT_LABELS: Record<
  LangKey,
  Record<"phone" | "email" | "line", string>
> = {
  ja: { phone: "電話", email: "メール", line: "LINE" },
  en: { phone: "Phone", email: "Email", line: "LINE" },
  zh: { phone: "电话", email: "邮箱", line: "LINE" },
  "zh-TW": { phone: "電話", email: "電子郵件", line: "LINE" },
  ko: { phone: "전화", email: "이메일", line: "LINE" },
  fr: { phone: "Téléphone", email: "E-mail", line: "LINE" },
  es: { phone: "Teléfono", email: "Correo", line: "LINE" },
  de: { phone: "Telefon", email: "E-Mail", line: "LINE" },
  pt: { phone: "Telefone", email: "E-mail", line: "LINE" },
  it: { phone: "Telefono", email: "Email", line: "LINE" },
  ru: { phone: "Телефон", email: "Email", line: "LINE" },
  th: { phone: "โทรศัพท์", email: "อีเมล", line: "LINE" },
  vi: { phone: "Điện thoại", email: "Email", line: "LINE" },
  id: { phone: "Telepon", email: "Email", line: "LINE" },
  hi: { phone: "फ़ोन", email: "ईमेल", line: "LINE" },
  ar: { phone: "هاتف", email: "بريد", line: "LINE" },
};

/* ===============================
   フォーム型
================================ */
type FormValues = {
  name: string;
  phone: string;
  email: string;
  contactMethod: "phone" | "email" | "line";
  date: string;
  time: string;
  address: string;
  notes: string;
};

/* ===============================
   多言語テキスト
   （必要に応じて文言を調整してください）
================================ */
type Strings = {
  ui: {
    sectionTitle: string;
    sectionHelp: string;
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    timeSelectPlaceholder: string;
    address: string;
    notes: string;
    submit: string;
    sending: string;
    namePh: string;
    phonePh: string;
    emailPh: string;
    addressPh: string;
    notesPh: string;
  };
  modal: {
    doneTitle: string;
    doneLine1: (name: string) => string;
    doneLine2: string;
    close: string;
  };
  errors: {
    name: string;
    phone: string;
    phoneFormat: string;
    email: string;
    emailFormat: string;
    date: string;
    dateFormat: string;
    time: string;
    address: string;
    notes: string;
    notesMax: string;
  };
};

const JA: Strings = {
  ui: {
    sectionTitle: "ご依頼内容",
    sectionHelp:
      "全ての項目をご入力ください。担当者より折り返しご連絡いたします。",
    name: "お名前",
    phone: "電話番号",
    email: "メールアドレス",
    date: "ご希望日",
    time: "ご希望時間",
    timeSelectPlaceholder: "選択してください",
    address: "ご住所",
    notes: "ご要望・相談内容",
    submit: "この内容で依頼する",
    sending: "送信中…",
    namePh: "山田 太郎",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "例）大阪府豊中市〇〇町1-2-3",
    notesPh: "サービス内容をご記入ください",
  },
  modal: {
    doneTitle: "送信が完了しました",
    doneLine1: (name) => `${name} 様、ありがとうございます。`,
    doneLine2: "担当者より折り返しご連絡いたします。",
    close: "閉じる",
  },
  errors: {
    name: "お名前を入力してください",
    phone: "電話番号を入力してください",
    phoneFormat: "半角数字・記号で入力してください",
    email: "メールアドレスを入力してください",
    emailFormat: "メールアドレスの形式が不正です",
    date: "ご希望日を選択してください",
    dateFormat: "日付形式が不正です（YYYY-MM-DD）",
    time: "ご希望時間を選択してください",
    address: "ご住所を入力してください",
    notes: "ご要望・相談内容を入力してください",
    notesMax: "ご要望が長すぎます",
  },
};

const EN: Strings = {
  ui: {
    sectionTitle: "Request Details",
    sectionHelp: "Please fill out all fields. We will contact you shortly.",
    name: "Name",
    phone: "Phone",
    email: "Email",
    date: "Preferred Date",
    time: "Preferred Time",
    timeSelectPlaceholder: "Select",
    address: "Address",
    notes: "Notes / Request",
    submit: "Submit Request",
    sending: "Sending…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "e.g. 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Describe the service you need",
  },
  modal: {
    doneTitle: "Your request has been sent",
    doneLine1: (name) => `Thank you, ${name}.`,
    doneLine2: "We will get back to you shortly.",
    close: "Close",
  },
  errors: {
    name: "Please enter your name",
    phone: "Please enter your phone number",
    phoneFormat: "Use numbers and symbols only",
    email: "Please enter your email address",
    emailFormat: "Invalid email format",
    date: "Please select a date",
    dateFormat: "Invalid date format (YYYY-MM-DD)",
    time: "Please select a time",
    address: "Please enter your address",
    notes: "Please enter your request",
    notesMax: "Your request is too long",
  },
};

/* --- 以下は簡易訳（必要なら精緻化してください） --- */
const ZH: Strings = {
  ui: {
    sectionTitle: "请求详情",
    sectionHelp: "请填写所有项目，我们会尽快与您联系。",
    name: "姓名",
    phone: "电话",
    email: "邮箱",
    date: "期望日期",
    time: "期望时间",
    timeSelectPlaceholder: "请选择",
    address: "地址",
    notes: "需求 / 备注",
    submit: "提交请求",
    sending: "发送中…",
    namePh: "山田 太郎",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "例如：大阪府丰中市〇〇町1-2-3",
    notesPh: "请描述所需服务",
  },
  modal: {
    doneTitle: "已提交",
    doneLine1: (name) => `感谢您，${name}。`,
    doneLine2: "我们将尽快与您联系。",
    close: "关闭",
  },
  errors: {
    name: "请输入姓名",
    phone: "请输入电话号码",
    phoneFormat: "仅使用数字和符号",
    email: "请输入邮箱地址",
    emailFormat: "邮箱格式无效",
    date: "请选择日期",
    dateFormat: "日期格式无效（YYYY-MM-DD）",
    time: "请选择时间",
    address: "请输入地址",
    notes: "请输入需求内容",
    notesMax: "内容过长",
  },
};

const ZH_TW: Strings = {
  ui: {
    sectionTitle: "請求內容",
    sectionHelp: "請填寫所有欄位，我們將盡快與您聯繫。",
    name: "姓名",
    phone: "電話",
    email: "電子郵件",
    date: "期望日期",
    time: "期望時間",
    timeSelectPlaceholder: "請選擇",
    address: "地址",
    notes: "需求 / 備註",
    submit: "送出請求",
    sending: "傳送中…",
    namePh: "山田 太郎",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "例如：大阪府豐中市〇〇町1-2-3",
    notesPh: "請描述所需服務",
  },
  modal: {
    doneTitle: "已送出",
    doneLine1: (name) => `感謝您，${name}。`,
    doneLine2: "我們將盡快與您聯繫。",
    close: "關閉",
  },
  errors: {
    name: "請輸入姓名",
    phone: "請輸入電話號碼",
    phoneFormat: "僅使用數字與符號",
    email: "請輸入電子郵件",
    emailFormat: "電子郵件格式不正確",
    date: "請選擇日期",
    dateFormat: "日期格式不正確（YYYY-MM-DD）",
    time: "請選擇時間",
    address: "請輸入地址",
    notes: "請輸入需求內容",
    notesMax: "內容過長",
  },
};

const KO: Strings = {
  ui: {
    sectionTitle: "요청 내용",
    sectionHelp: "모든 항목을 입력해 주세요. 곧 연락드리겠습니다.",
    name: "이름",
    phone: "전화번호",
    email: "이메일",
    date: "희망 날짜",
    time: "희망 시간",
    timeSelectPlaceholder: "선택",
    address: "주소",
    notes: "요청 / 상담 내용",
    submit: "요청 보내기",
    sending: "전송 중…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "예: 오사카부 도요나카시 ○○초 1-2-3",
    notesPh: "필요한 서비스를 입력하세요",
  },
  modal: {
    doneTitle: "요청이 전송되었습니다",
    doneLine1: (name) => `${name} 님, 감사합니다.`,
    doneLine2: "곧 연락드리겠습니다.",
    close: "닫기",
  },
  errors: {
    name: "이름을 입력하세요",
    phone: "전화번호를 입력하세요",
    phoneFormat: "숫자와 기호만 사용하세요",
    email: "이메일을 입력하세요",
    emailFormat: "이메일 형식이 올바르지 않습니다",
    date: "날짜를 선택하세요",
    dateFormat: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)",
    time: "시간을 선택하세요",
    address: "주소를 입력하세요",
    notes: "요청 내용을 입력하세요",
    notesMax: "요청 내용이 너무 깁니다",
  },
};

const FR: Strings = {
  ui: {
    sectionTitle: "Détails de la demande",
    sectionHelp:
      "Veuillez remplir tous les champs. Nous vous contacterons rapidement.",
    name: "Nom",
    phone: "Téléphone",
    email: "E-mail",
    date: "Date souhaitée",
    time: "Heure souhaitée",
    timeSelectPlaceholder: "Sélectionner",
    address: "Adresse",
    notes: "Remarques / Demande",
    submit: "Envoyer la demande",
    sending: "Envoi…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "ex. 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Décrivez le service souhaité",
  },
  modal: {
    doneTitle: "Votre demande a été envoyée",
    doneLine1: (name) => `Merci, ${name}.`,
    doneLine2: "Nous vous répondrons sous peu.",
    close: "Fermer",
  },
  errors: {
    name: "Veuillez saisir votre nom",
    phone: "Veuillez saisir votre numéro de téléphone",
    phoneFormat: "Utilisez uniquement des chiffres et symboles",
    email: "Veuillez saisir votre e-mail",
    emailFormat: "Format d’e-mail invalide",
    date: "Veuillez sélectionner une date",
    dateFormat: "Format de date invalide (YYYY-MM-DD)",
    time: "Veuillez sélectionner une heure",
    address: "Veuillez saisir votre adresse",
    notes: "Veuillez saisir votre demande",
    notesMax: "Votre demande est trop longue",
  },
};

const ES: Strings = {
  ui: {
    sectionTitle: "Detalles de la solicitud",
    sectionHelp: "Complete todos los campos. Nos pondremos en contacto pronto.",
    name: "Nombre",
    phone: "Teléfono",
    email: "Correo electrónico",
    date: "Fecha preferida",
    time: "Hora preferida",
    timeSelectPlaceholder: "Seleccionar",
    address: "Dirección",
    notes: "Notas / Solicitud",
    submit: "Enviar solicitud",
    sending: "Enviando…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "ej. 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Describa el servicio que necesita",
  },
  modal: {
    doneTitle: "Tu solicitud ha sido enviada",
    doneLine1: (name) => `Gracias, ${name}.`,
    doneLine2: "Nos pondremos en contacto en breve.",
    close: "Cerrar",
  },
  errors: {
    name: "Ingrese su nombre",
    phone: "Ingrese su teléfono",
    phoneFormat: "Use solo números y símbolos",
    email: "Ingrese su correo",
    emailFormat: "Formato de correo inválido",
    date: "Seleccione una fecha",
    dateFormat: "Formato de fecha inválido (YYYY-MM-DD)",
    time: "Seleccione una hora",
    address: "Ingrese su dirección",
    notes: "Ingrese su solicitud",
    notesMax: "Su solicitud es demasiado larga",
  },
};

const DE: Strings = {
  ui: {
    sectionTitle: "Anfragedetails",
    sectionHelp: "Bitte alle Felder ausfüllen. Wir melden uns zeitnah.",
    name: "Name",
    phone: "Telefon",
    email: "E-Mail",
    date: "Bevorzugtes Datum",
    time: "Bevorzugte Uhrzeit",
    timeSelectPlaceholder: "Auswählen",
    address: "Adresse",
    notes: "Anmerkungen / Anfrage",
    submit: "Anfrage senden",
    sending: "Senden…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "z. B. 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Beschreiben Sie den gewünschten Service",
  },
  modal: {
    doneTitle: "Ihre Anfrage wurde gesendet",
    doneLine1: (name) => `Vielen Dank, ${name}.`,
    doneLine2: "Wir melden uns in Kürze.",
    close: "Schließen",
  },
  errors: {
    name: "Bitte geben Sie Ihren Namen ein",
    phone: "Bitte geben Sie Ihre Telefonnummer ein",
    phoneFormat: "Nur Zahlen und Symbole verwenden",
    email: "Bitte geben Sie Ihre E-Mail ein",
    emailFormat: "Ungültiges E-Mail-Format",
    date: "Bitte wählen Sie ein Datum",
    dateFormat: "Ungültiges Datumsformat (YYYY-MM-DD)",
    time: "Bitte wählen Sie eine Uhrzeit",
    address: "Bitte geben Sie Ihre Adresse ein",
    notes: "Bitte geben Sie Ihre Anfrage ein",
    notesMax: "Ihre Anfrage ist zu lang",
  },
};

const PT: Strings = {
  ui: {
    sectionTitle: "Detalhes do pedido",
    sectionHelp: "Preencha todos os campos. Entraremos em contato em breve.",
    name: "Nome",
    phone: "Telefone",
    email: "E-mail",
    date: "Data preferida",
    time: "Hora preferida",
    timeSelectPlaceholder: "Selecionar",
    address: "Endereço",
    notes: "Observações / Solicitação",
    submit: "Enviar pedido",
    sending: "Enviando…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "ex.: 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Descreva o serviço necessário",
  },
  modal: {
    doneTitle: "Seu pedido foi enviado",
    doneLine1: (name) => `Obrigado, ${name}.`,
    doneLine2: "Entraremos em contato em breve.",
    close: "Fechar",
  },
  errors: {
    name: "Informe seu nome",
    phone: "Informe seu telefone",
    phoneFormat: "Use apenas números e símbolos",
    email: "Informe seu e-mail",
    emailFormat: "Formato de e-mail inválido",
    date: "Selecione uma data",
    dateFormat: "Formato de data inválido (YYYY-MM-DD)",
    time: "Selecione um horário",
    address: "Informe seu endereço",
    notes: "Descreva sua solicitação",
    notesMax: "Sua solicitação é muito longa",
  },
};

const IT: Strings = {
  ui: {
    sectionTitle: "Dettagli della richiesta",
    sectionHelp: "Compila tutti i campi. Ti contatteremo a breve.",
    name: "Nome",
    phone: "Telefono",
    email: "Email",
    date: "Data preferita",
    time: "Ora preferita",
    timeSelectPlaceholder: "Seleziona",
    address: "Indirizzo",
    notes: "Note / Richiesta",
    submit: "Invia richiesta",
    sending: "Invio…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "es. 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Descrivi il servizio richiesto",
  },
  modal: {
    doneTitle: "La tua richiesta è stata inviata",
    doneLine1: (name) => `Grazie, ${name}.`,
    doneLine2: "Ti contatteremo al più presto.",
    close: "Chiudi",
  },
  errors: {
    name: "Inserisci il nome",
    phone: "Inserisci il telefono",
    phoneFormat: "Usa solo numeri e simboli",
    email: "Inserisci l’email",
    emailFormat: "Formato email non valido",
    date: "Seleziona una data",
    dateFormat: "Formato data non valido (YYYY-MM-DD)",
    time: "Seleziona un orario",
    address: "Inserisci l’indirizzo",
    notes: "Inserisci la richiesta",
    notesMax: "La richiesta è troppo lunga",
  },
};

const RU: Strings = {
  ui: {
    sectionTitle: "Детали запроса",
    sectionHelp: "Заполните все поля. Мы свяжемся с вами в ближайшее время.",
    name: "Имя",
    phone: "Телефон",
    email: "Email",
    date: "Предпочтительная дата",
    time: "Предпочтительное время",
    timeSelectPlaceholder: "Выбрать",
    address: "Адрес",
    notes: "Примечания / Запрос",
    submit: "Отправить запрос",
    sending: "Отправка…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "например: Осака, Тойонака, ○○-тё 1-2-3",
    notesPh: "Опишите необходимую услугу",
  },
  modal: {
    doneTitle: "Ваш запрос отправлен",
    doneLine1: (name) => `Спасибо, ${name}.`,
    doneLine2: "Мы скоро свяжемся с вами.",
    close: "Закрыть",
  },
  errors: {
    name: "Введите имя",
    phone: "Введите номер телефона",
    phoneFormat: "Используйте только цифры и символы",
    email: "Введите email",
    emailFormat: "Неверный формат email",
    date: "Выберите дату",
    dateFormat: "Неверный формат даты (YYYY-MM-DD)",
    time: "Выберите время",
    address: "Введите адрес",
    notes: "Введите запрос",
    notesMax: "Слишком длинный запрос",
  },
};

const TH: Strings = {
  ui: {
    sectionTitle: "รายละเอียดคำขอ",
    sectionHelp: "กรอกข้อมูลให้ครบถ้วน เราจะติดต่อกลับโดยเร็ว",
    name: "ชื่อ",
    phone: "โทรศัพท์",
    email: "อีเมล",
    date: "วันที่ต้องการ",
    time: "เวลาที่ต้องการ",
    timeSelectPlaceholder: "เลือก",
    address: "ที่อยู่",
    notes: "รายละเอียด / คำขอ",
    submit: "ส่งคำขอ",
    sending: "กำลังส่ง…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "เช่น: 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "อธิบายบริการที่ต้องการ",
  },
  modal: {
    doneTitle: "ส่งคำขอแล้ว",
    doneLine1: (name) => `ขอบคุณคุณ ${name}`,
    doneLine2: "เราจะติดต่อกลับโดยเร็ว",
    close: "ปิด",
  },
  errors: {
    name: "กรุณากรอกชื่อ",
    phone: "กรุณากรอกโทรศัพท์",
    phoneFormat: "ใช้ตัวเลขและสัญลักษณ์เท่านั้น",
    email: "กรุณากรอกอีเมล",
    emailFormat: "รูปแบบอีเมลไม่ถูกต้อง",
    date: "กรุณาเลือกวันที่",
    dateFormat: "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)",
    time: "กรุณาเลือกเวลา",
    address: "กรุณากรอกที่อยู่",
    notes: "กรุณากรอกรายละเอียด",
    notesMax: "รายละเอียดยาวเกินไป",
  },
};

const VI: Strings = {
  ui: {
    sectionTitle: "Chi tiết yêu cầu",
    sectionHelp: "Vui lòng điền đầy đủ. Chúng tôi sẽ liên hệ sớm.",
    name: "Họ tên",
    phone: "Điện thoại",
    email: "Email",
    date: "Ngày mong muốn",
    time: "Giờ mong muốn",
    timeSelectPlaceholder: "Chọn",
    address: "Địa chỉ",
    notes: "Ghi chú / Yêu cầu",
    submit: "Gửi yêu cầu",
    sending: "Đang gửi…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "vd: 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Mô tả dịch vụ bạn cần",
  },
  modal: {
    doneTitle: "Đã gửi yêu cầu",
    doneLine1: (name) => `Cảm ơn ${name}.`,
    doneLine2: "Chúng tôi sẽ sớm liên hệ lại.",
    close: "Đóng",
  },
  errors: {
    name: "Vui lòng nhập họ tên",
    phone: "Vui lòng nhập điện thoại",
    phoneFormat: "Chỉ dùng số và ký hiệu",
    email: "Vui lòng nhập email",
    emailFormat: "Email không hợp lệ",
    date: "Vui lòng chọn ngày",
    dateFormat: "Sai định dạng ngày (YYYY-MM-DD)",
    time: "Vui lòng chọn giờ",
    address: "Vui lòng nhập địa chỉ",
    notes: "Vui lòng nhập yêu cầu",
    notesMax: "Yêu cầu quá dài",
  },
};

const IDN: Strings = {
  ui: {
    sectionTitle: "Detail Permintaan",
    sectionHelp: "Isi semua bidang. Kami akan segera menghubungi Anda.",
    name: "Nama",
    phone: "Telepon",
    email: "Email",
    date: "Tanggal pilihan",
    time: "Waktu pilihan",
    timeSelectPlaceholder: "Pilih",
    address: "Alamat",
    notes: "Catatan / Permintaan",
    submit: "Kirim Permintaan",
    sending: "Mengirim…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "cth: 1-2-3 ○○-cho, Toyonaka, Osaka",
    notesPh: "Jelaskan layanan yang dibutuhkan",
  },
  modal: {
    doneTitle: "Permintaan Anda telah dikirim",
    doneLine1: (name) => `Terima kasih, ${name}.`,
    doneLine2: "Kami akan segera menghubungi Anda.",
    close: "Tutup",
  },
  errors: {
    name: "Masukkan nama",
    phone: "Masukkan nomor telepon",
    phoneFormat: "Gunakan angka & simbol saja",
    email: "Masukkan email",
    emailFormat: "Format email tidak valid",
    date: "Pilih tanggal",
    dateFormat: "Format tanggal tidak valid (YYYY-MM-DD)",
    time: "Pilih waktu",
    address: "Masukkan alamat",
    notes: "Masukkan permintaan",
    notesMax: "Permintaan terlalu panjang",
  },
};

const HI: Strings = {
  ui: {
    sectionTitle: "अनुरोध विवरण",
    sectionHelp: "कृपया सभी फ़ील्ड भरें। हम शीघ्र संपर्क करेंगे।",
    name: "नाम",
    phone: "फ़ोन",
    email: "ईमेल",
    date: "वांछित तिथि",
    time: "वांछित समय",
    timeSelectPlaceholder: "चुनें",
    address: "पता",
    notes: "टिप्पणी / अनुरोध",
    submit: "अनुरोध भेजें",
    sending: "भेजा जा रहा है…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "उदा. 1-2-3 ○○-चो, टोयोनाका, ओसाका",
    notesPh: "आवश्यक सेवा का वर्णन करें",
  },
  modal: {
    doneTitle: "आपका अनुरोध भेज दिया गया है",
    doneLine1: (name) => `धन्यवाद, ${name}।`,
    doneLine2: "हम शीघ्र ही संपर्क करेंगे।",
    close: "बंद करें",
  },
  errors: {
    name: "कृपया नाम दर्ज करें",
    phone: "कृपया फ़ोन नंबर दर्ज करें",
    phoneFormat: "केवल अंक और चिन्ह का उपयोग करें",
    email: "कृपया ईमेल दर्ज करें",
    emailFormat: "ईमेल प्रारूप अमान्य है",
    date: "कृपया तिथि चुनें",
    dateFormat: "तिथि प्रारूप अमान्य (YYYY-MM-DD)",
    time: "कृपया समय चुनें",
    address: "कृपया पता दर्ज करें",
    notes: "कृपया अनुरोध दर्ज करें",
    notesMax: "अनुरोध बहुत लंबा है",
  },
};

const AR: Strings = {
  ui: {
    sectionTitle: "تفاصيل الطلب",
    sectionHelp: "يرجى تعبئة جميع الحقول. سنتواصل معك قريبًا.",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    date: "التاريخ المفضل",
    time: "الوقت المفضل",
    timeSelectPlaceholder: "اختر",
    address: "العنوان",
    notes: "ملاحظات / طلب",
    submit: "إرسال الطلب",
    sending: "جاري الإرسال…",
    namePh: "Taro Yamada",
    phonePh: "09012345678",
    emailPh: "example@example.com",
    addressPh: "مثال: 1-2-3 ○○-cho، تويوناکا، أوساكا",
    notesPh: "صف الخدمة المطلوبة",
  },
  modal: {
    doneTitle: "تم إرسال طلبك",
    doneLine1: (name) => `شكرًا لك، ${name}.`,
    doneLine2: "سنتواصل معك قريبًا.",
    close: "إغلاق",
  },
  errors: {
    name: "يرجى إدخال الاسم",
    phone: "يرجى إدخال رقم الهاتف",
    phoneFormat: "استخدم الأرقام والرموز فقط",
    email: "يرجى إدخال البريد الإلكتروني",
    emailFormat: "صيغة بريد غير صالحة",
    date: "يرجى اختيار التاريخ",
    dateFormat: "صيغة تاريخ غير صالحة (YYYY-MM-DD)",
    time: "يرجى اختيار الوقت",
    address: "يرجى إدخال العنوان",
    notes: "يرجى إدخال الطلب",
    notesMax: "الطلب طويل جدًا",
  },
};

const STRINGS: Record<LangKey, Strings> = {
  ja: JA,
  en: EN,
  zh: ZH,
  "zh-TW": ZH_TW,
  ko: KO,
  fr: FR,
  es: ES,
  de: DE,
  pt: PT,
  it: IT,
  ru: RU,
  th: TH,
  vi: VI,
  id: IDN,
  hi: HI,
  ar: AR,
};

/* ===============================
   日付ユーティリティ（JST）
================================ */
function todayISO(): string {
  const tz = "Asia/Tokyo";
  const d = new Date();
  const y = d.toLocaleString("ja-JP", { timeZone: tz, year: "numeric" });
  const m = d.toLocaleString("ja-JP", { timeZone: tz, month: "2-digit" });
  const day = d.toLocaleString("ja-JP", { timeZone: tz, day: "2-digit" });
  return `${y}-${m}-${day}`;
}

/* ===============================
   本体
================================ */
export default function JobApplyForm() {
  const gradient = useThemeGradient();
  const isDark =
    !!gradient &&
    DARK_KEYS.includes(
      (Object.keys(THEMES).find(
        (k) => THEMES[k as ThemeKey] === gradient
      ) as ThemeKey) ?? "brandA"
    );

  // ★ Jotai の UI 言語で文言を切替（未知キーは ja にフォールバック）
  const { uiLang } = useUILang();
  const lang = useMemo<LangKey>(() => {
    const k = (uiLang || "ja") as LangKey;
    return (STRINGS as any)[k] ? k : "ja";
  }, [uiLang]);

  const strings = useMemo(() => STRINGS[lang], [lang]);
  const contactLabels = useMemo(
    () => CONTACT_LABELS[lang] ?? CONTACT_LABELS.ja,
    [lang]
  );

  // バリデーション（言語ごとに再構築）
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, strings.errors.name),
        phone: z
          .string()
          .min(8, strings.errors.phone)
          .regex(/^[0-9+\-() ]+$/, strings.errors.phoneFormat),
        email: z
          .string()
          .min(1, strings.errors.email)
          .email(strings.errors.emailFormat),
        contactMethod: z.enum(["phone", "email", "line"]),
        date: z
          .string()
          .min(1, strings.errors.date)
          .regex(/^\d{4}-\d{2}-\d{2}$/, strings.errors.dateFormat),
        time: z.string().min(1, strings.errors.time),
        address: z.string().min(1, strings.errors.address),
        notes: z
          .string()
          .min(1, strings.errors.notes)
          .max(1000, strings.errors.notesMax),
      }),
    [strings.errors]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues, any>,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      contactMethod: "phone",
      date: todayISO(),
      time: "",
      address: "",
      notes: "",
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [doneModal, setDoneModal] = useState<null | { name: string }>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (v: FormValues) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/job/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          email: v.email,
          phone: v.phone,
          message: [
            "【ご依頼フォーム】",
            `■ 連絡方法: ${contactLabels[v.contactMethod] ?? v.contactMethod}`,
            `■ 希望日時: ${v.date} ${v.time}`,
            `■ ご住所: ${v.address}`,
            "",
            "■ ご要望・相談内容:",
            v.notes,
          ].join("\n"),
          contactMethod: v.contactMethod,
          date: v.date,
          time: v.time,
          address: v.address,
          notes: v.notes,
          lang, // 送信先で利用したい場合に参照可能
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error ?? "送信に失敗しました。");
        return;
      }
      reset({
        ...watch(),
        name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        time: "",
        date: todayISO(),
      });
      setDoneModal({ name: v.name });
    } catch (e: any) {
      setErrorMsg(e?.message ?? "送信に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = todayISO();

  const textClass = isDark ? "text-white" : "text-black";
  const cardClass = clsx(
    "rounded-2xl border shadow-sm backdrop-blur bg-white/10"
  );

  return (
    <div className={clsx("space-y-6", textClass)}>
      <div className={cardClass}>
        {/* ヘッダー（ピッカー無し） */}
        <div
          className={clsx(
            "px-5 pt-5 pb-3 border-b rounded-t-2xl",
            isDark ? " border-white/10" : " border-black/10"
          )}
        >
          <div className="flex items-center gap-2">
            <MessageSquareMore
              className={clsx("h-5 w-5", isDark ? "text-white" : "text-black")}
            />
            <h2
              className={clsx(
                "text-base font-semibold",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.sectionTitle}
            </h2>
          </div>
          <p
            className={clsx(
              "mt-1 text-xs",
              isDark ? "text-white/70" : "text-black/70"
            )}
          >
            {strings.ui.sectionHelp}
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-6">
          {/* お名前 */}
          <div className="grid gap-2">
            <label
              className={clsx(
                "text-sm font-medium",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.name}
            </label>
            <Input
              placeholder={strings.ui.namePh}
              {...register("name")}
              className={
                isDark
                  ? "text-white placeholder:text-white/50"
                  : "text-black placeholder:text-black/50"
              }
              aria-required={true}
              required
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* 電話番号 */}
          <div className="grid gap-2">
            <label
              className={clsx(
                "text-sm font-medium",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.phone}
            </label>
            <Input
              placeholder={strings.ui.phonePh}
              {...register("phone")}
              className={
                isDark
                  ? "text-white placeholder:text-white/50"
                  : "text-black placeholder:text-black/50"
              }
              inputMode="tel"
              aria-required={true}
              required
            />
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* メールアドレス */}
          <div className="grid gap-2">
            <label
              className={clsx(
                "text-sm font-medium",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.email}
            </label>
            <Input
              type="email"
              placeholder={strings.ui.emailPh}
              {...register("email")}
              className={
                isDark
                  ? "text-white placeholder:text-white/50"
                  : "text-black placeholder:text-black/50"
              }
              inputMode="email"
              aria-required={true}
              required
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* 希望日・希望時間 */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 日付 */}
            <div className="grid gap-2 min-w-0">
              <label
                className={clsx(
                  "text-sm font-medium  ",
                  isDark ? "text-white" : "text-black"
                )}
              >
                {strings.ui.date}
              </label>
              <Input
                type="date"
                min={minDate}
                {...register("date")}
                className={clsx(
                  "block min-w-0 w-full max-w-full appearance-none",
                  isDark
                    ? "text-white placeholder:text-white placeholder:opacity-70 [color-scheme:dark]"
                    : "text-black placeholder:text-black placeholder:opacity-70 [color-scheme:light]"
                )}
                aria-required={true}
                required
              />
              {errors.date && (
                <p className="text-xs text-red-500">{errors.date.message}</p>
              )}
            </div>

            {/* 時間 */}
            <div className="grid gap-2 min-w-0">
              <label
                className={clsx(
                  "text-sm font-medium",
                  isDark ? "text-white" : "text-black"
                )}
              >
                {strings.ui.time}
              </label>
              <select
                {...register("time")}
                className={clsx(
                  "block h-10 min-w-0 w-full max-w-full rounded-md border px-3 text-black",
                  isDark ? "text-white" : "text-black"
                )}
                aria-required={true}
                required
              >
                <option value="">{strings.ui.timeSelectPlaceholder}</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.time && (
                <p className="text-xs text-red-500">{errors.time.message}</p>
              )}
            </div>
          </div>

          {/* ご住所 */}
          <div className="grid gap-2">
            <label
              className={clsx(
                "text-sm font-medium",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.address}
            </label>
            <Input
              placeholder={strings.ui.addressPh}
              {...register("address")}
              className={
                isDark
                  ? "text-white placeholder:text-white/50"
                  : "text-black placeholder:text-black/50"
              }
              aria-required={true}
              required
            />
            {errors.address && (
              <p className="text-xs text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* ご要望 */}
          <div className="grid gap-2">
            <label
              className={clsx(
                "text-sm font-medium",
                isDark ? "text-white" : "text-black"
              )}
            >
              {strings.ui.notes}
            </label>
            <Textarea
              rows={6}
              placeholder={strings.ui.notesPh}
              {...register("notes")}
              className={
                isDark
                  ? "text-white placeholder:text-white/50"
                  : "text-black placeholder:text-black/50"
              }
              aria-required={true}
              required
            />
            {errors.notes && (
              <p className="text-xs text-red-500">{errors.notes.message}</p>
            )}
          </div>

          {/* 送信エラー */}
          {errorMsg && (
            <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* 送信ボタン */}
          <div className="pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? strings.ui.sending : strings.ui.submit}
            </Button>
          </div>
        </form>
      </div>

      {/* 成功モーダル（白背景固定） */}
      {doneModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
            <div className="text-base font-semibold mb-2">
              {strings.modal.doneTitle}
            </div>
            <p className="text-sm mb-4">
              {strings.modal.doneLine1(doneModal.name)}
              <br />
              {strings.modal.doneLine2}
            </p>
            <div className="text-right">
              <Button onClick={() => setDoneModal(null)}>
                {strings.modal.close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
