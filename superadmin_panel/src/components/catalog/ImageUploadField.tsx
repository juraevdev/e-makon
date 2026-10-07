"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MAX_MB = 5;

/** Rasm yuklash (multipart uchun `File`) + oldindan ko'rish. Mavjud rasm URL bo'lsa ham ko'rsatadi. */
export function ImageUploadField({
  label,
  file,
  existing,
  onFile,
  onClear,
  error,
  hint,
  aspect = "aspect-[16/9]",
}: {
  label: string;
  file: File | null;
  existing?: string;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string;
  hint?: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState("");
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);
  const preview = objectUrl || existing || "";

  function pick(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setLocalError("Faqat rasm fayli (JPG, PNG, WEBP) yuklang.");
      return;
    }
    if (next.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Rasm hajmi ${MAX_MB} MB dan oshmasin.`);
      return;
    }
    setLocalError("");
    onFile(next);
  }

  const shownError = localError || error;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="font-medium text-on-surface-variant">{label}</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files);
        }}
        className={`relative w-full overflow-hidden rounded-2xl border border-dashed ${
          shownError ? "border-error/60" : "border-[#2f4536]"
        } bg-[#0d100f] ${aspect}`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                Almashtirish
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalError("");
                  onClear();
                }}
                className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-error hover:bg-black/80"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Olib tashlash
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-on-surface-variant transition hover:bg-primary/5 hover:text-primary"
          >
            <span className="material-symbols-outlined text-[32px]">add_photo_alternate</span>
            <span className="text-sm font-semibold">Rasm tanlang yoki shu yerga tashlang</span>
            <span className="text-xs">JPG, PNG, WEBP · {MAX_MB} MB gacha</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      {file ? (
        <span className="truncate text-xs text-on-surface-variant">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </span>
      ) : null}
      {shownError ? <span className="text-xs text-error">{shownError}</span> : hint ? <span className="text-xs text-on-surface-variant/80">{hint}</span> : null}
    </div>
  );
}
