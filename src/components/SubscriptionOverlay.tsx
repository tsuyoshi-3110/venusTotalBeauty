"use client";

import { useEffect, useState } from "react";
import CheckoutButton from "./CheckoutButton";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // ← あなたのFirebase設定パスに応じて調整

export default function SubscriptionOverlay({ siteKey }: { siteKey: string }) {
  const [status, setStatus] = useState<
    "loading" | "paid" | "unpaid" | "pending" | "canceled" | "setup"
  >("loading");
  const [isFreePlan, setIsFreePlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      const apiUrl = sessionId
        ? `/api/stripe/verify-subscription?session_id=${sessionId}`
        : `/api/stripe/check-subscription?siteKey=${siteKey}`;

      console.log("🔍 checkPayment called:", apiUrl);

      const res = await fetch(apiUrl);
      const json = await res.json();

      console.log("✅ サブスクステータス:", json.status);

      if (json.status === "active") setStatus("paid");
      else if (json.status === "pending_cancel") setStatus("pending");
      else if (json.status === "canceled") setStatus("canceled");
      else if (json.status === "setup_mode") setStatus("setup");
      else setStatus("unpaid");

      if (sessionId) {
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      }
    };

    const fetchIsFreePlan = async () => {
      const ref = doc(db, "sitePublicProfile", siteKey);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      setIsFreePlan(data.isFreePlan === true);
    };

    checkPayment();
    fetchIsFreePlan();
  }, [siteKey]);

  // ✅ データ未取得中は表示しない
  if (isFreePlan === null || status === "loading") return null;

  // ✅ isFreePlan が true のときはオーバーレイを非表示
  if (isFreePlan) return null;

  // ✅ ステータスが未払い系のときだけ表示
  if (!["setup", "paid", "pending"].includes(status)) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center z-50">
        <p className="text-lg mb-4">
          このページを表示するにはサブスクリプション登録が必要です。
        </p>
        <CheckoutButton siteKey={siteKey} />
      </div>
    );
  }

  return null;
}
