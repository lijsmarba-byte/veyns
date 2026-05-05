"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ProfileSignatureContourInline } from "@/components/unseen/ProfileSignatureContourInline";
import type { MockReferenceVisual, MockTasteCluster } from "@/data/mockUsers";
import { mockUsers } from "@/data/mockUsers";

type ProfileTab = "signature" | "reference-sets" | "quiet-constraints" | "feedback" | "settings";
type OverlaySection = "profile" | "settings" | "feedback" | "about";
type SettingsField = "email" | "name" | "password";
type PriceCategory = "outer" | "upper" | "lower" | "silhouette" | "ground" | "artifacts";
type LetterSize = "XXS" | "XS" | "S" | "M" | "L" | "XL" | "XXL";
type QuietSizingCategory = "clothing" | "pants" | "shoes";
type ShoeSize = "35" | "35.5" | "36" | "36.5" | "37" | "37.5" | "38" | "38.5" | "39" | "39.5" | "40" | "40.5" | "41" | "41.5" | "42" | "42.5" | "43" | "43.5" | "44" | "44.5" | "45" | "45.5" | "46";
type PantSize = string;
type GenderMode = "all" | "men" | "women";
type GenderExceptionMode = "none" | "include-men" | "include-women";
type PreOwnedPreference = "default" | "prefer" | "only" | "exclude";

type QuietConstraints = {
  price: Record<PriceCategory, { floor: number; ceiling: number }>;
  sizing: {
    clothing: LetterSize[];
    pants: PantSize[];
    shoes: ShoeSize[];
  };
  gender: {
    main: GenderMode;
    exceptionMode: GenderExceptionMode;
    exceptionCategories: PriceCategory[];
  };
  preOwned: PreOwnedPreference;
  updatedAt: string;
  activeFromIssue: number;
};

type QuietConstraintEditor = {
  section: "price";
  category: PriceCategory;
} | {
  section: "sizing";
  category: QuietSizingCategory;
} | {
  section: "gender";
} | {
  section: "pre-owned";
};
type ConstraintsPageVersion = "coming-soon" | "active";
type SignatureArtifactActionVersion = "coming-soon" | "active";
type ComingSoonActionId =
  | "signature-save"
  | "signature-share"
  | "constraints-price"
  | "constraints-sizing"
  | "constraints-gender"
  | "constraints-pre-owned";

const QUIET_CONSTRAINT_STORAGE_KEY = "unseen:quiet-constraints";
const QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE = 2;

const CATEGORY_LABELS: Record<PriceCategory, string> = {
  outer: "Outer",
  upper: "Upper",
  lower: "Lower",
  silhouette: "Silhouette",
  ground: "Ground",
  artifacts: "Artifacts",
};
const PRICE_CATEGORIES: PriceCategory[] = ["outer", "upper", "lower", "silhouette", "ground", "artifacts"];
const SIZING_CATEGORIES: QuietSizingCategory[] = ["clothing", "pants", "shoes"];
const LETTER_SIZES: LetterSize[] = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];
const PANTS_SIZES: PantSize[] = ["32", "34", "36", "38", "40", "42", "44"];
const SHOE_SIZES: ShoeSize[] = [
  "35",
  "35.5",
  "36",
  "36.5",
  "37",
  "37.5",
  "38",
  "38.5",
  "39",
  "39.5",
  "40",
  "40.5",
  "41",
  "41.5",
  "42",
  "42.5",
  "43",
  "43.5",
  "44",
  "44.5",
  "45",
  "45.5",
  "46",
];
const QUIET_SIZE_LABELS: Record<QuietSizingCategory, string> = {
  clothing: "Clothing",
  pants: "Pants",
  shoes: "Shoes",
};
const GENDER_OPTIONS: { value: GenderMode; label: string }[] = [
  { value: "all", label: "all gender" },
  { value: "women", label: "women" },
  { value: "men", label: "men" },
];
const PRE_OWNED_OPTIONS: { value: PreOwnedPreference; label: string }[] = [
  { value: "default", label: "default" },
  { value: "prefer", label: "prefer" },
  { value: "only", label: "only" },
  { value: "exclude", label: "exclude" },
];
const PRICE_RANGE_STEPS: Record<PriceCategory, number> = {
  outer: 100,
  upper: 50,
  lower: 100,
  silhouette: 100,
  ground: 100,
  artifacts: 500,
};
const PRICE_RANGE_LIMITS: Record<PriceCategory, { min: number; max: number }> = {
  outer: { min: 0, max: 6000 },
  upper: { min: 0, max: 2000 },
  lower: { min: 0, max: 2500 },
  silhouette: { min: 0, max: 6000 },
  ground: { min: 0, max: 6000 },
  artifacts: { min: 0, max: 20000 },
};
// Switch constraints experience here: "coming-soon" | "active".
const CONSTRAINTS_PAGE_VERSION: ConstraintsPageVersion = "coming-soon";
// Switch signature artifact save/share actions here: "coming-soon" | "active".
const SIGNATURE_ARTIFACT_ACTION_VERSION: SignatureArtifactActionVersion = "coming-soon";

const womensClothingConversionTable = [
  { standard: "XXS", numeric: "0", eu: 32, fr: 34, it: 36, uk: "4", us: "0" },
  { standard: "XS", numeric: "1", eu: 34, fr: 36, it: 38, uk: "6", us: "2" },
  { standard: "S", numeric: "2", eu: 36, fr: 38, it: 40, uk: "8", us: "4" },
  { standard: "M", numeric: "3", eu: 38, fr: 40, it: 42, uk: "10", us: "6" },
  { standard: "L", numeric: "4", eu: 40, fr: 42, it: 44, uk: "12", us: "8" },
  { standard: "XL", numeric: "5", eu: 42, fr: 44, it: 46, uk: "14", us: "10" },
  { standard: "XXL", numeric: "6", eu: 44, fr: 46, it: 48, uk: "16", us: "12" },
] as const;

const mensClothingConversionTable = [
  { standard: "XS", numeric: "1", eu: 44, uk: "34", us: "34" },
  { standard: "S", numeric: "2", eu: 46, uk: "36", us: "36" },
  { standard: "M", numeric: "3", eu: 48, uk: "38", us: "38" },
  { standard: "L", numeric: "4", eu: 50, uk: "40", us: "40" },
  { standard: "XL", numeric: "5", eu: 52, uk: "42", us: "42" },
  { standard: "XXL", numeric: "6", eu: 54, uk: "44", us: "44" },
] as const;

const womensShoeConversionTable = [
  { eu: 35, fr: 35, it: 34, uk: "2.5", us: 5 },
  { eu: 36, fr: 36, it: 35, uk: "3.5", us: 6 },
  { eu: 37, fr: 37, it: 36, uk: "4.5", us: 7 },
  { eu: 38, fr: 38, it: 37, uk: "5.5", us: 8 },
  { eu: 39, fr: 39, it: 38, uk: "6.5", us: 9 },
  { eu: 40, fr: 40, it: 39, uk: "7.5", us: 10 },
  { eu: 41, fr: 41, it: 40, uk: "8.5", us: 11 },
] as const;

const mensShoeConversionTable = [
  { eu: 40, it: 40, uk: "6", us: 7 },
  { eu: 41, it: 41, uk: "7", us: 8 },
  { eu: 42, it: 42, uk: "8", us: 9 },
  { eu: 43, it: 43, uk: "9", us: 10 },
  { eu: 44, it: 44, uk: "10", us: 11 },
  { eu: 45, it: 45, uk: "11", us: 12 },
  { eu: 46, it: 46, uk: "12", us: 13 },
] as const;

const womensPantsConversionTable = [
  { standard: "XXS", waistRange: "24-25", eu: 32, example: "24/30 or 24/32" },
  { standard: "XS", waistRange: "26-27", eu: 34, example: "26/32" },
  { standard: "S", waistRange: "27-28", eu: 36, example: "27/32" },
  { standard: "M", waistRange: "29-30", eu: 38, example: "29/32" },
  { standard: "L", waistRange: "31-32", eu: 40, example: "31/32" },
  { standard: "XL", waistRange: "32-33", eu: 42, example: "32/32" },
] as const;

const mensPantsConversionTable = [
  { standard: "XS", waistRange: "28-29", example: "28/32" },
  { standard: "S", waistRange: "30-31", example: "30/32" },
  { standard: "M", waistRange: "32-33", example: "32/32" },
  { standard: "L", waistRange: "34-35", example: "34/32" },
  { standard: "XL", waistRange: "36-37", example: "36/34" },
  { standard: "XXL", waistRange: "38-39", example: "38/34" },
] as const;

const DEFAULT_QUIET_CONSTRAINTS: QuietConstraints = {
  price: {
    outer: { floor: 200, ceiling: 4500 },
    upper: { floor: 50, ceiling: 800 },
    lower: { floor: 80, ceiling: 1400 },
    silhouette: { floor: 150, ceiling: 3500 },
    ground: { floor: 100, ceiling: 1800 },
    artifacts: { floor: 100, ceiling: 14000 },
  },
  sizing: {
    clothing: [],
    pants: [],
    shoes: [],
  },
  gender: {
    main: "all",
    exceptionMode: "none",
    exceptionCategories: [],
  },
  preOwned: "default",
  updatedAt: "",
  activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
};

function isLetterSize(value: string): value is LetterSize {
  return (LETTER_SIZES as ReadonlyArray<string>).includes(value);
}
function isPantSize(value: string): value is PantSize {
  return PANTS_SIZES.includes(value);
}
function isShoeSize(value: string): value is ShoeSize {
  return (SHOE_SIZES as ReadonlyArray<string>).includes(value);
}
function isGenderMode(value: string): value is GenderMode {
  return value === "all" || value === "men" || value === "women";
}
function isGenderExceptionMode(value: string): value is GenderExceptionMode {
  return value === "none" || value === "include-men" || value === "include-women";
}
function isPreOwned(value: string): value is PreOwnedPreference {
  return value === "default" || value === "prefer" || value === "only" || value === "exclude";
}
function isPriceCategory(value: string): value is PriceCategory {
  return PRICE_CATEGORIES.includes(value as PriceCategory);
}
function parseConstraintStringArray(raw: unknown): string[] {
  if (typeof raw === "string") return raw.trim() ? [raw.trim()] : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseQuietConstraints(raw: string | null, fallback: QuietConstraints): QuietConstraints {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return fallback;
    }

    const next: QuietConstraints = {
      ...fallback,
      price: {
        ...fallback.price,
      },
      sizing: {
        ...fallback.sizing,
      },
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };

    if (typeof parsed.activeFromIssue === "number" && Number.isFinite(parsed.activeFromIssue)) {
      next.activeFromIssue = parsed.activeFromIssue;
    }

    if (
      parsed.price &&
      typeof parsed.price === "object" &&
      !Array.isArray(parsed.price)
    ) {
      PRICE_CATEGORIES.forEach((category) => {
        const nextValue = parsed.price[category];
        const floor = Number(nextValue?.floor);
        const ceiling = Number(nextValue?.ceiling);
        if (Number.isFinite(floor) && Number.isFinite(ceiling) && floor >= 0 && ceiling >= 0) {
          next.price[category] = {
            floor: Math.round(floor),
            ceiling: Math.round(ceiling),
          };
        }
      });
    }

    if (parsed.sizing && typeof parsed.sizing === "object" && !Array.isArray(parsed.sizing)) {
      const parsedSizing = parsed.sizing as Record<string, unknown>;
      const legacySizing = parsedSizing as Partial<
        Record<PriceCategory | QuietSizingCategory | "outer" | "upper" | "lower" | "silhouette" | "ground", unknown>
      >;

      const legacyClothingValues = parseConstraintStringArray(
        (legacySizing.clothing as unknown) ??
          parsedSizing.upper ??
          parsedSizing.outer ??
          parsedSizing.lower ??
          parsedSizing.silhouette ??
          parsedSizing.ground,
      );
      if (legacyClothingValues[0] && isLetterSize(legacyClothingValues[0])) {
        next.sizing.clothing = legacyClothingValues.filter(isLetterSize);
      }

      const pantsValues = parseConstraintStringArray(legacySizing.pants).filter(isPantSize);
      if (pantsValues.length > 0) next.sizing.pants = pantsValues;
      const shoeValues = parseConstraintStringArray(legacySizing.shoes).filter(isShoeSize);
      if (shoeValues.length > 0) next.sizing.shoes = shoeValues;
      if (
        typeof parsedSizing.gender === "object" &&
        parsedSizing.gender &&
        !Array.isArray(parsedSizing.gender)
      ) {
        const rawGender = parsedSizing.gender as Record<string, unknown>;
        const main = typeof rawGender.main === "string" ? rawGender.main : "";
        const exceptionMode = typeof rawGender.exceptionMode === "string" ? rawGender.exceptionMode : "";
        const preOwned = typeof parsedSizing.preOwned === "string" ? parsedSizing.preOwned : "";
        const exceptionCategories = parseConstraintStringArray(rawGender.exceptionCategories).filter(isPriceCategory);
        if (isGenderMode(main)) next.gender.main = main;
        if (isGenderExceptionMode(exceptionMode)) {
          next.gender.exceptionMode = exceptionMode;
        }
        next.gender.exceptionCategories = exceptionCategories;
        if (isPreOwned(preOwned)) {
          next.preOwned = preOwned;
        }
      }
    }

    return next;
  } catch {
    return fallback;
  }
}

