"use client";

import { useState } from "react";

type UploadRegister = "accent" | "ink";

type ReferenceUploadDropzoneProps = {
  onClick: () => void;
  onFilesDrop: (files: File[]) => void;
  register: UploadRegister;
  label?: string;
  align?: "center" | "left";
  isUploading?: boolean;
  compact?: boolean;
  className?: string;
};

export function ReferenceUploadDropzone({
  onClick,
  onFilesDrop,
  register,
  label = "Add visual references",
  align = "center",
  isUploading = false,
  compact = false,
  className = "",
}: ReferenceUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const isActive = isDragOver || isUploading;
  const activeToneClass = register === "accent" ? "text-accent" : "text-ink";
  const toneClass = isActive ? activeToneClass : "text-ink";
  const alignmentClass = align === "left" ? "items-start text-left" : "items-center text-center";
  const chipToneClass = isActive
    ? register === "accent"
      ? "bg-accent text-paper"
      : "bg-ink text-paper"
    : "bg-paper text-ink";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseLeave={() => setIsDragOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        onFilesDrop(Array.from(event.dataTransfer.files));
      }}
      className={`group relative ${
        compact
          ? "inline-flex h-[46px] w-fit flex-row items-center justify-center rounded-[999px] border border-line/80 bg-paper px-3 py-0"
          : "flex min-h-[92px] w-full flex-col justify-center rounded-[999px] px-7 py-3"
      } transition-all duration-180 focus-visible:outline-none ${alignmentClass} ${
        compact
          ? isActive
            ? register === "accent"
              ? "border-accent/45 bg-[#F8F9FF] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "border-ink/25 bg-[#F6F6F4] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            : "hover:border-line hover:bg-[#FBFBFA] hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          : isActive
            ? register === "accent"
              ? "bg-[#EEF1FF]"
              : "bg-[#F6F6F4]"
            : register === "accent"
              ? "bg-[#FBFBFA] hover:bg-[#F6F6F4]"
              : "bg-[#FBFBFA] hover:bg-[#F6F6F4]"
      } ${className}`}
      aria-label="Add visual references"
    >
      <div className="flex items-center gap-3">
        <span
          className={`font-ui ${compact ? "text-[13px] leading-5 tracking-[0.01em]" : "text-[14px] leading-6"} font-medium transition-colors duration-150 ${toneClass} ${
            isActive ? "" : register === "accent" ? "group-hover:text-accent" : "group-hover:text-ink"
          }`}
        >
          {label}
        </span>
        <span
          className={`inline-flex ${
            compact ? "h-7 w-7 text-[18px]" : "h-7 w-7 text-[16px]"
          } items-center justify-center rounded-full border border-line/70 font-ui font-medium leading-none shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 ${chipToneClass}`}
        >
          ↑
        </span>
      </div>
    </button>
  );
}
