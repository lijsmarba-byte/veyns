"use client";

import { contourDensity } from "d3-contour";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MockTasteCluster, MockUserProfile } from "@/data/mockUsers";
import { clamp, hashStringToUint32, mulberry32 } from "@/lib/taste/seededRandom";

type AttributeNode = {
  id: string;
  label: string;
  clusterId: string;
  weight: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  boxW: number;
  boxH: number;
};

type ClusterNode = {
  id: string;
  name: string;
  thesis: string;
  cx: number;
  cy: number;
  labelW: number;
  labelH: number;
  attributes: AttributeNode[];
  weight: number;
};

type TopographyData = {
  clusters: ClusterNode[];
  words: AttributeNode[];
};

type FocusAttributeText = {
  id: string;
  label: string;
  weight: number;
};
type SignatureExportMode = "save" | "share";
type ExportArtifactContent = {
  displayName?: string;
  signatureTitle?: string;
  narrative?: string;
};
type SignatureExportEvent =
  | { status: "exporting"; mode: SignatureExportMode }
  | { status: "done"; mode: SignatureExportMode; channel: "share-file" | "share-link" | "download" }
  | { status: "failed"; mode: SignatureExportMode; message: string };
type ArtifactContourLayer = {
  coordinates: number[][][][];
  fill: string;
  stroke: string;
  strokeWidth: number;
};
type ArtifactHeatmapLabel = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
  fill: string;
  letterSpacingPx: number;
};
type SignatureArtifactSnapshot = {
  version: "signature-artifact-v1";
  heatmap: {
    width: number;
    height: number;
    backgroundColor: string;
    contours: ArtifactContourLayer[];
    labels: ArtifactHeatmapLabel[];
  };
  text: {
    displayName: string;
    signatureTitle: string;
    narrative: string;
  };
};

const WIDTH = 680;
const HEIGHT = 520;
const CONTOUR_BLEED_BOTTOM = 130;
const CLUSTER_MARGIN_X = 108;
const CLUSTER_MARGIN_Y = 84;
const CLUSTER_CLAMP_X = 88;
const CLUSTER_CLAMP_Y = 72;
const WORD_PADDING_X = 42;
const WORD_PADDING_Y = 40;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const OVERLAY_CARD_WIDTH_BASE = 500;
const OVERLAY_CARD_HEIGHT_BASE = 176;
const OVERLAY_CARD_WIDTH_EXPANDED = 560;
const OVERLAY_CARD_HEIGHT_EXPANDED = 240;
const OVERLAY_CARD_PADDING = 10;
const OVERLAY_TITLE_ANCHOR_Y = 36;
const OVERLAY_HALO_BLEED = 8;
const OVERLAY_HEATMAP_SCALE = 0.94;
const HOVER_EXPAND_DELAY_MS = 500;
const OVERLAY_SOFT_BACKGROUND = "#FEFEFD";
const OVERLAY_SOFT_SHADOW = "0 5px 12px rgba(17,17,17,0.035), 0 1px 3px rgba(17,17,17,0.013)";
const OVERLAY_CORNER_RADIUS_PX = 32;
const EXPORT_IMAGE_WIDTH = 1800;
const EXPORT_IMAGE_HEIGHT = 1200;

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG encoding failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = url;
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = words[0] ?? "";

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[i];
  }

  if (current) lines.push(current);
  return lines;
}

