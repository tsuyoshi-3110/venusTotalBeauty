// components/forms/MinimalInquiryForm.tsx
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";

/* ===============================
   ダークテーマ判定に使うキー
================================ */
const DARK_KEYS: ThemeKey[] = ["brandH", "brandG", "brandI"];

/* ===============================
   多言語テキスト（添付系は optional）
================================ */
type Strings = {
  reserveBtn: string;
  title: string;
  help: string;
  name: string;
  email: string;
  message: string;
  namePh: string;
  messagePh: string;
  submit: string;
  sending: string;
  sent: string;
  errors: {
    name: string;
    emailReq: string;
    emailFmt: string;
    message: string;
  };
  // 追加（任意: 無ければフォールバック）
  attachLabel?: string;
  attachHelp?: string;
  fileRemove?: string;
  fileTooMany?: string;
  fileTooBig?: string;
  fileTypeErr?: string;
};

const STRINGS: Record<string, Strings> = {
  ja: {
    reserveBtn: "ご予約の方はこちら",
    title: "お問い合わせフォーム",
    help: "※ メールとお問い合わせ内容は必須です。",
    name: "お名前（必須）",
    email: "メールアドレス（必須）",
    message: "お問い合わせ内容（必須）",
    namePh: "山田 太郎",
    messagePh: "ご質問・ご要望をご記入ください",
    submit: "送信",
    sending: "送信中…",
    sent: "送信が完了しました。担当者よりメールでご連絡いたします。",
    errors: {
      name: "お名前は必須です",
      emailReq: "メールは必須です",
      emailFmt: "メール形式が不正です",
      message: "お問い合わせ内容は必須です",
    },
    attachLabel: "ファイル添付（写真・PDF）",
    attachHelp: "最大5件、各10MBまで。対応形式：JPEG / PNG / WebP / GIF / PDF",
    fileRemove: "削除",
    fileTooMany: "添付できるのは最大5件までです。",
    fileTooBig: "ファイルサイズが大きすぎます（各10MBまで）。",
    fileTypeErr: "対応していないファイル形式です。",
  },
  en: {
    reserveBtn: "Go to booking",
    title: "Contact Form",
    help: "Email and message are required.",
    name: "Your Name (required)",
    email: "Email (required)",
    message: "Message (required)",
    namePh: "Taro Yamada",
    messagePh: "Write your question or request",
    submit: "Send",
    sending: "Sending…",
    sent: "Sent. We will contact you by email.",
    errors: {
      name: "Name is required",
      emailReq: "Email is required",
      emailFmt: "Invalid email format",
      message: "Message is required",
    },
    attachLabel: "Attachments (photos / PDF)",
    attachHelp:
      "Up to 5 files, 10MB each. Supported: JPEG / PNG / WebP / GIF / PDF",
    fileRemove: "Remove",
    fileTooMany: "You can attach up to 5 files.",
    fileTooBig: "File size is too large (max 10MB each).",
    fileTypeErr: "Unsupported file type.",
  },
  // 他言語は既存のまま（添付系は ja→en にフォールバック）
  zh: {
    reserveBtn: "前往预约",
    title: "联系表单",
    help: "邮箱与内容为必填。",
    name: "姓名（必填）",
    email: "邮箱（必填）",
    message: "内容（必填）",
    namePh: "山田 太郎",
    messagePh: "请填写您的问题或需求",
    submit: "发送",
    sending: "发送中…",
    sent: "已发送，我们将通过邮件联系您。",
    errors: {
      name: "请输入姓名",
      emailReq: "请输入邮箱",
      emailFmt: "邮箱格式不正确",
      message: "请输入内容",
    },
  },
  "zh-TW": {
    reserveBtn: "前往預約",
    title: "聯絡表單",
    help: "電子郵件與內容為必填。",
    name: "姓名（必填）",
    email: "電子郵件（必填）",
    message: "內容（必填）",
    namePh: "山田 太郎",
    messagePh: "請填寫您的問題或需求",
    submit: "送出",
    sending: "傳送中…",
    sent: "已送出，我們將以電子郵件與您聯繫。",
    errors: {
      name: "請輸入姓名",
      emailReq: "請輸入電子郵件",
      emailFmt: "電子郵件格式不正確",
      message: "請輸入內容",
    },
  },
  ko: {
    reserveBtn: "예약 바로가기",
    title: "문의 폼",
    help: "이메일과 내용은 필수입니다.",
    name: "이름 (필수)",
    email: "이메일 (필수)",
    message: "문의 내용 (필수)",
    namePh: "Taro Yamada",
    messagePh: "문의 사항을 적어주세요",
    submit: "보내기",
    sending: "전송 중…",
    sent: "전송되었습니다. 이메일로 연락드리겠습니다.",
    errors: {
      name: "이름을 입력하세요",
      emailReq: "이메일을 입력하세요",
      emailFmt: "이메일 형식이 올바르지 않습니다",
      message: "내용을 입력하세요",
    },
  },
  fr: {
    reserveBtn: "Aller à la réservation",
    title: "Formulaire de contact",
    help: "E-mail et message requis.",
    name: "Nom (obligatoire)",
    email: "E-mail (obligatoire)",
    message: "Message (obligatoire)",
    namePh: "Taro Yamada",
    messagePh: "Votre question ou demande",
    submit: "Envoyer",
    sending: "Envoi…",
    sent: "Envoyé. Nous vous contacterons par e-mail.",
    errors: {
      name: "Le nom est requis",
      emailReq: "L’e-mail est requis",
      emailFmt: "Format d’e-mail invalide",
      message: "Le message est requis",
    },
  },
  es: {
    reserveBtn: "Ir a reservas",
    title: "Formulario de contacto",
    help: "Correo y mensaje son obligatorios.",
    name: "Nombre (obligatorio)",
    email: "Correo (obligatorio)",
    message: "Mensaje (obligatorio)",
    namePh: "Taro Yamada",
    messagePh: "Escribe tu consulta o solicitud",
    submit: "Enviar",
    sending: "Enviando…",
    sent: "Enviado. Te contactaremos por correo.",
    errors: {
      name: "El nombre es obligatorio",
      emailReq: "El correo es obligatorio",
      emailFmt: "Formato de correo inválido",
      message: "El mensaje es obligatorio",
    },
  },
  de: {
    reserveBtn: "Zur Buchung",
    title: "Kontaktformular",
    help: "E-Mail und Nachricht sind erforderlich.",
    name: "Name (erforderlich)",
    email: "E-Mail (erforderlich)",
    message: "Nachricht (erforderlich)",
    namePh: "Taro Yamada",
    messagePh: "Ihre Frage oder Anfrage",
    submit: "Senden",
    sending: "Senden…",
    sent: "Gesendet. Wir melden uns per E-Mail.",
    errors: {
      name: "Name ist erforderlich",
      emailReq: "E-Mail ist erforderlich",
      emailFmt: "Ungültiges E-Mail-Format",
      message: "Nachricht ist erforderlich",
    },
  },
  pt: {
    reserveBtn: "Ir para reserva",
    title: "Formulário de contato",
    help: "E-mail e mensagem são obrigatórios.",
    name: "Nome (obrigatório)",
    email: "E-mail (obrigatório)",
    message: "Mensagem (obrigatório)",
    namePh: "Taro Yamada",
    messagePh: "Sua dúvida ou solicitação",
    submit: "Enviar",
    sending: "Enviando…",
    sent: "Enviado. Entraremos em contato por e-mail.",
    errors: {
      name: "Nome é obrigatório",
      emailReq: "E-mail é obrigatório",
      emailFmt: "Formato de e-mail inválido",
      message: "Mensagem é obrigatória",
    },
  },
  it: {
    reserveBtn: "Vai alla prenotazione",
    title: "Modulo di contatto",
    help: "Email e messaggio sono obbligatori.",
    name: "Nome (obbligatorio)",
    email: "Email (obbligatoria)",
    message: "Messaggio (obbligatorio)",
    namePh: "Taro Yamada",
    messagePh: "La tua domanda o richiesta",
    submit: "Invia",
    sending: "Invio…",
    sent: "Inviato. Ti contatteremo via email.",
    errors: {
      name: "Il nome è obbligatorio",
      emailReq: "L'email è obbligatoria",
      emailFmt: "Formato email non valido",
      message: "Il messaggio è obbligatorio",
    },
  },
  ru: {
    reserveBtn: "Перейти к бронированию",
    title: "Контактная форма",
    help: "Требуются e-mail и сообщение.",
    name: "Имя (обязательно)",
    email: "Email (обязательно)",
    message: "Сообщение (обязательно)",
    namePh: "Таро Ямада",
    messagePh: "Ваш вопрос или запрос",
    submit: "Отправить",
    sending: "Отправка…",
    sent: "Отправлено. Свяжемся с вами по e-mail.",
    errors: {
      name: "Имя обязательно",
      emailReq: "Требуется email",
      emailFmt: "Неверный формат email",
      message: "Требуется сообщение",
    },
  },
  th: {
    reserveBtn: "ไปที่แบบฟอร์มจอง",
    title: "ฟอร์มติดต่อ",
    help: "ต้องใส่อีเมลและข้อความ",
    name: "ชื่อ (จำเป็น)",
    email: "อีเมล (จำเป็น)",
    message: "ข้อความ (จำเป็น)",
    namePh: "Taro Yamada",
    messagePh: "เขียนคำถามหรือคำขอของคุณ",
    submit: "ส่ง",
    sending: "กำลังส่ง…",
    sent: "ส่งแล้ว เราจะติดต่อกลับทางอีเมล",
    errors: {
      name: "กรุณากรอกชื่อ",
      emailReq: "กรุณากรอกอีเมล",
      emailFmt: "รูปแบบอีเมลไม่ถูกต้อง",
      message: "กรุณากรอกข้อความ",
    },
  },
  vi: {
    reserveBtn: "Đi tới đặt lịch",
    title: "Biểu mẫu liên hệ",
    help: "Bắt buộc nhập email và nội dung.",
    name: "Họ tên (bắt buộc)",
    email: "Email (bắt buộc)",
    message: "Nội dung (bắt buộc)",
    namePh: "Taro Yamada",
    messagePh: "Ghi câu hỏi hoặc yêu cầu của bạn",
    submit: "Gửi",
    sending: "Đang gửi…",
    sent: "Đã gửi. Chúng tôi sẽ liên hệ qua email.",
    errors: {
      name: "Vui lòng nhập họ tên",
      emailReq: "Vui lòng nhập email",
      emailFmt: "Email không hợp lệ",
      message: "Vui lòng nhập nội dung",
    },
  },
  id: {
    reserveBtn: "Ke halaman pemesanan",
    title: "Form kontak",
    help: "Email dan pesan wajib diisi.",
    name: "Nama (wajib)",
    email: "Email (wajib)",
    message: "Pesan (wajib)",
    namePh: "Taro Yamada",
    messagePh: "Tulis pertanyaan atau permintaan Anda",
    submit: "Kirim",
    sending: "Mengirim…",
    sent: "Terkirim. Kami akan menghubungi via email.",
    errors: {
      name: "Nama wajib diisi",
      emailReq: "Email wajib diisi",
      emailFmt: "Format email tidak valid",
      message: "Pesan wajib diisi",
    },
  },
  hi: {
    reserveBtn: "बुकिंग पर जाएँ",
    title: "संपर्क फ़ॉर्म",
    help: "ईमेल और संदेश आवश्यक हैं。",
    name: "नाम (आवश्यक)",
    email: "ईमेल (आवश्यक)",
    message: "संदेश (आवश्यक)",
    namePh: "Taro Yamada",
    messagePh: "अपना प्रश्न या अनुरोध लिखें",
    submit: "भेजें",
    sending: "भेजा जा रहा है…",
    sent: "भेज दिया गया। हम ईमेल से संपर्क करेंगे。",
    errors: {
      name: "नाम आवश्यक है",
      emailReq: "ईमेल आवश्यक है",
      emailFmt: "ईमेल प्रारूप अमान्य है",
      message: "संदेश आवश्यक है",
    },
  },
  ar: {
    reserveBtn: "الانتقال لنموذج الحجز",
    title: "نموذج الاتصال",
    help: "البريد الإلكتروني والرسالة مطلوبان.",
    name: "الاسم (مطلوب)",
    email: "البريد الإلكتروني (مطلوب)",
    message: "الرسالة (مطلوبة)",
    namePh: "Taro Yamada",
    messagePh: "اكتب سؤالك أو طلبك",
    submit: "إرسال",
    sending: "جارٍ الإرسال…",
    sent: "تم الإرسال. سنتواصل عبر البريد الإلكتروني.",
    errors: {
      name: "الاسم مطلوب",
      emailReq: "البريد الإلكتروني مطلوب",
      emailFmt: "صيغة البريد الإلكتروني غير صالحة",
      message: "الرسالة مطلوبة",
    },
  },
};

