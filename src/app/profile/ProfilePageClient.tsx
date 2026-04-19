"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSignatureContourInline } from "@/components/unseen/ProfileSignatureContourInline";
import type { MockReferenceVisual, MockTasteCluster } from "@/data/mockUsers";
import { mockUsers } from "@/data/mockUsers";

type ProfileTab = "signature" | "reference-sets" | "quiet-constraints" | "feedback" | "settings";
type SettingsField = "email" | "name" | "password";
type QuietConstraintAction = "price" | "sizing";

type ReferenceSet = {
  id: string;
  name: string;
  images: MockReferenceVisual[];
};

type FeedbackEntry = {
  sentAt: string;
  clarity: string;
  quality: string;
  trust: string;
};

const NEW_EDIT_TARGET = "__new_edit__";
const MAIN_EDIT_SET_ID = "main-edit";
const MIN_NEW_EDIT_REFERENCES = 30;
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
  if (viewportWidth >= 1900) return 9;
  if (viewportWidth >= 1600) return 8;
  if (viewportWidth >= 1300) return 7;
  if (viewportWidth >= 1050) return 6;
  return 5;
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

const PROFILE_HEADER_NAME_TOP_PX = 32;
const PROFILE_HEADER_NAV_TOP_PX = 46;
const PROFILE_HEADER_META_TOP_PX = 66;
const PROFILE_HEADER_DIVIDER_TOP_PX = 96;
const PROFILE_HEADER_HEIGHT_PX = 97;
const PROFILE_HEADER_META_FOLD_BUFFER_PX = 38;

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
  const [isNewEditUploading, setIsNewEditUploading] = useState(false);
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
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackEntry[]>([]);
  const [isFeedbackHistoryOpen, setIsFeedbackHistoryOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState(() => ({
    email: activeUser?.email ?? "",
    name: activeUser?.name ?? "",
  }));
  const [isSettingsEditMode, setIsSettingsEditMode] = useState(false);
  const [activeSettingsField, setActiveSettingsField] = useState<SettingsField | null>(null);
  const [settingsFieldDraft, setSettingsFieldDraft] = useState("");
  const [activeConstraintHint, setActiveConstraintHint] = useState<QuietConstraintAction | null>(null);
  const [newEditName, setNewEditName] = useState("");
  const [newEditReferences, setNewEditReferences] = useState<MockReferenceVisual[]>([]);
  const [renameDraft, setRenameDraft] = useState("");
  const [referenceSets, setReferenceSets] = useState<ReferenceSet[]>(
    () => buildReferenceSets(activeUser?.referenceSetForMainEdit ?? []),
  );
  const [mainEditRecalibrationCount, setMainEditRecalibrationCount] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [isCloseIconMorphed, setIsCloseIconMorphed] = useState(!shouldMorphCloseIcon);
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  const [shouldSplitCreateActionRow, setShouldSplitCreateActionRow] = useState(false);
  const [shouldFoldHeaderMeta, setShouldFoldHeaderMeta] = useState(false);
  const createEditSectionRef = useRef<HTMLDivElement | null>(null);
  const createEditNameInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackClarityRef = useRef<HTMLTextAreaElement | null>(null);
  const feedbackQualityRef = useRef<HTMLTextAreaElement | null>(null);
  const feedbackTrustRef = useRef<HTMLTextAreaElement | null>(null);
  const hasAppliedInitialCreateFlowRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetSetId, setUploadTargetSetId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"append" | "replace">("append");
  const fixedHeaderRef = useRef<HTMLDivElement | null>(null);
  const headerMetaRef = useRef<HTMLParagraphElement | null>(null);
  const headerNavRef = useRef<HTMLDivElement | null>(null);
  const createActionRowRef = useRef<HTMLDivElement | null>(null);
  const createActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryActionsRowRef = useRef<HTMLDivElement | null>(null);
  const constraintHintTimeoutRef = useRef<number | null>(null);
  const newEditUploadPulseTimeoutRef = useRef<number | null>(null);
  const isCompactHeaderLayout = viewportWidth < 980;

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
      setNewEditReferences((prev) => {
        prev.forEach((image) => URL.revokeObjectURL(image.publicPath));
        return prev;
      });
      if (constraintHintTimeoutRef.current !== null) {
        window.clearTimeout(constraintHintTimeoutRef.current);
      }
      if (newEditUploadPulseTimeoutRef.current !== null) {
        window.clearTimeout(newEditUploadPulseTimeoutRef.current);
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

  useEffect(() => {
    if (activeTab !== "feedback") return;
    const raf = window.requestAnimationFrame(() => {
      feedbackClarityRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "reference-sets" || isCreateEditOpen) return;

    const measureWrapNeed = () => {
      const wrapper = createActionRowRef.current;
      const createButton = createActionButtonRef.current;
      const primaryActions = primaryActionsRowRef.current;
      if (!wrapper || !createButton || !primaryActions) return;

      const wrapperWidth = wrapper.clientWidth;
      const createWidth = createButton.offsetWidth;
      const primaryWidth = primaryActions.scrollWidth;
      const gapPx = 12;
      setShouldSplitCreateActionRow(createWidth + primaryWidth + gapPx > wrapperWidth);
    };

    const raf = window.requestAnimationFrame(measureWrapNeed);
    window.addEventListener("resize", measureWrapNeed);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureWrapNeed);
    };
  }, [activeTab, isCreateEditOpen, referenceSets.length, expandedSetIds, editingSetIds]);

  useEffect(() => {
    const measureMetaFold = () => {
      if (isCompactHeaderLayout) {
        setShouldFoldHeaderMeta(true);
        return;
      }

      const metaNode = headerMetaRef.current;
      const navNode = headerNavRef.current;
      if (!metaNode || !navNode) {
        setShouldFoldHeaderMeta(false);
        return;
      }

      const metaRect = metaNode.getBoundingClientRect();
      const navRect = navNode.getBoundingClientRect();
      const gapPx = navRect.left - metaRect.right;
      setShouldFoldHeaderMeta(gapPx < PROFILE_HEADER_META_FOLD_BUFFER_PX);
    };

    const raf = window.requestAnimationFrame(measureMetaFold);
    const resizeObserver = new ResizeObserver(measureMetaFold);
    if (headerMetaRef.current) resizeObserver.observe(headerMetaRef.current);
    if (headerNavRef.current) resizeObserver.observe(headerNavRef.current);
    window.addEventListener("resize", measureMetaFold);
    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureMetaFold);
    };
  }, [isCompactHeaderLayout, activeTab]);

  const clusters = useMemo(
    () => [...(activeUser?.tasteAttributes.clusters ?? [])].sort((a, b) => clusterWeight(b) - clusterWeight(a)),
    [activeUser],
  );
  const dominantCluster = clusters[0] ?? null;
  const shortSummary = limitSentences(activeUser?.tasteDescription.tasteThesis ?? "", 3);

  if (!activeUser) return null;

  const calibrationMonth = new Date(activeUser.lastCalibrationDate)
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toUpperCase();
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
  const settingsActionPillClass =
    "inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink";
  const settingsDeletePillClass =
    "inline-flex h-[33px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] outline-none transition-colors duration-150 hover:border-[#D94343] hover:bg-[#D94343] hover:text-paper focus:outline-none focus-visible:outline-none focus-visible:ring-0";
  const profileTabHoverPillClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center -translate-x-[calc(50%-8px)] translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381]/55 bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out group-hover/tab:translate-y-0 group-hover/tab:opacity-100 group-focus-visible/tab:translate-y-0 group-focus-visible/tab:opacity-100";
  const constraintHoverPillClass =
    "pointer-events-none absolute bottom-[5px] left-full z-20 ml-[8px] inline-flex h-[29px] items-center justify-center translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381]/55 bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out group-hover/constraint:translate-y-0 group-hover/constraint:opacity-100 group-focus-within/constraint:translate-y-0 group-focus-within/constraint:opacity-100";
  const mainEditHoverPillClass =
    "pointer-events-none absolute left-0 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381]/55 bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out group-hover/mainedit:translate-y-0 group-hover/mainedit:opacity-100 group-focus-within/mainedit:translate-y-0 group-focus-within/mainedit:opacity-100";
  const expandTextButtonClass =
    "inline-flex items-center gap-2 whitespace-nowrap border-0 bg-transparent p-0 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none";
  const isShortcutCreateFlowActive = isFocusedCreateFlow && isCreateEditOpen;
  const canSendFeedback =
    feedbackAnswers.clarity.trim().length > 0 ||
    feedbackAnswers.quality.trim().length > 0 ||
    feedbackAnswers.trust.trim().length > 0;
  const pendingDoneSet = pendingDoneSetId ? referenceSets.find((set) => set.id === pendingDoneSetId) ?? null : null;
  const isPendingDoneMainEdit = pendingDoneSet?.id === MAIN_EDIT_SET_ID;
  const pendingRebuildSet = pendingRebuildSetId ? referenceSets.find((set) => set.id === pendingRebuildSetId) ?? null : null;
  const isPendingRebuildMainEdit = pendingRebuildSet?.id === MAIN_EDIT_SET_ID;
  const pendingDeleteSet = pendingDeleteSetId ? referenceSets.find((set) => set.id === pendingDeleteSetId) ?? null : null;

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

  const autoResizeFeedbackField = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleFeedbackFieldChange = (field: "clarity" | "quality" | "trust", value: string, textarea: HTMLTextAreaElement) => {
    setFeedbackAnswers((prev) => ({ ...prev, [field]: value }));
    autoResizeFeedbackField(textarea);
  };

  const handleFeedbackFieldKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    field: "clarity" | "quality" | "trust",
  ) => {
    if (event.key === "Enter") {
      // Keep Enter inside the current feedback field and avoid parent keyboard handlers.
      event.stopPropagation();
      return;
    }

    if (event.key !== "/") return;

    const textarea = event.currentTarget;
    const value = feedbackAnswers[field];
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const before = value.slice(0, selectionStart);
    const lineStart = before.lastIndexOf("\n") + 1;
    const linePrefix = before.slice(lineStart);

    // Slash command for bullets in feedback only: typing "/" at line start inserts a bullet.
    if (linePrefix.trim().length > 0) return;

    event.preventDefault();
    event.stopPropagation();

    const nextValue = `${value.slice(0, selectionStart)}• ${value.slice(selectionEnd)}`;
    setFeedbackAnswers((prev) => ({ ...prev, [field]: nextValue }));
    window.requestAnimationFrame(() => {
      const nextCursor = selectionStart + 2;
      textarea.selectionStart = nextCursor;
      textarea.selectionEnd = nextCursor;
      autoResizeFeedbackField(textarea);
    });
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
    window.requestAnimationFrame(() => {
      createEditNameInputRef.current?.focus();
    });
  };

  const closeCreateEdit = () => {
    setNewEditReferences((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.publicPath));
      return [];
    });
    setIsCreateEditOpen(false);
    setNewEditName("");
    setUploadTargetSetId(null);
    setUploadMode("append");
    setIsFocusedCreateFlow(false);
  };

  const switchTab = (nextTab: ProfileTab) => {
    if (nextTab !== "reference-sets") {
      setNewEditReferences((prev) => {
        prev.forEach((image) => URL.revokeObjectURL(image.publicPath));
        return [];
      });
      setExpandedSetIds({});
      setEditingSetIds({});
      setPendingDoneSetId(null);
      setDragOverSetId(null);
      setHoveredImageId(null);
      setIsCreateEditOpen(false);
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
    }
    if (nextTab === "settings") {
      setIsSettingsEditMode(true);
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
    setSettingsFieldDraft(profileSettings[field]);
  };

  const cancelSettingsFieldEdit = () => {
    setActiveSettingsField(null);
    setSettingsFieldDraft("");
  };

  const saveSettingsFieldEdit = () => {
    if (!activeSettingsField) return;
    if (activeSettingsField === "password") {
      if (!settingsFieldDraft.trim()) return;
      cancelSettingsFieldEdit();
      return;
    }
    const trimmed = settingsFieldDraft.trim();
    if (!trimmed) {
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

  const startRenameSet = (setId: string) => {
    setPendingDoneSetId(null);
    setPendingRebuildSetId(null);
    setPendingDeleteSetId(null);
    setRenamingSetId(setId);
    setRenameDraft("");
    window.requestAnimationFrame(() => {
      const renamePanel = document.getElementById(`rename-panel-${setId}`);
      renamePanel?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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

  const appendNewEditReferences = (incomingFiles: File[]) => {
    const files = incomingFiles.filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    pulseNewEditUploading();
    const nextImages = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      publicPath: URL.createObjectURL(file),
    }));
    setNewEditReferences((prev) => [...prev, ...nextImages]);
  };

  const removeNewEditReference = (imageId: string) => {
    setNewEditReferences((prev) => {
      const target = prev.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.publicPath);
      return prev.filter((image) => image.id !== imageId);
    });
  };

  const pulseNewEditUploading = () => {
    setIsNewEditUploading(true);
    if (newEditUploadPulseTimeoutRef.current !== null) {
      window.clearTimeout(newEditUploadPulseTimeoutRef.current);
    }
    newEditUploadPulseTimeoutRef.current = window.setTimeout(() => {
      setIsNewEditUploading(false);
      newEditUploadPulseTimeoutRef.current = null;
    }, 280);
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
      appendNewEditReferences(Array.from(files));
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

  const handleNewEditUploadFiles = (incomingFiles: File[]) => {
    appendNewEditReferences(incomingFiles);
  };

  const canProceedNewEdit = newEditReferences.length >= MIN_NEW_EDIT_REFERENCES;
  const visibleNewEditReferences = newEditReferences;

  const proceedCreateEdit = () => {
    if (!canProceedNewEdit) return;
    setReferenceSets((prev) => [
      ...prev,
      {
        id: `edit-${Date.now()}`,
        name: resolveNewEditName(prev.length),
        images: newEditReferences,
      },
    ]);
    setIsCreateEditOpen(false);
    setNewEditName("");
    setNewEditReferences([]);
    setUploadTargetSetId(null);
    setUploadMode("append");
    setIsFocusedCreateFlow(false);
    setPendingRebuildSetId(null);
  };

  const createEditComposer = (
    <div className="mx-auto mt-2 w-full max-w-[640px]">
      <div className="mx-auto w-full max-w-[280px]">
        <input
          ref={createEditNameInputRef}
          type="text"
          value={newEditName}
          onChange={(event) => setNewEditName(event.target.value)}
          placeholder="Edit name, e.g. Summer Edit"
          className="mt-1 block h-[30px] w-full border-0 bg-transparent px-0 text-center font-ui text-[14px] font-normal leading-6 text-ink outline-none placeholder:text-inactive"
        />
      </div>

      {newEditReferences.length === 0 ? (
        <div
          className="mt-8 flex w-full items-center justify-center px-0 py-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleNewEditUploadFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <button
            type="button"
            aria-label="Upload visual references"
            onClick={() => requestUpload(NEW_EDIT_TARGET)}
            className={`group inline-flex flex-col items-center justify-center gap-2 border-0 bg-transparent focus-visible:outline-none ${
              isNewEditUploading ? "text-ink" : ""
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[18px] leading-none shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink ${
                isNewEditUploading ? "border-ink bg-ink text-paper" : "text-meta group-hover:text-paper"
              }`}
            >
              ↑
            </span>
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <div className="mb-2 flex w-full justify-end">
            <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[12px] font-medium leading-5 tracking-[0.02em] text-meta">
              <span aria-hidden="true">|</span>
              <span className="px-[2px]">{newEditReferences.length} references</span>
              <span aria-hidden="true">|</span>
            </span>
          </div>
          <div
            className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleNewEditUploadFiles(Array.from(event.dataTransfer.files));
            }}
          >
            {visibleNewEditReferences.map((image) => (
              <div key={image.id} className="group relative aspect-square w-full overflow-hidden rounded-[4px] bg-mist">
                <Image
                  src={image.publicPath}
                  alt={image.fileName}
                  fill
                  unoptimized
                  sizes="120px"
                  className="object-cover"
                  draggable={false}
                />
                <button
                  type="button"
                  aria-label="Remove uploaded reference"
                  onClick={() => removeNewEditReference(image.id)}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-meta opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              aria-label="Upload visual references"
              onClick={() => requestUpload(NEW_EDIT_TARGET)}
              className="group inline-flex aspect-square w-full flex-col items-center justify-center gap-2 border-0 bg-transparent transition-colors duration-180 focus-visible:outline-none"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-meta shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                ↑
              </span>
              <span className="font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink">
                add more
              </span>
              {!canProceedNewEdit ? (
                <span className="font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink">
                  (upload at least {MIN_NEW_EDIT_REFERENCES} images)
                </span>
              ) : null}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <button type="button" onClick={closeCreateEdit} className={settingsActionPillClass}>
          cancel
        </button>
        <button
          type="button"
          onClick={proceedCreateEdit}
          disabled={!canProceedNewEdit}
          className={`${settingsActionPillClass} ${!canProceedNewEdit ? "cursor-not-allowed opacity-50 hover:text-[#6F7381]" : ""}`}
        >
          proceed
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
        className="fixed right-5 top-[30px] z-50 inline-flex h-[11px] w-[15px] items-center justify-center text-inactive transition-colors duration-150 hover:text-ink focus-visible:outline-none sm:right-10"
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

      <section className="mx-auto w-full max-w-[1333px] px-5 pb-16 pt-[116px] sm:px-10">
        <div
          ref={fixedHeaderRef}
          className="fixed inset-x-0 top-0 z-40 mx-[calc(50%-50vw)] bg-paper px-5 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)] sm:px-10"
          style={{ height: `${PROFILE_HEADER_HEIGHT_PX}px` }}
        >
          <div className="relative h-full w-full">
            <div className="absolute left-0 top-0 text-left">
              <h1
                className="text-left font-ui text-[20px] leading-none tracking-[-0.03em] text-ink sm:text-[26px]"
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
                ref={headerMetaRef}
                aria-hidden={shouldFoldHeaderMeta}
                className="text-left font-ui text-[12px] leading-4 tracking-[0.02em] text-meta"
                style={{
                  fontFamily: "var(--font-meta-mono), monospace",
                  position: "absolute",
                  top: `${PROFILE_HEADER_META_TOP_PX}px`,
                  left: 0,
                  whiteSpace: "nowrap",
                  visibility: shouldFoldHeaderMeta ? "hidden" : "visible",
                }}
              >
                ID {userIdLabel} · CALIBRATION {calibrationMonth} · ISSUE {issueLabel}
              </p>
            </div>

            <div
              ref={headerNavRef}
              className={`absolute z-20 flex h-12 items-end gap-x-4 sm:gap-x-7 md:gap-x-[47px] ${
                isCompactHeaderLayout ? "inset-x-0 justify-start overflow-x-auto pr-14" : "right-0 justify-end"
              }`}
              style={{ top: `${PROFILE_HEADER_NAV_TOP_PX}px` }}
            >
                <button
                  type="button"
                  onClick={() => switchTab("signature")}
                  className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[13px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 md:text-[14px] ${
                    activeTab === "signature"
                      ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
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
                  className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[13px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 md:text-[14px] ${
                    activeTab === "reference-sets"
                      ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
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
                  className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[13px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 md:text-[14px] ${
                    activeTab === "quiet-constraints"
                      ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
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
                  className={`group/tab font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[13px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 md:text-[14px] ${
                    activeTab === "feedback"
                      ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
                      : "font-medium text-inactive hover:text-meta"
                  }`}
                >
                  Feedback
                  <span className={profileTabHoverPillClass}>
                    Shape cenoir
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("settings")}
                  className={`font-ui relative inline-flex h-10 items-center whitespace-nowrap border-0 bg-transparent px-0 text-[13px] leading-5 tracking-[0.28px] outline-none transition-colors focus-visible:outline-none focus-visible:ring-0 md:text-[14px] ${
                    activeTab === "settings"
                      ? "font-semibold text-ink after:absolute after:bottom-[-3px] after:left-0 after:h-[1.5px] after:w-full after:bg-black after:content-['']"
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
                const isRenaming = renamingSetId === set.id;
                const isMainEdit = set.id === MAIN_EDIT_SET_ID;
                const previewColumns = getReferencePreviewColumns(viewportWidth);
                const previewRows = 1;
                const previewCount = previewColumns * previewRows;
                const visibleImages = isExpanded ? set.images : set.images.slice(0, previewCount);

                return (
                  <div key={set.id} className={setIndex === 0 ? "mt-12" : "mt-8"}>
                    <div className="flex items-center justify-between gap-8">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`${isMainEdit ? "group/mainedit relative" : ""}`}>
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
                            <span aria-hidden="true" className={mainEditHoverPillClass}>
                              This is the core reference set behind the Main Edit. The personal Signature is shaped
                              from it. Additional Edits exist for distinct contexts.
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        <span aria-hidden="true">|</span>
                        <span className="px-[2px]">{set.images.length} References</span>
                        <span aria-hidden="true">|</span>
                      </span>
                    </div>
                    {!isCreateEditOpen ? (
                      <>
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
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-meta"
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
                              className={`group inline-flex aspect-square w-full flex-col items-center justify-center gap-2 border-0 bg-transparent transition-colors duration-180 focus-visible:outline-none ${
                                dragOverSetId === set.id ? "text-ink" : ""
                              }`}
                            >
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-meta shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper ${
                                  dragOverSetId === set.id ? "border-ink bg-ink text-paper" : ""
                                }`}
                              >
                                ↑
                              </span>
                              <span
                                className={`font-ui text-[11px] font-medium leading-4 tracking-[0.02em] text-meta transition-colors duration-150 group-hover:text-ink ${
                                  dragOverSetId === set.id ? "text-ink" : ""
                                }`}
                              >
                                add more
                              </span>
                            </button>
                          ) : null}
                        </div>

                        <div
                          ref={isLastSet && !isCreateEditOpen ? createActionRowRef : null}
                          className={`mt-4 ${
                            isLastSet && !isCreateEditOpen
                              ? shouldSplitCreateActionRow
                                ? "grid grid-cols-1 items-start gap-3"
                                : "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                              : "flex justify-end"
                          }`}
                        >
                          {!isExpanded ? (
                            <div
                              ref={isLastSet && !isCreateEditOpen ? primaryActionsRowRef : null}
                              className={`flex flex-wrap items-center gap-3 ${
                                isLastSet && !isCreateEditOpen
                                  ? shouldSplitCreateActionRow
                                    ? "col-start-1 row-start-1 w-full justify-end"
                                    : "col-start-2 row-start-1 justify-self-end"
                                  : ""
                              }`}
                            >
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
                                    onClick={() => startRenameSet(set.id)}
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
                                className={expandTextButtonClass}
                              >
                                view all
                                <span aria-hidden="true">▾</span>
                              </button>
                            </div>
                          ) : (
                            <div
                              ref={isLastSet && !isCreateEditOpen ? primaryActionsRowRef : null}
                              className={`flex flex-wrap items-center gap-3 ${
                                isLastSet && !isCreateEditOpen
                                  ? shouldSplitCreateActionRow
                                    ? "col-start-1 row-start-1 w-full justify-end"
                                    : "col-start-2 row-start-1 justify-self-end"
                                  : ""
                              }`}
                            >
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
                                    onClick={() => startRenameSet(set.id)}
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
                                className={expandTextButtonClass}
                              >
                                show less
                                <span aria-hidden="true">▴</span>
                              </button>
                            </div>
                          )}
                          {isLastSet && !isCreateEditOpen ? (
                            <div
                              className={`flex items-center ${
                                shouldSplitCreateActionRow
                                  ? "col-start-1 row-start-2 w-full justify-center"
                                  : "col-start-1 row-start-1"
                              }`}
                            >
                              <button
                                ref={createActionButtonRef}
                                type="button"
                                onClick={() => openCreateEdit()}
                                className={settingsActionPillClass}
                              >
                                create new
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 w-full border-t border-line/80" />
                    )}

                  {isRenaming && !isMainEdit ? (
                    <div id={`rename-panel-${set.id}`} className="mx-auto mt-6 w-full max-w-[640px]">
                      <div className="mx-auto w-full max-w-[280px]">
                        <div className="mt-1 h-[30px] w-full">
                          <input
                            type="text"
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            placeholder="Edit name, e.g. Summer Edit"
                            className="block h-[30px] w-full border-0 bg-transparent px-0 text-center font-ui text-[14px] font-normal leading-6 text-ink outline-none placeholder:text-inactive"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-center gap-3">
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
                          proceed
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isLastSet ? (
                    <div
                      ref={createEditSectionRef}
                      className={`w-full ${isCreateEditOpen ? "mt-2 pb-12" : "mt-4"}`}
                      style={{ scrollMarginTop: `${PROFILE_HEADER_HEIGHT_PX + 28}px` }}
                    >
                      {isCreateEditOpen ? (
                        <p className="font-ui text-[14px] font-normal leading-6 text-meta">/ New Edit</p>
                      ) : null}

                      <div
                        className={`transition-[max-height,opacity,margin-top] duration-200 ease-in-out ${
                          isCreateEditOpen
                            ? "mt-3 max-h-[5000px] overflow-visible opacity-100"
                            : "mt-0 max-h-0 overflow-hidden opacity-0"
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

        {activeTab === "reference-sets" && pendingRebuildSet ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Close rebuild disclaimer"
              onClick={cancelRebuildConfirmation}
              className="absolute inset-0 bg-paper/72"
            />
            <div className="relative w-full max-w-[460px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-10 md:py-10">
              <p className="font-ui text-[14px] font-normal leading-[1.7] text-ink">
                {isPendingRebuildMainEdit
                  ? "Rebuilding this Main Edit replaces the current reference set with a new one. The Signature and current Issue recalibrate immediately once the new set is in place."
                  : "Rebuilding this edit deletes the current reference set and lets you upload a whole new reference set in its place."}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button type="button" onClick={cancelRebuildConfirmation} className={settingsActionPillClass}>
                  cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmRebuildForSet(pendingRebuildSet.id)}
                  className={settingsActionPillClass}
                >
                  proceed
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "reference-sets" && pendingDoneSet ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Close done disclaimer"
              onClick={cancelDoneConfirmation}
              className="absolute inset-0 bg-paper/72"
            />
            <div className="relative w-full max-w-[460px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-10 md:py-10">
              <p className="font-ui text-[14px] font-normal leading-[1.7] text-ink">
                {isPendingDoneMainEdit
                  ? "Proceeding will make this the active reference set for the Main Edit and Signature. The Signature and current Issue will recalibrate immediately."
                  : `This reference set becomes the active reference for the ${formatEditName(pendingDoneSet.name)}.`}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button type="button" onClick={cancelDoneConfirmation} className={settingsActionPillClass}>
                  cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDoneForSet(pendingDoneSet.id)}
                  className={settingsActionPillClass}
                >
                  proceed
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "reference-sets" && pendingDeleteSet && pendingDeleteSet.id !== MAIN_EDIT_SET_ID ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Close delete disclaimer"
              onClick={cancelDeleteSetConfirmation}
              className="absolute inset-0 bg-paper/72"
            />
            <div className="relative w-full max-w-[460px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-10 md:py-10">
              <p className="font-ui text-[14px] font-normal leading-[1.7] text-ink">
                This permanently removes {formatEditName(pendingDeleteSet.name)}, its reference set, and its paired
                Capsule in the Archive.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button type="button" onClick={cancelDeleteSetConfirmation} className={settingsActionPillClass}>
                  cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDeleteSet(pendingDeleteSet.id)}
                  className={settingsDeletePillClass}
                >
                  delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "quiet-constraints" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-12 w-full">
              <div className="w-full space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-ui text-[14px] font-normal leading-[1.8] text-meta">
                        Preferred <span className="font-ui font-medium text-ink">price range</span> by category
                      </p>
                    </div>
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

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-ui text-[14px] font-normal leading-[1.8] text-meta">
                        Preferred <span className="font-ui font-medium text-ink">sizing</span> and fit flexibility
                      </p>
                    </div>
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
            <section className="mt-12 w-full">
              <div className="grid w-full gap-8">
                <div>
                  {activeSettingsField === "name" ? (
                    <>
                      <input
                        type="text"
                        value={settingsFieldDraft}
                        onChange={(event) => setSettingsFieldDraft(event.target.value)}
                        className="mt-2 h-10 w-full border-0 bg-transparent px-0 font-ui text-[13px] font-normal text-ink outline-none placeholder:text-inactive"
                        placeholder="name"
                        autoFocus
                      />
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={cancelSettingsFieldEdit} className={settingsActionPillClass}>
                          cancel
                        </button>
                        <button type="button" onClick={saveSettingsFieldEdit} className={settingsActionPillClass}>
                          save
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("name")}
                      className="mt-2 w-full border-0 pb-2 text-left font-ui text-[13px] font-normal text-ink outline-none transition-colors duration-150 hover:text-meta"
                    >
                      {profileSettings.name}
                    </button>
                  )}
                </div>

                <div>
                  {activeSettingsField === "email" ? (
                    <>
                      <input
                        type="email"
                        value={settingsFieldDraft}
                        onChange={(event) => setSettingsFieldDraft(event.target.value)}
                        className="mt-2 h-10 w-full border-0 bg-transparent px-0 font-ui text-[13px] font-normal text-ink outline-none placeholder:text-inactive"
                        placeholder="email"
                        autoFocus
                      />
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={cancelSettingsFieldEdit} className={settingsActionPillClass}>
                          cancel
                        </button>
                        <button type="button" onClick={saveSettingsFieldEdit} className={settingsActionPillClass}>
                          save
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("email")}
                      className="mt-2 w-full border-0 pb-2 text-left font-ui text-[13px] font-normal text-ink outline-none transition-colors duration-150 hover:text-meta"
                    >
                      {profileSettings.email}
                    </button>
                  )}
                </div>

                <div>
                  {activeSettingsField === "password" ? (
                    <>
                      <input
                        type="password"
                        value={settingsFieldDraft}
                        onChange={(event) => setSettingsFieldDraft(event.target.value)}
                        className="mt-2 h-10 w-full border-0 bg-transparent px-0 font-ui text-[13px] font-normal text-ink outline-none placeholder:text-inactive"
                        placeholder="new password"
                        autoFocus
                      />
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" onClick={cancelSettingsFieldEdit} className={settingsActionPillClass}>
                          cancel
                        </button>
                        <button type="button" onClick={saveSettingsFieldEdit} className={settingsActionPillClass}>
                          save
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginSettingsFieldEdit("password")}
                      className="mt-2 w-full border-0 pb-2 text-left font-ui text-[13px] font-normal tracking-[0.1em] text-meta outline-none transition-colors duration-150 hover:text-[#6F7381]"
                    >
                      ••••••
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-10 flex items-center gap-3">
                <button type="button" className={settingsActionPillClass}>
                  log out
                </button>
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
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "settings" && isDeleteProfileDisclaimerOpen ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Close delete profile disclaimer"
              onClick={() => setIsDeleteProfileDisclaimerOpen(false)}
              className="absolute inset-0 bg-paper/72"
            />
            <div className="relative w-full max-w-[460px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-10 md:py-10">
              <p className="font-ui text-[14px] font-normal leading-[1.7] text-ink">
                Deleting your profile removes your settings, signature history, and saved references from this
                account.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
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
                  proceed
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "feedback" ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-12 w-full">
              <div>
                <p className="w-full font-ui text-[14px] font-normal leading-[1.8] text-meta">
                  Your notes are anonymous and used only to improve clarity, quality, and trust in the experience.
                  Thank you for shaping cenoir.
                </p>
              </div>

              <div className="mt-8 w-full space-y-7">
                <label className="block w-full">
                  <div className="flex w-full items-center gap-3">
                    <span className="font-ui text-[14px] font-medium leading-[1.8] text-ink">
                      What worked well?
                    </span>
                  </div>
                  <div className="w-full">
                    <textarea
                      ref={feedbackClarityRef}
                      rows={1}
                      value={feedbackAnswers.clarity}
                      onChange={(event) =>
                        handleFeedbackFieldChange("clarity", event.target.value, event.currentTarget)
                      }
                      onKeyDown={(event) => handleFeedbackFieldKeyDown(event, "clarity")}
                      className="mt-2 h-[34px] w-full resize-none overflow-hidden rounded-[4px] border-0 bg-[#FBFBFA] px-3 py-2 font-ui text-[14px] font-normal leading-[1.6] text-meta outline-none"
                    />
                  </div>
                </label>

                <label className="block w-full">
                  <div className="flex w-full items-center gap-3">
                    <span className="font-ui text-[14px] font-medium leading-[1.8] text-ink">
                      What felt unclear and complete?
                    </span>
                  </div>
                  <div className="w-full">
                    <textarea
                      ref={feedbackQualityRef}
                      rows={1}
                      value={feedbackAnswers.quality}
                      onChange={(event) =>
                        handleFeedbackFieldChange("quality", event.target.value, event.currentTarget)
                      }
                      onKeyDown={(event) => handleFeedbackFieldKeyDown(event, "quality")}
                      className="mt-2 h-[34px] w-full resize-none overflow-hidden rounded-[4px] border-0 bg-[#FBFBFA] px-3 py-2 font-ui text-[14px] font-normal leading-[1.6] text-meta outline-none"
                    />
                  </div>
                </label>

                <label className="block w-full">
                  <div className="flex w-full items-center gap-3">
                    <span className="font-ui text-[14px] font-medium leading-[1.8] text-ink">
                      What should change first, or which feature would most improve the experience?
                    </span>
                  </div>
                  <div className="w-full">
                    <textarea
                      ref={feedbackTrustRef}
                      rows={1}
                      value={feedbackAnswers.trust}
                      onChange={(event) => handleFeedbackFieldChange("trust", event.target.value, event.currentTarget)}
                      onKeyDown={(event) => handleFeedbackFieldKeyDown(event, "trust")}
                      className="mt-2 h-[34px] w-full resize-none overflow-hidden rounded-[4px] border-0 bg-[#FBFBFA] px-3 py-2 font-ui text-[14px] font-normal leading-[1.6] text-meta outline-none"
                    />
                  </div>
                </label>

                <div className="pt-1">
                  <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const sentAt = new Date().toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                      setLastFeedbackSentAt(sentAt);
                      setFeedbackHistory((prev) => [
                        {
                          sentAt,
                          clarity: feedbackAnswers.clarity.trim(),
                          quality: feedbackAnswers.quality.trim(),
                          trust: feedbackAnswers.trust.trim(),
                        },
                        ...prev,
                      ]);
                      setFeedbackAnswers({
                        clarity: "",
                        quality: "",
                        trust: "",
                      });
                      window.requestAnimationFrame(() => {
                        if (feedbackClarityRef.current) autoResizeFeedbackField(feedbackClarityRef.current);
                        if (feedbackQualityRef.current) autoResizeFeedbackField(feedbackQualityRef.current);
                        if (feedbackTrustRef.current) autoResizeFeedbackField(feedbackTrustRef.current);
                      });
                    }}
                    disabled={!canSendFeedback}
                    className={`${settingsActionPillClass} ${!canSendFeedback ? "cursor-not-allowed opacity-50 hover:text-[#6F7381]" : ""}`}
                  >
                    send feedback
                  </button>
                  {lastFeedbackSentAt ? (
                    <p className="font-ui text-[13px] font-normal leading-5 text-meta">
                      Last feedback sent: {lastFeedbackSentAt}
                    </p>
                  ) : null}
                  {feedbackHistory.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setIsFeedbackHistoryOpen((current) => !current)}
                      className={expandTextButtonClass}
                    >
                      {isFeedbackHistoryOpen ? "hide feedback" : "show feedback"}
                      <span aria-hidden="true">{isFeedbackHistoryOpen ? "▴" : "▾"}</span>
                    </button>
                  ) : null}
                  </div>
                  {isFeedbackHistoryOpen && feedbackHistory.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {feedbackHistory.map((entry, index) => (
                        <div key={`${entry.sentAt}-${index}`} className="rounded-[4px] bg-[#FBFBFA] px-3 py-3">
                          <p className="font-ui text-[12px] font-normal leading-5 text-meta">{entry.sentAt}</p>
                          {entry.clarity ? (
                            <p className="mt-1 font-ui text-[13px] font-normal leading-[1.6] text-ink">
                              {entry.clarity}
                            </p>
                          ) : null}
                          {entry.quality ? (
                            <p className="mt-1 font-ui text-[13px] font-normal leading-[1.6] text-ink">
                              {entry.quality}
                            </p>
                          ) : null}
                          {entry.trust ? (
                            <p className="mt-1 font-ui text-[13px] font-normal leading-[1.6] text-ink">
                              {entry.trust}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
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
