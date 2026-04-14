"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSignatureContourInline } from "@/components/unseen/ProfileSignatureContourInline";
import type { MockReferenceVisual, MockTasteCluster } from "@/data/mockUsers";
import { mockUsers } from "@/data/mockUsers";

type ProfileTab = "signature" | "reference-sets" | "quiet-constraints" | "feedback" | "settings";
type SettingsField = "email" | "phone" | "name" | "password";
type QuietConstraintAction = "price" | "sizing";

type ReferenceSet = {
  id: string;
  name: string;
  images: MockReferenceVisual[];
};

const NEW_EDIT_TARGET = "__new_edit__";
const MAIN_EDIT_SET_ID = "main-edit";
const RECALIBRATED_SIGNATURE_PREFIXES = [
  "Quiet",
  "Refined",
  "Tailored",
  "Textured",
  "Fluid",
  "Crisp",
  "Architectural",
  "Soft",
];
const RECALIBRATED_SIGNATURE_NOUNS = [
  "Balance",
  "Rhythm",
  "Contour",
  "Poise",
  "Contrast",
  "Precision",
  "Ease",
  "Clarity",
];

function isProfileTab(value: string | null): value is ProfileTab {
  return (
    value === "signature" ||
    value === "reference-sets" ||
    value === "quiet-constraints" ||
    value === "feedback" ||
    value === "settings"
  );
}

function formatCalibrationDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
}

function isValidPhone(value: string): boolean {
  const compact = value.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(compact);
}

function limitSentences(text: string, maxSentences: number): string {
  if (!text) return "";
  const chunks = text.match(/[^.!?]+[.!?]?/g) ?? [];
  return chunks
    .slice(0, maxSentences)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join(" ");
}

function clusterWeight(cluster: MockTasteCluster): number {
  return cluster.attributes.reduce((sum, attr) => sum + attr.score * attr.confidence, 0);
}

function buildReferenceSets(images: MockReferenceVisual[]): ReferenceSet[] {
  return [
    {
      id: MAIN_EDIT_SET_ID,
      name: "Main Edit",
      images,
    },
  ];
}

function formatEditName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Edit";
  return /(?:\s+|^)edit$/i.test(trimmed) ? trimmed : `${trimmed} Edit`;
}

function getReferencePreviewColumns(viewportWidth: number): number {
  if (viewportWidth >= 1900) return 8;
  if (viewportWidth >= 1600) return 7;
  if (viewportWidth >= 1300) return 6;
  if (viewportWidth >= 1050) return 5;
  return 4;
}

function buildSignatureTitle(
  userName: string,
  signatureTitle: string | null | undefined,
  dominantDimension: string | null,
): string {
  const normalizeSentence = (value: string) => value.trim().replace(/[.!?]+$/g, "");
  const withPeriod = (value: string) => `${normalizeSentence(value)}.`;
  const stripUserNamePrefix = (value: string) => {
    const escaped = userName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return value
      .replace(new RegExp(`^\\s*${escaped}\\s*,\\s*`, "i"), "")
      .replace(new RegExp(`^\\s*${escaped}\\s+`, "i"), "")
      .trim();
  };

  const base = stripUserNamePrefix(normalizeSentence(signatureTitle || ""));
  if (base) return withPeriod(base);
  return withPeriod(normalizeSentence(dominantDimension || "Quiet confidence"));
}

function hashSignatureSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildRecalibratedMainEditSignature(images: MockReferenceVisual[], fallbackTitle: string): string {
  if (images.length === 0) return fallbackTitle;
  const seed = images
    .map((image) => `${image.id}|${image.fileName}|${image.publicPath}`)
    .sort()
    .join("::");
  const hash = hashSignatureSeed(seed);
  const prefix = RECALIBRATED_SIGNATURE_PREFIXES[hash % RECALIBRATED_SIGNATURE_PREFIXES.length] ?? "Quiet";
  const noun =
    RECALIBRATED_SIGNATURE_NOUNS[
      Math.floor(hash / RECALIBRATED_SIGNATURE_PREFIXES.length) % RECALIBRATED_SIGNATURE_NOUNS.length
    ] ?? "Balance";
  return `${prefix} ${noun}`;
}

const PROFILE_HEADER_NAME_TOP_PX = 22;
const PROFILE_HEADER_NAV_TOP_PX = 46;
const PROFILE_HEADER_NAV_ROW_HEIGHT_PX = 48;
const PROFILE_HEADER_NAV_BUTTON_HEIGHT_PX = 40;
const PROFILE_HEADER_NAV_TEXT_LINE_HEIGHT_PX = 20;
const PROFILE_HEADER_META_TOP_PX =
  PROFILE_HEADER_NAV_TOP_PX +
  (PROFILE_HEADER_NAV_ROW_HEIGHT_PX - PROFILE_HEADER_NAV_BUTTON_HEIGHT_PX) +
  (PROFILE_HEADER_NAV_BUTTON_HEIGHT_PX - PROFILE_HEADER_NAV_TEXT_LINE_HEIGHT_PX) / 2;