function formatPriceValue(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function safeIntegerInputValue(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function interpolateClamped(
  value: number,
  start: number,
  end: number,
  startValue: number,
  endValue: number,
): number {
  if (end <= start) return endValue;
  const progress = clampNumber((value - start) / (end - start), 0, 1);
  return startValue + (endValue - startValue) * progress;
}

function snapToStep(value: number, min: number, step: number): number {
  if (step <= 0) return value;
  const relative = value - min;
  return min + Math.round(relative / step) * step;
}

function labelForPriceCategory(category: PriceCategory): string {
  return CATEGORY_LABELS[category];
}

function labelForSizingCategory(category: QuietSizingCategory): string {
  return QUIET_SIZE_LABELS[category];
}

function getGenderInclusionOption(main: GenderMode): Exclude<GenderExceptionMode, "none"> | null {
  if (main === "women") return "include-men";
  if (main === "men") return "include-women";
  return null;
}

function getGenderInclusionLabel(main: GenderMode): string | null {
  if (main === "women") return "include men";
  if (main === "men") return "include women";
  return null;
}

function formatGenderMainValue(main: GenderMode): string {
  if (main === "all") return "all gender";
  return main;
}

function formatGenderInclusionValue(gender: QuietConstraints["gender"]): string {
  const inclusionOption = getGenderInclusionOption(gender.main);
  if (!inclusionOption || gender.exceptionMode === "none" || gender.exceptionMode !== inclusionOption) {
    return "none";
  }
  return getGenderInclusionLabel(gender.main) ?? "none";
}

function formatGenderCategoryValue(categories: PriceCategory[]): string {
  if (categories.length === 0) return "—";
  return categories.map((category) => labelForPriceCategory(category)).join(", ");
}

function mapProfileGenderToGenderMode(value: string | null | undefined): GenderMode {
  if (value === "woman" || value === "women" || value === "female") return "women";
  if (value === "man" || value === "men" || value === "male") return "men";
  return "all";
}

function formatSizingValue(category: QuietSizingCategory, value: string[]): string {
  if (value.length === 0) return "—";
  return value.join(", ");
}


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
type PriceDragState = {
  category: PriceCategory;
  edge: "floor" | "ceiling";
} | null;

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
const MOBILE_PROFILE_HEADER_NAME_TOP_PX = 22;
const MOBILE_PROFILE_CLOSE_TOP_PX = 26;
const MOBILE_PROFILE_HEADER_NAV_TOP_PX = 36;
const MOBILE_PROFILE_HEADER_DIVIDER_TOP_PX = 74;
const MOBILE_PROFILE_HEADER_HEIGHT_PX = 75;
const MOBILE_PROFILE_CONTENT_TOP_PX = 76;

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
  const defaultConstraintGenderMain = mapProfileGenderToGenderMode(activeUser?.profileGender);
  const defaultQuietConstraints = useMemo<QuietConstraints>(
    () => ({
      ...DEFAULT_QUIET_CONSTRAINTS,
      price: { ...DEFAULT_QUIET_CONSTRAINTS.price },
      sizing: {
        clothing: [...DEFAULT_QUIET_CONSTRAINTS.sizing.clothing],
        pants: [...DEFAULT_QUIET_CONSTRAINTS.sizing.pants],
        shoes: [...DEFAULT_QUIET_CONSTRAINTS.sizing.shoes],
      },
      gender: {
        main: defaultConstraintGenderMain,
        exceptionMode: "none",
        exceptionCategories: [],
      },
      preOwned: DEFAULT_QUIET_CONSTRAINTS.preOwned,
      updatedAt: DEFAULT_QUIET_CONSTRAINTS.updatedAt,
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }),
    [defaultConstraintGenderMain],
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (isEmbedded) return embeddedInitialTab;
    if (isProfileTab(requestedTab)) return requestedTab;
    return startsInCreateEditFlow ? "reference-sets" : "signature";
  });
  const [editingSetIds, setEditingSetIds] = useState<Record<string, boolean>>({});
  const [expandedSetIds, setExpandedSetIds] = useState<Record<string, boolean>>({});
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
  const [constraints, setConstraints] = useState<QuietConstraints>(defaultQuietConstraints);
  const [activeConstraintEditor, setActiveConstraintEditor] = useState<QuietConstraintEditor | null>(null);
  const [activeConstraintSectionEditor, setActiveConstraintSectionEditor] = useState<"price" | "sizing" | null>(null);
  const [editingPriceRanges, setEditingPriceRanges] = useState<QuietConstraints["price"]>(defaultQuietConstraints.price);
  const [editingSizingDraft, setEditingSizingDraft] = useState<QuietConstraints["sizing"]>(defaultQuietConstraints.sizing);
  const [editingPriceFloor, setEditingPriceFloor] = useState("");
  const [editingPriceCeiling, setEditingPriceCeiling] = useState("");
  const [editingSizingValues, setEditingSizingValues] = useState<string[]>([]);
  const [editingSizingCategory, setEditingSizingCategory] = useState<QuietSizingCategory | null>(null);
  const [editingGenderMain, setEditingGenderMain] = useState<GenderMode>(defaultConstraintGenderMain);
  const [editingGenderExceptionMode, setEditingGenderExceptionMode] = useState<GenderExceptionMode>("none");
  const [editingGenderExceptionCategories, setEditingGenderExceptionCategories] = useState<PriceCategory[]>([]);
  const [editingPreOwnedPreference, setEditingPreOwnedPreference] = useState<PreOwnedPreference>("default");
  const [editingFieldShake, setEditingFieldShake] = useState<"floor" | "ceiling" | null>(null);
  const [activeComingSoonActionId, setActiveComingSoonActionId] = useState<ComingSoonActionId | null>(null);
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [isConversionMenuOpen, setIsConversionMenuOpen] = useState(false);
  const [isResetConstraintsConfirmOpen, setIsResetConstraintsConfirmOpen] = useState(false);
  const [newEditName, setNewEditName] = useState("");
  const [newEditReferences, setNewEditReferences] = useState<MockReferenceVisual[]>([]);
  const [renameDraft, setRenameDraft] = useState("");
  const [createEditSource, setCreateEditSource] = useState<"profile" | "shortcut" | null>(
    startsInCreateEditFlow ? "shortcut" : null,
  );
  const [referenceSets, setReferenceSets] = useState<ReferenceSet[]>(
    () => buildReferenceSets(activeUser?.referenceSetForMainEdit ?? []),
  );
  const [minimumReferenceDisclaimerSetIds, setMinimumReferenceDisclaimerSetIds] = useState<Record<string, boolean>>({});
  const [isMainEditHintDismissedForAccount, setIsMainEditHintDismissedForAccount] = useState(false);
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
  const profileRootRef = useRef<HTMLElement | null>(null);
  const headerMetaRef = useRef<HTMLParagraphElement | null>(null);
  const headerNavRef = useRef<HTMLDivElement | null>(null);
  const createActionRowRef = useRef<HTMLDivElement | null>(null);
  const createActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryActionsRowRef = useRef<HTMLDivElement | null>(null);
  const constraintHintTimeoutRef = useRef<number | null>(null);
  const comingSoonActionTimeoutRef = useRef<number | null>(null);
  const newEditUploadPulseTimeoutRef = useRef<number | null>(null);
  const conversionPopoverRef = useRef<HTMLDivElement | null>(null);
  const conversionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const conversionMenuRef = useRef<HTMLDivElement | null>(null);
  const priceSliderTrackRefs = useRef<Record<PriceCategory, HTMLDivElement | null>>({
    outer: null,
    upper: null,
    lower: null,
    silhouette: null,
    ground: null,
    artifacts: null,
  });
  const constraintsStorageKeyRef = useRef<string>(`${QUIET_CONSTRAINT_STORAGE_KEY}:${activeUser?.userId ?? "default"}`);
  const [draggingPrice, setDraggingPrice] = useState<PriceDragState>(null);
  const isCompactHeaderLayout = viewportWidth < 980;
  const isMobileProfileViewport = viewportWidth < 768;
  const isMobileEmbedded = isEmbedded && viewportWidth < 768;
  const isMobileProfileHeader = !isEmbedded && viewportWidth < 768;
  const isMobileMenuPageEmbedded =
    isMobileEmbedded &&
    (overlaySection === "settings" || overlaySection === "feedback" || overlaySection === "about");
  const resolvedProfileHeaderNameTopPx = isMobileProfileHeader
    ? MOBILE_PROFILE_HEADER_NAME_TOP_PX
    : PROFILE_HEADER_NAME_TOP_PX;
  const resolvedProfileHeaderNavTopPx = isMobileProfileHeader
    ? MOBILE_PROFILE_HEADER_NAV_TOP_PX
    : PROFILE_HEADER_NAV_TOP_PX;
  const resolvedProfileHeaderDividerTopPx = isMobileProfileHeader
    ? MOBILE_PROFILE_HEADER_DIVIDER_TOP_PX
    : PROFILE_HEADER_DIVIDER_TOP_PX;
  const resolvedProfileHeaderHeightPx = isMobileProfileHeader
    ? MOBILE_PROFILE_HEADER_HEIGHT_PX
    : PROFILE_HEADER_HEIGHT_PX;
  const resolvedProfileContentTopPx = isMobileProfileHeader ? MOBILE_PROFILE_CONTENT_TOP_PX : 116;
  const referenceHeaderTextSizeClass = "text-[25px] max-[767px]:text-[24px]";
  const constraintsContentTranslateXPx = isEmbedded
    ? Math.round(interpolateClamped(viewportWidth, 900, 1620, 0, 14))
    : viewportWidth >= 768
      ? 128
      : 0;
  const constraintsContentMaxWidthPx = isEmbedded
    ? Math.round(interpolateClamped(viewportWidth, 980, 1620, 860, 920))
    : 960;
  const embeddedSignaturePanelMaxWidthPx = isMobileEmbedded ? Math.max(0, viewportWidth - 32) : 900;

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
    return () => {
      if (comingSoonActionTimeoutRef.current !== null) {
        window.clearTimeout(comingSoonActionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    const key = `unseen:main-edit-meta-dismissed-profile-create:${activeUser.userId}`;
    try {
      setIsMainEditHintDismissedForAccount(window.localStorage.getItem(key) === "1");
    } catch {
      setIsMainEditHintDismissedForAccount(false);
    }
  }, [activeUser]);

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
    if (!activeUser) return;
    const key = `${QUIET_CONSTRAINT_STORAGE_KEY}:${activeUser.userId}`;
    constraintsStorageKeyRef.current = key;
    try {
      const stored = window.localStorage.getItem(key);
      const parsed = parseQuietConstraints(stored, defaultQuietConstraints);
      const shouldBootstrapGenderFromProfile =
        parsed.updatedAt.trim().length === 0 && parsed.gender.main !== defaultConstraintGenderMain;
      if (shouldBootstrapGenderFromProfile) {
        setConstraints({
          ...parsed,
          gender: {
            main: defaultConstraintGenderMain,
            exceptionMode: "none",
            exceptionCategories: [],
          },
        });
      } else {
        setConstraints(parsed);
      }
    } catch {
      setConstraints(defaultQuietConstraints);
    }
  }, [activeUser, defaultConstraintGenderMain, defaultQuietConstraints]);

  useEffect(() => {
    if (!activeUser) return;
    if (constraintsStorageKeyRef.current !== `${QUIET_CONSTRAINT_STORAGE_KEY}:${activeUser.userId}`) {
      constraintsStorageKeyRef.current = `${QUIET_CONSTRAINT_STORAGE_KEY}:${activeUser.userId}`;
    }
    try {
      window.localStorage.setItem(constraintsStorageKeyRef.current, JSON.stringify(constraints));
    } catch {
      // Ignore storage failures.
    }
  }, [activeUser, constraints]);

  useEffect(() => {
    if (!isConversionOpen && !isConversionMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeConstraintConversion();
      closeConversionMenu();
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !conversionPopoverRef.current?.contains(target) &&
        !conversionTriggerRef.current?.contains(target) &&
        !conversionMenuRef.current?.contains(target)
      ) {
        closeConversionMenu();
        setIsConversionMenuOpen(false);
        closeConstraintConversion();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [isConversionOpen, isConversionMenuOpen]);

  useEffect(() => {
    if (!isConversionOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const prevRootOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prevRootOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [isConversionOpen]);

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
    if (isEmbedded) return;
    const raf = window.requestAnimationFrame(() => {
      feedbackClarityRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeTab, isEmbedded]);

  useEffect(() => {
    if (!isMobileMenuPageEmbedded) return;

    let startX = 0;
    let startY = 0;
    let startTarget: EventTarget | null = null;

    const shouldIgnoreSwipeTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true']"));

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTarget = event.target;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch || shouldIgnoreSwipeTarget(startTarget)) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const isBackSwipe = deltaX >= 72 && Math.abs(deltaY) <= 46 && deltaX > Math.abs(deltaY) * 1.6;
      if (!isBackSwipe) return;

      window.parent.dispatchEvent(new CustomEvent("unseen:mobile-menu-page-back"));
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobileMenuPageEmbedded]);

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
    if (isMobileProfileHeader) {
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
  }, [isCompactHeaderLayout, activeTab, isEmbedded, isMobileProfileHeader]);

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
    `inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] md:h-[33px] ${
      isEmbedded ? "bg-[#F5F5F6]" : "bg-[#F5F5F6]"
    } px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink md:px-4 md:text-[13px]`;
  const settingsDeletePillClass =
    `inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] md:h-[33px] ${
      isEmbedded ? "bg-[#F5F5F6]" : "bg-[#F5F5F6]"
    } px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] outline-none transition-colors duration-150 hover:border-[#D94343] hover:bg-[#D94343] hover:text-paper focus:outline-none focus-visible:outline-none focus-visible:ring-0 md:px-4 md:text-[13px]`;
  const settingsDangerPillClass =
    "inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#D94343] bg-[#D94343] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-paper shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] outline-none transition-colors duration-150 hover:border-[#B92F2F] hover:bg-[#B92F2F] focus:outline-none focus-visible:outline-none focus-visible:ring-0 md:h-[33px] md:px-4 md:text-[13px]";
  const overlayTitleClass = "font-ui text-[16px] font-medium leading-5 text-ink";
  const formFieldTitleClass = "font-ui text-[13px] font-medium leading-5 text-meta";
  const embeddedProfileContentClass = isEmbedded
    ? "mx-auto w-full max-w-[940px] max-[767px]:max-w-none"
    : "w-full";
  const overlayInfoCardClass = isMobileEmbedded
    ? "px-0 py-5"
    : isEmbedded
      ? "px-5 py-5"
      : "rounded-[6px] bg-[#F5F5F6] px-5 py-5";
  const aboutInfoCardClass = isMobileEmbedded
    ? "px-0 py-5"
    : isEmbedded
      ? "px-5 py-5"
      : "rounded-[6px] bg-[#F5F5F6] px-6 py-6";
  const overlayInputClass =
    `mt-2 h-9 w-full ${
      isEmbedded ? "rounded-[4px] border border-line/80 bg-[#F5F5F6] px-3" : "rounded-[4px] border border-line/80 bg-paper px-3"
    } font-ui text-[16px] font-normal text-meta outline-none placeholder:text-meta/75 md:text-[13px]`;
  const overlayReadOnlyFieldClass =
    `mt-2 w-full ${
      isEmbedded ? "rounded-[4px] border border-transparent bg-[#F5F5F6] px-3 py-2" : "rounded-[4px] border border-transparent bg-paper/65 px-3 py-2"
    } text-left font-ui text-[13px] font-normal leading-[1.5] text-meta outline-none transition-colors duration-150 hover:text-meta`;
  const profileTabHoverPillClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center -translate-x-[calc(50%-8px)] translate-y-1 whitespace-nowrap rounded-[999px] border border-ink bg-ink px-[11px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover/tab:translate-y-0 group-hover/tab:opacity-100 group-focus-visible/tab:translate-y-0 group-focus-visible/tab:opacity-100";
  const constraintSectionMetaClass =
    "font-ui text-[13px] leading-5 tracking-[0.02em] text-meta";
  const expandTextButtonClass =
    "inline-flex items-center gap-2 whitespace-nowrap border-0 bg-transparent p-0 font-ui text-[13px] leading-5 tracking-[0.02em] text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none";
  const constraintListRowValueClass =
    "text-[13px] font-ui leading-[1.25] text-meta";
  const constraintPriceRowLabelClass = "inline-flex h-7 items-center text-[13px] font-ui leading-[1.25] text-meta";
  const constraintPriceRowReadClass =
    "grid min-h-[44px] grid-cols-[112px_minmax(0,1fr)] items-center gap-4 py-2 max-[767px]:gap-3";
  const constraintPriceRowComingSoonMobileReadClass =
    "grid min-h-[31px] grid-cols-[112px_minmax(0,1fr)] items-center gap-3 py-0";
  const constraintPriceRowEditClass =
    "grid min-h-[58px] grid-cols-[112px_minmax(0,1fr)] items-start gap-4 py-2 max-[767px]:gap-3";
  const constraintPriceInlineValueClass =
    "inline-flex h-7 items-center justify-center whitespace-nowrap font-ui text-[13px] leading-5 text-meta";
  const constraintPriceValueSlotClass =
    "inline-flex h-7 w-[60px] items-center justify-center text-[13px] font-ui leading-5 text-meta";
  const constraintPriceDashClass = "inline-flex h-7 w-[12px] items-center justify-center text-[13px] font-ui leading-5 text-meta";
  const constraintPriceSliderWidthPx = isMobileEmbedded
    ? Math.round(clampNumber(viewportWidth - 180, 132, 220))
    : 220;
  const constraintPriceSliderHandleSizePx = 14;
  const constraintPriceSliderWrapClass =
    "relative h-7 select-none touch-none";
  const constraintPriceSliderTrackClass =
    "pointer-events-none absolute left-0 right-0 top-1/2 z-0 -translate-y-1/2 rounded-full";
  const constraintPriceSliderActiveTrackClass =
    "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 rounded-full";
  const constraintPriceSliderHandleClass =
    "absolute top-1/2 z-[20] m-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-ink p-0 shadow-[0_0_0_1px_var(--paper),0_1px_2px_rgba(0,0,0,0.18)] transition-transform duration-120 hover:scale-105 focus-visible:scale-105 focus-visible:outline-none";
  const constraintOptionRowClass = "flex flex-wrap items-center gap-x-3 gap-y-1";
  const constraintOptionButtonClass =
    "inline-flex h-7 items-center rounded-[4px] bg-transparent px-1 font-ui text-[13px] font-normal leading-5 text-meta transition-colors duration-150 focus-visible:outline-none";
  const constraintSizingOptionButtonClass = "w-[54px] justify-center";
  const constraintOptionButtonActiveClass = "bg-transparent !text-ink font-semibold";
  const constraintReadRowClass =
    "grid min-h-[44px] grid-cols-[112px_minmax(0,1fr)] items-center gap-4 py-2";
  const constraintReadRowComingSoonMobileClass =
    "grid min-h-[31px] grid-cols-[112px_minmax(0,1fr)] items-center gap-3 py-0";
  const constraintEditRowClass =
    "grid min-h-[44px] grid-cols-[112px_minmax(0,1fr)] items-center gap-4 py-2";
  const constraintPanelHeaderClass =
    "flex flex-wrap items-center gap-3 max-[767px]:flex-nowrap max-[767px]:justify-between";
  const constraintPanelTitleGroupClass =
    "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1";
  const constraintPanelActionGroupClass =
    "flex items-center gap-3 max-[767px]:ml-auto max-[767px]:shrink-0 max-[767px]:justify-end";
  const constraintActionPillClass = `${settingsActionPillClass} active:text-ink`;
  const signatureArtifactActionPillClass =
    "inline-flex h-[35px] items-center justify-center whitespace-nowrap rounded-[999px] border-[0.5px] border-[#F0F0F1] bg-[#F5F5F6] px-[15px] font-ui text-[14px] font-normal leading-5 tracking-[-0.03em] text-[#6F7381] shadow-[0_0.5px_1px_rgba(0,0,0,0.05)] transition-colors duration-150 hover:text-ink focus-visible:text-ink active:text-ink md:h-[31px] md:px-4 md:text-[13px]";
  const constraintComingSoonPillClass =
    "pointer-events-none absolute left-1/2 top-full z-20 mt-2 inline-flex h-[29px] items-center justify-center -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-[999px] border border-ink bg-ink px-[11px] font-ui text-[13px] font-normal leading-[18px] tracking-[-0.02em] text-paper opacity-0 shadow-[0_0.5px_1px_rgba(0,0,0,0.12)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-active:translate-y-0 group-active:opacity-100";
  const comingSoonPillVisibleClass = "!translate-y-0 !opacity-100";
  const constraintsPageVersionConfig: Record<
    ConstraintsPageVersion,
    {
      isComingSoonMode: boolean;
      priceComingSoonValueLabel: string;
    }
  > = {
    "coming-soon": {
      isComingSoonMode: true,
      priceComingSoonValueLabel: "none",
    },
    active: {
      isComingSoonMode: false,
      priceComingSoonValueLabel: "none",
    },
  };
  const signatureArtifactActionVersionConfig: Record<
    SignatureArtifactActionVersion,
    {
      isComingSoonMode: boolean;
    }
  > = {
    "coming-soon": {
      isComingSoonMode: true,
    },
    active: {
      isComingSoonMode: false,
    },
  };
  const activeConstraintsPageVersion = constraintsPageVersionConfig[CONSTRAINTS_PAGE_VERSION];
  const activeSignatureArtifactActionVersion =
    signatureArtifactActionVersionConfig[SIGNATURE_ARTIFACT_ACTION_VERSION];
  const isConstraintsComingSoonMode = activeConstraintsPageVersion.isComingSoonMode;
  const isSignatureArtifactComingSoonMode = activeSignatureArtifactActionVersion.isComingSoonMode;
  const shouldTightenComingSoonConstraintRows = isMobileProfileViewport && isConstraintsComingSoonMode;
  const constraintArticleClass = `${overlayInfoCardClass} h-full ${
    isMobileEmbedded ? "px-3" : ""
  } ${isMobileProfileViewport ? "!pt-0" : ""}`;
  const constraintRowsTopMarginClass = shouldTightenComingSoonConstraintRows ? "mt-2" : "mt-4";
  const constraintPriceComingSoonValueLabel = activeConstraintsPageVersion.priceComingSoonValueLabel;
  const constraintSizingComingSoonValueLabel = "not specified";
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
  const pendingDoneSet = pendingDoneSetId ? referenceSets.find((set) => set.id === pendingDoneSetId) ?? null : null;
  const isPendingDoneMainEdit = pendingDoneSet?.id === MAIN_EDIT_SET_ID;
  const pendingRebuildSet = pendingRebuildSetId ? referenceSets.find((set) => set.id === pendingRebuildSetId) ?? null : null;
  const isPendingRebuildMainEdit = pendingRebuildSet?.id === MAIN_EDIT_SET_ID;
  const pendingDeleteSet = pendingDeleteSetId ? referenceSets.find((set) => set.id === pendingDeleteSetId) ?? null : null;
  const showComingSoonAction = (actionId: ComingSoonActionId) => {
    if (comingSoonActionTimeoutRef.current !== null) {
      window.clearTimeout(comingSoonActionTimeoutRef.current);
    }
    setActiveComingSoonActionId(actionId);
    comingSoonActionTimeoutRef.current = window.setTimeout(() => {
      setActiveComingSoonActionId((current) => (current === actionId ? null : current));
      comingSoonActionTimeoutRef.current = null;
    }, 1100);
  };
  const comingSoonPillClassFor = (actionId: ComingSoonActionId) =>
    `${constraintComingSoonPillClass} ${
      activeComingSoonActionId === actionId ? comingSoonPillVisibleClass : ""
    }`;

  useEffect(() => {
    if (viewportWidth >= 768 || !showReferenceSetsSection) return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflowY = root.style.overflowY;
    const previousBodyOverflowY = body.style.overflowY;
    let frameId: number | null = null;

    const syncReferenceScroll = () => {
      frameId = null;
      const contentNode = profileRootRef.current;
      const viewportHeight = window.innerHeight;
      const contentHeight = Math.ceil(
        Math.max(
          contentNode?.scrollHeight ?? 0,
          body.scrollHeight,
          root.scrollHeight,
        ),
      );
      const needsScroll = contentHeight > viewportHeight + 2;
      root.style.overflowY = needsScroll ? "auto" : "hidden";
      body.style.overflowY = needsScroll ? "auto" : "hidden";
    };

    const scheduleSync = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(syncReferenceScroll);
    };

    scheduleSync();
    const resizeObserver = new ResizeObserver(scheduleSync);
    if (profileRootRef.current) resizeObserver.observe(profileRootRef.current);
    resizeObserver.observe(body);
    window.addEventListener("resize", scheduleSync);
    window.visualViewport?.addEventListener("resize", scheduleSync);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.visualViewport?.removeEventListener("resize", scheduleSync);
      root.style.overflowY = previousRootOverflowY;
      body.style.overflowY = previousBodyOverflowY;
    };
  }, [
    editingSetIds,
    expandedSetIds,
    isCreateEditOpen,
    pendingDeleteSetId,
    pendingDoneSetId,
    pendingRebuildSetId,
    minimumReferenceDisclaimerSetIds,
    referenceSets,
    showReferenceSetsSection,
    viewportWidth,
  ]);

  const dismissMainEditMetaHint = () => {
    if (!activeUser) return;
    const key = `unseen:main-edit-meta-dismissed-profile-create:${activeUser.userId}`;
    setIsMainEditHintDismissedForAccount(true);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Ignore storage failures and keep in-memory state.
    }
  };

  const openConstraintConversion = () => {
    setIsConversionOpen(true);
    setIsConversionMenuOpen(false);
  };

  const closeConstraintConversion = () => {
    setIsConversionOpen(false);
  };

  const toggleConversionMenu = () => {
    openConstraintConversion();
  };

  const closeConversionMenu = () => {
    setIsConversionMenuOpen(false);
  };

  const beginPriceConstraintEditor = (category: PriceCategory) => {
    const range = constraints.price[category];
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor({ section: "price", category });
    setEditingPriceFloor(String(range.floor));
    setEditingPriceCeiling(String(range.ceiling));
  };

  const beginPriceSectionEditor = () => {
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor(null);
    setActiveConstraintSectionEditor("price");
    setEditingPriceRanges({
      outer: { ...constraints.price.outer },
      upper: { ...constraints.price.upper },
      lower: { ...constraints.price.lower },
      silhouette: { ...constraints.price.silhouette },
      ground: { ...constraints.price.ground },
      artifacts: { ...constraints.price.artifacts },
    });
  };

  const beginSizingSectionEditor = () => {
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor(null);
    setActiveConstraintSectionEditor("sizing");
    setEditingSizingDraft({
      clothing: [...constraints.sizing.clothing],
      pants: [...constraints.sizing.pants],
      shoes: [...constraints.sizing.shoes],
    });
  };

  const beginSizingConstraintEditor = (category: QuietSizingCategory) => {
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor({ section: "sizing", category });
    setEditingSizingCategory(category);
    const nextValues =
      category === "clothing"
        ? [...constraints.sizing.clothing]
        : category === "pants"
          ? [...constraints.sizing.pants]
          : [...constraints.sizing.shoes];
    setEditingSizingValues(nextValues);
  };

  const beginGenderConstraintEditor = () => {
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor({ section: "gender" });
    setEditingGenderMain(constraints.gender.main);
    const allowedExceptionMode = getGenderInclusionOption(constraints.gender.main);
    if (
      constraints.gender.exceptionMode === "none" ||
      (allowedExceptionMode && constraints.gender.exceptionMode === allowedExceptionMode)
    ) {
      setEditingGenderExceptionMode(constraints.gender.exceptionMode);
      setEditingGenderExceptionCategories(
        constraints.gender.exceptionMode === "none" ? [] : [...constraints.gender.exceptionCategories],
      );
      return;
    }
    setEditingGenderExceptionMode("none");
    setEditingGenderExceptionCategories([]);
  };

  const beginPreOwnedConstraintEditor = () => {
    setIsConversionOpen(false);
    setIsResetConstraintsConfirmOpen(false);
    setActiveConstraintEditor({ section: "pre-owned" });
    setEditingPreOwnedPreference(constraints.preOwned);
  };

  const cancelConstraintEditor = () => {
    setActiveConstraintEditor(null);
    setActiveConstraintSectionEditor(null);
    setEditingPriceRanges(defaultQuietConstraints.price);
    setEditingSizingDraft(defaultQuietConstraints.sizing);
    setEditingPriceFloor("");
    setEditingPriceCeiling("");
    setEditingSizingCategory(null);
    setEditingSizingValues([]);
    setEditingGenderMain(defaultConstraintGenderMain);
    setEditingGenderExceptionMode("none");
    setEditingGenderExceptionCategories([]);
    setEditingPreOwnedPreference(defaultQuietConstraints.preOwned);
    setEditingFieldShake(null);
  };

  const triggerConstraintFieldShake = (field: "floor" | "ceiling") => {
    setEditingFieldShake(field);
    if (constraintHintTimeoutRef.current !== null) {
      window.clearTimeout(constraintHintTimeoutRef.current);
    }
    constraintHintTimeoutRef.current = window.setTimeout(() => {
      setEditingFieldShake(null);
      constraintHintTimeoutRef.current = null;
    }, 240);
  };

  const setEditingPriceRangeValue = (category: PriceCategory, edge: "floor" | "ceiling", value: number) => {
    const limits = PRICE_RANGE_LIMITS[category];
    const step = PRICE_RANGE_STEPS[category];
    const nextValue = clampNumber(snapToStep(value, limits.min, step), limits.min, limits.max);
    setEditingPriceRanges((current) => ({
      ...current,
      [category]:
        edge === "floor"
          ? {
              ...current[category],
              floor: Math.min(nextValue, current[category].ceiling),
            }
          : {
              ...current[category],
              ceiling: Math.max(nextValue, current[category].floor),
            },
    }));
  };

  const normalizeEditingPriceRange = (category: PriceCategory) => {
    const limits = PRICE_RANGE_LIMITS[category];
    const step = PRICE_RANGE_STEPS[category];
    setEditingPriceRanges((current) => {
      const floor = clampNumber(snapToStep(current[category].floor, limits.min, step), limits.min, limits.max);
      const ceiling = clampNumber(snapToStep(current[category].ceiling, limits.min, step), limits.min, limits.max);
      return {
        ...current,
        [category]: {
          floor: Math.min(floor, ceiling),
          ceiling: Math.max(floor, ceiling),
        },
      };
    });
  };

  const getPriceValueFromClientX = (category: PriceCategory, clientX: number): number | null => {
    const track = priceSliderTrackRefs.current[category];
    if (!track) return null;
    const limits = PRICE_RANGE_LIMITS[category];
    const step = PRICE_RANGE_STEPS[category];
    const rect = track.getBoundingClientRect();
    const ratio = clampNumber((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const raw = limits.min + ratio * (limits.max - limits.min);
    return clampNumber(snapToStep(raw, limits.min, step), limits.min, limits.max);
  };

  const updatePriceFromClientX = (category: PriceCategory, edge: "floor" | "ceiling", clientX: number) => {
    const nextValue = getPriceValueFromClientX(category, clientX);
    if (nextValue === null) return;
    setEditingPriceRangeValue(category, edge, nextValue);
  };

  const beginPriceDrag = (
    category: PriceCategory,
    edge: "floor" | "ceiling",
    clientX: number,
  ) => {
    setDraggingPrice({ category, edge });
    updatePriceFromClientX(category, edge, clientX);
  };

  useEffect(() => {
    if (!draggingPrice) return;

    const onMouseMove = (event: globalThis.MouseEvent) => {
      updatePriceFromClientX(draggingPrice.category, draggingPrice.edge, event.clientX);
    };
    const onMouseUp = () => {
      normalizeEditingPriceRange(draggingPrice.category);
      setDraggingPrice(null);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      updatePriceFromClientX(draggingPrice.category, draggingPrice.edge, touch.clientX);
      event.preventDefault();
    };
    const onTouchEnd = () => {
      normalizeEditingPriceRange(draggingPrice.category);
      setDraggingPrice(null);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [draggingPrice]);

  const savePriceSection = () => {
    const nextPrice = { ...editingPriceRanges };

    PRICE_CATEGORIES.forEach((category) => {
      const limits = PRICE_RANGE_LIMITS[category];
      const step = PRICE_RANGE_STEPS[category];
      const floor = clampNumber(snapToStep(Math.round(Number(nextPrice[category].floor)), limits.min, step), limits.min, limits.max);
      const ceiling = clampNumber(
        snapToStep(Math.round(Number(nextPrice[category].ceiling)), limits.min, step),
        limits.min,
        limits.max,
      );
      nextPrice[category] = {
        floor: Math.min(floor, ceiling),
        ceiling: Math.max(floor, ceiling),
      };
    });

    setConstraints((current) => ({
      ...current,
      price: nextPrice,
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintSectionEditor(null);
  };

  const toggleSizingDraftValue = (category: QuietSizingCategory, value: string) => {
    setEditingSizingDraft((current) => {
      const currentValues = [...current[category]];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [category]:
          category === "clothing"
            ? nextValues.filter(isLetterSize)
            : category === "pants"
              ? nextValues.filter(isPantSize)
              : nextValues.filter(isShoeSize),
      };
    });
  };

  const saveSizingSection = () => {
    setConstraints((current) => ({
      ...current,
      sizing: {
        clothing: editingSizingDraft.clothing.filter(isLetterSize),
        pants: editingSizingDraft.pants.filter(isPantSize),
        shoes: editingSizingDraft.shoes.filter(isShoeSize),
      },
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintSectionEditor(null);
  };

  const savePriceConstraint = () => {
    if (!activeConstraintEditor || activeConstraintEditor.section !== "price") return;

    const rawFloor = Number(editingPriceFloor);
    const rawCeiling = Number(editingPriceCeiling);
    const isFloorInvalid = !Number.isFinite(rawFloor) || !Number.isInteger(rawFloor) || rawFloor < 0;
    const isCeilingInvalid = !Number.isFinite(rawCeiling) || !Number.isInteger(rawCeiling) || rawCeiling < 0;

    if (isFloorInvalid) {
      triggerConstraintFieldShake("floor");
      return;
    }

    if (isCeilingInvalid) {
      triggerConstraintFieldShake("ceiling");
      return;
    }

    const nextFloor = Math.min(rawFloor, rawCeiling);
    const nextCeiling = Math.max(rawFloor, rawCeiling);

    setConstraints((current) => ({
      ...current,
      price: {
        ...current.price,
        [activeConstraintEditor.category]: {
          floor: nextFloor,
          ceiling: nextCeiling,
        },
      },
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintEditor(null);
  };

  const saveSizingConstraint = () => {
    if (activeConstraintEditor?.section !== "sizing") return;
    const category = activeConstraintEditor.category;

    if (category === "clothing") {
      const nextValue = editingSizingValues.filter(isLetterSize);

      setConstraints((current) => ({
        ...current,
        sizing: {
          ...current.sizing,
          clothing: nextValue,
        },
        updatedAt: new Date().toISOString(),
        activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
      }));
      setActiveConstraintEditor(null);
      return;
    }

    if (category === "pants") {
      const nextValue = editingSizingValues.filter(isPantSize);
      setConstraints((current) => ({
        ...current,
        sizing: {
          ...current.sizing,
          pants: nextValue,
        },
        updatedAt: new Date().toISOString(),
        activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
      }));
      setActiveConstraintEditor(null);
      return;
    }

    const nextShoes = editingSizingValues.filter(isShoeSize);
    setConstraints((current) => ({
      ...current,
      sizing: {
        ...current.sizing,
        shoes: nextShoes,
      },
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintEditor(null);
  };

  const toggleSizingValue = (category: QuietSizingCategory, value: string) => {
    setEditingSizingValues((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      return [...current, value];
    });
  };

  const saveGenderConstraint = () => {
    if (activeConstraintEditor?.section !== "gender") return;
    const inclusionOption = getGenderInclusionOption(editingGenderMain);
    const normalizedExceptionMode =
      editingGenderExceptionMode === "none"
        ? "none"
        : inclusionOption && editingGenderExceptionMode === inclusionOption
          ? editingGenderExceptionMode
          : "none";
    const normalizedExceptionCategories =
      normalizedExceptionMode === "none"
        ? []
        : editingGenderExceptionCategories.filter((category, index, arr) => arr.indexOf(category) === index);
    setConstraints((current) => ({
      ...current,
      gender: {
        main: editingGenderMain,
        exceptionMode: normalizedExceptionMode,
        exceptionCategories: normalizedExceptionCategories,
      },
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintEditor(null);
  };

  const toggleGenderExceptionCategory = (category: PriceCategory) => {
    setEditingGenderExceptionCategories((current) => {
      if (current.includes(category)) return current.filter((item) => item !== category);
      return [...current, category];
    });
  };

  const savePreOwnedConstraint = () => {
    if (activeConstraintEditor?.section !== "pre-owned") return;
    setConstraints((current) => ({
      ...current,
      preOwned: editingPreOwnedPreference,
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    }));
    setActiveConstraintEditor(null);
  };

  const resetConstraintsToCalibration = () => {
    setConstraints({
      ...defaultQuietConstraints,
      price: { ...defaultQuietConstraints.price },
      sizing: {
        clothing: [...defaultQuietConstraints.sizing.clothing],
        pants: [...defaultQuietConstraints.sizing.pants],
        shoes: [...defaultQuietConstraints.sizing.shoes],
      },
      gender: {
        main: defaultQuietConstraints.gender.main,
        exceptionMode: "none",
        exceptionCategories: [],
      },
      preOwned: defaultQuietConstraints.preOwned,
      updatedAt: new Date().toISOString(),
      activeFromIssue: QUIET_CONSTRAINT_ACTIVE_FROM_ISSUE,
    });
    setEditingPriceFloor("");
    setEditingPriceCeiling("");
    setEditingSizingValues([]);
    setEditingSizingCategory(null);
    setEditingGenderMain(defaultConstraintGenderMain);
    setEditingGenderExceptionMode("none");
    setEditingGenderExceptionCategories([]);
    setEditingPreOwnedPreference(defaultQuietConstraints.preOwned);
    setEditingFieldShake(null);
    setActiveConstraintEditor(null);
    setActiveConstraintSectionEditor(null);
    setIsResetConstraintsConfirmOpen(false);
  };

  const bumpMainEditRecalibration = () => {
    setMainEditRecalibrationCount((current) => current + 1);
  };

  const setMinimumReferenceDisclaimer = (setId: string, shouldShow: boolean) => {
    setMinimumReferenceDisclaimerSetIds((current) => {
      if (shouldShow) {
        if (current[setId]) return current;
        return {
          ...current,
          [setId]: true,
        };
      }

      if (!current[setId]) return current;
      const next = { ...current };
      delete next[setId];
      return next;
    });
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
    setCreateEditSource(focused ? "shortcut" : "profile");
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
    setCreateEditSource(null);
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
      setIsCreateEditOpen(false);
      setNewEditName("");
      setPendingRebuildSetId(null);
      setPendingDeleteSetId(null);
      setRenamingSetId(null);
      setRenameDraft("");
      setUploadTargetSetId(null);
      setUploadMode("append");
      setIsFocusedCreateFlow(false);
      setCreateEditSource(null);
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

  const stopSettingsFieldPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleSettingsPasswordKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
  };

  const removeImage = (setId: string, imageId: string) => {
    const targetSet = referenceSets.find((set) => set.id === setId);
    if (targetSet) {
      const nextCount = targetSet.images.filter((img) => img.id !== imageId).length;
      setMinimumReferenceDisclaimer(setId, nextCount < MIN_NEW_EDIT_REFERENCES);
    }

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
    setMinimumReferenceDisclaimer(setId, false);
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

    const uploadedFiles = Array.from(files);

    if (uploadTargetSetId === NEW_EDIT_TARGET) {
      appendNewEditReferences(uploadedFiles);
    } else if (uploadMode === "replace") {
      const nextImages = uploadedFiles.map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        fileName: file.name,
        publicPath: URL.createObjectURL(file),
      }));
      setMinimumReferenceDisclaimer(uploadTargetSetId, nextImages.length < MIN_NEW_EDIT_REFERENCES);
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
      const nextImages = uploadedFiles.map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        fileName: file.name,
        publicPath: URL.createObjectURL(file),
      }));
      const targetSet = referenceSets.find((set) => set.id === uploadTargetSetId);
      if ((targetSet?.images.length ?? 0) + nextImages.length >= MIN_NEW_EDIT_REFERENCES) {
        setMinimumReferenceDisclaimer(uploadTargetSetId, false);
      }
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
    const targetSet = referenceSets.find((set) => set.id === setId);
    if ((targetSet?.images.length ?? 0) + nextImages.length >= MIN_NEW_EDIT_REFERENCES) {
      setMinimumReferenceDisclaimer(setId, false);
    }

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
    if (createEditSource === "profile") {
      dismissMainEditMetaHint();
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
    setCreateEditSource(null);
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
          className="mt-1 block h-[30px] w-full border-0 bg-transparent px-0 text-center font-ui text-[16px] font-normal leading-6 text-ink outline-none placeholder:text-inactive md:text-[14px]"
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
                isNewEditUploading ? "border-ink bg-ink text-paper" : "text-[#6F7381] group-hover:text-paper"
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
              <div key={image.id} className="group relative aspect-square w-full overflow-hidden rounded-[3px] bg-mist">
                <img
                  src={image.publicPath}
                  alt={image.fileName}
                  loading="eager"
                  decoding="async"
                  className="pointer-events-none select-none h-full w-full object-cover"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-label="Remove uploaded reference"
                  onClick={() => removeNewEditReference(image.id)}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-[#6F7381] opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
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
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
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
      {!canProceedNewEdit ? (
        <p className="mt-3 text-center font-ui text-[12px] font-medium leading-5 tracking-[0.02em] text-meta">
          upload at least {MIN_NEW_EDIT_REFERENCES} images to proceed
        </p>
      ) : null}
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
      ref={profileRootRef}
      className={`relative z-[120] isolate bg-paper ${
        isMobileEmbedded && showReferenceSetsSection ? "min-h-0" : isMobileEmbedded ? "min-h-screen" : isEmbedded ? "min-h-0" : "min-h-screen"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {!isEmbedded ? (
        <button
          type="button"
          aria-label="Close profile"
          onClick={handleCloseProfile}
          className="fixed right-4 top-[23px] z-50 inline-flex h-[14px] w-[20px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none md:right-10"
          style={{
            top: isMobileProfileHeader ? `${MOBILE_PROFILE_CLOSE_TOP_PX}px` : undefined,
          }}
        >
          <span
            className={`absolute left-1/2 top-1/2 block h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isCloseIconMorphed ? "translate-y-0 rotate-45" : "-translate-y-[3px] rotate-0"
            }`}
          />
          <span
            className={`absolute left-1/2 top-1/2 block h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-all duration-220 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isCloseIconMorphed ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-1/2 top-1/2 block h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,0.75,0.28,1)] ${
              isCloseIconMorphed ? "translate-y-0 -rotate-45" : "translate-y-[3px] rotate-0"
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
        className={`mx-auto w-full max-w-[1333px] ${isMobileEmbedded ? "px-4" : "px-5 sm:px-10"} ${
          isCompactEmbeddedOverlay ? "pb-0" : showReferenceSetsSection ? "pb-16 max-[767px]:pb-0" : "pb-16"
        } ${isEmbedded ? "pt-0" : "pt-[116px]"}`}
        style={{
          paddingTop: !isEmbedded ? `${resolvedProfileContentTopPx}px` : undefined,
        }}
      >
        {!isEmbedded ? (
          <div
            ref={fixedHeaderRef}
            className="fixed inset-x-0 top-0 z-40 mx-[calc(50%-50vw)] bg-paper px-5 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:h-8 after:bg-[linear-gradient(180deg,rgba(254,254,253,0.34)_0%,rgba(254,254,253,0.16)_42%,rgba(254,254,253,0.05)_72%,rgba(254,254,253,0)_100%)] sm:px-10"
            style={{ height: `${resolvedProfileHeaderHeightPx}px` }}
          >
          <div className="relative h-full w-full">
            <div
              className={`absolute left-0 text-left ${
                isMobileProfileHeader ? "right-12 flex h-[22px] items-center gap-[8px] overflow-hidden" : ""
              }`}
              style={{ top: `${resolvedProfileHeaderNameTopPx}px` }}
            >
              <h1
                className={`m-0 shrink-0 text-left font-ui leading-none tracking-[-0.03em] text-ink ${
                  isMobileProfileHeader ? "text-[18px]" : "text-[20px] sm:text-[26px]"
                }`}
                style={{
                  fontFamily: "var(--font-ui-sans), sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {activeUser.name}
              </h1>
              <p
                ref={headerMetaRef}
                aria-hidden={shouldFoldHeaderMeta}
                className={`m-0 text-left font-ui font-medium leading-4 tracking-[0.02em] text-ink ${
                  isMobileProfileHeader
                    ? "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px]"
                    : "mt-[14px] text-[12px] sm:mt-[8px]"
                }`}
                style={{
                  fontFamily: "var(--font-ui-sans), sans-serif",
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
              style={{ top: `${resolvedProfileHeaderNavTopPx}px` }}
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
              style={{ top: `${resolvedProfileHeaderDividerTopPx}px` }}
            />
          </div>
          </div>
        ) : null}

        {showSignatureSection ? (
          <section className={isMobileEmbedded ? "mt-5 touch-pan-y" : "mt-10"}>
            <div className={`mx-auto w-full ${isMobileEmbedded ? "px-0" : "px-10"}`}>
              <div
                className={`mx-auto w-full overflow-hidden ${isMobileEmbedded ? "touch-pan-y" : ""}`}
                style={{
                  maxWidth: isEmbedded ? `${embeddedSignaturePanelMaxWidthPx}px` : "1080px",
                  backgroundColor: "#F5F5F6",
                  borderRadius: isMobileEmbedded ? "26px" : "36px",
                  boxShadow: "0 2px 8px rgba(17,17,17,0.06)",
                }}
              >
                <div className={`grid w-full gap-0 ${
                  isMobileEmbedded
                    ? "grid-cols-1"
                    : isEmbedded
                      ? "grid-cols-[0.42fr_0.58fr]"
                      : "lg:grid-cols-[0.43fr_0.57fr]"
                }`}>
                  <div
                    className={`min-w-0 ${
                      isMobileEmbedded
                        ? "flex min-h-0 items-stretch justify-start px-3 pt-3"
                        : isEmbedded
                        ? "flex min-h-[292px] items-stretch justify-start py-4 pr-3 md:py-4 md:pr-3"
                        : "flex min-h-[430px] items-stretch justify-start py-4 pr-4 md:py-4 md:pr-4"
                    }`}
                    style={{
                      backgroundColor: "#F5F5F6",
                      paddingLeft: isMobileEmbedded ? undefined : isEmbedded ? "37px" : "56px",
                    }}
                  >
                    <div
                      className={`bg-ink ${
                        isMobileEmbedded
                          ? "min-h-[210px] w-full max-w-none self-center px-5 py-6"
                          : isEmbedded
                          ? "min-h-[218px] w-full max-w-[374px] self-center px-7 py-6"
                          : "min-h-[352px] w-full self-center px-7 py-7 md:px-8 md:py-8"
                      }`}
                      style={
                        isMobileEmbedded
                          ? { borderRadius: "24px" }
                          : isEmbedded
                            ? { borderRadius: "32px", maxWidth: "374px" }
                            : { borderRadius: "32px" }
                      }
                    >
                      <h2 className={`${isMobileEmbedded ? "mb-5 text-[24px]" : isEmbedded ? "mb-5 text-[22px]" : "mb-7 text-[25px]"} inline-flex w-full items-end justify-start leading-none text-paper`}>
                        <span className="font-ui font-normal tracking-[-0.06em]">{activeUser.name}</span>
                        <span className="-ml-[1px] font-ui font-normal tracking-[-0.06em]">–</span>
                        <span className="ml-[1px] font-instrument italic tracking-[0.01em]">{signatureTitleDisplay}</span>
                      </h2>

                      <p className={`${isEmbedded ? "text-[13px] leading-[1.75]" : "text-[14px] leading-[1.8]"} ${isMobileEmbedded ? "max-w-none" : "max-w-[52ch]"} text-left font-ui font-normal text-paper/88`}>
                        {shortSummary}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex ${isMobileEmbedded ? "min-h-[256px]" : isEmbedded ? "min-h-[292px]" : "min-h-[430px]"} min-w-0 items-center justify-center ${
                      isMobileEmbedded ? "px-2 pb-4 pt-1" : isEmbedded ? "py-4 pl-2 pr-3 md:pl-2 md:pr-3" : "px-4 py-4 md:px-5"
                    }`}
                    style={{ backgroundColor: "#F5F5F6" }}
                  >
                    <div className={`${isMobileEmbedded ? "mx-auto w-full max-w-none touch-pan-y" : isEmbedded ? "mx-auto w-[136%] max-w-none" : "mx-auto w-[96%]"} overflow-visible rounded-[32px]`}>
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

              <div
                className="mx-auto mt-4 flex w-full items-center justify-end gap-[10px]"
                style={{ maxWidth: isEmbedded ? `${embeddedSignaturePanelMaxWidthPx}px` : "1080px" }}
              >
                {isSignatureArtifactComingSoonMode ? (
                  <>
                    <div className="group relative inline-flex">
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={() => showComingSoonAction("signature-save")}
                        className={`${signatureArtifactActionPillClass} cursor-default`}
                      >
                        save
                      </button>
                      <span className={comingSoonPillClassFor("signature-save")}>coming soon</span>
                    </div>
                    <div className="group relative inline-flex">
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={() => showComingSoonAction("signature-share")}
                        className={`${signatureArtifactActionPillClass} cursor-default`}
                      >
                        share
                      </button>
                      <span className={comingSoonPillClassFor("signature-share")}>coming soon</span>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("unseen:signature-artifact-export", { detail: { mode: "save" } }),
                        )
                      }
                      className={signatureArtifactActionPillClass}
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
                      className={signatureArtifactActionPillClass}
                    >
                      share
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {showReferenceSetsSection ? (
          <div className="mx-[calc(50%-50vw)] px-10 max-[767px]:px-4">
            <section className={embeddedProfileContentClass}>
              {isShortcutCreateFlowActive ? (
                <div
                  ref={createEditSectionRef}
                  className="mt-12 w-full"
                  style={{ scrollMarginTop: `${resolvedProfileHeaderHeightPx + 28}px` }}
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
                const shouldShowMainEditMetaHint = isMainEdit && !isMainEditHintDismissedForAccount;
                const showMinimumReferenceDisclaimer =
                  Boolean(minimumReferenceDisclaimerSetIds[set.id]) && set.images.length < MIN_NEW_EDIT_REFERENCES;
                const previewColumns = isEmbedded
                  ? Math.min(getReferencePreviewColumns(viewportWidth), 5)
                  : getReferencePreviewColumns(viewportWidth);
                const previewRows = 1;
                const previewCount = (isEmbedded ? 5 : previewColumns) * previewRows;
                const visibleImages = isExpanded ? set.images : set.images.slice(0, previewCount);
                const referenceGridClass = isEmbedded
                  ? `mt-6 grid gap-[6px] ${
                      isExpanded
                        ? isEditing
                          ? "grid-cols-4 max-[767px]:grid-cols-2"
                          : "grid-cols-5 max-[767px]:grid-cols-3"
                        : "grid-cols-5 max-[767px]:grid-cols-4 max-[767px]:[&>*:nth-child(n+5)]:hidden"
                    }`
                  : "mt-6 grid gap-[6px]";
                const referenceGridStyle = isEmbedded
                  ? undefined
                  : { gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))` };

                return (
                  <div key={set.id} className={setIndex === 0 ? "mt-12" : "mt-8"}>
	                    <div className={`flex justify-between ${isMobileEmbedded ? "gap-4" : "gap-8"} ${shouldShowMainEditMetaHint ? "items-start" : "items-center"}`}>
	                      <div className="flex min-w-0 flex-1 items-center gap-3">
	                        <div className="w-full">
                          <h3 className="inline-flex items-baseline leading-none text-ink">
                            <span className={`font-ui ${referenceHeaderTextSizeClass} font-normal leading-none tracking-[-0.06em]`}>The</span>
                            <span className={`-ml-[1px] font-ui ${referenceHeaderTextSizeClass} font-normal leading-none tracking-[-0.06em]`}>
                              –
                            </span>
                            <span className={`ml-[2px] font-instrument ${referenceHeaderTextSizeClass} italic leading-none tracking-[0.01em]`}>
                              {set.name}
                            </span>
                          </h3>
	                          {shouldShowMainEditMetaHint ? (
		                            <p className="mt-2 w-full max-w-none font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
	                              This is the core reference set behind the Main Edit. The personal Signature is shaped
	                              from it. Additional Edits exist for distinct contexts.
	                            </p>
	                          ) : null}
                          {showMinimumReferenceDisclaimer ? (
                            <p className="mt-2 w-full max-w-none font-ui text-[13px] font-medium leading-5 tracking-[0.02em] text-meta">
                              Fewer than {MIN_NEW_EDIT_REFERENCES} references are active. More references need to be
                              added before this edit has enough signal.
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
                          className={referenceGridClass}
                          style={referenceGridStyle}
                        >
                          {visibleImages.map((image) => (
                            <div
                              key={image.id}
                              className="relative aspect-square w-full overflow-hidden rounded-[3px]"
                            >
                              <Image
                                src={image.publicPath}
                                alt={image.fileName}
                                fill
                                unoptimized
                                sizes="(max-width: 1024px) 100vw, 220px"
                                className="pointer-events-none select-none object-cover"
                                draggable={false}
                                onDragStart={(event) => event.preventDefault()}
                              />
                              {isEditing ? (
                                <button
                                  type="button"
                                  aria-label="Remove reference"
                                  onClick={() => removeImage(set.id, image.id)}
                                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-paper/92 font-ui text-[12px] leading-none text-[#6F7381] opacity-100 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] transition-opacity duration-150"
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
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-line/80 bg-paper font-ui text-[16px] font-medium leading-none text-[#6F7381] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-150 group-hover:border-ink group-hover:bg-ink group-hover:text-paper ${
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
	                            className="block h-[30px] w-full border-0 bg-transparent px-0 text-center font-ui text-[16px] font-normal leading-6 text-ink outline-none placeholder:text-inactive md:text-[14px]"
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
                      style={{ scrollMarginTop: `${resolvedProfileHeaderHeightPx + 28}px` }}
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

        {isResetConstraintsConfirmOpen ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Cancel reset"
              onClick={() => setIsResetConstraintsConfirmOpen(false)}
              className="absolute inset-0 bg-paper/72"
            />
            <div className="relative w-full max-w-[440px] rounded-[6px] bg-paper px-6 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.06)]">
              <p className="font-ui text-[14px] font-normal leading-[1.7] text-ink">
                Reset all constraints to calibration defaults?
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsResetConstraintsConfirmOpen(false)}
                  className={settingsActionPillClass}
                >
                  cancel
                </button>
                <button type="button" onClick={resetConstraintsToCalibration} className={settingsActionPillClass}>
                  reset
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isConversionOpen ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center px-6">
            <button
              type="button"
              aria-label="Close conversion table"
              onClick={closeConstraintConversion}
              className="absolute inset-0 bg-paper/72"
            />
            <div
              ref={conversionPopoverRef}
              className="relative flex h-[50vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[6px] bg-paper px-5 py-5 shadow-[0_8px_20px_rgba(0,0,0,0.06)] md:px-6 md:py-6"
            >
              <div>
                <p className={overlayTitleClass}>Sizing conversion</p>
              </div>
              <div
                className="mt-3 min-h-0 flex-1 overflow-y-scroll overscroll-contain pr-1"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
              >
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <p className="font-ui text-[13px] font-medium leading-5 text-ink">Women</p>
                    <p className="font-ui text-[13px] font-medium leading-5 text-ink">Men</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Clothing</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">Standard</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">Numeric</th>
                              <th className="py-1 pr-3 text-left font-medium text-ink">EU</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">FR</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">IT</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">UK</th>
                              <th className="py-1 text-left font-medium text-meta">US</th>
                            </tr>
                          </thead>
                          <tbody>
                            {womensClothingConversionTable.map((entry) => (
                              <tr key={`women-clothing-${entry.standard}`}>
                                <td className="py-1 pr-3 text-ink">{entry.standard}</td>
                                <td className="py-1 pr-3">{entry.numeric}</td>
                                <td className="py-1 pr-3 text-ink">{entry.eu}</td>
                                <td className="py-1 pr-3">{entry.fr}</td>
                                <td className="py-1 pr-3">{entry.it}</td>
                                <td className="py-1 pr-3">{entry.uk}</td>
                                <td className="py-1">{entry.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Clothing</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">Standard</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">Numeric</th>
                              <th className="py-1 pr-3 text-left font-medium text-ink">EU / FR / IT</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">UK</th>
                              <th className="py-1 text-left font-medium text-meta">US</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mensClothingConversionTable.map((entry) => (
                              <tr key={`men-clothing-${entry.standard}`}>
                                <td className="py-1 pr-3 text-ink">{entry.standard}</td>
                                <td className="py-1 pr-3">{entry.numeric}</td>
                                <td className="py-1 pr-3 text-ink">{entry.eu}</td>
                                <td className="py-1 pr-3">{entry.uk}</td>
                                <td className="py-1">{entry.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Shoes</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">EU</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">FR</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">IT</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">UK</th>
                              <th className="py-1 text-left font-medium text-meta">US</th>
                            </tr>
                          </thead>
                          <tbody>
                            {womensShoeConversionTable.map((entry) => (
                              <tr key={`women-shoes-${entry.eu}`}>
                                <td className="py-1 pr-3 text-ink">{entry.eu}</td>
                                <td className="py-1 pr-3">{entry.fr}</td>
                                <td className="py-1 pr-3">{entry.it}</td>
                                <td className="py-1 pr-3">{entry.uk}</td>
                                <td className="py-1">{entry.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Shoes</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">EU</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">IT</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">UK</th>
                              <th className="py-1 text-left font-medium text-meta">US</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mensShoeConversionTable.map((entry) => (
                              <tr key={`men-shoes-${entry.eu}`}>
                                <td className="py-1 pr-3 text-ink">{entry.eu}</td>
                                <td className="py-1 pr-3">{entry.it}</td>
                                <td className="py-1 pr-3">{entry.uk}</td>
                                <td className="py-1">{entry.us}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Pants</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">Standard</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">Waist Range</th>
                              <th className="py-1 pr-3 text-left font-medium text-ink">EU</th>
                              <th className="py-1 text-left font-medium text-meta">Example W/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {womensPantsConversionTable.map((entry) => (
                              <tr key={`women-pants-${entry.standard}`}>
                                <td className="py-1 pr-3 text-ink">{entry.standard}</td>
                                <td className="py-1 pr-3">{entry.waistRange}</td>
                                <td className="py-1 pr-3 text-ink">{entry.eu}</td>
                                <td className="py-1">{entry.example}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section className="rounded-[8px] bg-[#F5F5F6] p-4">
                      <p className="font-ui text-[12px] font-medium leading-5 text-ink">Pants</p>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full border-collapse font-ui text-[13px] leading-5 text-meta">
                          <thead>
                            <tr>
                              <th className="py-1 pr-3 text-left font-medium text-ink">Standard</th>
                              <th className="py-1 pr-3 text-left font-medium text-meta">Waist Range</th>
                              <th className="py-1 text-left font-medium text-meta">Example W/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mensPantsConversionTable.map((entry) => (
                              <tr key={`men-pants-${entry.standard}`}>
                                <td className="py-1 pr-3 text-ink">{entry.standard}</td>
                                <td className="py-1 pr-3">{entry.waistRange}</td>
                                <td className="py-1">{entry.example}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-center pt-3">
                <button type="button" onClick={closeConstraintConversion} className={constraintActionPillClass}>
                  close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showConstraintsSection ? (
          <div
            data-compact-overlay-content={isEmbedded ? "constraints" : undefined}
            className={`mx-[calc(50%-50vw)] ${isMobileEmbedded ? "px-4" : "px-10"} ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={isMobileEmbedded ? embeddedProfileContentClass : "mt-12 w-full"}>
              <div
                className={`${isMobileEmbedded ? "mx-0 mt-12" : "mx-auto"} w-full px-0 md:px-8`}
                style={{
                  maxWidth: isMobileEmbedded ? undefined : `${constraintsContentMaxWidthPx}px`,
                  transform: constraintsContentTranslateXPx > 0 ? `translateX(${constraintsContentTranslateXPx}px)` : undefined,
                }}
              >
                <div className="grid gap-4 md:grid-cols-2 md:gap-3">
                  <article className={constraintArticleClass}>
                    <div className={constraintPanelHeaderClass}>
                      <div className={constraintPanelTitleGroupClass}>
                        <h2 className="font-ui text-[16px] font-medium leading-5 text-ink">Price Range</h2>
                        <span className="font-ui text-[13px] font-normal leading-5 text-meta">(in EUR)</span>
                      </div>
                      <div className={constraintPanelActionGroupClass}>
                        {isConstraintsComingSoonMode ? (
                          <div className="group relative inline-flex">
                            <button
                              type="button"
                              aria-disabled="true"
                              onClick={() => showComingSoonAction("constraints-price")}
                              className={`${constraintActionPillClass} cursor-default`}
                            >
                              edit
                            </button>
                            <span className={comingSoonPillClassFor("constraints-price")}>coming soon</span>
                          </div>
                        ) : activeConstraintSectionEditor === "price" ? (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={cancelConstraintEditor} className={constraintActionPillClass}>
                              cancel
                            </button>
                            <button type="button" onClick={savePriceSection} className={constraintActionPillClass}>
                              save
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={beginPriceSectionEditor} className={constraintActionPillClass}>
                            edit
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`${constraintRowsTopMarginClass} space-y-0`}>
                      {PRICE_CATEGORIES.map((category) => {
                        const range = constraints.price[category];
                        const isEditing = activeConstraintSectionEditor === "price";
                        const draftRange = editingPriceRanges[category];
                        return (
                          <div
                            key={category}
                            className={
                              isEditing
                                ? constraintPriceRowEditClass
                                : shouldTightenComingSoonConstraintRows
                                  ? constraintPriceRowComingSoonMobileReadClass
                                  : constraintPriceRowReadClass
                            }
                          >
                            <p className={constraintPriceRowLabelClass}>{labelForPriceCategory(category)}</p>
                            <div className="min-w-0">
                              <div
                                className={constraintPriceInlineValueClass}
                                style={{ width: `${constraintPriceSliderWidthPx}px` }}
                              >
                                {isConstraintsComingSoonMode ? (
                                  <span className={constraintPriceValueSlotClass}>{constraintPriceComingSoonValueLabel}</span>
                                ) : (
                                  <>
                                    {isEditing ? (
                                      <span className={constraintPriceValueSlotClass}>{formatPriceValue(draftRange.floor)}</span>
                                    ) : (
                                      <span className={constraintPriceValueSlotClass}>{formatPriceValue(range.floor)}</span>
                                    )}
                                    <span className={constraintPriceDashClass}>—</span>
                                    {isEditing ? (
                                      <span className={constraintPriceValueSlotClass}>{formatPriceValue(draftRange.ceiling)}</span>
                                    ) : (
                                      <span className={constraintPriceValueSlotClass}>{formatPriceValue(range.ceiling)}</span>
                                    )}
                                  </>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="mt-0">
                                  {(() => {
                                    const limits = PRICE_RANGE_LIMITS[category];
                                    const min = limits.min;
                                    const max = limits.max;
                                    const span = Math.max(max - min, 1);
                                    const floor = clampNumber(draftRange.floor, min, max);
                                    const ceiling = clampNumber(draftRange.ceiling, min, max);
                                    const floorPercent = ((floor - min) / span) * 100;
                                    const ceilingPercent = ((ceiling - min) / span) * 100;
                                    const floorPx = (floorPercent / 100) * constraintPriceSliderWidthPx;
                                    const ceilingPx = (ceilingPercent / 100) * constraintPriceSliderWidthPx;
                                    const handleRadiusPx = constraintPriceSliderHandleSizePx / 2;
                                    const activeLeftPx = floorPx + handleRadiusPx;
                                    const activeWidthPx = Math.max(ceilingPx - floorPx - handleRadiusPx * 2, 0);
                                    return (
                                      <div
                                        ref={(node) => {
                                          priceSliderTrackRefs.current[category] = node;
                                        }}
                                        className={constraintPriceSliderWrapClass}
                                        style={{ width: `${constraintPriceSliderWidthPx}px` }}
                                        onMouseDown={(event) => {
                                          const clickedValue = getPriceValueFromClientX(category, event.clientX);
                                          if (clickedValue === null) return;
                                          const edge =
                                            Math.abs(clickedValue - floor) <= Math.abs(clickedValue - ceiling)
                                              ? "floor"
                                              : "ceiling";
                                          beginPriceDrag(category, edge, event.clientX);
                                        }}
                                        onTouchStart={(event) => {
                                          const touch = event.touches[0];
                                          if (!touch) return;
                                          const touchedValue = getPriceValueFromClientX(category, touch.clientX);
                                          if (touchedValue === null) return;
                                          const edge =
                                            Math.abs(touchedValue - floor) <= Math.abs(touchedValue - ceiling)
                                              ? "floor"
                                              : "ceiling";
                                          beginPriceDrag(category, edge, touch.clientX);
                                          event.preventDefault();
                                        }}
                                      >
                                        <div
                                          className={constraintPriceSliderTrackClass}
                                          style={{
                                            height: "4px",
                                            backgroundColor: "var(--inactive)",
                                            opacity: 1,
                                          }}
                                        />
                                        <div
                                          className={constraintPriceSliderActiveTrackClass}
                                          style={{
                                            height: "4px",
                                            backgroundColor: "var(--meta)",
                                            left: `${activeLeftPx}px`,
                                            width: `${activeWidthPx}px`,
                                          }}
                                        />
                                        <button
                                          type="button"
                                          aria-label={`Adjust minimum ${labelForPriceCategory(category)} price`}
                                          onMouseDown={(event) => {
                                            event.stopPropagation();
                                            beginPriceDrag(category, "floor", event.clientX);
                                          }}
                                          onTouchStart={(event) => {
                                            const touch = event.touches[0];
                                            if (!touch) return;
                                            event.stopPropagation();
                                            beginPriceDrag(category, "floor", touch.clientX);
                                            event.preventDefault();
                                          }}
                                          className={`${constraintPriceSliderHandleClass} cursor-ew-resize`}
                                          style={{
                                            left: `${floorPercent}%`,
                                            width: `${constraintPriceSliderHandleSizePx}px`,
                                            height: `${constraintPriceSliderHandleSizePx}px`,
                                          }}
                                        />
                                        <button
                                          type="button"
                                          aria-label={`Adjust maximum ${labelForPriceCategory(category)} price`}
                                          onMouseDown={(event) => {
                                            event.stopPropagation();
                                            beginPriceDrag(category, "ceiling", event.clientX);
                                          }}
                                          onTouchStart={(event) => {
                                            const touch = event.touches[0];
                                            if (!touch) return;
                                            event.stopPropagation();
                                            beginPriceDrag(category, "ceiling", touch.clientX);
                                            event.preventDefault();
                                          }}
                                          className={`${constraintPriceSliderHandleClass} cursor-ew-resize`}
                                          style={{
                                            left: `${ceilingPercent}%`,
                                            width: `${constraintPriceSliderHandleSizePx}px`,
                                            height: `${constraintPriceSliderHandleSizePx}px`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className={constraintArticleClass}>
                    <div className={constraintPanelHeaderClass}>
                      <div className={constraintPanelTitleGroupClass}>
                        <h2 className="font-ui text-[16px] font-medium leading-5 text-ink">Sizing</h2>
                        <button
                          ref={conversionTriggerRef}
                          type="button"
                          onClick={openConstraintConversion}
                          className={expandTextButtonClass}
                        >
                          (conversion chart)
                        </button>
                      </div>
                      <div className={constraintPanelActionGroupClass}>
                        {isConstraintsComingSoonMode ? (
                          <div className="group relative inline-flex">
                            <button
                              type="button"
                              aria-disabled="true"
                              onClick={() => showComingSoonAction("constraints-sizing")}
                              className={`${constraintActionPillClass} cursor-default`}
                            >
                              edit
                            </button>
                            <span className={comingSoonPillClassFor("constraints-sizing")}>coming soon</span>
                          </div>
                        ) : activeConstraintSectionEditor === "sizing" ? (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={cancelConstraintEditor} className={constraintActionPillClass}>
                              cancel
                            </button>
                            <button type="button" onClick={saveSizingSection} className={constraintActionPillClass}>
                              save
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={beginSizingSectionEditor} className={constraintActionPillClass}>
                            edit
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={`${constraintRowsTopMarginClass} space-y-0`}>
                      {SIZING_CATEGORIES.map((category) => {
                        const isClothing = category === "clothing";
                        const clothingValue = (() => {
                          if (isClothing) {
                            return constraints.sizing.clothing;
                          }
                          return category === "pants" ? constraints.sizing.pants : constraints.sizing.shoes;
                        })();
                        const isEditing = activeConstraintSectionEditor === "sizing";
                        const sizingOptions =
                          isClothing
                            ? LETTER_SIZES
                            : category === "pants"
                              ? PANTS_SIZES
                              : SHOE_SIZES;
                        const draftValues = editingSizingDraft[category];
                        return (
                          <div
                            key={category}
                            className={
                              isEditing
                                ? constraintEditRowClass
                                : shouldTightenComingSoonConstraintRows
                                  ? constraintReadRowComingSoonMobileClass
                                  : constraintReadRowClass
                            }
                          >
                            <p className={formFieldTitleClass}>
                              {labelForSizingCategory(category)}
                            </p>
                            {isEditing ? (
                              <div className="min-w-0 flex-1">
                                <div className={constraintOptionRowClass}>
                                  {sizingOptions.map((option, index) => {
                                    const isActive = draftValues.includes(option as never);
                                    return (
                                      <div key={option} className="inline-flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            toggleSizingDraftValue(category, option);
                                          }}
                                          aria-pressed={isActive}
                                          style={isActive ? { color: "var(--ink)", fontWeight: 600 } : undefined}
                                          className={`${constraintOptionButtonClass} ${constraintSizingOptionButtonClass} ${
                                            isActive ? constraintOptionButtonActiveClass : ""
                                          }`}
                                        >
                                          {option}
                                        </button>
                                        {index < sizingOptions.length - 1 ? (
                                          <span aria-hidden="true" className="font-ui text-[13px] leading-5 text-meta/55">·</span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={constraintListRowValueClass}>
                                  {isConstraintsComingSoonMode
                                    ? constraintSizingComingSoonValueLabel
                                    : formatSizingValue(category, clothingValue)}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className={constraintArticleClass}>
                    <div className={constraintPanelHeaderClass}>
                      <div className={constraintPanelTitleGroupClass}>
                        <h2 className="font-ui text-[16px] font-medium leading-5 text-ink">Gender</h2>
                      </div>
                      <div className={constraintPanelActionGroupClass}>
                        {isConstraintsComingSoonMode ? (
                          <div className="group relative inline-flex">
                            <button
                              type="button"
                              aria-disabled="true"
                              onClick={() => showComingSoonAction("constraints-gender")}
                              className={`${constraintActionPillClass} cursor-default`}
                            >
                              edit
                            </button>
                            <span className={comingSoonPillClassFor("constraints-gender")}>coming soon</span>
                          </div>
                        ) : activeConstraintEditor?.section === "gender" ? (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={cancelConstraintEditor} className={constraintActionPillClass}>
                              cancel
                            </button>
                            <button type="button" onClick={saveGenderConstraint} className={constraintActionPillClass}>
                              save
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={beginGenderConstraintEditor} className={constraintActionPillClass}>
                            edit
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 space-y-0">
                      {(() => {
                        const isEditing = activeConstraintEditor?.section === "gender";
                        const hasInclusionInReadMode =
                          constraints.gender.exceptionMode !== "none" &&
                          getGenderInclusionOption(constraints.gender.main) === constraints.gender.exceptionMode;
                        const canEditInclusion = getGenderInclusionOption(editingGenderMain) !== null;
                        const shouldShowCategoryScopeInEdit =
                          canEditInclusion && editingGenderExceptionMode !== "none";
                        return (
                          <div className="space-y-0">
                            <div className={isEditing ? constraintEditRowClass : constraintReadRowClass}>
                              <p className={formFieldTitleClass}>Preference</p>
                              {isEditing ? (
                                <div className="min-w-0 flex-1">
                                  <div className={constraintOptionRowClass}>
                                    {GENDER_OPTIONS.map((option, index) => {
                                      const isActive = editingGenderMain === option.value;
                                      return (
                                        <div key={option.value} className="inline-flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingGenderMain(option.value);
                                              const nextInclusionOption = getGenderInclusionOption(option.value);
                                              if (!nextInclusionOption) {
                                                setEditingGenderExceptionMode("none");
                                                setEditingGenderExceptionCategories([]);
                                              } else if (editingGenderExceptionMode !== "none" && editingGenderExceptionMode !== nextInclusionOption) {
                                                setEditingGenderExceptionMode("none");
                                                setEditingGenderExceptionCategories([]);
                                              }
                                            }}
                                            aria-pressed={isActive}
                                            style={isActive ? { color: "var(--ink)", fontWeight: 600 } : undefined}
                                            className={`${constraintOptionButtonClass} ${
                                              isActive ? constraintOptionButtonActiveClass : ""
                                            }`}
                                          >
                                            {option.label}
                                          </button>
                                          {index < GENDER_OPTIONS.length - 1 ? (
                                            <span aria-hidden="true" className="font-ui text-[13px] leading-5 text-meta/55">·</span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className={constraintListRowValueClass}>
                                  {formatGenderMainValue(constraints.gender.main)}
                                </p>
                              )}
                            </div>
                            {isEditing && canEditInclusion ? (
                              <div className={constraintEditRowClass}>
                                <p className={formFieldTitleClass}>Inclusion</p>
                                <div className="min-w-0 flex-1">
                                  <div className={constraintOptionRowClass}>
                                    {[
                                      { value: "none" as const, label: "none" },
                                      ...(getGenderInclusionOption(editingGenderMain)
                                        ? [{
                                            value: getGenderInclusionOption(editingGenderMain) as Exclude<GenderExceptionMode, "none">,
                                            label: getGenderInclusionLabel(editingGenderMain) as string,
                                          }]
                                        : []),
                                    ].map((option, index, list) => {
                                      const isActive = editingGenderExceptionMode === option.value;
                                      return (
                                        <div key={option.value} className="inline-flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingGenderExceptionMode(option.value);
                                              if (option.value === "none") {
                                                setEditingGenderExceptionCategories([]);
                                              }
                                            }}
                                            aria-pressed={isActive}
                                            style={isActive ? { color: "var(--ink)", fontWeight: 600 } : undefined}
                                            className={`${constraintOptionButtonClass} ${
                                              isActive ? constraintOptionButtonActiveClass : ""
                                            }`}
                                          >
                                            {option.label}
                                          </button>
                                          {index < list.length - 1 ? (
                                            <span aria-hidden="true" className="font-ui text-[13px] leading-5 text-meta/55">·</span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              hasInclusionInReadMode ? (
                                <div className={constraintReadRowClass}>
                                  <p className={formFieldTitleClass}>Inclusion</p>
                                  <p className={constraintListRowValueClass}>
                                    {formatGenderInclusionValue(constraints.gender)}
                                  </p>
                                </div>
                              ) : null
                            )}
                            {isEditing && shouldShowCategoryScopeInEdit ? (
                              <div className={constraintEditRowClass}>
                                <p className={formFieldTitleClass}>Categories</p>
                                <div className="min-w-0 flex-1">
                                  <div className={constraintOptionRowClass}>
                                    {PRICE_CATEGORIES.map((category, index) => {
                                      const isActive = editingGenderExceptionCategories.includes(category);
                                      return (
                                        <div key={category} className="inline-flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              toggleGenderExceptionCategory(category);
                                            }}
                                            aria-pressed={isActive}
                                            style={isActive ? { color: "var(--ink)", fontWeight: 600 } : undefined}
                                            className={`${constraintOptionButtonClass} ${
                                              isActive ? constraintOptionButtonActiveClass : ""
                                            }`}
                                          >
                                            {labelForPriceCategory(category)}
                                          </button>
                                          {index < PRICE_CATEGORIES.length - 1 ? (
                                            <span aria-hidden="true" className="font-ui text-[13px] leading-5 text-meta/55">·</span>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {!isEditing && hasInclusionInReadMode && constraints.gender.exceptionCategories.length > 0 ? (
                              <div className={constraintReadRowClass}>
                                <p className={formFieldTitleClass}>Categories</p>
                                <p className={constraintListRowValueClass}>
                                  {formatGenderCategoryValue(constraints.gender.exceptionCategories)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </article>

                  <article className={constraintArticleClass}>
                    <div className={constraintPanelHeaderClass}>
                      <div className={constraintPanelTitleGroupClass}>
                        <h2 className="font-ui text-[16px] font-medium leading-5 text-ink">Pre-owned items</h2>
                      </div>
                      <div className={constraintPanelActionGroupClass}>
                        {isConstraintsComingSoonMode ? (
                          <div className="group relative inline-flex">
                            <button
                              type="button"
                              aria-disabled="true"
                              onClick={() => showComingSoonAction("constraints-pre-owned")}
                              className={`${constraintActionPillClass} cursor-default`}
                            >
                              edit
                            </button>
                            <span className={comingSoonPillClassFor("constraints-pre-owned")}>coming soon</span>
                          </div>
                        ) : activeConstraintEditor?.section === "pre-owned" ? (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={cancelConstraintEditor} className={constraintActionPillClass}>
                              cancel
                            </button>
                            <button type="button" onClick={savePreOwnedConstraint} className={constraintActionPillClass}>
                              save
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={beginPreOwnedConstraintEditor} className={constraintActionPillClass}>
                            edit
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 space-y-0">
                      <div className={activeConstraintEditor?.section === "pre-owned" ? constraintEditRowClass : constraintReadRowClass}>
                        <p className={formFieldTitleClass}>Preference</p>
                        {activeConstraintEditor?.section === "pre-owned" ? (
                          <div className="min-w-0 flex-1">
                            <div className={constraintOptionRowClass}>
                              {PRE_OWNED_OPTIONS.map((option, index) => {
                                const isActive = editingPreOwnedPreference === option.value;
                                return (
                                  <div key={option.value} className="inline-flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPreOwnedPreference(option.value);
                                      }}
                                      aria-pressed={isActive}
                                      style={isActive ? { color: "var(--ink)", fontWeight: 600 } : undefined}
                                      className={`${constraintOptionButtonClass} ${
                                        isActive ? constraintOptionButtonActiveClass : ""
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                    {index < PRE_OWNED_OPTIONS.length - 1 ? (
                                      <span aria-hidden="true" className="font-ui text-[13px] leading-5 text-meta/55">·</span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className={constraintListRowValueClass}>{constraints.preOwned}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </div>

              </div>
            </section>
          </div>
        ) : null}

        {showSettingsSection ? (
          <div
            data-compact-overlay-content={isEmbedded ? "settings" : undefined}
            className={`mx-[calc(50%-50vw)] ${isMobileEmbedded ? "px-4" : "px-10"} ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={`${isEmbedded ? "pt-[66px]" : "mt-4"} w-full`}>
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
                        <div onPointerDown={stopSettingsFieldPropagation} onClick={stopSettingsFieldPropagation}>
                          <input
                            type="password"
                            value={settingsFieldDraft}
                            onChange={(event) => setSettingsFieldDraft(event.target.value)}
                            onKeyDown={handleSettingsPasswordKeyDown}
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
                        </div>
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
                <div className={`${isMobileEmbedded ? "" : isEmbedded ? "px-5" : ""} flex w-full items-center justify-start gap-3`}>
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
                  className={settingsDangerPillClass}
                >
                  proceed
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showAboutSection ? (
          <div
            data-compact-overlay-content={isEmbedded ? "about" : undefined}
            className={`mx-[calc(50%-50vw)] ${isMobileEmbedded ? "px-4" : "px-10"} ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={`${isEmbedded ? "pt-[66px]" : "mt-10"} w-full`}>
              <div className="w-full space-y-8 [&_h2]:text-[16px] [&_h3]:text-[13px] [&_h3]:text-meta [&_p]:text-[13px] [&_li]:text-[13px] [&_th]:text-[12px] [&_th]:text-meta [&_td]:text-[12px]">
                <article className={aboutInfoCardClass}>
                  <h2 className={overlayTitleClass}>Impressum</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-meta">Operator of cenoir.co (the Service)</span>
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
                    <span className="font-medium text-meta">Contact:</span> hello@cenoir.co
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

                <article className={aboutInfoCardClass}>
                  <h2 className="font-ui text-[18px] font-medium leading-6 text-ink">Privacy Policy</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-meta">Effective date:</span> 22 April 2026
                    <br />
                    <span className="font-medium text-meta">Controller:</span> J. A., sole proprietor trading as
                    "Cenoir", Fritz-Fleiner-Weg 11, 8044 Zurich, Switzerland
                    <br />
                    <span className="font-medium text-meta">Contact:</span> hello@cenoir.co
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    This policy explains how Cenoir - a private, invitation-only beta of a fashion-technology service
                    - handles your personal data. It is written to meet the Swiss FADP and, where applicable, the EU
                    GDPR.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">1. What we collect</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      <span className="font-medium text-meta">Account:</span> your email and a password (stored only
                      hashed). Optionally a display name.
                    </li>
                    <li>
                      <span className="font-medium text-meta">Profile inputs:</span> the preferences, tags, and
                      selections you give us while using the Service.
                    </li>
                    <li>
                      <span className="font-medium text-meta">Uploaded images:</span> photos you upload as inputs to
                      the Service.
                    </li>
                    <li>
                      <span className="font-medium text-meta">Usage and technical data:</span> actions you take in the
                      Service, device and browser info, IP address, and basic logs.
                    </li>
                    <li>
                      <span className="font-medium text-meta">Communications:</span> anything you send us by email or
                      in-product.
                    </li>
                  </ul>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We use strictly necessary cookies (session, CSRF, your cookie-preference) to run the Service. We
                    do not set analytics or marketing cookies during the private beta.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
                    2. Why we use it and on what basis
                  </h3>
                  <div className="mt-2 overflow-hidden rounded-[4px] border border-line/80">
                    <table className="w-full border-collapse text-left font-ui text-[13px] leading-[1.7] text-meta">
                      <thead className="bg-paper">
                        <tr>
                          <th className="border-b border-line/80 px-3 py-2 font-medium text-meta">Purpose</th>
                          <th className="border-b border-line/80 px-3 py-2 font-medium text-meta">Legal basis (GDPR)</th>
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

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">3. Automated processing</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Your inputs - including uploaded images and profile signals - are processed by proprietary and
                    third-party models to generate the Service's outputs. Where we use third-party providers, they are
                    contractually prohibited from using your inputs to train their own foundation models. You can ask
                    us to exclude your data from model-improvement use at any time at hello@cenoir.co.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">4. How long we keep it</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <li>
                      Account data: for the life of your account, deleted or anonymised within 30 days of account
                      closure, except where we have a legal obligation to keep it longer (e.g. Swiss accounting
                      retention up to 10 years).
                    </li>
                    <li>Uploaded content and profile inputs: until you delete them or close your account.</li>
                    <li>Logs: up to 12 months.</li>
                  </ul>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">5. Who sees it</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Only the operator and sub-processors acting on written instructions (hosting, email, error
                    monitoring, inference infrastructure). A current list is available at hello@cenoir.co on request.
                    Where sub-processors are outside Switzerland or the EEA, transfers are protected by EU Standard
                    Contractual Clauses and the Swiss FDPIC addendum.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">6. Your rights</h3>
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
                      className="underline decoration-line/70 underline-offset-2 hover:text-meta"
                    >
                      edoeb.admin.ch
                    </a>
                    ) or, if you are in the EU, to your local supervisory authority.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
                    7. Security and children
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We use TLS, access controls, and standard security practices. No system is perfectly secure.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Cenoir is not intended for children under 16. Please do not use it if you are under 16.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">8. Changes</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    If we change this policy materially, we will update the date above and notify you by email or
                    in-product before the change takes effect.
                  </p>
                  <p className="mt-4 font-ui text-[13px] font-normal leading-5 text-meta">Last updated: 22 April 2026</p>
                </article>

                <article className={aboutInfoCardClass}>
                  <h2 className="font-ui text-[18px] font-medium leading-6 text-ink">Cenoir - Private Beta Terms</h2>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    <span className="font-medium text-meta">Effective date:</span> 22 April 2026
                    <br />
                    <span className="font-medium text-meta">Operator:</span> J. A., sole proprietor trading as
                    "Cenoir" ("we", "us", "the Operator").
                    <br />
                    <span className="font-medium text-meta">Contact:</span> hello@cenoir.co
                  </p>
                  <p className="mt-4 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    By accepting a Cenoir invitation, creating an account, or using Cenoir, you agree to these Beta
                    Terms and to our Privacy Policy. If you don't agree, don't use the Service.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">1. What Cenoir is</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Cenoir is a private, invitation-only beta of a fashion-technology service. It is pre-release and
                    experimental. Features, mechanics, and available content may change, break, or be withdrawn at any
                    time.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">2. Eligibility</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    You may use Cenoir only if you are at least 16 years old, have legal capacity to enter into a
                    contract, and are not barred from using the Service under applicable law.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">3. Access is personal</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Your invitation and credentials are personal to you. Don't share them. You are responsible for
                    activity on your account. Tell us at hello@cenoir.co if you suspect unauthorised use.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
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

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">5. Outputs are advisory</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Recommendations, scores, and other outputs produced by Cenoir are probabilistic and may contain
                    errors. They are informational only. You are solely responsible for any decision you make based on
                    them.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
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

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
                    7. Confidentiality of the beta
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    The beta is non-public. Until we publicly announce a feature, please don't publish screenshots,
                    screen recordings, or detailed descriptions of the Service's interior (UI, copy, model behaviour)
                    or share internal roadmap information you learn through the beta. You can say you are a Cenoir
                    beta participant.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">8. Feedback</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    If you send us feedback, bug reports, or suggestions, you grant us a perpetual, irrevocable,
                    worldwide, royalty-free, sublicensable licence to use them in any way, without obligation to
                    credit or compensate you.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
                    9. We may reset or delete beta data
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may reset, export, or delete beta data at any time - for example when the beta ends or when we
                    transition to general release. We'll try to give reasonable notice.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
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

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">11. No warranties</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    To the fullest extent permitted by law, Cenoir is provided "as is" and "as available", without any
                    warranty, express or implied. We do not warrant uninterrupted availability, accuracy, security, or
                    fitness for any purpose.
                  </p>
                  <p className="mt-3 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    Nothing here excludes liability that cannot be excluded under mandatory Swiss or EU consumer law,
                    nor liability for wilful misconduct or gross negligence.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
                    12. Limitation of liability
                  </h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    To the maximum extent permitted by law, we are not liable for any indirect, incidental, special,
                    or consequential damages, or for loss of profits, data, or goodwill. Our total aggregate liability
                    for all claims in any 12-month period is capped at CHF 100. Liability for wilful misconduct, gross
                    negligence, or personal injury is not limited.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
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

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">14. Changes</h3>
                  <p className="mt-2 font-ui text-[14px] font-normal leading-[1.8] text-meta">
                    We may change these Beta Terms. Material changes will be announced by email or in-product with
                    reasonable notice. Continued use after they take effect means you accept them.
                  </p>

                  <h3 className="mt-6 font-ui text-[14px] font-medium leading-6 text-meta">
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
            className={`mx-[calc(50%-50vw)] ${isMobileEmbedded ? "px-4" : "px-10"} ${isEmbedded ? "pb-4" : ""}`}
          >
            <section className={`${isEmbedded ? "pt-[66px]" : "mt-10"} w-full`}>
              <div className="w-full space-y-4">
                <article className={overlayInfoCardClass}>
                  <h2 className={overlayTitleClass}>Beta Feedback</h2>
                  <p className="mt-3 w-full font-ui text-[13px] font-normal leading-[1.7] text-meta">
                    Notes are anonymous. They go into a shared feedback inbox and are not attached to any name or
                    account. Thank you for shaping new versions, new features, and what comes next.
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
                          className={`mt-2 h-9 w-full resize-none overflow-hidden ${
                            isEmbedded ? "rounded-[4px] border border-transparent bg-[#F5F5F6] px-3" : "rounded-[4px] border border-line/80 bg-paper px-3"
	                          } py-2 font-ui text-[16px] font-normal leading-[1.5] text-meta outline-none md:text-[13px]`}
                        />
                      </div>
                    </label>

                    <label className="block w-full">
                      <div className="flex w-full items-center gap-3">
                        <span className={formFieldTitleClass}>What felt unclear and incomplete?</span>
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
                          className={`mt-2 h-9 w-full resize-none overflow-hidden ${
                            isEmbedded ? "rounded-[4px] border border-transparent bg-[#F5F5F6] px-3" : "rounded-[4px] border border-line/80 bg-paper px-3"
	                          } py-2 font-ui text-[16px] font-normal leading-[1.5] text-meta outline-none md:text-[13px]`}
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
                          className={`mt-2 h-9 w-full resize-none overflow-hidden ${
                            isEmbedded ? "rounded-[4px] border border-transparent bg-[#F5F5F6] px-3" : "rounded-[4px] border border-line/80 bg-paper px-3"
	                          } py-2 font-ui text-[16px] font-normal leading-[1.5] text-meta outline-none md:text-[13px]`}
                        />
                      </div>
                    </label>
                  </div>
                </article>
                <div className={isMobileEmbedded ? "" : isEmbedded ? "px-5" : ""}>
                  <div className={isMobileEmbedded ? "flex flex-col items-start gap-2" : "flex items-center gap-3"}>
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
                      className={settingsActionPillClass}
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
                    <div className={`${isMobileEmbedded ? "max-h-[calc(100dvh-430px)] overflow-y-auto overscroll-contain pr-1" : ""} mt-4 space-y-3`}>
                      {feedbackHistory.map((entry, index) => (
                        <div
                          key={`${entry.sentAt}-${index}`}
                          className={`${
                            isEmbedded ? "rounded-[4px] bg-[#F5F5F6] px-3" : "rounded-[4px] bg-paper px-3"
                          } py-3`}
                        >
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