function truncateLinesWithEllipsis(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number,
): string[] {
  if (lines.length <= maxLines) return lines;
  const trimmed = lines.slice(0, maxLines);
  const lastIndex = maxLines - 1;
  const ellipsis = "...";
  let lastLine = trimmed[lastIndex] ?? "";
  while (lastLine.length > 0 && ctx.measureText(`${lastLine}${ellipsis}`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }
  trimmed[lastIndex] = lastLine ? `${lastLine}${ellipsis}` : ellipsis;
  return trimmed;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function buildClusters(rawClusters: MockTasteCluster[], userId: number): TopographyData {
  const prepared = rawClusters.map((cluster, clusterIndex) => {
    const attrs = cluster.attributes.map((attr, attrIndex) => {
      const score = typeof attr.score === "number" ? attr.score : 0;
      const confidence = typeof attr.confidence === "number" ? attr.confidence : 0;
      const weight = clamp(score * confidence, 0, 1);
      return {
        id: `c${clusterIndex}-a${attrIndex}-${attr.key}`,
        label: attr.label,
        weight,
      };
    });

    attrs.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.label.localeCompare(b.label);
    });

    const totalWeight = attrs.reduce((sum, item) => sum + item.weight, 0);
    const seed = hashStringToUint32(`${userId}-${cluster.cluster_name}`);
    const rng = mulberry32(seed);

    return {
      id: `cluster-${clusterIndex}`,
      name: cluster.cluster_name,
      thesis: cluster.cluster_thesis,
      weight: totalWeight,
      rng,
      attrs,
      labelW: clamp(cluster.cluster_name.length * 6.8, 82, 180),
      labelH: 18,
    };
  });

  prepared.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.name.localeCompare(b.name);
  });

  const clusters = prepared.slice(0, 14).map((cluster) => {
    return {
      id: cluster.id,
      name: cluster.name,
      thesis: cluster.thesis,
      weight: cluster.weight,
      rng: cluster.rng,
      attrs: cluster.attrs,
      labelW: cluster.labelW,
      labelH: cluster.labelH,
      cx: CLUSTER_MARGIN_X + cluster.rng() * (WIDTH - CLUSTER_MARGIN_X * 2),
      cy: CLUSTER_MARGIN_Y + cluster.rng() * (HEIGHT - CLUSTER_MARGIN_Y * 2),
    };
  });

  for (let step = 0; step < 84; step += 1) {
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const a = clusters[i];
        const b = clusters[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const radialMin = 102;

        if (dist < radialMin) {
          const push = ((radialMin - dist) / radialMin) * 8;
          const ux = dx / dist;
          const uy = dy / dist;
          a.cx -= ux * push;
          a.cy -= uy * push;
          b.cx += ux * push;
          b.cy += uy * push;
        }

        const overlapX = Math.abs(dx) < (a.labelW + b.labelW) * 0.54;
        const overlapY = Math.abs(dy) < (a.labelH + b.labelH) * 1.8;

        if (overlapX && overlapY) {
          const pushX = (((a.labelW + b.labelW) * 0.54 - Math.abs(dx)) / 220) * 9;
          const pushY = (((a.labelH + b.labelH) * 1.6 - Math.abs(dy)) / 90) * 7;
          if (pushX > pushY) {
            const dirX = dx >= 0 ? 1 : -1;
            a.cx -= dirX * pushX;
            b.cx += dirX * pushX;
          } else {
            const dirY = dy >= 0 ? 1 : -1;
            a.cy -= dirY * pushY;
            b.cy += dirY * pushY;
          }
        }
      }
    }

    for (const cluster of clusters) {
      cluster.cx = clamp(cluster.cx, CLUSTER_CLAMP_X, WIDTH - CLUSTER_CLAMP_X);
      cluster.cy = clamp(cluster.cy, CLUSTER_CLAMP_Y, HEIGHT - CLUSTER_CLAMP_Y);
    }
  }

  const words: AttributeNode[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (const cluster of clusters) {
    const local = cluster.attrs.map((attr, i) => {
      const ring = Math.floor(i / 7);
      const angle = i * golden + (cluster.rng() - 0.5) * 0.2;
      const radius = 26 + ring * 22 + cluster.rng() * 6;
      const x = cluster.cx + Math.cos(angle) * radius;
      const y = cluster.cy + Math.sin(angle) * radius;
      const fontSize = 10 + attr.weight * 4.2;
      const textWidth = attr.label.length * (fontSize * 0.42);
      const boxW = clamp(textWidth + 10, 42, 190);
      const boxH = clamp(fontSize * 1.2, 14, 22);
      return {
        id: attr.id,
        label: attr.label,
        clusterId: cluster.id,
        weight: attr.weight,
        x,
        y,
        baseX: x,
        baseY: y,
        boxW,
        boxH,
      };
    });

    words.push(...local);
  }

  for (let step = 0; step < 92; step += 1) {
    for (let i = 0; i < words.length; i += 1) {
      const a = words[i];
      for (let j = i + 1; j < words.length; j += 1) {
        const b = words[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = (Math.max(a.boxW, a.boxH) + Math.max(b.boxW, b.boxH)) * 0.24;
        if (dist >= minDist) continue;
        const overlap = (minDist - dist) / minDist;
        const ux = dx / dist;
        const uy = dy / dist;
        const push = overlap * 4.7;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }

    for (const word of words) {
      word.x += (word.baseX - word.x) * 0.018;
      word.y += (word.baseY - word.y) * 0.018;
      word.x = clamp(
        word.x,
        WORD_PADDING_X + word.boxW * 0.5,
        WIDTH - WORD_PADDING_X - word.boxW * 0.5,
      );
      word.y = clamp(word.y, WORD_PADDING_Y + word.boxH, HEIGHT - WORD_PADDING_Y);
    }
  }

  const byCluster = new Map<string, AttributeNode[]>();
  for (const word of words) {
    const list = byCluster.get(word.clusterId) ?? [];
    list.push(word);
    byCluster.set(word.clusterId, list);
  }

  const clusterNodes: ClusterNode[] = clusters.map((cluster) => ({
    id: cluster.id,
    name: cluster.name,
    thesis: cluster.thesis,
    cx: cluster.cx,
    cy: cluster.cy,
    labelW: cluster.labelW,
    labelH: cluster.labelH,
    attributes: byCluster.get(cluster.id) ?? [],
    weight: cluster.weight,
  }));

  return { clusters: clusterNodes, words };
}

function contoursPath(coordinates: number[][][][]): string {
  let path = "";
  for (const polygon of coordinates) {
    for (const ring of polygon) {
      if (ring.length === 0) continue;
      path += `M${ring[0][0].toFixed(1)},${ring[0][1].toFixed(1)}`;
      for (let i = 1; i < ring.length; i += 1) {
        path += `L${ring[i][0].toFixed(1)},${ring[i][1].toFixed(1)}`;
      }
      path += "Z";
    }
  }
  return path;
}

function overviewContourColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const r = Math.round(142 - t * 46);
  const g = Math.round(142 - t * 46);
  const b = Math.round(140 - t * 44);
  const a = 0.2 + t * 0.16;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function overviewContourFill(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const tone = Math.round(124 - t * 18);
  const a = 0.028 + t * 0.03;
  return `rgba(${tone}, ${tone}, ${tone}, ${a.toFixed(3)})`;
}

function createArtifactSnapshot({
  backgroundColor,
  contours,
  clusters,
  displayName,
  signatureTitle,
  narrative,
}: {
  backgroundColor: string;
  contours: number[][][][][];
  clusters: ClusterNode[];
  displayName: string;
  signatureTitle: string;
  narrative: string;
}): SignatureArtifactSnapshot {
  return {
    version: "signature-artifact-v1",
    heatmap: {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor,
      contours: contours.map((coordinates, index, all) => ({
        coordinates,
        fill: overviewContourFill(index, all.length),
        stroke: overviewContourColor(index, all.length),
        strokeWidth: 0.72,
      })),
      labels: clusters.map((cluster) => ({
        text: cluster.name,
        x: cluster.cx,
        y: cluster.cy,
        fontSize: 17,
        fontWeight: 500,
        fill: "rgba(17,17,17,0.72)",
        letterSpacingPx: 0.25,
      })),
    },
    text: {
      displayName,
      signatureTitle,
      narrative,
    },
  };
}

function buildArtifactHeatmapSvgMarkup(snapshot: SignatureArtifactSnapshot, uiFontFamily: string): string {
  const contoursMarkup = snapshot.heatmap.contours
    .map(
      (layer) =>
        `<path d="${contoursPath(layer.coordinates)}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />`,
    )
    .join("");
  const labelsMarkup = snapshot.heatmap.labels
    .map(
      (label) =>
        `<text x="${label.x}" y="${label.y}" text-anchor="middle" font-family="${escapeXml(uiFontFamily)}, sans-serif" font-size="${label.fontSize}" font-weight="${label.fontWeight}" fill="${label.fill}" letter-spacing="${label.letterSpacingPx}px">${escapeXml(label.text)}</text>`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${snapshot.heatmap.width}" height="${snapshot.heatmap.height}" viewBox="0 0 ${snapshot.heatmap.width} ${snapshot.heatmap.height}">`,
    `<rect x="0" y="0" width="${snapshot.heatmap.width}" height="${snapshot.heatmap.height}" fill="${snapshot.heatmap.backgroundColor}" />`,
    contoursMarkup,
    labelsMarkup,
    "</svg>",
  ].join("");
}

function buildFocusAttributeLayout(cluster: ClusterNode | null): FocusAttributeText[] {
  if (!cluster) return [];
  const sorted = [...cluster.attributes].sort((a, b) => b.weight - a.weight);
  return sorted.slice(0, 6).map((word) => ({
    id: word.id,
    label: word.label,
    weight: word.weight,
  }));
}

export function ProfileSignatureContourInline({
  user,
  backgroundColor = "var(--paper)",
  exportArtifactContent,
  onExportEvent,
}: {
  user: MockUserProfile;
  backgroundColor?: string;
  exportArtifactContent?: ExportArtifactContent;
  onExportEvent?: (event: SignatureExportEvent) => void;
}) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
  const [isExportingCard, setIsExportingCard] = useState(false);
  const [heatmapContainerWidth, setHeatmapContainerWidth] = useState(WIDTH);
  const [overlayMeasuredSize, setOverlayMeasuredSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);
  const overlayMeasureRef = useRef<HTMLDivElement | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);
  const exportActionRef = useRef<(mode: SignatureExportMode) => Promise<void>>(async () => {});

  const data = useMemo(() => buildClusters(user.tasteAttributes.clusters ?? [], user.userId), [user]);
  const activeCluster = data.clusters.find((cluster) => cluster.id === activeClusterId) ?? null;
  const overlayCardWidth = isOverlayExpanded ? OVERLAY_CARD_WIDTH_EXPANDED : OVERLAY_CARD_WIDTH_BASE;
  const overlayCardHeight = isOverlayExpanded ? OVERLAY_CARD_HEIGHT_EXPANDED : OVERLAY_CARD_HEIGHT_BASE;
  const heatmapScale = clamp(heatmapContainerWidth / WIDTH, 0.55, 1);
  const overlayResponsiveScale = clamp(0.92, 0.84 + heatmapScale * 0.16, 1);

  const clearHoverExpandTimer = () => {
    if (hoverExpandTimerRef.current !== null) {
      window.clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
  };

  const startHoverExpandTimer = (clusterId: string) => {
    clearHoverExpandTimer();
    hoverExpandTimerRef.current = window.setTimeout(() => {
      setActiveClusterId(clusterId);
      setIsOverlayExpanded(true);
      hoverExpandTimerRef.current = null;
    }, HOVER_EXPAND_DELAY_MS);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearHoverExpandTimer();
        setActiveClusterId(null);
        setIsOverlayExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearHoverExpandTimer();
    };
  }, []);

  useEffect(() => {
    const node = heatmapContainerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (typeof nextWidth !== "number" || Number.isNaN(nextWidth)) return;
      setHeatmapContainerWidth((current) => (Math.abs(current - nextWidth) > 0.5 ? nextWidth : current));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeCluster || heatmapContainerWidth <= 0) {
      setOverlayMeasuredSize(null);
      return;
    }
    const node = overlayMeasureRef.current;
    if (!node) return;

    const toHeatmapUnits = (pixels: number) => (pixels / heatmapContainerWidth) * WIDTH;
    const syncSize = () => {
      const rect = node.getBoundingClientRect();
      const next = {
        width: toHeatmapUnits(rect.width),
        height: toHeatmapUnits(rect.height),
      };
      setOverlayMeasuredSize((current) => {
        if (!current) return next;
        if (Math.abs(current.width - next.width) <= 0.5 && Math.abs(current.height - next.height) <= 0.5) {
          return current;
        }
        return next;
      });
    };

    syncSize();
    const observer = new ResizeObserver(() => syncSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    activeCluster,
    heatmapContainerWidth,
    isOverlayExpanded,
    overlayCardHeight,
    overlayCardWidth,
    overlayResponsiveScale,
  ]);

  const contourPoints = useMemo(() => {
    const centers = data.clusters.map((cluster) => ({
      id: `center-${cluster.id}`,
      label: cluster.name,
      clusterId: cluster.id,
      weight: clamp(cluster.weight / 12, 0.22, 0.9),
      x: cluster.cx,
      y: cluster.cy,
      baseX: cluster.cx,
      baseY: cluster.cy,
      boxW: 1,
      boxH: 1,
    }));
    return [...data.words, ...centers];
  }, [data.clusters, data.words]);

  const allContours = useMemo(() => {
    if (contourPoints.length === 0) return [];
    return contourDensity<AttributeNode>()
      .x((d) => d.x)
      .y((d) => d.y)
      .weight((d) => d.weight)
      .size([WIDTH, HEIGHT + CONTOUR_BLEED_BOTTOM])
      .bandwidth(34)
      .thresholds(11)(contourPoints);
  }, [contourPoints]);

  const focusAttributes = useMemo(() => buildFocusAttributeLayout(activeCluster), [activeCluster]);
  const thesisText = activeCluster ? activeCluster.thesis.trim() : "";
  const exportDisplayName = exportArtifactContent?.displayName?.trim() || user.name.trim() || "User";
  const exportSignatureTitle =
    exportArtifactContent?.signatureTitle?.trim() || user.tasteDescription.signatureTitle.trim() || "Signature";
  const exportNarrative = exportArtifactContent?.narrative?.trim() || user.tasteDescription.tasteThesis.trim();
  const exportSnapshot = useMemo(
    () =>
      createArtifactSnapshot({
        backgroundColor: backgroundColor.trim() || "#F8F8F6",
        contours: allContours.map((contour) => contour.coordinates as number[][][][]),
        clusters: data.clusters,
        displayName: exportDisplayName,
        signatureTitle: exportSignatureTitle,
        narrative: exportNarrative,
      }),
    [
      allContours,
      backgroundColor,
      data.clusters,
      exportDisplayName,
      exportNarrative,
      exportSignatureTitle,
    ],
  );
  const activeCardPlacement = useMemo(() => {
    if (!activeCluster) return null;
    const measuredWidth =
      overlayMeasuredSize?.width ?? overlayCardWidth * overlayResponsiveScale;
    const measuredHeight =
      overlayMeasuredSize?.height ?? overlayCardHeight * overlayResponsiveScale;
    const scaledCardWidth = measuredWidth + OVERLAY_HALO_BLEED * 2;
    const scaledCardHeight = measuredHeight + OVERLAY_HALO_BLEED * 2;
    const rawLeft = activeCluster.cx - scaledCardWidth * 0.5;
    const rawTop = activeCluster.cy - OVERLAY_TITLE_ANCHOR_Y * overlayResponsiveScale;

    const clampedLeft = clamp(rawLeft, OVERLAY_CARD_PADDING, WIDTH - scaledCardWidth - OVERLAY_CARD_PADDING);
    const clampedTop = clamp(rawTop, OVERLAY_CARD_PADDING, HEIGHT - scaledCardHeight - OVERLAY_CARD_PADDING);

    return {
      leftPercent: (clampedLeft / WIDTH) * 100,
      topPercent: (clampedTop / HEIGHT) * 100,
    } as const;
  }, [
    activeCluster,
    overlayCardHeight,
    overlayCardWidth,
    overlayMeasuredSize,
    overlayResponsiveScale,
  ]);

  const exportSignatureArtifactImage = async (mode: SignatureExportMode) => {
    if (isExportingCard) return;

    setIsExportingCard(true);
    onExportEvent?.({ status: "exporting", mode });
    let svgUrl: string | null = null;
    let imageUrl: string | null = null;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_IMAGE_WIDTH;
      canvas.height = EXPORT_IMAGE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable.");
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.left = "-9999px";
      probe.style.top = "-9999px";
      probe.style.pointerEvents = "none";
      probe.style.opacity = "0";

      const uiProbe = document.createElement("span");
      uiProbe.className = "font-ui";
      uiProbe.textContent = "A";
      const headlineProbe = document.createElement("span");
      headlineProbe.className = "font-instrument";
      headlineProbe.textContent = "A";
      probe.appendChild(uiProbe);
      probe.appendChild(headlineProbe);
      document.body.appendChild(probe);

      const uiFontFamily = getComputedStyle(uiProbe).fontFamily || "sans-serif";
      const headlineFontFamily = getComputedStyle(headlineProbe).fontFamily || "serif";
      probe.remove();

      const rootStyles = getComputedStyle(document.documentElement);
      const paperColor = rootStyles.getPropertyValue("--paper").trim() || "#FEFEFD";
      const mistColor = rootStyles.getPropertyValue("--mist").trim() || "#F8F8F6";
      const inkColor = rootStyles.getPropertyValue("--ink").trim() || "#111111";
      const metaColor = rootStyles.getPropertyValue("--meta").trim() || "#888894";
      const summaryColor = "rgba(254,254,253,0.88)";
      const rawHeatmapBackgroundColor = heatmapSvgRef.current
        ? getComputedStyle(heatmapSvgRef.current).backgroundColor
        : exportSnapshot.heatmap.backgroundColor;
      const heatmapBackgroundColor =
        rawHeatmapBackgroundColor && !rawHeatmapBackgroundColor.includes("var(")
          ? rawHeatmapBackgroundColor
          : mistColor;

      const snapshot: SignatureArtifactSnapshot = {
        ...exportSnapshot,
        heatmap: {
          ...exportSnapshot.heatmap,
          backgroundColor: heatmapBackgroundColor,
        },
      };
      if (snapshot.heatmap.contours.length === 0) {
        throw new Error("Artifact snapshot has no contours.");
      }

      ctx.fillStyle = mistColor;
      ctx.fillRect(0, 0, EXPORT_IMAGE_WIDTH, EXPORT_IMAGE_HEIGHT);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const frameX = 72;
      const frameY = 72;
      const frameW = EXPORT_IMAGE_WIDTH - frameX * 2;
      const frameH = EXPORT_IMAGE_HEIGHT - frameY * 2;
      roundedRectPath(ctx, frameX, frameY, frameW, frameH, 24);
      ctx.fillStyle = paperColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(17,17,17,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const cardX = frameX + 64;
      const cardY = frameY + 126;
      const cardW = frameW - 128;
      const cardH = frameH - 236;
      const blackCardInset = 10;

      roundedRectPath(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fillStyle = mistColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(17,17,17,0.06)";
      ctx.stroke();

      const leftPaneW = Math.round(cardW * 0.42);
      const blackCardX = cardX + blackCardInset;
      const blackCardY = cardY + 10;
      const blackCardW = leftPaneW - blackCardInset * 2;
      const blackCardH = cardH - 20;
      roundedRectPath(ctx, blackCardX, blackCardY, blackCardW, blackCardH, 14);
      ctx.fillStyle = inkColor;
      ctx.fill();
      const blackInnerX = blackCardX + 42;
      const blackInnerY = blackCardY + 52;
      const blackInnerW = blackCardW - 84;
      const blackInnerH = blackCardH - 98;
      const exportHeadingPrefix = `${snapshot.text.displayName}-`;
      let headingSize = 46;
      let headingPrefixWidth = 0;

      while (headingSize >= 30) {
        ctx.font = `400 ${headingSize}px ${uiFontFamily}, sans-serif`;
        headingPrefixWidth = ctx.measureText(exportHeadingPrefix).width;
        ctx.font = `italic 400 ${headingSize}px ${headlineFontFamily}, serif`;
        const headingTitleWidth = ctx.measureText(snapshot.text.signatureTitle).width;
        if (headingPrefixWidth + headingTitleWidth <= blackInnerW) break;
        headingSize -= 2;
      }

      let cursorY = blackInnerY + headingSize;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = paperColor;
      ctx.font = `400 ${headingSize}px ${uiFontFamily}, sans-serif`;
      ctx.fillText(exportHeadingPrefix, blackInnerX, cursorY);
      ctx.font = `italic 400 ${headingSize}px ${headlineFontFamily}, serif`;
      ctx.fillText(snapshot.text.signatureTitle, blackInnerX + headingPrefixWidth + 2, cursorY);

      cursorY += 54;
      let bodyFontSize = 24;
      let lineHeight = 38;
      let narrativeLines: string[] = [];
      let maxLines = 1;
      const narrativeMaxHeight = blackInnerY + blackInnerH - cursorY;

      while (bodyFontSize >= 16) {
        ctx.font = `400 ${bodyFontSize}px ${uiFontFamily}, sans-serif`;
        narrativeLines = wrapTextLines(ctx, snapshot.text.narrative, blackInnerW);
        lineHeight = Math.round(bodyFontSize * 1.56);
        maxLines = Math.max(1, Math.floor(narrativeMaxHeight / lineHeight));
        if (narrativeLines.length <= maxLines) break;
        bodyFontSize -= 2;
      }

      const displayNarrativeLines = truncateLinesWithEllipsis(ctx, narrativeLines, maxLines, blackInnerW);
      ctx.fillStyle = summaryColor;
      ctx.font = `400 ${bodyFontSize}px ${uiFontFamily}, sans-serif`;
      for (const line of displayNarrativeLines) {
        ctx.fillText(line, blackInnerX, cursorY);
        cursorY += lineHeight;
      }

      const screenshotPanelX = cardX + leftPaneW;
      const screenshotPanelY = cardY;
      const screenshotPanelW = cardW - leftPaneW;
      const screenshotPanelH = cardH;
      const screenshotInsetX = Math.round(screenshotPanelW * 0.035);
      const screenshotInsetY = Math.round(screenshotPanelH * 0.055);
      const screenshotX = screenshotPanelX + screenshotInsetX;
      const screenshotY = screenshotPanelY + screenshotInsetY;
      const screenshotW = screenshotPanelW - screenshotInsetX * 2;
      const screenshotH = screenshotPanelH - screenshotInsetY * 2;
      const screenshotScale = Math.min(
        screenshotW / snapshot.heatmap.width,
        screenshotH / snapshot.heatmap.height,
      );
      const drawnScreenshotW = snapshot.heatmap.width * screenshotScale;
      const drawnScreenshotH = snapshot.heatmap.height * screenshotScale;
      const drawnScreenshotX = screenshotX + (screenshotW - drawnScreenshotW) * 0.5;
      const drawnScreenshotY = screenshotY + (screenshotH - drawnScreenshotH) * 0.5;

      const heatmapSvgMarkup = buildArtifactHeatmapSvgMarkup(snapshot, uiFontFamily);
      const serializedSvg = `<?xml version="1.0" encoding="UTF-8"?>${heatmapSvgMarkup}`;
      svgUrl = URL.createObjectURL(new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" }));
      const heatmapImage = await loadImageFromUrl(svgUrl);
      ctx.drawImage(
        heatmapImage,
        drawnScreenshotX,
        drawnScreenshotY,
        drawnScreenshotW,
        drawnScreenshotH,
      );

      const footerY = cardY + cardH + 42;
      const footerText = "cenoir signature artifact";
      ctx.font = `400 22px ${uiFontFamily}, sans-serif`;
      ctx.fillStyle = metaColor;
      const footerTextWidth = ctx.measureText(footerText).width;
      ctx.fillText(footerText, cardX + cardW - footerTextWidth, footerY);

      const imageBlob = await canvasToPngBlob(canvas);
      const fileName = `cenoir-signature-${snapshot.text.displayName.toLowerCase().replace(/\s+/g, "-")}.png`;
      const imageFile = new File([imageBlob], fileName, { type: "image/png" });
      const shareTitle = `Signature Artifact · ${snapshot.text.displayName}`;
      const shareText = "Cenoir signature artifact";

      if (
        mode === "share" &&
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        navigator.canShare({ files: [imageFile] })
      ) {
        await navigator.share({
          files: [imageFile],
          title: shareTitle,
          text: shareText,
        });
        onExportEvent?.({ status: "done", mode, channel: "share-file" });
        return;
      }

      if (mode === "share" && typeof navigator !== "undefined" && "share" in navigator) {
        try {
          const url = typeof window !== "undefined" ? window.location.href : undefined;
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url,
          });
          onExportEvent?.({ status: "done", mode, channel: "share-link" });
          return;
        } catch {
          // Fall through to deterministic download fallback.
        }
      }

      imageUrl = URL.createObjectURL(imageBlob);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      onExportEvent?.({ status: "done", mode, channel: "download" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export failure.";
      onExportEvent?.({ status: "failed", mode, message });
      console.error("Signature artifact export failed.", error);
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setIsExportingCard(false);
    }
  };

  exportActionRef.current = exportSignatureArtifactImage;

  useEffect(() => {
    const onExportRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: SignatureExportMode }>).detail;
      if (detail?.mode !== "save" && detail?.mode !== "share") return;
      void exportActionRef.current(detail.mode);
    };
    window.addEventListener("unseen:signature-artifact-export", onExportRequest as EventListener);
    return () => {
      window.removeEventListener("unseen:signature-artifact-export", onExportRequest as EventListener);
    };
  }, []);

  return (
    <div className="w-full overflow-visible">
      <div
        ref={heatmapContainerRef}
        className="relative mx-auto overflow-visible"
        style={{ width: `${OVERLAY_HEATMAP_SCALE * 100}%` }}
      >
        <svg
          ref={heatmapSvgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          onMouseLeave={() => {
            setHoveredClusterId(null);
            clearHoverExpandTimer();
          }}
          style={{
            backgroundColor,
            overflow: "visible",
          }}
        >
          {allContours.map((contour, index) => (
            <motion.path
              key={`all-${index}`}
              d={contoursPath(contour.coordinates as number[][][][])}
              fill={overviewContourFill(index, allContours.length)}
              stroke={overviewContourColor(index, allContours.length)}
              strokeWidth={0.72}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.4, delay: index * 0.085, ease: EASE }}
            />
          ))}

          {data.clusters.map((cluster) => {
            const isHovered = hoveredClusterId === cluster.id;
            const isActive = activeClusterId === cluster.id;
            return (
              <text
                key={`label-${cluster.id}`}
                x={cluster.cx}
                y={cluster.cy}
                textAnchor="middle"
                className="select-none font-ui"
                onMouseEnter={() => {
                  setHoveredClusterId(cluster.id);
                  startHoverExpandTimer(cluster.id);
                }}
                onMouseLeave={() => {
                  setHoveredClusterId((current) => (current === cluster.id ? null : current));
                  clearHoverExpandTimer();
                }}
                onFocus={() => {
                  setHoveredClusterId(cluster.id);
                  startHoverExpandTimer(cluster.id);
                }}
                onBlur={() => {
                  setHoveredClusterId((current) => (current === cluster.id ? null : current));
                  clearHoverExpandTimer();
                }}
                onClick={() => {
                  clearHoverExpandTimer();
                  const isSameCluster = activeClusterId === cluster.id;
                  setIsOverlayExpanded(!isSameCluster);
                  setActiveClusterId(isSameCluster ? null : cluster.id);
                }}
                style={{
                  fontSize: isHovered ? "19px" : "17px",
                  fontWeight: isActive || isHovered ? 540 : 500,
                  fill: isActive || isHovered ? "var(--ink)" : "rgba(17,17,17,0.72)",
                  letterSpacing: "0.015em",
                  cursor: "pointer",
                  transition: "fill 160ms ease, font-size 180ms ease",
                }}
              >
                {cluster.name}
              </text>
            );
          })}
        </svg>

        {activeCluster && activeCardPlacement ? (
          <motion.div
            className="pointer-events-none absolute inset-0 overflow-visible"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div
              ref={overlayMeasureRef}
              className="pointer-events-auto absolute"
              style={{
                left: `${activeCardPlacement.leftPercent}%`,
                top: `${activeCardPlacement.topPercent}%`,
                width: `${(overlayCardWidth / WIDTH) * 100}%`,
                maxWidth: `${overlayCardWidth}px`,
                transform: `scale(${overlayResponsiveScale})`,
                transformOrigin: "top left",
              }}
              onMouseLeave={() => {
                setActiveClusterId(null);
                setIsOverlayExpanded(false);
              }}
            >
              <div
                className="relative w-full px-5 py-4"
                style={{ borderRadius: `${OVERLAY_CORNER_RADIUS_PX}px` }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{
                    top: `${-OVERLAY_HALO_BLEED}px`,
                    right: `${-OVERLAY_HALO_BLEED}px`,
                    bottom: `${-OVERLAY_HALO_BLEED}px`,
                    left: `${-OVERLAY_HALO_BLEED}px`,
                    borderRadius: `${OVERLAY_CORNER_RADIUS_PX}px`,
                    background: OVERLAY_SOFT_BACKGROUND,
                    boxShadow: OVERLAY_SOFT_SHADOW,
                  }}
                />

                <div className="relative">
                  <h3 className="flex w-full items-baseline justify-start leading-none text-ink">
                    <span className="font-ui text-[19px] font-normal leading-none tracking-[-0.06em]">The</span>
                    <span className="-ml-[1px] font-ui text-[19px] font-normal leading-none tracking-[-0.06em]">–</span>
                    <span className="ml-[2px] font-instrument text-[19px] italic leading-none tracking-[0.01em]">
                      {activeCluster.name}
                    </span>
                  </h3>

                  <p className="mt-2.5 text-justify font-ui text-[13px] font-normal leading-[1.65] text-meta">
                    {thesisText}
                  </p>

                  <div className="mx-auto mt-3 flex max-w-[440px] flex-wrap justify-center gap-x-[9px] gap-y-[7px]">
                    {focusAttributes.map((word) => (
                      <span
                        key={`detail-tag-${word.id}`}
                        className="inline-flex h-[27px] items-center justify-center whitespace-nowrap rounded-[999px] border border-ink bg-ink px-[10px] text-center font-ui text-[13px] font-normal leading-[17px] tracking-[-0.03em] text-paper shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      >
                        {word.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        ) : null}
      </div>

    </div>
  );
}
