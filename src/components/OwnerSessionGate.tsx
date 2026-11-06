"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

/** オーナーのセッションを確認し、確認できたらページを再表示します。 */
export default function OwnerSessionGate() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "login" | "forbidden">("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      await auth.authStateReady();
      if (!active) return;
      const user = auth.currentUser;
      if (!user) {
        setState("login");
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch("/api/owner/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!active) return;
      if (res.ok) router.refresh();
      else setState("forbidden");
    })().catch(() => {
      if (active) setState("forbidden");
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-lg p-6 text-center text-black">
      {state === "checking" && <p>確認しています…</p>}
      {state === "login" && (
        <p>
          このページを見るには
          <Link href="/login" className="underline">
            ログイン
          </Link>
          が必要です。
        </p>
      )}
      {state === "forbidden" && <p>このページを表示する権限がありません。</p>}
    </main>
  );
}
