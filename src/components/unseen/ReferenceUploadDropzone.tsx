"use client";

import { useState } from "react";

type UploadRegister = "accent" | "ink";

type ReferenceUploadDropzoneProps = {
  onClick: () => void;
  onFilesDrop: (files: File[]) => void;
  register: UploadRegister;
  align?: "center" | "left";
  isUploading?: boolean;
  className?: string;
};

export function ReferenceUploadDropzone({
  onClick,
  onFilesDrop,
  register,
  align = "center",
  isUploading = false,
  className = "",
}: ReferenceUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const isActive = isDragOver || isUploading;
  const activeToneClass = register === "accent" ? "text-accent" : "text-ink";
  const plusToneClass = isActive ? activeToneClass : "text-meta";
  const contentAlignmentClass = align === "left" ? "items-start text-left px-0" : "items-center text-center px-10";

  return (
    <div className={`mt-3 w-full ${className}`}>
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
        className={`relative flex min-h-[210px] w-full flex-col justify-center overflow-hidden rounded-[18px] bg-transparent py-7 transition-colors duration-150 focus-visible:outline-none ${contentAlignmentClass}`}
      >
        <span className={`font-ui text-[24px] font-normal leading-none ${plusToneClass}`}>+</span>
        <span className="mt-1 font-ui text-[14px] font-normal leading-5 text-meta">Add visual references</span>

        {isUploading ? (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-px ${register === "accent" ? "bg-accent" : "bg-ink"} opacity-80`}
          />
        ) : null}
      </button>

      <p className="mt-3 font-ui text-[12px] font-normal leading-[1.45] text-meta">
        Screenshots, saved images, or Pinterest board captures.
      </p>
      <p className="mt-1 font-ui text-[12px] font-normal leading-[1.45] text-inactive">
        On Pinterest App, Compact view gives the cleanest grid to screenshot.
      </p>
    </div>
  );
}
