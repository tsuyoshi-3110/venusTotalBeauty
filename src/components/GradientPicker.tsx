"use client";
import { useState } from "react";
import { ChromePicker } from "react-color";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);

export default function GradientPicker({
  defaultFrom = "#F547C9",
  defaultTo = "#FADB9F",
}: { defaultFrom?: string; defaultTo?: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const save = async () => {
    await setDoc(META_REF, { customGradient: { from, to } }, { merge: true });
    alert("背景色を保存しました！");
  };



  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div>
          <p className="text-sm mb-2">左色</p>
          <ChromePicker color={from} onChange={(c) => setFrom(c.hex)} />
        </div>
        <div>
          <p className="text-sm mb-2">右色</p>
          <ChromePicker color={to} onChange={(c) => setTo(c.hex)} />
        </div>
      </div>
      <div
        className="h-20 rounded-md border shadow"
        style={{ background: `linear-gradient(to right, ${from}, ${to})` }}
      />
      <button
        onClick={save}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        保存
      </button>
    </div>
  );
}
