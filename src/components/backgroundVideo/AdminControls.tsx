"use client";
import React from "react";
import { Button } from "@/components/ui/button";

type AdminControlsProps = {
  editing: boolean;
  setEditing: (editing: boolean) => void;
  uploading: boolean;
  uploadImage: (file: File) => Promise<void>;
  uploadHeaderImage: (file: File) => Promise<void>;
};

export default function AdminControls({
  editing,
  setEditing,
  uploading,
}: AdminControlsProps) {
  return (
    <>
      {!editing && (
        <Button
          onClick={() => setEditing(true)}
          disabled={uploading}
          size="sm"
          className="absolute bottom-45 left-1/2 -translate-x-1/2 bg-blue-500 text-white rounded shadow"
        >
          トップ画像・動画
        </Button>
      )}
    </>
  );
}
