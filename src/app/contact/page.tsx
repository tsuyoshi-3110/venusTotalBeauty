"use client";

import MinimalInquiryForm from "@/components/contact/MinimalInquiryForm";

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white md:text-3xl text-outline">
        お問い合わせ
      </h1>
      <p className="mt-2 text-sm text-white text-outline">
        ご不明点やご相談は、こちらのフォームからお気軽にお送りください。
      </p>

      {/* 予約フォームへのリンクを有効化（URLは環境に合わせて変更） */}
      <div className="mt-4">
        <MinimalInquiryForm />
        {/** 例: 外部サービス → bookingHref="https://example.com/booking" */}
      </div>
    </main>
  );
}