/* ===============================
   フォーム型
================================ */
type FormValues = {
  name: string;
  email: string;
  message: string;
  website?: string; // 蜜鉢
};

/* ===============================
   添付の制限
================================ */
const MAX_FILES = 5;
const MAX_SIZE_MB = 10;
const ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

/* ===============================
   本体
================================ */
export default function MinimalInquiryForm() {
  // ダーク判定
  const gradient = useThemeGradient();
  const isDark =
    !!gradient &&
    DARK_KEYS.includes(
      (Object.keys(THEMES).find(
        (k) => THEMES[k as ThemeKey] === gradient
      ) as ThemeKey) ?? "brandA"
    );

  // 言語
  const { uiLang } = useUILang();
  const lang = (STRINGS[uiLang] ? uiLang : "ja") as keyof typeof STRINGS;
  const tRaw = STRINGS[lang];
  // 添付系テキストはフォールバック
  const t = {
    ...tRaw,
    attachLabel:
      tRaw.attachLabel ?? STRINGS.ja.attachLabel ?? STRINGS.en.attachLabel!,
    attachHelp:
      tRaw.attachHelp ?? STRINGS.ja.attachHelp ?? STRINGS.en.attachHelp!,
    fileRemove:
      tRaw.fileRemove ?? STRINGS.ja.fileRemove ?? STRINGS.en.fileRemove!,
    fileTooMany:
      tRaw.fileTooMany ?? STRINGS.ja.fileTooMany ?? STRINGS.en.fileTooMany!,
    fileTooBig:
      tRaw.fileTooBig ?? STRINGS.ja.fileTooBig ?? STRINGS.en.fileTooBig!,
    fileTypeErr:
      tRaw.fileTypeErr ?? STRINGS.ja.fileTypeErr ?? STRINGS.en.fileTypeErr!,
  };

  // バリデーション
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t.errors.name),
        email: z.string().min(1, t.errors.emailReq).email(t.errors.emailFmt),
        message: z.string().min(1, t.errors.message),
        website: z.string().optional(), // 蜜鉢
      }),
    [t.errors]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", message: "", website: "" },
  });

  // 添付ファイル
  const [files, setFiles] = useState<File[]>([]);

  const [done, setDone] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [...files];
    for (const f of Array.from(list)) {
      if (!ACCEPT.includes(f.type)) {
        setErrorMsg(t.fileTypeErr);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setErrorMsg(t.fileTooBig);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setErrorMsg(t.fileTooMany);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeAt = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async (v: FormValues) => {
    setErrorMsg(null);
    setDone(null);
    try {
      // 常に FormData で送信（multipart）
      const fd = new FormData();
      fd.append("name", v.name);
      fd.append("email", v.email);
      fd.append("message", v.message);
      fd.append("siteKey", SITE_KEY);
      if (v.website) fd.append("website", v.website);
      files.forEach((f) => fd.append("files", f, f.name));

      const res = await fetch("/api/contact/send", {
        method: "POST",
        body: fd, // ← Content-Type は自動付与
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send");

      reset({ name: "", email: "", message: "", website: "" });
      setFiles([]);
      setDone(t.sent);
    } catch (e: any) {
      setErrorMsg(
        e?.message ||
          (lang === "ja"
            ? "送信に失敗しました。時間をおいて再度お試しください。"
            : "Failed to send. Please try again later.")
      );
    }
  };

  // スタイル（このフォームは常に白背景＋黒文字で固定）
  const outerText = "text-black";
  const labelClass = clsx("text-sm font-medium", outerText);
  const helpClass = "mt-1 text-xs text-black/70";

  // 各フィールドの見た目
  const fieldClass = clsx(
    "block w-full min-w-0 max-w-full",
    "bg-white/50 text-black",
    "placeholder:text-black/50 placeholder:opacity-100",
    "border border-black/30",
    "focus-visible:ring-1 focus-visible:ring-black/40"
  );

  // カード全体の見た目（フォームの背景）
  const cardClass =
    "rounded-2xl border shadow-sm backdrop-blur-md bg-white/50 border-black/10 text-black";

  // ヘッダー下のボーダー
  const headerBorder = "border-black/10";

  return (
    <div className={clsx("space-y-4", outerText)}>
      {/* 予約ボタン */}
      <div>
        <Link
          href="apply"
          className={clsx(
            "inline-flex items-center rounded-xl px-4 py-2 text-sm shadow-sm backdrop-blur-sm transition-colors bg-black hover:bg-black/90 text-white"
          )}
        >
          {t.reserveBtn}
        </Link>
      </div>

      <div className={cardClass}>
        <div
          className={clsx(
            "px-5 pt-5 pb-3 border-b rounded-t-2xl",
            headerBorder
          )}
        >
          <h2 className="text-base font-semibold">{t.title}</h2>
          <p className={helpClass}>{t.help}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          {/* 蜜鉢（非表示） */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: "absolute", left: -9999 }}
            aria-hidden
            {...register("website")}
          />

          {/* お名前 */}
          <div className="grid gap-2">
            <label className={labelClass}>{t.name}</label>
            <Input
              {...register("name")}
              placeholder={t.namePh}
              required
              className={fieldClass}
            />
            {errors.name && (
              <p className="text-xs text-red-500">
                {String(errors.name.message)}
              </p>
            )}
          </div>

          {/* メール */}
          <div className="grid gap-2">
            <label className={labelClass}>{t.email}</label>
            <Input
              type="email"
              inputMode="email"
              placeholder="example@example.com"
              {...register("email")}
              required
              className={fieldClass}
            />
            {errors.email && (
              <p className="text-xs text-red-500">
                {String(errors.email.message)}
              </p>
            )}
          </div>

          {/* 内容 */}
          <div className="grid gap-2">
            <label className={labelClass}>{t.message}</label>
            <Textarea
              rows={6}
              placeholder={t.messagePh}
              {...register("message")}
              required
              className={clsx(fieldClass, "resize-y")}
            />
            {errors.message && (
              <p className="text-xs text-red-500">
                {String(errors.message.message)}
              </p>
            )}
          </div>

          {/* 添付 */}
          <div className="grid gap-2">
            <label className={labelClass}>{t.attachLabel}</label>
            <div>
              <input
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                onChange={(e) => onPickFiles(e.target.files)}
                className={clsx(
                  "block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5",
                  isDark
                    ? "file:bg-white file:text-black"
                    : "file:bg-black file:text-white",
                  fieldClass
                )}
              />
              <p className={helpClass}>{t.attachHelp}</p>
            </div>

            {/* プレビュー */}
            {files.length > 0 && (
              <ul className="mt-2 space-y-2">
                {files.map((f, i) => {
                  const isImage = f.type.startsWith("image/");
                  const url = isImage ? URL.createObjectURL(f) : null;
                  return (
                    <li
                      key={`${f.name}-${i}`}
                      className={clsx(
                        "flex items-center gap-3 rounded-md border px-3 py-2",
                        isDark ? "border-white/20" : "border-black/10"
                      )}
                    >
                      {isImage ? (
                        // 画像サムネイル
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url!}
                          alt={f.name}
                          className="h-12 w-12 rounded object-cover"
                          onLoad={() => url && URL.revokeObjectURL(url)}
                        />
                      ) : (
                        // PDF アイコン代替（テキスト）
                        <div
                          className={clsx(
                            "h-12 w-12 flex items-center justify-center rounded",
                            isDark ? "bg-white/20" : "bg-black/10"
                          )}
                        >
                          PDF
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{f.name}</p>
                        <p className="text-xs opacity-70">
                          {(f.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        className={clsx(
                          "text-xs underline",
                          isDark ? "text-white" : "text-black"
                        )}
                      >
                        {t.fileRemove}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 通知 */}
          {errorMsg && (
            <div
              className={clsx(
                "rounded-md p-2 text-sm",
                isDark ? "bg-red-950/60 text-red-200" : "bg-red-50 text-red-700"
              )}
            >
              {errorMsg}
            </div>
          )}
          {done && (
            <div
              className={clsx(
                "rounded-md p-2 text-sm",
                isDark
                  ? "bg-emerald-950/60 text-emerald-200"
                  : "bg-green-50 text-green-700"
              )}
            >
              {done}
            </div>
          )}

          {/* 送信 */}
          <div className="pt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={"bg-black text-white hover:bg-black/90"}
            >
              {isSubmitting ? t.sending : t.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
