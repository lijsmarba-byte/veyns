"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSignatureContourInline } from "@/components/unseen/ProfileSignatureContourInline";
import type { MockReferenceVisual, MockTasteCluster } from "@/data/mockUsers";
import { mockUsers } from "@/data/mockUsers";

type ProfileTab = "signature" | "reference-sets" | "quiet-constraints" | "feedback" | "settings";
type OverlaySection = "profile" | "settings" | "feedback" | "about";
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

function isProfileOverlayTab(value: string | null): value is "signature" | "reference-sets" | "quiet-constraints" {
  return value === "signature" || value === "reference-sets" || value === "quiet-constraints";
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
const PROFILE_HEADER_DIVIDER_TOP_PX = 96;
const PROFILE_HEADER_HEIGHT_PX = 97;
const PROFILE_HEADER_META_FOLD_BUFFER_PX = 38;

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embed") === "1";
  const rawOverlaySection = searchParams.get("overlaySection");
  const requestedProfileTab = searchParams.get("profileTab");
  const overlaySection: OverlaySection | null =
    rawOverlaySection === "profile" ||
    rawOverlaySection === "settings" ||
    rawOverlaySection === "feedback" ||
    rawOverlaySection === "about"
      ? rawOverlaySection
      : null;
  const backHref = searchParams.get("back") || "/gallery";
  const shouldMorphCloseIcon = !isEmbedded && searchParams.get("iconMorph") === "1";
  const requestedTab = searchParams.get("tab");
  const requestedEditFlow = searchParams.get("editFlow");
  const startsInCreateEditFlow = requestedEditFlow === "create";
  const embeddedInitialTab: ProfileTab =
    overlaySection === "settings"
      ? "settings"
      : overlaySection === "feedback" || overlaySection === "about"
        ? "feedback"
        : isProfileOverlayTab(requestedProfileTab)
          ? requestedProfileTab
          : "signature";
  const isCompactEmbeddedOverlay =
    isEmbedded && (overlaySection === "settings" || overlaySection === "feedback");
  const activeUser = mockUsers[0] ?? null;
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (isEmbedded) return embeddedInitialTab;
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
  const [isSettingsEditMode, setIsSettingsEditMode] = useState(() => isEmbedded && embeddedInitialTab === "settings");
  const [activeSettingsField, setActiveSettingsField] = useState<SettingsField | null>(null);
  const [settingsFieldDraft, setSettingsFieldDraft] = useState("");
  const [activeConstraintHint, setActiveConstraintHint] = useState<QuietConstraintAction | null>(null);
  const [newEditName, setNewEditName] = useState("");
  const [newEditReferences, setNewEditReferences] = useState<MockReferenceVisual[]>([]);
  const [renameDraft, setRenameDraft] = useState("");
  const [referenceSets, setReferenceSets] = useState<ReferenceSet[]>(
    () => buildReferenceSets(activeUser?.referenceSetForMainEdit ?? []),
  );
  const [isMainEditHintDismissedForAccount, setIsMainEditHintDismissedForAccount] = useState(() => {
    if (!activeUser || typeof window === "undefined") return false;
    const key = `unseen:main-edit-meta-dismissed:${activeUser.userId}`;
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
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
    if (!isCompactEmbeddedOverlay) return;

    let rafId = 0;
    const syncOverflow = () => {
      const root = document.documentElement;
      const body = document.body;
      const canScroll = root.scrollHeight - root.clientHeight > 1;
      const overflowY = canScroll ? "auto" : "hidden";
      root.style.overflowY = overflowY;
      body.style.overflowY = overflowY;
    };

    const scheduleSync = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncOverflow);
    };

    scheduleSync();
    window.addEventListener("resize", scheduleSync);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleSync);
      document.documentElement.style.overflowY = "";
      document.body.style.overflowY = "";
    };
  }, [
    isCompactEmbeddedOverlay,
    activeSettingsField,
    settingsFieldDraft,
    feedbackAnswers.clarity,
    feedbackAnswers.quality,
    feedbackAnswers.trust,
    feedbackHistory.length,
    isFeedbackHistoryOpen,
  ]);

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
    if (isEmbedded) {
      setShouldFoldHeaderMeta(false);
      return;
    }
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
  }, [isCompactHeaderLayout, activeTab, isEmbedded]);

  const clusters = useMemo(
    () => [...(activeUser?.tasteAttributes.clusters ?? [])].sort((a, b) => clusterWeight(b) - clusterWeight(a)),
    [activeUser],
  );
  const dominantCluster = clusters[0] ?? null;
  const shortSummary = limitSentences(activeUser?.tasteDescription.tasteThesis ?? "", 3);

  if (!activeUser) return null;

  const calibrationMonth = new Date(activeUser.lastCalibrationDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const issueLabel = String(activeUser.userId + mainEditRecalibrationCount).padStart(2, "0");
  const userIdLabel = String(activeUser.userId).padStart(3, "0");
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
  const overlayTitleClass = "font-ui text-[16px] font-medium leading-5 text-ink";
  const formFieldTitleClass = "font-ui text-[13px] font-medium leading-5 text-ink";
  const overlayInfoCardClass = "rounded-[6px] bg-[#F5F5F6] px-5 py-5";
  const overlayInputClass =
    "mt-2 h-9 w-full rounded-[4px] border border-line/80 bg-paper px-3 font-ui text-[13px] font-normal text-meta outline-none placeholder:text-meta/75";
  const overlayReadOnlyFieldClass =
    "mt-2 w-full rounded-[4px] border border-transparent bg-paper/65 px-3 py-2 text-left font-ui text-[13px] font-normal leading-[1.5] text-meta outline-none transition-colors duration-150 hover:text-meta";
  const profileTabHoverPillClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center -translate-x-[calc(50%-8px)] translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381]/55 bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out group-hover/tab:translate-y-0 group-hover/tab:opacity-100 group-focus-visible/tab:translate-y-0 group-focus-visible/tab:opacity-100";
  const constraintHoverPillClass =
    "pointer-events-none absolute bottom-[5px] left-full z-20 ml-[8px] inline-flex h-[29px] items-center justify-center translate-y-1 whitespace-nowrap rounded-[999px] border border-[#6F7381]/55 bg-[#6F7381] px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out group-hover/constraint:translate-y-0 group-hover/constraint:opacity-100 group-focus-within/constraint:translate-y-0 group-focus-within/constraint:opacity-100";
  const expandTextButtonClass =
    "inline-flex items-center gap-2 whitespace-nowrap border-0 bg-transparent p-0 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none";
  const isShortcutCreateFlowActive = isFocusedCreateFlow && isCreateEditOpen;
  const canSendFeedback =
    feedbackAnswers.clarity.trim().length > 0 ||
    feedbackAnswers.quality.trim().length > 0 ||
    feedbackAnswers.trust.trim().length > 0;
  const showSignatureSection = activeTab === "signature";
  const showReferenceSetsSection = activeTab === "reference-sets";
  const showConstraintsSection = activeTab === "quiet-constraints";
  const showSettingsSection = activeTab === "settings";
  const showFeedbackSection = activeTab === "feedback";
  const showAboutSection = showFeedbackSection && overlaySection === "about";
  const showFeedbackFormSection = showFeedbackSection && overlaySection !== "about";
  const hasSecondaryEdit = referenceSets.some((set) => set.id !== MAIN_EDIT_SET_ID);
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
    if (!hasSecondaryEdit && activeUser) {
      const key = `unseen:main-edit-meta-dismissed:${activeUser.userId}`;
      setIsMainEditHintDismissedForAccount(true);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // Ignore storage failures and keep in-memory state.
      }
    }
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
              <span>{newEditReferences.length} references</span>
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
      className={`relative z-[120] isolate bg-paper ${isEmbedded ? "min-h-0" : "min-h-screen"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {!isEmbedded ? (
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
      ) : null}

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        onChange={onUpload}
      />

      <section
        className={`mx-auto w-full max-w-[1333px] px-5 sm:px-10 ${
          isCompactEmbeddedOverlay ? "pb-0" : "pb-16"
        } ${isEmbedded ? "pt-0" : "pt-[116px]"}`}
      >
        {!isEmbedded ? (
          <div
            ref={fixedHeaderRef}
            className="fixed inset-x-0 top-0 z-40 mx-[calc(50%-50vw)] bg-paper px-5 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)] sm:px-10"
            style={{ height: `${PROFILE_HEADER_HEIGHT_PX}px` }}
          >
          <div className="relative h-full w-full">
            <div className="absolute left-0 text-left" style={{ top: `${PROFILE_HEADER_NAME_TOP_PX}px` }}>
              <h1
                className="m-0 text-left font-ui text-[20px] leading-none tracking-[-0.03em] text-ink sm:text-[26px]"
                style={{
                  fontFamily: "var(--font-meta-mono), monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {activeUser.name}
              </h1>
              <p
                ref={headerMetaRef}
                aria-hidden={shouldFoldHeaderMeta}
                className="m-0 mt-[14px] text-left font-ui text-[12px] font-bold leading-4 tracking-[0.02em] text-ink sm:mt-[8px]"
                style={{
                  fontFamily: "var(--font-meta-mono), monospace",
                  whiteSpace: "nowrap",
                  visibility: shouldFoldHeaderMeta ? "hidden" : "visible",
                }}
              >
                no. {userIdLabel} · calibrated {calibrationMonth} · Issue {issueLabel}
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
              className="absolute inset-x-0 h-px bg-[#ECEDEF] shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
              style={{ top: `${PROFILE_HEADER_DIVIDER_TOP_PX}px` }}
            />
          </div>
          </div>
        ) : null}

        {showSignatureSection ? (
          <section className="mt-10">
            <div className="mx-auto w-full px-10">
              <div
                className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-[10px]"
                style={{
                  backgroundColor: "#F5F5F6",
                  boxShadow: "0 10px 26px rgba(17,17,17,0.12)",
                }}
              >
                <div className="grid w-full gap-0 lg:grid-cols-[0.44fr_0.56fr]">
                  <div className="min-h-[392px] p-3 md:p-4" style={{ backgroundColor: "#F5F5F6" }}>
                    <div className="h-full min-h-[352px] rounded-[10px] bg-ink px-7 py-7 md:px-8 md:py-8">
                      <h2 className="mb-7 inline-flex w-full items-end justify-start text-[25px] leading-none text-paper">
                        <span className="font-ui font-normal tracking-[-0.06em]">{activeUser.name}</span>
                        <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                        <span className="ml-[1px] font-instrument italic tracking-[0.01em]">{signatureTitleDisplay}</span>
                      </h2>

                      <p className="max-w-[52ch] text-left font-ui text-[14px] font-normal leading-[1.8] text-paper">
                        {shortSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-[392px] items-center px-4 py-4 md:px-5 md:py-5" style={{ backgroundColor: "#F5F5F6" }}>
                    <div className="mx-auto w-[82%] overflow-visible rounded-[10px]">
                      <ProfileSignatureContourInline
                        user={activeUser}
                        backgroundColor="#F5F5F6"
                        exportArtifactContent={{
                          displayName: activeUser.name,
                          signatureTitle: signatureTitleDisplay,
                          narrative: shortSummary,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-4 flex w-full max-w-[1080px] items-center justify-end gap-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("unseen:signature-artifact-export", { detail: { mode: "save" } }),
                    )
                  }
                  className="inline-flex h-[31px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink"
                >
                  save
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("unseen:signature-artifact-export", { detail: { mode: "share" } }),
                    )
                  }
                  className="inline-flex h-[31px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink"
                >
                  share
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {showReferenceSetsSection ? (
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
                const shouldShowMainEditMetaHint = isMainEdit && !hasSecondaryEdit && !isMainEditHintDismissedForAccount;
                const previewColumns = getReferencePreviewColumns(viewportWidth);
                const previewRows = 1;
                const previewCount = previewColumns * previewRows;
                const visibleImages = isExpanded ? set.images : set.images.slice(0, previewCount);

                return (
                  <div key={set.id} className={setIndex === 0 ? "mt-12" : "mt-8"}>
                    <div className={`flex justify-between gap-8 ${shouldShowMainEditMetaHint ? "items-start" : "items-center"}`}>
                      <div className="flex min-w-0 items-center gap-3">
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
                          {shouldShowMainEditMetaHint ? (
                            <p className="mt-2 font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                              This is the core reference set behind the Main Edit. The personal Signature is shaped
                              from it. Additional Edits exist for distinct contexts.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 whitespace-nowrap font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                        <span>{set.images.length} References</span>
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

        {showReferenceSetsSection && pendingRebuildSet ? (
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

        {showReferenceSetsSection && pendingDoneSet ? (
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

        {showReferenceSetsSection && pendingDeleteSet && pendingDeleteSet.id !== MAIN_EDIT_SET_ID ? (
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

        {showConstraintsSection ? (
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

        {showSettingsSection ? (
          <div
            data-compact-overlay-content={isEmbedded ? "settings" : undefined}
            className={`mx-[calc(50%-50vw)] px-10 ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={`${isEmbedded ? "pt-10" : "mt-4"} w-full`}>
              <div className="w-full space-y-4">
                <article className={overlayInfoCardClass}>
                  <h2 className={overlayTitleClass}>Settings</h2>
                  <div className="mt-4 grid w-full gap-5">
                    <div>
                      <p className={formFieldTitleClass}>Name</p>
                      {activeSettingsField === "name" ? (
                        <>
                          <input
                            type="text"
                            value={settingsFieldDraft}
                            onChange={(event) => setSettingsFieldDraft(event.target.value)}
                            className={overlayInputClass}
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
                          className={overlayReadOnlyFieldClass}
                        >
                          {profileSettings.name}
                        </button>
                      )}
                    </div>

                    <div>
                      <p className={formFieldTitleClass}>Email</p>
                      {activeSettingsField === "email" ? (
                        <>
                          <input
                            type="email"
                            value={settingsFieldDraft}
                            onChange={(event) => setSettingsFieldDraft(event.target.value)}
                            className={overlayInputClass}
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
                          className={overlayReadOnlyFieldClass}
                        >
                          {profileSettings.email}
                        </button>
                      )}
                    </div>

                    <div>
                      <p className={formFieldTitleClass}>Password</p>
                      {activeSettingsField === "password" ? (
                        <>
                          <input
                            type="password"
                            value={settingsFieldDraft}
                            onChange={(event) => setSettingsFieldDraft(event.target.value)}
                            className={overlayInputClass}
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
                          className={`${overlayReadOnlyFieldClass} tracking-[0.1em]`}
                        >
                          ••••••
                        </button>
                      )}
                    </div>
                  </div>
                </article>
                <div className="flex w-full items-center justify-start gap-3">
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
              </div>
            </section>
          </div>
        ) : null}

        {showSettingsSection && isDeleteProfileDisclaimerOpen ? (
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

        {showAboutSection ? (
          <div className="mx-[calc(50%-50vw)] px-10">
            <section className="mt-10 w-full">
              <div className="w-full space-y-8 [&_h2]:text-[16px] [&_h3]:text-[13px] [&_p]:text-[13px] [&_li]:text-[13px] [&_th]:text-[12px] [&_td]:text-[12px]">
                <article className="rounded-[6px] bg-[#F5F5F6] px-6 py-6">
                  <h2 className="font-ui text-[18px] font-medium leading-6 text-ink">Impressum</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-ink">Operator of cenoir.co (the Service)</span>
                    <br />
                    J. A.
                    <br />
                    Sole proprietor, trading as "Cenoir"
                    <br />
                    Fritz-Fleiner-Weg 11
                    <br />
                    8044 Zurich
                    <br />
                    Switzerland
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-ink">Contact:</span> hello@cenoir.co
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Cenoir is operated as an unincorporated sole proprietorship. The operator is personally
                    responsible for the content of the Service.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Links to third-party websites are provided for convenience. The operator has no control over their
                    content and accepts no liability for it.
                  </p>
                  <p className="mt-4 font-ui text-[13px] font-normal leading-5 text-meta">Last updated: 22 April 2026</p>
                </article>

                <article className="rounded-[6px] bg-[#F5F5F6] px-6 py-6">
                  <h2 className="font-ui text-[18px] font-medium leading-6 text-ink">Privacy Policy</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-ink">Effective date:</span> 22 April 2026
                    <br />
                    <span className="font-medium text-ink">Controller:</span> J. A., sole proprietor trading as
                    "Cenoir", Fritz-Fleiner-Weg 11, 8044 Zurich, Switzerland
                    <br />
                    <span className="font-medium text-ink">Contact:</span> hello@cenoir.co
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    This policy explains how Cenoir - a private, invitation-only beta of a fashion-technology service
                    - handles your personal data. It is written to meet the Swiss FADP and, where applicable, the EU
                    GDPR.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">1. What we collect</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      <span className="font-medium text-ink">Account:</span> your email and a password (stored only
                      hashed). Optionally a display name.
                    </li>
                    <li>
                      <span className="font-medium text-ink">Profile inputs:</span> the preferences, tags, and
                      selections you give us while using the Service.
                    </li>
                    <li>
                      <span className="font-medium text-ink">Uploaded images:</span> photos you upload as inputs to
                      the Service.
                    </li>
                    <li>
                      <span className="font-medium text-ink">Usage and technical data:</span> actions you take in the
                      Service, device and browser info, IP address, and basic logs.
                    </li>
                    <li>
                      <span className="font-medium text-ink">Communications:</span> anything you send us by email or
                      in-product.
                    </li>
                  </ul>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We use strictly necessary cookies (session, CSRF, your cookie-preference) to run the Service. We
                    do not set analytics or marketing cookies during the private beta.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    2. Why we use it and on what basis
                  </h3>
                  <div className="mt-2 overflow-hidden rounded-[4px] border border-line/80">
                    <table className="w-full border-collapse text-left font-ui text-[13px] leading-[1.7] text-meta">
                      <thead className="bg-paper">
                        <tr>
                          <th className="border-b border-line/80 px-3 py-2 font-medium text-ink">Purpose</th>
                          <th className="border-b border-line/80 px-3 py-2 font-medium text-ink">Legal basis (GDPR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-b border-line/70 px-3 py-2">
                            Running your account and the core Service
                          </td>
                          <td className="border-b border-line/70 px-3 py-2">
                            Performance of a contract (Art. 6(1)(b))
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-line/70 px-3 py-2">
                            Processing your inputs to produce the Service's outputs
                          </td>
                          <td className="border-b border-line/70 px-3 py-2">
                            Performance of a contract; consent where required for biometric or sensitive data (Art.
                            9(2)(a))
                          </td>
                        </tr>
                        <tr>
                          <td className="border-b border-line/70 px-3 py-2">Security and abuse prevention</td>
                          <td className="border-b border-line/70 px-3 py-2">Legitimate interest (Art. 6(1)(f))</td>
                        </tr>
                        <tr>
                          <td className="border-b border-line/70 px-3 py-2">Responding to your messages</td>
                          <td className="border-b border-line/70 px-3 py-2">
                            Performance of a contract; legitimate interest
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Legal compliance (accounting, requests from authorities)</td>
                          <td className="px-3 py-2">Legal obligation (Art. 6(1)(c))</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We do not sell your data. We do not use it to make automated decisions with legal or similarly
                    significant effects about you.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">3. Automated processing</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Your inputs - including uploaded images and profile signals - are processed by proprietary and
                    third-party models to generate the Service's outputs. Where we use third-party providers, they are
                    contractually prohibited from using your inputs to train their own foundation models. You can ask
                    us to exclude your data from model-improvement use at any time at hello@cenoir.co.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">4. How long we keep it</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      Account data: for the life of your account, deleted or anonymised within 30 days of account
                      closure, except where we have a legal obligation to keep it longer (e.g. Swiss accounting
                      retention up to 10 years).
                    </li>
                    <li>Uploaded content and profile inputs: until you delete them or close your account.</li>
                    <li>Logs: up to 12 months.</li>
                  </ul>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">5. Who sees it</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Only the operator and sub-processors acting on written instructions (hosting, email, error
                    monitoring, inference infrastructure). A current list is available at hello@cenoir.co on request.
                    Where sub-processors are outside Switzerland or the EEA, transfers are protected by EU Standard
                    Contractual Clauses and the Swiss FDPIC addendum.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">6. Your rights</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You can ask us at any time to: access your data, correct it, delete it, restrict or object to
                    processing, port it, or withdraw consent where processing is based on consent. Email
                    hello@cenoir.co from the address on your account.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You can also complain to the Swiss Federal Data Protection and Information Commissioner (
                    <a
                      href="https://www.edoeb.admin.ch"
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-line/70 underline-offset-2 hover:text-ink"
                    >
                      edoeb.admin.ch
                    </a>
                    ) or, if you are in the EU, to your local supervisory authority.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    7. Security and children
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We use TLS, access controls, and standard security practices. No system is perfectly secure.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Cenoir is not intended for children under 16. Please do not use it if you are under 16.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">8. Changes</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    If we change this policy materially, we will update the date above and notify you by email or
                    in-product before the change takes effect.
                  </p>
                  <p className="mt-4 font-ui text-[13px] font-normal leading-5 text-meta">Last updated: 22 April 2026</p>
                </article>

                <article className="rounded-[6px] bg-[#F5F5F6] px-6 py-6">
                  <h2 className="font-ui text-[18px] font-medium leading-6 text-ink">Cenoir - Private Beta Terms</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-ink">Effective date:</span> 22 April 2026
                    <br />
                    <span className="font-medium text-ink">Operator:</span> J. A., sole proprietor trading as
                    "Cenoir" ("we", "us", "the Operator").
                    <br />
                    <span className="font-medium text-ink">Contact:</span> hello@cenoir.co
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    By accepting a Cenoir invitation, creating an account, or using Cenoir, you agree to these Beta
                    Terms and to our Privacy Policy. If you don't agree, don't use the Service.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">1. What Cenoir is</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Cenoir is a private, invitation-only beta of a fashion-technology service. It is pre-release and
                    experimental. Features, mechanics, and available content may change, break, or be withdrawn at any
                    time.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">2. Eligibility</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You may use Cenoir only if you are at least 16 years old, have legal capacity to enter into a
                    contract, and are not barred from using the Service under applicable law.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">3. Access is personal</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Your invitation and credentials are personal to you. Don't share them. You are responsible for
                    activity on your account. Tell us at hello@cenoir.co if you suspect unauthorised use.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    4. Visual References, and the licence you give us
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You may upload images and other inputs (together, "Visual References"). You keep ownership. You
                    grant us a worldwide, non-exclusive, royalty-free, sublicensable licence to host, store, process,
                    analyse, and display your Visual References solely to run and improve Cenoir, including by running
                    proprietary and third-party models over them.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You confirm that:
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      you have the rights to submit your Visual References and grant this licence, including for any
                      person or work shown;
                    </li>
                    <li>your Visual References do not infringe any third-party right or any law.</li>
                  </ul>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may remove Visual References at our discretion if we reasonably think they breach these Terms or
                    applicable law.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">5. Outputs are advisory</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Recommendations, scores, and other outputs produced by Cenoir are probabilistic and may contain
                    errors. They are informational only. You are solely responsible for any decision you make based on
                    them.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    6. What you agree not to do
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      reverse engineer or try to derive our source code or models, except as allowed by mandatory law;
                    </li>
                    <li>use bots, scrapers, or automated tools without our written permission;</li>
                    <li>
                      use Cenoir, its outputs, or data obtained from it to build or train competing products or
                      models;
                    </li>
                    <li>circumvent security or access controls;</li>
                    <li>do anything unlawful, infringing, harassing, or abusive.</li>
                  </ul>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    7. Confidentiality of the beta
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    The beta is non-public. Until we publicly announce a feature, please don't publish screenshots,
                    screen recordings, or detailed descriptions of the Service's interior (UI, copy, model behaviour)
                    or share internal roadmap information you learn through the beta. You can say you are a Cenoir
                    beta participant.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">8. Feedback</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    If you send us feedback, bug reports, or suggestions, you grant us a perpetual, irrevocable,
                    worldwide, royalty-free, sublicensable licence to use them in any way, without obligation to
                    credit or compensate you.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    9. We may reset or delete beta data
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may reset, export, or delete beta data at any time - for example when the beta ends or when we
                    transition to general release. We'll try to give reasonable notice.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    10. Commissions and retailer partnerships
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    During the private beta, Cenoir does not charge users and does not receive any commission,
                    referral, or affiliate payment of any kind.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    In the future, Cenoir may receive a commission, referral fee, or comparable transfer fee from
                    retailers when a user acquires an item through a retailer that is part of the Cenoir network.
                    Where this is the case:
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>the fee is paid out of the retailer's margin. It is not added on top of the price you see;</li>
                    <li>
                      using Cenoir does not change the price you pay the retailer compared to buying directly;
                    </li>
                    <li>
                      the commercial arrangement between Cenoir and any retailer can be independently verified by a
                      qualified third party on reasonable request.
                    </li>
                  </ul>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Recommendations, rankings, and outputs inside Cenoir are always generated on the basis of best fit
                    and similarity to your profile and inputs. They are not ranked, filtered, weighted, or otherwise
                    biased by any commercial relationship between Cenoir and any retailer.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    If and when commission relationships become active, we will disclose them clearly within the
                    Service and update these Terms accordingly.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">11. No warranties</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    To the fullest extent permitted by law, Cenoir is provided "as is" and "as available", without any
                    warranty, express or implied. We do not warrant uninterrupted availability, accuracy, security, or
                    fitness for any purpose.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Nothing here excludes liability that cannot be excluded under mandatory Swiss or EU consumer law,
                    nor liability for wilful misconduct or gross negligence.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    12. Limitation of liability
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    To the maximum extent permitted by law, we are not liable for any indirect, incidental, special,
                    or consequential damages, or for loss of profits, data, or goodwill. Our total aggregate liability
                    for all claims in any 12-month period is capped at CHF 100. Liability for wilful misconduct, gross
                    negligence, or personal injury is not limited.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    13. Suspension and termination
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may suspend or terminate your access at any time, with or without notice, if you breach these
                    Terms, if your use creates a legal or security risk, or if we end the beta. You can stop using the
                    Service at any time and request deletion of your account at hello@cenoir.co.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Sections on Visual References licence, Feedback, Confidentiality, No Warranties, and Limitation of
                    Liability survive termination.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">14. Changes</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may change these Beta Terms. Material changes will be announced by email or in-product with
                    reasonable notice. Continued use after they take effect means you accept them.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-ink">
                    15. Governing law and jurisdiction
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    These Beta Terms are governed by Swiss law, excluding its conflict-of-law rules and the CISG. Place
                    of jurisdiction is Zurich, Switzerland, subject to mandatory consumer-protection rules (including
                    the right of EU/Swiss consumers to sue at their place of residence).
                  </p>
                  <p className="mt-4 font-ui text-[13px] font-normal leading-5 text-meta">Last updated: 22 April 2026</p>
                </article>
              </div>
            </section>
          </div>
        ) : null}

        {showFeedbackFormSection ? (
          <div
            data-compact-overlay-content={isEmbedded ? "feedback" : undefined}
            className={`mx-[calc(50%-50vw)] px-10 ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={`${isEmbedded ? "pt-10" : "mt-10"} w-full`}>
              <div className="w-full space-y-4">
                <article className={overlayInfoCardClass}>
                  <h2 className={overlayTitleClass}>Feedback</h2>
                  <p className="mt-3 w-full font-ui text-[13px] font-normal leading-[1.7] text-meta">
                    Your notes are anonymous and used only to improve clarity, quality, and trust in the experience.
                    Thank you for shaping cenoir.
                  </p>
                  <div className="mt-4 w-full space-y-5">
                    <label className="block w-full">
                      <div className="flex w-full items-center gap-3">
                        <span className={formFieldTitleClass}>What worked well?</span>
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
                          className="mt-2 h-[32px] w-full resize-none overflow-hidden rounded-[4px] border border-line/80 bg-paper px-3 py-2 font-ui text-[13px] font-normal leading-[1.5] text-meta outline-none"
                        />
                      </div>
                    </label>

                    <label className="block w-full">
                      <div className="flex w-full items-center gap-3">
                        <span className={formFieldTitleClass}>What felt unclear and complete?</span>
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
                          className="mt-2 h-[32px] w-full resize-none overflow-hidden rounded-[4px] border border-line/80 bg-paper px-3 py-2 font-ui text-[13px] font-normal leading-[1.5] text-meta outline-none"
                        />
                      </div>
                    </label>

                    <label className="block w-full">
                      <div className="flex w-full items-center gap-3">
                        <span className={formFieldTitleClass}>
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
                          className="mt-2 h-[32px] w-full resize-none overflow-hidden rounded-[4px] border border-line/80 bg-paper px-3 py-2 font-ui text-[13px] font-normal leading-[1.5] text-meta outline-none"
                        />
                      </div>
                    </label>
                  </div>
                </article>
                <div>
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
                        <div key={`${entry.sentAt}-${index}`} className="rounded-[4px] border border-line/80 bg-paper px-3 py-3">
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