const PROFILE_HEADER_DIVIDER_TOP_PX = 96;
const PROFILE_HEADER_HEIGHT_PX = 97;

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("back") || "/gallery";
  const shouldMorphCloseIcon = searchParams.get("iconMorph") === "1";
  const requestedTab = searchParams.get("tab");
  const requestedEditFlow = searchParams.get("editFlow");
  const startsInCreateEditFlow = requestedEditFlow === "create";
  const activeUser = mockUsers[0] ?? null;
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (isProfileTab(requestedTab)) return requestedTab;
    return startsInCreateEditFlow ? "reference-sets" : "signature";
  });
  const [editingSetIds, setEditingSetIds] = useState<Record<string, boolean>>({});
  const [expandedSetIds, setExpandedSetIds] = useState<Record<string, boolean>>({});
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [dragOverSetId, setDragOverSetId] = useState<string | null>(null);
  const [isNewEditDragOver, setIsNewEditDragOver] = useState(false);
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(startsInCreateEditFlow);
  const [isFocusedCreateFlow, setIsFocusedCreateFlow] = useState(startsInCreateEditFlow);
  const [pendingDoneSetId, setPendingDoneSetId] = useState<string | null>(null);
  const [pendingRebuildSetId, setPendingRebuildSetId] = useState<string | null>(null);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState<string | null>(null);
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null);
  const [isDeleteProfileDisclaimerOpen, setIsDeleteProfileDisclaimerOpen] = useState(false);
  const [feedbackAnswers, setFeedbackAnswers] = useState({
    clarity: "",
    quality: "",
    trust: "",
  });
  const [lastFeedbackSentAt, setLastFeedbackSentAt] = useState<string | null>(null);
  const [profileSettings, setProfileSettings] = useState(() => ({
    email: activeUser?.email ?? "",
    phone: "",
    name: activeUser?.name ?? "",
  }));
  const [isSettingsEditMode, setIsSettingsEditMode] = useState(false);
  const [activeSettingsField, setActiveSettingsField] = useState<SettingsField | null>(null);
  const [settingsFieldDraft, setSettingsFieldDraft] = useState("");
  const [settingsPhoneCodeInput, setSettingsPhoneCodeInput] = useState("");
  const [settingsPhoneVerificationCode, setSettingsPhoneVerificationCode] = useState("");
  const [isSettingsPhoneCodeSent, setIsSettingsPhoneCodeSent] = useState(false);
  const [isSettingsPhoneVerified, setIsSettingsPhoneVerified] = useState(false);
  const [activeConstraintHint, setActiveConstraintHint] = useState<QuietConstraintAction | null>(null);
  const [newEditName, setNewEditName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [referenceSets, setReferenceSets] = useState<ReferenceSet[]>(
    () => buildReferenceSets(activeUser?.referenceSetForMainEdit ?? []),
  );
  const [mainEditRecalibrationCount, setMainEditRecalibrationCount] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [isCloseIconMorphed, setIsCloseIconMorphed] = useState(!shouldMorphCloseIcon);
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  const createEditSectionRef = useRef<HTMLDivElement | null>(null);
  const createEditNameInputRef = useRef<HTMLInputElement | null>(null);
  const hasAppliedInitialCreateFlowRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetSetId, setUploadTargetSetId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"append" | "replace">("append");
  const fixedHeaderRef = useRef<HTMLDivElement | null>(null);
  const constraintHintTimeoutRef = useRef<number | null>(null);

  const mainEditImages = useMemo(
    () => referenceSets.find((set) => set.id === MAIN_EDIT_SET_ID)?.images ?? [],
    [referenceSets],
  );

  useEffect(() => {
    const syncViewportWidth = () => setViewportWidth(window.innerWidth);
    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);
    return () => window.removeEventListener("resize", syncViewportWidth);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevRootOverscroll = root.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevRootOverscrollY = root.style.overscrollBehaviorY;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;

    root.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    root.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";

    return () => {
      root.style.overscrollBehavior = prevRootOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      root.style.overscrollBehaviorY = prevRootOverscrollY;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
    };
  }, []);

  useEffect(() => {
    if (!shouldMorphCloseIcon) return;
    const raf = window.requestAnimationFrame(() => {
      setIsCloseIconMorphed(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [shouldMorphCloseIcon]);

  useEffect(() => {
    return () => {
      if (constraintHintTimeoutRef.current !== null) {
        window.clearTimeout(constraintHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!startsInCreateEditFlow || hasAppliedInitialCreateFlowRef.current) return;
    if (activeTab !== "reference-sets" || !isCreateEditOpen) return;

    hasAppliedInitialCreateFlowRef.current = true;

    const raf = window.requestAnimationFrame(() => {
      createEditSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      createEditNameInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [activeTab, isCreateEditOpen, startsInCreateEditFlow]);

  const clusters = useMemo(
    () => [...(activeUser?.tasteAttributes.clusters ?? [])].sort((a, b) => clusterWeight(b) - clusterWeight(a)),
    [activeUser],
  );
  const dominantCluster = clusters[0] ?? null;
  const shortSummary = limitSentences(activeUser?.tasteDescription.tasteThesis ?? "", 3);

  if (!activeUser) return null;

  const calibrationMonth = formatCalibrationDate(activeUser.lastCalibrationDate);
  const issueLabel = String(activeUser.userId + mainEditRecalibrationCount).padStart(2, "0");
  const userIdLabel = String(activeUser.userId);
  const activeSignatureSourceTitle =
    mainEditRecalibrationCount > 0
      ? buildRecalibratedMainEditSignature(mainEditImages, activeUser.tasteDescription.signatureTitle)
      : activeUser.tasteDescription.signatureTitle;
  const signatureTitle = buildSignatureTitle(
    activeUser.name,
    activeSignatureSourceTitle,
    dominantCluster?.cluster_name ?? null,
  );
  const signatureTitleDisplay = signatureTitle.replace(/[.!?]+$/g, "");
  const sessionIdentity = profileSettings.email || profileSettings.phone || "No contact set";
  const settingsActionPillClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:font-medium focus-visible:font-medium hover:text-ink focus-visible:text-ink";
  const settingsDeletePillClass =
    "inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.12)] outline-none transition-colors duration-150 hover:border-[#D94343] hover:bg-[#D94343] hover:text-paper focus:outline-none focus-visible:outline-none focus-visible:ring-0";
  const metaDescriptionClass = "font-ui text-[14px] font-normal leading-[1.7] text-meta";
  const profileTabHoverPillClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center -translate-x-[calc(50%-8px)] translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381] bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover/tab:translate-y-0 group-hover/tab:opacity-100 group-focus-visible/tab:translate-y-0 group-focus-visible/tab:opacity-100";
  const constraintHoverPillClass =
    "pointer-events-none absolute bottom-[5px] left-full z-20 ml-[8px] inline-flex h-[29px] items-center justify-center translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381] bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover/constraint:translate-y-0 group-hover/constraint:opacity-100 group-focus-within/constraint:translate-y-0 group-focus-within/constraint:opacity-100";
  const isShortcutCreateFlowActive = isFocusedCreateFlow && isCreateEditOpen;
  const canSendFeedback =
    feedbackAnswers.clarity.trim().length > 0 ||
    feedbackAnswers.quality.trim().length > 0 ||
    feedbackAnswers.trust.trim().length > 0;

  const showConstraintHint = (target: QuietConstraintAction) => {
    setActiveConstraintHint(target);
    if (constraintHintTimeoutRef.current !== null) {
      window.clearTimeout(constraintHintTimeoutRef.current);
    }
    constraintHintTimeoutRef.current = window.setTimeout(() => {
      setActiveConstraintHint((current) => (current === target ? null : current));
      constraintHintTimeoutRef.current = null;
    }, 1300);
  };

  const hideConstraintHint = (target: QuietConstraintAction) => {
    setActiveConstraintHint((current) => (current === target ? null : current));
    if (constraintHintTimeoutRef.current !== null) {
      window.clearTimeout(constraintHintTimeoutRef.current);
      constraintHintTimeoutRef.current = null;
    }
  };

  const bumpMainEditRecalibration = () => {
    setMainEditRecalibrationCount((current) => current + 1);
  };

  const openCreateEdit = ({ focused = false }: { focused?: boolean } = {}) => {
    setExpandedSetIds({});
    setEditingSetIds({});
    setPendingDoneSetId(null);
    setPendingRebuildSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(null);
    setRenameDraft("");
    setIsCreateEditOpen(true);
    setIsFocusedCreateFlow(focused);
  };

  const closeCreateEdit = () => {
    setIsCreateEditOpen(false);
    setIsNewEditDragOver(false);
    setNewEditName("");
    setUploadTargetSetId(null);
    setUploadMode("append");
    setIsFocusedCreateFlow(false);
  };

  const switchTab = (nextTab: ProfileTab) => {
    if (nextTab !== "reference-sets") {
      setExpandedSetIds({});
      setEditingSetIds({});
      setPendingDoneSetId(null);
      setDragOverSetId(null);
      setHoveredImageId(null);
      setIsCreateEditOpen(false);
      setIsNewEditDragOver(false);
      setNewEditName("");
      setPendingRebuildSetId(null);
      setPendingDeleteSetId(null);
      setRenamingSetId(null);
      setRenameDraft("");
      setUploadTargetSetId(null);
      setUploadMode("append");
      setIsFocusedCreateFlow(false);
    }
    if (nextTab !== "settings") {
      setIsDeleteProfileDisclaimerOpen(false);
      setIsSettingsEditMode(false);
      setActiveSettingsField(null);
      setSettingsFieldDraft("");
      setSettingsPhoneCodeInput("");
      setSettingsPhoneVerificationCode("");
      setIsSettingsPhoneCodeSent(false);
      setIsSettingsPhoneVerified(false);
    }
    setActiveTab(nextTab);
  };

  const beginSettingsFieldEdit = (field: SettingsField) => {
    if (!isSettingsEditMode) return;
    setIsDeleteProfileDisclaimerOpen(false);
    setActiveSettingsField(field);
    if (field === "password") {
      setSettingsFieldDraft("");
      return;
    }
    if (field === "phone") {
      setSettingsPhoneCodeInput("");
      setSettingsPhoneVerificationCode("");
      setIsSettingsPhoneCodeSent(false);
      setIsSettingsPhoneVerified(false);
    }
    setSettingsFieldDraft(profileSettings[field]);
  };

  const cancelSettingsFieldEdit = () => {
    setActiveSettingsField(null);
    setSettingsFieldDraft("");
    setSettingsPhoneCodeInput("");
    setSettingsPhoneVerificationCode("");
    setIsSettingsPhoneCodeSent(false);
    setIsSettingsPhoneVerified(false);
  };

  const handleSettingsPhoneDraftChange = (value: string) => {
    setSettingsFieldDraft(value);
    setSettingsPhoneCodeInput("");
    setSettingsPhoneVerificationCode("");
    setIsSettingsPhoneCodeSent(false);
    setIsSettingsPhoneVerified(false);
  };

  const sendSettingsPhoneCode = () => {
    if (activeSettingsField !== "phone") return;
    const trimmed = settingsFieldDraft.trim();
    if (!isValidPhone(trimmed)) {
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSettingsPhoneVerificationCode(code);
    setSettingsPhoneCodeInput("");
    setIsSettingsPhoneCodeSent(true);
    setIsSettingsPhoneVerified(false);
  };

  const confirmSettingsPhoneCode = () => {
    if (activeSettingsField !== "phone") return;
    if (!isSettingsPhoneCodeSent || !settingsPhoneVerificationCode) return;
    if (settingsPhoneCodeInput.trim() !== settingsPhoneVerificationCode) return;
    setIsSettingsPhoneVerified(true);
  };

  const saveSettingsFieldEdit = () => {
    if (!activeSettingsField) return;
    if (activeSettingsField === "password") {
      if (!settingsFieldDraft.trim()) return;
      cancelSettingsFieldEdit();
      return;
    }
    const trimmed = settingsFieldDraft.trim();
    if (activeSettingsField === "phone") {
      if (!trimmed) {
        setProfileSettings((prev) => ({ ...prev, phone: "" }));
        cancelSettingsFieldEdit();
        return;
      }
      if (!isValidPhone(trimmed)) return;
      if (trimmed !== profileSettings.phone && !isSettingsPhoneVerified) return;
    } else if (!trimmed) {
      return;
    }
    setProfileSettings((prev) => ({
      ...prev,
      [activeSettingsField]: trimmed,
    }));
    cancelSettingsFieldEdit();
  };

  const removeImage = (setId: string, imageId: string) => {
    setReferenceSets((prev) =>
      prev.map((set) =>
        set.id === setId
          ? {
              ...set,
              images: set.images.filter((img) => img.id !== imageId),
            }
          : set,
      ),
    );
    if (setId === MAIN_EDIT_SET_ID) {
      bumpMainEditRecalibration();
    }
  };

  function requestUpload(setId: string) {
    setUploadMode("append");
    setUploadTargetSetId(setId);
    uploadInputRef.current?.click();
  }

  const toggleEditSet = (setId: string) => {
    setEditingSetIds((current) => ({
      ...current,
      [setId]: !current[setId],
    }));
  };

  const requestDoneConfirmation = (setId: string) => {
    setPendingRebuildSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(null);
    setRenameDraft("");
    setPendingDoneSetId(setId);
  };

  const cancelDoneConfirmation = () => {
    setPendingDoneSetId(null);
  };

  const confirmDoneForSet = (setId: string) => {
    setEditingSetIds((current) => ({
      ...current,
      [setId]: false,
    }));
    setPendingDoneSetId(null);
  };

  const requestRebuildConfirmation = (setId: string) => {
    setPendingDoneSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(null);
    setRenameDraft("");
    setPendingRebuildSetId(setId);
  };

  const cancelRebuildConfirmation = () => {
    setPendingRebuildSetId(null);
  };

  const confirmRebuildForSet = (setId: string) => {
    setPendingRebuildSetId(null);
    setUploadMode("replace");
    setUploadTargetSetId(setId);
    uploadInputRef.current?.click();
  };

  const requestDeleteSetConfirmation = (setId: string) => {
    setPendingDoneSetId(null);
    setPendingRebuildSetId(null);
    setRenamingSetId(null);
    setRenameDraft("");
    setPendingDeleteSetId(setId);
  };

  const cancelDeleteSetConfirmation = () => {
    setPendingDeleteSetId(null);
  };

  const confirmDeleteSet = (setId: string) => {
    setReferenceSets((prev) => prev.filter((set) => set.id !== setId));
    setExpandedSetIds((current) => {
      const next = { ...current };
      delete next[setId];
      return next;
    });
    setEditingSetIds((current) => {
      const next = { ...current };
      delete next[setId];
      return next;
    });
    setPendingDoneSetId(null);
    setPendingRebuildSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(null);
    setRenameDraft("");
  };

  const startRenameSet = (setId: string, currentName: string) => {
    setPendingDoneSetId(null);
    setPendingRebuildSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(setId);
    setRenameDraft(currentName);
  };

  const cancelRenameSet = () => {
    setRenamingSetId(null);
    setRenameDraft("");
  };

  const confirmRenameSet = (setId: string) => {
    const trimmed = renameDraft.trim();
    if (!trimmed) return;
    setReferenceSets((prev) =>
      prev.map((set) =>
        set.id === setId
          ? {
              ...set,
              name: trimmed,
            }
          : set,
      ),
    );
    setRenamingSetId(null);
    setRenameDraft("");
  };

  const resolveNewEditName = (index: number) => {
    const trimmed = newEditName.trim();
    return trimmed.length > 0 ? trimmed : `Edit ${index}`;
  };

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !uploadTargetSetId) return;
    const nextImages = Array.from(files).map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      publicPath: URL.createObjectURL(file),
    }));

    if (uploadTargetSetId === NEW_EDIT_TARGET) {
      setReferenceSets((prev) => [
        ...prev,
        {
          id: `edit-${Date.now()}`,
          name: resolveNewEditName(prev.length),
          images: nextImages,
        },
      ]);
      closeCreateEdit();
      setPendingRebuildSetId(null);
    } else if (uploadMode === "replace") {
      setReferenceSets((prev) =>
        prev.map((set) =>
          set.id === uploadTargetSetId
            ? {
                ...set,
                images: nextImages,
              }
            : set,
        ),
      );
      if (uploadTargetSetId === MAIN_EDIT_SET_ID) {
        bumpMainEditRecalibration();
      }
    } else {
      setReferenceSets((prev) =>
        prev.map((set) =>
          set.id === uploadTargetSetId
            ? {
                ...set,
                images: [...set.images, ...nextImages],
              }
            : set,
        ),
      );
      if (uploadTargetSetId === MAIN_EDIT_SET_ID) {
        bumpMainEditRecalibration();
      }
    }

    event.target.value = "";
    setUploadTargetSetId(null);
    setUploadMode("append");
  };

  const handleSetDrop = (setId: string, event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverSetId(null);
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    const nextImages = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      publicPath: URL.createObjectURL(file),
    }));

    setReferenceSets((prev) =>
      prev.map((set) =>
        set.id === setId
          ? {
              ...set,
              images: [...set.images, ...nextImages],
            }
          : set,
      ),
    );
    if (setId === MAIN_EDIT_SET_ID) {
      bumpMainEditRecalibration();
    }
  };

  function handleNewEditDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsNewEditDragOver(false);
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    const nextImages = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      publicPath: URL.createObjectURL(file),
    }));

    setReferenceSets((prev) => [
      ...prev,
      {
        id: `edit-${Date.now()}`,
        name: resolveNewEditName(prev.length),
        images: nextImages,
      },
    ]);
    closeCreateEdit();
  }

  const createEditComposer = (
    <div className="mx-auto mt-2 w-full max-w-[640px]">
      <div className="flex items-center gap-4 rounded-[18px] border border-line/95 bg-[#FCFCFB] px-5 py-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="whitespace-nowrap font-ui text-[12px] font-medium uppercase leading-5 tracking-[0.08em] text-meta">
          Edit Name
        </p>
        <input
          ref={createEditNameInputRef}
          type="text"
          value={newEditName}
          onChange={(event) => setNewEditName(event.target.value)}
          placeholder="e.g. Summer Edit"
          className="w-full border-0 bg-transparent py-0 font-ui text-[15px] font-normal leading-5 text-ink outline-none placeholder:text-inactive"
        />
      </div>

      <button
        type="button"
        onClick={() => requestUpload(NEW_EDIT_TARGET)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsNewEditDragOver(true);
        }}
        onDragLeave={() => setIsNewEditDragOver(false)}
        onDrop={handleNewEditDrop}
        className={`relative mt-3 flex w-full min-h-[210px] flex-col items-center justify-center overflow-hidden rounded-[30px] border px-10 py-7 text-center transition-colors duration-150 ${
          isNewEditDragOver
            ? "border-meta bg-[#F9F9F8] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
            : "border-line/95 bg-[#FCFCFB] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        }`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[10px] rounded-[24px] border border-white/60"
        />
        <span className="relative z-[1] font-ui text-[24px] font-normal leading-none text-meta">+</span>
        <span className="relative z-[1] mt-1 font-ui text-[14px] font-normal leading-5 text-meta">Add visual references</span>
        <span className="relative z-[1] mt-0.5 max-w-[430px] font-ui text-[12px] font-normal leading-[1.45] text-meta">
          Screenshots, saved images, or Pinterest board captures.
        </span>
      </button>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={closeCreateEdit} className={settingsActionPillClass}>
          cancel
        </button>
      </div>
    </div>
  );

  const handleCloseProfile = () => {
    if (isClosingProfile) return;
    setIsClosingProfile(true);
    try {
      const targetPath = new URL(backHref, window.location.origin).pathname;
      window.sessionStorage.setItem(
        "unseen:profile-close-morph",
        JSON.stringify({
          targetPath,
          at: Date.now(),
        }),
      );
    } catch {
      // Ignore storage failures.
    }
    router.push(backHref, { scroll: false });
  };

  return (
    <motion.main
      className="min-h-screen bg-paper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <button
        type="button"
        aria-label="Close profile"
        onClick={handleCloseProfile}
        className="fixed right-10 top-[30px] z-50 inline-flex h-[11px] w-[15px] items-center justify-center text-inactive transition-colors duration-150 hover:text-ink focus-visible:outline-none"
      >
        <span
          className={`absolute block h-[1.5px] w-[15px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
            isCloseIconMorphed ? "translate-y-0 rotate-45" : "-translate-y-[4px] rotate-0"
          }`}
        />
        <span
          className={`absolute block h-[1.5px] w-[15px] rounded-full bg-current transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
            isCloseIconMorphed ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`absolute block h-[1.5px] w-[15px] rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
            isCloseIconMorphed ? "translate-y-0 -rotate-45" : "translate-y-[4px] rotate-0"
          }`}
        />
      </button>

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        onChange={onUpload}
      />

      <section className="mx-auto w-full max-w-[1333px] px-10 pb-16 pt-[116px]">
        <div
          ref={fixedHeaderRef}
          className="fixed inset-x-0 top-0 z-40 mx-[calc(50%-50vw)] bg-paper px-10 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)]"
          style={{ height: `${PROFILE_HEADER_HEIGHT_PX}px` }}
        >
          <div className="relative h-full w-full">
            <div className="absolute left-0 top-0 text-left">
              <h1
                className="text-left font-ui text-[30px] leading-none tracking-[-0.03em] text-ink"
                style={{
                  fontFamily: "var(--font-meta-mono), monospace",
                  position: "absolute",
                  top: `${PROFILE_HEADER_NAME_TOP_PX}px`,
                  left: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {activeUser.name}
              </h1>
              <p
                className="text-left font-ui text-[13px] leading-5 tracking-[0.02em] text-meta"
                style={{
                  fontFamily: "var(--font-meta-mono), monospace",
                  position: "absolute",
                  top: `${PROFILE_HEADER_META_TOP_PX}px`,
                  left: 0,
                  whiteSpace: "nowrap",
                }}
              >
                ID {userIdLabel} · CALIBRATION {calibrationMonth} · ISSUE {issueLabel}
              </p>
            </div>

            <div
              className="absolute right-0 z-20 flex h-12 w-full flex-wrap items-end justify-start gap-x-7 gap-y-2 sm:w-max sm:justify-end md:gap-x-[47px]"
              style={{ top: `${PROFILE_HEADER_NAV_TOP_PX}px` }}
            >
              <button
                type="button"
                onClick={() => switchTab("signature")}
                className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[14px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                  activeTab === "signature"
                    ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:bg-black after:content-['']"
                    : "font-medium text-inactive hover:text-meta"
                }`}
              >
                Signature
                <span className={profileTabHoverPillClass}>
                  Aesthetic, decoded
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("reference-sets")}
                className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[14px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                  activeTab === "reference-sets"
                    ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:bg-black after:content-['']"
                    : "font-medium text-inactive hover:text-meta"
                }`}
              >
                References
                <span className={profileTabHoverPillClass}>
                  Visual references, by edit
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("quiet-constraints")}
                className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[14px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                  activeTab === "quiet-constraints"
                    ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:bg-black after:content-['']"
                    : "font-medium text-inactive hover:text-meta"
                }`}
              >
                Constraints
                <span className={profileTabHoverPillClass}>
                  Quiet rules
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("feedback")}
                className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[14px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                  activeTab === "feedback"
                    ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:bg-black after:content-['']"
                    : "font-medium text-inactive hover:text-meta"
                }`}
              >
                Feedback
                <span className={profileTabHoverPillClass}>
                  Shape seenless
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("settings")}
                className={`font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[14px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 ${
                  activeTab === "settings"
                    ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:bg-black after:content-['']"
                    : "font-medium text-inactive hover:text-meta"
                }`}
              >
                Settings
              </button>
            </div>

            <div
              className="absolute inset-x-0 h-px bg-[#ECEDEF] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              style={{ top: `${PROFILE_HEADER_DIVIDER_TOP_PX}px` }}
            />
          </div>
        </div>

        {activeTab === "signature" ? (
          <section className="mt-12">
            <div className="mx-auto w-full px-10">
              <div className="mx-auto w-full max-w-[72ch]">
                <h2 className="mb-6 inline-flex w-full items-end justify-start text-[25px] leading-none text-ink">
                  <span className="font-ui font-normal tracking-[-0.06em]">Signature</span>
                  <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                  <span className="ml-[1px] font-instrument italic tracking-[0.01em]">{signatureTitleDisplay}</span>
                </h2>

                <p className="text-justify font-ui text-[14px] font-normal leading-[1.8] text-meta">
                  {shortSummary}
                </p>
              </div>
            </div>

            <div className="mx-auto mt-24 w-full max-w-[620px]">
              <ProfileSignatureContourInline user={activeUser} />
            </div>
          </section>
        ) : null}

        {activeTab === "reference-sets" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section>
              {isShortcutCreateFlowActive ? (
                <div
                  ref={createEditSectionRef}
                  className="mt-12 w-full"
                  style={{ scrollMarginTop: `${PROFILE_HEADER_HEIGHT_PX + 28}px` }}
                >
                  <div className="mt-2">
                    {createEditComposer}
                  </div>
                </div>
              ) : (
                referenceSets.map((set, setIndex) => {
                const isEditing = Boolean(editingSetIds[set.id]);
                const isExpanded = Boolean(expandedSetIds[set.id]);
                const isLastSet = setIndex === referenceSets.length - 1;
                const hasPendingDoneConfirmation = pendingDoneSetId === set.id;
                const hasPendingRebuildConfirmation = pendingRebuildSetId === set.id;
                const hasPendingDeleteConfirmation = pendingDeleteSetId === set.id;
                const isRenaming = renamingSetId === set.id;
                const isMainEdit = set.id === MAIN_EDIT_SET_ID;
                const previewColumns = getReferencePreviewColumns(viewportWidth);
                const defaultPreviewRows = isMainEdit && referenceSets.length === 1 ? 2 : viewportWidth >= 1680 ? 2 : 1;
                const previewRows = isCreateEditOpen ? 1 : defaultPreviewRows;
                const previewCount = previewColumns * previewRows;
                const visibleImages = isExpanded ? set.images : set.images.slice(0, previewCount);

                return (
                  <div key={set.id} className={setIndex === 0 ? "mt-12" : "mt-4"}>
                    <div className="flex items-start justify-between gap-8">
                      <div>
                        <h3 className="inline-flex items-baseline leading-none text-ink">
                          <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">The</span>
                          <span className="-ml-[1px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">
                            –
                          </span>
                          <span className="ml-[2px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
                            {set.name}
                          </span>
                        </h3>
                        {isMainEdit ? (
                          <p className={`mt-3 max-w-[540px] ${metaDescriptionClass}`}>
                            This is the core reference set behind the Main Edit. The personal Signature is shaped from
                            it. Additional Edits exist only for distinct contexts.
                          </p>
                        ) : null}
                      </div>
                      <span className="font-ui text-[14px] font-medium leading-5 tracking-[0.02em] text-meta">
                        <span aria-hidden="true">|</span>
                        <span className="px-[2px]">{set.images.length} References</span>
                        <span aria-hidden="true">|</span>
                      </span>
                    </div>

                    <div
                      className="mt-6 grid gap-[6px]"
                      style={{ gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))` }}
                    >
                      {visibleImages.map((image) => (
                        <div
                          key={image.id}
                          className="relative aspect-square w-full overflow-hidden rounded-[4px]"
                          onMouseEnter={() => setHoveredImageId(image.id)}
                          onMouseLeave={() => setHoveredImageId(null)}
                        >
                          <Image
                            src={image.publicPath}
                            alt={image.fileName}
                            fill
                            unoptimized
                            sizes="(max-width: 1024px) 100vw, 220px"
                            className="object-cover"
                          />
                          {isEditing && hoveredImageId === image.id ? (
                            <button
                              type="button"
                              aria-label="Remove reference"
                              onClick={() => removeImage(set.id, image.id)}
                              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/50 font-ui text-[12px] leading-none text-paper"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}

                      {isExpanded && isEditing ? (
                        <button
                          type="button"
                          onClick={() => requestUpload(set.id)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverSetId(set.id);
                          }}
                          onDragLeave={() => setDragOverSetId((current) => (current === set.id ? null : current))}
                          onDrop={(event) => handleSetDrop(set.id, event)}
                          className={`flex aspect-square w-full items-center justify-center border border-dashed font-ui text-[32px] font-normal leading-none text-meta transition-colors duration-150 hover:text-ink ${
                            dragOverSetId === set.id ? "border-meta" : "border-line"
                          }`}
                        >
                          +
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-end">
                      {!isExpanded ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSetIds((current) => ({
                                ...current,
                                [set.id]: true,
                              }));
                              setEditingSetIds((current) => ({
                                ...current,
                                [set.id]: true,
                              }));
                              setPendingDoneSetId((current) => (current === set.id ? null : current));
                              setPendingRebuildSetId((current) => (current === set.id ? null : current));
                              setPendingDeleteSetId((current) => (current === set.id ? null : current));
                              setRenamingSetId((current) => (current === set.id ? null : current));
                            }}
                            className={settingsActionPillClass}
                          >
                            {isEditing ? "done" : "review"}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestRebuildConfirmation(set.id)}
                            className={settingsActionPillClass}
                          >
                            rebuild
                          </button>
                          {!isMainEdit ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startRenameSet(set.id, set.name)}
                                className={settingsActionPillClass}
                              >
                                rename
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteSetConfirmation(set.id)}
                                className={settingsDeletePillClass}
                              >
                                delete
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSetIds((current) => ({
                                ...current,
                                [set.id]: true,
                              }))
                            }
                            className={settingsActionPillClass}
                          >
                            view all →
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                requestDoneConfirmation(set.id);
                                return;
                              }
                              setPendingRebuildSetId((current) => (current === set.id ? null : current));
                              setPendingDeleteSetId((current) => (current === set.id ? null : current));
                              setRenamingSetId((current) => (current === set.id ? null : current));
                              toggleEditSet(set.id);
                            }}
                            className={settingsActionPillClass}
                          >
                            {isEditing ? "done" : "review"}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestRebuildConfirmation(set.id)}
                            className={settingsActionPillClass}
                          >
                            rebuild
                          </button>
                          {!isMainEdit ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startRenameSet(set.id, set.name)}
                                className={settingsActionPillClass}
                              >
                                rename
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteSetConfirmation(set.id)}
                                className={settingsDeletePillClass}
                              >
                                delete
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedSetIds((current) => ({
                                ...current,
                                [set.id]: false,
                              }));
                              setEditingSetIds((current) => ({
                                ...current,
                                [set.id]: false,
                              }));
                              setPendingDoneSetId((current) => (current === set.id ? null : current));
                              setPendingRebuildSetId((current) => (current === set.id ? null : current));
                              setPendingDeleteSetId((current) => (current === set.id ? null : current));
                              setRenamingSetId((current) => (current === set.id ? null : current));
                            }}
                            className={settingsActionPillClass}
                          >
                            show less
                          </button>
                        </div>
                      )}
                    </div>

                  {hasPendingDoneConfirmation ? (
                    <div className="mt-6 max-w-[480px]">
                      <p className="font-ui text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-inactive">
                        disclaimer
                      </p>
                      <p className={`mt-2 ${metaDescriptionClass}`}>
                        {isMainEdit
                          ? "Proceeding will make this the active reference set for the Main Edit and Signature. The Signature and current Issue will recalibrate immediately."
                          : `This reference set becomes your active reference for the ${formatEditName(set.name)}.`}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={cancelDoneConfirmation}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDoneForSet(set.id)}
                          className={settingsActionPillClass}
                        >
                          proceed
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isRenaming && !isMainEdit ? (
                    <div className="mt-6 max-w-[360px]">
                      <p className="font-ui text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-inactive">
                        rename
                      </p>
                      <div className="mt-3">
                        <p className="font-ui text-[14px] font-normal text-ink">Edit Name</p>
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          placeholder="e.g. Summer"
                          className="mt-[6px] w-full border-0 border-b border-line bg-transparent py-2 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-ink"
                        />
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={cancelRenameSet}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmRenameSet(set.id)}
                          className={settingsActionPillClass}
                        >
                          save
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {hasPendingRebuildConfirmation ? (
                    <div className="mt-6 max-w-[480px]">
                      <p className="font-ui text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-inactive">
                        disclaimer
                      </p>
                      <p className={`mt-2 ${metaDescriptionClass}`}>
                        {isMainEdit
                          ? "Rebuilding this Main Edit replaces the current reference set with a new one. The Signature and current Issue recalibrate immediately once the new set is in place."
                          : "Rebuilding this edit deletes the current reference set and lets you upload a whole new reference set in its place."}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={cancelRebuildConfirmation}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmRebuildForSet(set.id)}
                          className={settingsActionPillClass}
                        >
                          proceed
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {hasPendingDeleteConfirmation && !isMainEdit ? (
                    <div className="mt-6 max-w-[480px]">
                      <p className="font-ui text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-inactive">
                        delete
                      </p>
                      <p className={`mt-2 ${metaDescriptionClass}`}>
                        This permanently removes {formatEditName(set.name)}, its reference set, and its paired Capsule in the Archive.
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={cancelDeleteSetConfirmation}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteSet(set.id)}
                          className={settingsDeletePillClass}
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 w-full border-t border-line/80" />

                  {isLastSet ? (
                    <div
                      ref={createEditSectionRef}
                      className={`w-full ${isCreateEditOpen ? "mt-2" : "mt-4"}`}
                      style={{ scrollMarginTop: `${PROFILE_HEADER_HEIGHT_PX + 28}px` }}
                    >
                      <div className="flex justify-end">
                        {!isCreateEditOpen ? (
                          <button type="button" onClick={openCreateEdit} className={settingsActionPillClass}>
                            create
                          </button>
                        ) : null}
                      </div>

                      <div
                        className={`overflow-hidden transition-[max-height,opacity,margin-top] duration-200 ease-in-out ${
                          isCreateEditOpen ? "mt-3 max-h-[520px] opacity-100" : "mt-0 max-h-0 opacity-0"
                        }`}
                      >
                        {createEditComposer}
                      </div>
                    </div>
                  ) : null}
                  </div>
                );
              }))}
            </section>
          </div>
        ) : null}

        {activeTab === "quiet-constraints" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-12 max-w-[980px]">
              <div>
                <h3 className="inline-flex items-end text-[25px] leading-none text-ink">
                  <span className="font-ui font-normal tracking-[-0.06em]">Quiet</span>
                  <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                  <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Constraints</span>
                </h3>
                <p className={`mt-2 max-w-[620px] ${metaDescriptionClass}`}>
                  Set soft boundaries for what enters each Edit. Coming soon.
                </p>
              </div>

              <div className="mt-7">
                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 border-y border-line py-4">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">PRICE</p>
                  <p className="font-ui text-[14px] font-normal text-meta">
                    Set a preferred price range by category.
                  </p>
                  <div
                    className="group/constraint relative inline-flex"
                    onMouseLeave={() => hideConstraintHint("price")}
                  >
                    <button
                      type="button"
                      className={settingsActionPillClass}
                      onClick={() => showConstraintHint("price")}
                    >
                      set range
                    </button>
                    <span
                      aria-hidden="true"
                      className={`${constraintHoverPillClass} ${activeConstraintHint === "price" ? "translate-y-0 opacity-100" : ""}`}
                    >
                      coming soon
                    </span>
                  </div>
                </div>

                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 border-b border-line py-4">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">SIZING</p>
                  <p className="font-ui text-[14px] font-normal text-meta">
                    Set sizing preferences and flexibility.
                  </p>
                  <div
                    className="group/constraint relative inline-flex"
                    onMouseLeave={() => hideConstraintHint("sizing")}
                  >
                    <button
                      type="button"
                      className={settingsActionPillClass}
                      onClick={() => showConstraintHint("sizing")}
                    >
                      set sizing
                    </button>
                    <span
                      aria-hidden="true"
                      className={`${constraintHoverPillClass} ${activeConstraintHint === "sizing" ? "translate-y-0 opacity-100" : ""}`}
                    >
                      coming soon
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-12 max-w-[980px]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="inline-flex items-end text-[25px] leading-none text-ink">
                    <span className="font-ui font-normal tracking-[-0.06em]">Profile</span>
                    <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                    <span className="ml-[1px] font-instrument italic tracking-[0.01em]">Details</span>
                  </h3>
                  <p className={`mt-2 ${metaDescriptionClass}`}>
                    {isSettingsEditMode ? "Click a value to edit one field at a time." : "Details are currently read-only."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isSettingsEditMode) {
                      setIsSettingsEditMode(false);
                      cancelSettingsFieldEdit();
                      return;
                    }
                    setIsDeleteProfileDisclaimerOpen(false);
                    setIsSettingsEditMode(true);
                  }}
                  className={settingsActionPillClass}
                >
                  {isSettingsEditMode ? "done" : "edit profile"}
                </button>
              </div>

              <div className="mt-6 space-y-1">
                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 py-2">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">EMAIL</p>
                  {activeSettingsField === "email" ? (
                    <input
                      type="email"
                      value={settingsFieldDraft}
                      onChange={(event) => setSettingsFieldDraft(event.target.value)}
                      className="h-10 w-full rounded-[12px] border border-line bg-paper px-3 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                      placeholder="Email"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("email")}
                      className={`w-full text-left font-ui text-[14px] font-normal text-ink outline-none transition-colors duration-150 ${
                        isSettingsEditMode ? "cursor-pointer hover:text-meta" : "cursor-default"
                      }`}
                      disabled={!isSettingsEditMode}
                    >
                      {profileSettings.email}
                    </button>
                  )}
                  <div className="flex min-w-[146px] items-center justify-end gap-2">
                    {activeSettingsField === "email" ? (
                      <>
                        <button
                          type="button"
                          onClick={cancelSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          save
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 py-2">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">PHONE</p>
                  {activeSettingsField === "phone" ? (
                    <div className="w-full">
                      <input
                        type="tel"
                        value={settingsFieldDraft}
                        onChange={(event) => handleSettingsPhoneDraftChange(event.target.value)}
                        className="h-10 w-full rounded-[12px] border border-line bg-paper px-3 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                        placeholder="+41 79 123 45 67"
                        autoFocus
                      />
                      <p className="mt-2 font-ui text-[12px] font-normal leading-5 text-meta">
                        Phone login uses a one-time code.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={sendSettingsPhoneCode}
                          className={settingsActionPillClass}
                          disabled={!isValidPhone(settingsFieldDraft.trim())}
                        >
                          {isSettingsPhoneCodeSent ? "resend code" : "send code"}
                        </button>
                        {isSettingsPhoneVerified ? (
                          <span className="font-ui text-[12px] font-normal leading-5 text-meta">phone confirmed</span>
                        ) : null}
                      </div>
                      {isSettingsPhoneCodeSent && !isSettingsPhoneVerified ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="min-w-[180px] flex-1">
                            <span className="font-ui text-[11px] font-medium uppercase tracking-[0.08em] text-meta">
                              Verification Code
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={settingsPhoneCodeInput}
                              onChange={(event) => setSettingsPhoneCodeInput(event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                              className="mt-1 h-10 w-full rounded-[12px] border border-line bg-paper px-3 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                              placeholder="6-digit code"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={confirmSettingsPhoneCode}
                            className={settingsActionPillClass}
                            disabled={settingsPhoneCodeInput.length !== 6}
                          >
                            confirm code
                          </button>
                        </div>
                      ) : null}
                      {isSettingsPhoneCodeSent && !isSettingsPhoneVerified ? (
                        <p className="mt-2 font-ui text-[11px] font-normal leading-5 text-meta">
                          Beta preview code: {settingsPhoneVerificationCode}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("phone")}
                      className={`w-full text-left font-ui text-[14px] font-normal text-ink outline-none transition-colors duration-150 ${
                        isSettingsEditMode ? "cursor-pointer hover:text-meta" : "cursor-default"
                      }`}
                      disabled={!isSettingsEditMode}
                    >
                      {profileSettings.phone || "—"}
                    </button>
                  )}
                  <div className="flex min-w-[146px] items-center justify-end gap-2">
                    {activeSettingsField === "phone" ? (
                      <>
                        <button
                          type="button"
                          onClick={cancelSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          save
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 py-2">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">NAME</p>
                  {activeSettingsField === "name" ? (
                    <input
                      type="text"
                      value={settingsFieldDraft}
                      onChange={(event) => setSettingsFieldDraft(event.target.value)}
                      className="h-10 w-full rounded-[12px] border border-line bg-paper px-3 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                      placeholder="Name"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("name")}
                      className={`w-full text-left font-ui text-[14px] font-normal text-ink outline-none transition-colors duration-150 ${
                        isSettingsEditMode ? "cursor-pointer hover:text-meta" : "cursor-default"
                      }`}
                      disabled={!isSettingsEditMode}
                    >
                      {profileSettings.name}
                    </button>
                  )}
                  <div className="flex min-w-[146px] items-center justify-end gap-2">
                    {activeSettingsField === "name" ? (
                      <>
                        <button
                          type="button"
                          onClick={cancelSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          save
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 py-2">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">PASSWORD</p>
                  {activeSettingsField === "password" ? (
                    <input
                      type="password"
                      value={settingsFieldDraft}
                      onChange={(event) => setSettingsFieldDraft(event.target.value)}
                      className="h-10 w-full rounded-[12px] border border-line bg-paper px-3 font-ui text-[14px] font-normal text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                      placeholder="Set a new password"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("password")}
                      className={`w-full text-left font-ui text-[13px] font-normal tracking-[0.1em] text-meta outline-none transition-colors duration-150 ${
                        isSettingsEditMode ? "cursor-pointer hover:text-[#6F7381]" : "cursor-default"
                      }`}
                      disabled={!isSettingsEditMode}
                    >
                      ••••••
                    </button>
                  )}
                  <div className="flex min-w-[146px] items-center justify-end gap-2">
                    {activeSettingsField === "password" ? (
                      <>
                        <button
                          type="button"
                          onClick={cancelSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSettingsFieldEdit}
                          className={settingsActionPillClass}
                        >
                          save
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 border-y border-line py-4">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">SESSION</p>
                  <p className="font-ui text-[14px] font-normal text-meta">Signed in as {sessionIdentity}</p>
                  <button
                    type="button"
                    className={settingsActionPillClass}
                  >
                    log out
                  </button>
                </div>

                <div className="grid min-h-[72px] grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-6 border-b border-line py-4">
                  <p className="font-ui text-[14px] font-normal leading-none text-meta">PROFILE</p>
                  <div>
                    <p className={metaDescriptionClass}>
                      Permanently remove this account, including reference sets and signature state.
                    </p>
                    {isDeleteProfileDisclaimerOpen ? (
                      <p className="mt-2 font-ui text-[13px] leading-[1.6] text-meta">
                        This action cannot be undone.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {isDeleteProfileDisclaimerOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsDeleteProfileDisclaimerOpen(false)}
                          className={settingsActionPillClass}
                        >
                          cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeleteProfileDisclaimerOpen(false)}
                          className={settingsDeletePillClass}
                        >
                          confirm delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsEditMode(false);
                          cancelSettingsFieldEdit();
                          setIsDeleteProfileDisclaimerOpen(true);
                        }}
                        className={settingsDeletePillClass}
                      >
                        delete profile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "feedback" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-12 max-w-[980px]">
              <div>
                <h3 className="inline-flex items-end text-[25px] leading-none text-ink">
                  <span className="font-ui font-normal tracking-[-0.06em]">Beta–</span>
                  <span className="font-instrument italic tracking-[0.01em]">Feedback</span>
                </h3>
                <p className={`mt-2 max-w-[720px] ${metaDescriptionClass}`}>
                  Thank you for helping shape seenless in beta. Notes shared here are anonymous, not linked to the
                  account, and reviewed as part of the broader refinement process. At this stage, reflections on what
                  felt clear, what felt off, and what would build more trust are especially valuable.
                </p>
                <p className="mt-6 font-ui text-[13px] leading-[1.8] tracking-[0.02em] text-meta">Best,</p>
                <p className="mt-4 font-belmonte text-[28px] leading-none italic text-accent">
                  Jil &amp; Nick
                </p>
              </div>

              <div className="mt-7 space-y-5">
                <label className="block">
                  <span className="font-ui text-[12px] font-medium uppercase tracking-[0.08em] text-meta">
                    1. What felt most clear and most useful?
                  </span>
                  <textarea
                    value={feedbackAnswers.clarity}
                    onChange={(event) => setFeedbackAnswers((prev) => ({ ...prev, clarity: event.target.value }))}
                    className="mt-2 min-h-[88px] w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 font-ui text-[14px] font-normal leading-[1.6] text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                    placeholder="Share the moments, elements, or interactions that worked especially well."
                  />
                </label>

                <label className="block">
                  <span className="font-ui text-[12px] font-medium uppercase tracking-[0.08em] text-meta">
                    2. Where did the experience feel unclear, off, or incomplete?
                  </span>
                  <textarea
                    value={feedbackAnswers.quality}
                    onChange={(event) => setFeedbackAnswers((prev) => ({ ...prev, quality: event.target.value }))}
                    className="mt-2 min-h-[88px] w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 font-ui text-[14px] font-normal leading-[1.6] text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                    placeholder="Anything that felt confusing, missing, or slightly out of place is helpful to note."
                  />
                </label>

                <label className="block">
                  <span className="font-ui text-[12px] font-medium uppercase tracking-[0.08em] text-meta">
                    3. What should change first to earn more trust?
                  </span>
                  <textarea
                    value={feedbackAnswers.trust}
                    onChange={(event) => setFeedbackAnswers((prev) => ({ ...prev, trust: event.target.value }))}
                    className="mt-2 min-h-[88px] w-full resize-y rounded-[14px] border border-line bg-paper px-4 py-3 font-ui text-[14px] font-normal leading-[1.6] text-ink outline-none placeholder:text-inactive focus:border-meta/60"
                    placeholder="One honest suggestion is enough."
                  />
                </label>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLastFeedbackSentAt(
                        new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                      );
                      setFeedbackAnswers({
                        clarity: "",
                        quality: "",
                        trust: "",
                      });
                    }}
                    disabled={!canSendFeedback}
                    className={`${settingsActionPillClass} ${!canSendFeedback ? "cursor-not-allowed opacity-50 hover:text-[#6F7381]" : ""}`}
                  >
                    send feedback
                  </button>
                  {lastFeedbackSentAt ? (
                    <p className="mt-3 font-ui text-[13px] font-normal leading-5 text-meta">
                      Last feedback sent: {lastFeedbackSentAt}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </motion.main>
  );
}
