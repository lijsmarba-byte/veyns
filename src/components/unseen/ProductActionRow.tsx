"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type ProductActionRowProps = {
  itemId: string;
  mode: "gallery" | "archive";
  editId?: string | null;
};

type SavedItemRecord = {
  itemId: string;
  capsuleId: string;
  savedAt: string;
};

type CapsuleOption = {
  id: string;
  label: string;
};

const capsuleOptions: CapsuleOption[] = [
  { id: "main", label: "Main Capsule" },
  { id: "capsule1", label: "Capsule 1" },
  { id: "capsule2", label: "Capsule 2" },
  { id: "capsule3", label: "Capsule 3" },
];

const DROPDOWN_ANIMATION_MS = 180;

function getDefaultCapsuleId(editId: string | null | undefined) {
  if (!editId || editId === "main") return "main";
  if (editId === "edit1" || editId === "edit1a") return "capsule1";
  if (editId === "edit2" || editId === "edit1b") return "capsule2";
  if (editId === "edit3" || editId === "edit1c") return "capsule3";
  return "main";
}

function emitSavedItemsUpdated(itemId: string, isSaved: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("unseen:saved-items-updated", {
      detail: { itemId, isSaved },
    }),
  );
}

export function ProductActionRow({ itemId, mode, editId }: ProductActionRowProps) {
  const acquireUrl = "https://www.mytheresa.com";
  const defaultCapsuleId = useMemo(() => getDefaultCapsuleId(editId), [editId]);
  const [selectedCapsuleId, setSelectedCapsuleId] = useState(defaultCapsuleId);
  const [isSaveFlowOpen, setIsSaveFlowOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isArchiveDeleteExpanded, setIsArchiveDeleteExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savePillWidth, setSavePillWidth] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const savePillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("unseen:saved-items");
      if (!raw) return;
      const records = JSON.parse(raw) as SavedItemRecord[];
      const existing = records.find((record) => record.itemId === itemId);
      if (!existing) return;
      setSelectedCapsuleId(existing.capsuleId);
      setIsSaved(true);
    } catch {
      // Ignore malformed local data.
    }
  }, [itemId]);

  useEffect(() => {
    if (!isSaved) {
      setSelectedCapsuleId(defaultCapsuleId);
    }
    setIsSaveFlowOpen(false);
    setIsDropdownOpen(false);
    setIsDropdownVisible(false);
    setIsArchiveDeleteExpanded(false);
    setSavePillWidth(null);
  }, [defaultCapsuleId, isSaved]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (isDropdownOpen) {
      setIsDropdownVisible(true);
      return;
    }

    if (!isDropdownVisible) return;
    const timeout = window.setTimeout(() => {
      setIsDropdownVisible(false);
    }, DROPDOWN_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isDropdownOpen, isDropdownVisible]);

  useLayoutEffect(() => {
    if (!isSaveFlowOpen || isSaved || mode === "archive") return;
    const node = savePillRef.current;
    if (!node) return;

    const currentWidth = Math.ceil(node.getBoundingClientRect().width);
    const previousInlineWidth = node.style.width;
    node.style.width = "auto";
    const nextWidth = Math.ceil(node.getBoundingClientRect().width);
    node.style.width = previousInlineWidth;

    if (Math.abs(nextWidth - currentWidth) < 1) {
      setSavePillWidth(nextWidth);
      return;
    }

    setSavePillWidth(currentWidth);
    const frame = window.requestAnimationFrame(() => {
      setSavePillWidth(nextWidth);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSaveFlowOpen, isSaved, mode, selectedCapsuleId]);

  const saveToStorage = (capsuleId: string) => {
    try {
      const raw = window.localStorage.getItem("unseen:saved-items");
      const currentRecords: SavedItemRecord[] = raw ? JSON.parse(raw) : [];
      const nextRecords = [
        ...currentRecords.filter((record) => record.itemId !== itemId),
        { itemId, capsuleId, savedAt: new Date().toISOString() },
      ];
      window.localStorage.setItem("unseen:saved-items", JSON.stringify(nextRecords));
      emitSavedItemsUpdated(itemId, true);
    } catch {
      // Keep UI responsive even if storage is unavailable.
    }
  };

  const removeFromStorage = () => {
    try {
      const raw = window.localStorage.getItem("unseen:saved-items");
      const currentRecords: SavedItemRecord[] = raw ? JSON.parse(raw) : [];
      const nextRecords = currentRecords.filter((record) => record.itemId !== itemId);
      window.localStorage.setItem("unseen:saved-items", JSON.stringify(nextRecords));
      emitSavedItemsUpdated(itemId, false);
    } catch {
      // Keep UI responsive even if storage is unavailable.
    }
  };

  const handleAcquire = () => window.open(acquireUrl, "_blank", "noopener,noreferrer");

  const clearSavedState = () => {
    removeFromStorage();
    setIsSaved(false);
    setIsSaveFlowOpen(false);
    setIsDropdownOpen(false);
    setSelectedCapsuleId(defaultCapsuleId);
  };

  const handleArchiveDelete = () => {
    removeFromStorage();
    setIsArchiveDeleteExpanded(false);
  };

  const selectedCapsuleLabel =
    capsuleOptions.find((option) => option.id === selectedCapsuleId)?.label ?? capsuleOptions[0].label;
  const otherCapsules = capsuleOptions.filter((option) => option.id !== selectedCapsuleId);
  const baseActionButtonClass =
    "inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150";
  const acquireButtonClass =
    mode === "archive"
      ? `${baseActionButtonClass} hover:text-accent focus-visible:text-accent`
      : `${baseActionButtonClass} hover:text-ink focus-visible:text-ink`;
  const saveButtonClass = `${baseActionButtonClass} hover:text-ink focus-visible:text-ink`;
  const savePillBaseClass =
    "relative inline-flex h-[33px] w-auto items-center overflow-visible rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] pl-[12px] pr-0 font-ui text-[13px] leading-5 tracking-[-0.03em] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)]";
  const dropdownItemClass =
    "w-full rounded-[10px] px-[10px] py-[6px] text-left font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-accent focus-visible:outline-none";
  const archiveDeletePillClass =
    "inline-flex h-[33px] items-center overflow-hidden rounded-[999px] border-[0.5px] border-accent bg-accent shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-[width] duration-220 ease-out";
  const archiveMinusCircleClass =
    "inline-flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full border-[0.5px] border-accent bg-accent shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] focus-visible:outline-none";

  return (
    <div data-pv-info-hit="true" className="relative flex items-center gap-[10px]">
      <button type="button" className={acquireButtonClass} onClick={handleAcquire}>
        acquire
      </button>

      {mode === "archive" ? (
        <div
          className={archiveDeletePillClass}
          style={{ width: isArchiveDeleteExpanded ? "67px" : "33px" }}
          onMouseLeave={() => setIsArchiveDeleteExpanded(false)}
        >
          {isArchiveDeleteExpanded ? (
            <button
              type="button"
              className="inline-flex h-[33px] w-full items-center justify-center px-4 font-ui text-[13px] font-medium leading-5 tracking-[-0.03em] text-paper focus-visible:outline-none"
              onClick={handleArchiveDelete}
              aria-label="Delete from capsule"
            >
              delete
            </button>
          ) : (
            <button
              type="button"
              className={archiveMinusCircleClass}
              onMouseEnter={() => setIsArchiveDeleteExpanded(true)}
              onFocus={() => setIsArchiveDeleteExpanded(true)}
              onClick={handleArchiveDelete}
              aria-label="Delete from capsule"
            >
              <span aria-hidden="true" className="relative left-[-1px] block h-[2px] w-[9px] rounded-full bg-paper" />
            </button>
          )}
        </div>
      ) : isSaved ? (
        <button
          type="button"
          onClick={clearSavedState}
          className="inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-accent bg-accent px-[16px] font-ui text-[13px] font-medium leading-5 tracking-[-0.03em] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] focus-visible:outline-none"
          aria-label="Remove from saved"
        >
          saved
        </button>
      ) : !isSaveFlowOpen ? (
        <button
          type="button"
          className={saveButtonClass}
          onClick={() => {
            setIsSaveFlowOpen(true);
            setIsDropdownOpen(false);
          }}
        >
          save
        </button>
      ) : (
        <div ref={dropdownRef} className="relative">
          <div
            ref={savePillRef}
            className={`${savePillBaseClass} transition-[width] duration-220 ease-out`}
            style={{ width: savePillWidth ? `${savePillWidth}px` : "auto" }}
          >
            <button
              type="button"
              className="inline-flex flex-1 items-center gap-[6px] whitespace-nowrap rounded-[999px] px-[2px] py-0 font-ui text-[13px] font-medium leading-5 tracking-[-0.03em] text-accent focus-visible:outline-none"
              onClick={() => setIsDropdownOpen((open) => !open)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="menu"
            >
              <span>{selectedCapsuleLabel}</span>
              <span
                aria-hidden="true"
                className={`inline-block text-[11px] leading-none transition-transform duration-150 ${
                  isDropdownOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                ▾
              </span>
            </button>

            <button
              type="button"
              className="relative z-[1] ml-[8px] mr-[-1px] inline-flex h-[33px] w-[33px] shrink-0 items-center justify-center rounded-full bg-accent text-[18px] font-medium leading-none text-paper focus-visible:outline-none"
              onClick={() => {
                saveToStorage(selectedCapsuleId);
                setIsSaved(true);
                setIsDropdownOpen(false);
              }}
              aria-label={`Save to ${selectedCapsuleLabel}`}
            >
              <span aria-hidden="true" className="relative left-[-0.5px] top-[-0.5px] block">
                +
              </span>
            </button>
          </div>

          {isDropdownVisible ? (
            <div
              className={`absolute left-0 top-[39px] z-20 min-w-full rounded-[14px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] p-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-all duration-[180ms] ease-out ${
                isDropdownOpen
                  ? "translate-y-0 scale-100 opacity-100"
                  : "-translate-y-[4px] scale-[0.985] opacity-0 pointer-events-none"
              }`}
            >
              <div role="menu" aria-label="Choose capsule" className="flex flex-col gap-[2px]">
                {otherCapsules.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    className={dropdownItemClass}
                    onClick={() => {
                      setSelectedCapsuleId(option.id);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
