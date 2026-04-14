"use client";

import { contourDensity } from "d3-contour";
import { motion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";
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

const WIDTH = 760;
const HEIGHT = 410;
const CONTOUR_BLEED_BOTTOM = 130;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const TYPING_HIGHLIGHT_WORDS = new Set([
  "refined",
  "versatility",
  "leathers",
  "cashmeres",
  "espresso",
  "alabaster",
  "minimalism",
  "sculptural",
  "bold",
  "individuality",
  "modernity",
]);

function renderTypedTextWithHighlights(text: string, isActive: boolean): ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\s+|[,.!?:;]+)/g);
  return parts.map((part, index) => {
    const normalized = part.toLowerCase().replace(/[^a-z]/g, "");
    if (normalized && TYPING_HIGHLIGHT_WORDS.has(normalized)) {
      return (
        <span
          key={`typed-highlight-${index}`}
          className={`font-ui transition-colors duration-[3600ms] ease-[cubic-bezier(0.18,0.96,0.22,1)] ${
            isActive ? "font-medium text-accent" : "font-normal text-ink/90"
          }`}
        >
          {part}
        </span>
      );
    }
    return <span key={`typed-part-${index}`}>{part}</span>;
  });
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
    const marginX = 82;
    const marginY = 64;
    return {
      id: cluster.id,
      name: cluster.name,
      thesis: cluster.thesis,
      weight: cluster.weight,
      rng: cluster.rng,
      attrs: cluster.attrs,
      labelW: cluster.labelW,
      labelH: cluster.labelH,
      cx: marginX + cluster.rng() * (WIDTH - marginX * 2),
      cy: marginY + cluster.rng() * (HEIGHT - marginY * 2),
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
      cluster.cx = clamp(cluster.cx, 66, WIDTH - 66);
      cluster.cy = clamp(cluster.cy, 52, HEIGHT - 52);
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
      word.x = clamp(word.x, 26 + word.boxW * 0.5, WIDTH - 26 - word.boxW * 0.5);
      word.y = clamp(word.y, 24 + word.boxH, HEIGHT - 24);
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
  const r = Math.round(166 - t * 74);
  const g = Math.round(172 - t * 66);
  const b = Math.round(184 - t * 52);
  const a = 0.2 + t * 0.24;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function overviewContourFill(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const r = Math.round(182 - t * 96);
  const g = Math.round(188 - t * 84);
  const b = Math.round(198 - t * 66);
  const a = 0.018 + t * 0.05;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
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

export default function TasteWordTopography({ user }: { user: MockUserProfile }) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [hintClusterId, setHintClusterId] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLetterHovering, setIsLetterHovering] = useState(false);
  const [letterHoverPos, setLetterHoverPos] = useState({ x: 0, y: 0 });
  const [hoverPillIndex, setHoverPillIndex] = useState(0);
  const [previousHoverPillText, setPreviousHoverPillText] = useState<string | null>(null);
  const [typedTopText, setTypedTopText] = useState("");
  const [isTypingTopText, setIsTypingTopText] = useState(false);
  const [areWordHighlightsActive, setAreWordHighlightsActive] = useState(true);
  const [isGraphRevealReady, setIsGraphRevealReady] = useState(false);
  const [isNameRevealDone, setIsNameRevealDone] = useState(false);
  const didRunClusterHintRef = useRef(false);

  const data = useMemo(() => buildClusters(user.tasteAttributes.clusters ?? [], user.userId), [user]);
  const activeCluster = data.clusters.find((cluster) => cluster.id === activeClusterId) ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveClusterId(null);
        setHoveredClusterId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isUnlocking) return;
    const timeout = window.setTimeout(() => {
      setIsUnlocked(true);
      setIsUnlocking(false);
    }, 640);
    return () => window.clearTimeout(timeout);
  }, [isUnlocking]);

  useEffect(() => {
    if (!isLetterHovering) return;
    const interval = window.setInterval(() => {
      setHoverPillIndex((current) => {
        const next = current === 0 ? 1 : 0;
        setPreviousHoverPillText(current === 0 ? "Decode Your References" : "Unlock a Portrait of Your Taste");
        window.setTimeout(() => {
          setPreviousHoverPillText(null);
        }, 240);
        return next;
      });
    }, 1100);
    return () => window.clearInterval(interval);
  }, [isLetterHovering]);

  useEffect(() => {
    if (!isGraphRevealReady || didRunClusterHintRef.current || data.clusters.length === 0) return;

    didRunClusterHintRef.current = true;
    let index = 0;
    const ids = data.clusters.map((cluster) => cluster.id);
    const startDelay = window.setTimeout(() => {
      const timer = window.setInterval(() => {
        if (index >= ids.length) {
          window.clearInterval(timer);
          setHintClusterId(null);
          return;
        }
        setHintClusterId(ids[index]);
        index += 1;
      }, 560);

      window.setTimeout(() => {
        window.clearInterval(timer);
        setHintClusterId(null);
      }, ids.length * 560 + 420);
    }, 940);

    return () => {
      window.clearTimeout(startDelay);
      setHintClusterId(null);
    };
  }, [data.clusters, isGraphRevealReady]);

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
      .thresholds(9)(contourPoints);
  }, [contourPoints]);

  const focusAttributes = useMemo(() => buildFocusAttributeLayout(activeCluster), [activeCluster]);
  const thesisText = activeCluster ? activeCluster.thesis.trim() : "";
  const topTasteText = user.tasteDescription.tasteThesis.trim();
  const leadPhrase = "In a world";
  const hasLeadPhrase = topTasteText.toLowerCase().startsWith(leadPhrase.toLowerCase());
  const topTasteTextRemainder = hasLeadPhrase ? topTasteText.slice(leadPhrase.length).trimStart() : topTasteText;
  const typingTargetText = hasLeadPhrase ? topTasteTextRemainder : topTasteText;
  const nameDisplayText = `For ${user.name}`;
  const typedTopTextNodes = useMemo(
    () => renderTypedTextWithHighlights(typedTopText, areWordHighlightsActive),
    [areWordHighlightsActive, typedTopText],
  );
  const isTypingComplete = isUnlocked && typedTopText.length >= typingTargetText.length && !isTypingTopText;
  const handleUnlock = () => {
    if (isUnlocked || isUnlocking) return;
    setTypedTopText("");
    setIsTypingTopText(false);
    setAreWordHighlightsActive(true);
    setIsGraphRevealReady(false);
    setIsNameRevealDone(false);
    setIsUnlocking(true);
  };

  useEffect(() => {
    if (!isTypingComplete) return;
    const timeout = window.setTimeout(() => {
      setAreWordHighlightsActive(false);
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [isTypingComplete]);

  useEffect(() => {
    if (!isTypingComplete) return;
    const timeout = window.setTimeout(() => {
      setIsGraphRevealReady(true);
    }, 760);
    return () => window.clearTimeout(timeout);
  }, [isTypingComplete]);

  useEffect(() => {
    if (!isUnlocked || !isNameRevealDone) return;

    let index = 0;
    let timer: number | null = null;
    const scheduleNext = () => {
      if (index === 0) setIsTypingTopText(true);
      index += 1;
      setTypedTopText(typingTargetText.slice(0, index));
      if (index >= typingTargetText.length) {
        setIsTypingTopText(false);
        return;
      }
      const nextChar = typingTargetText[index] ?? "";
      const currentChar = typingTargetText[index - 1] ?? "";
      const pause =
        currentChar === "." || currentChar === "," || currentChar === ":" || currentChar === ";"
          ? 120
          : currentChar === " "
            ? 26
            : nextChar === " "
              ? 18
              : 11 + (index % 3);
      timer = window.setTimeout(scheduleNext, pause);
    };

    timer = window.setTimeout(scheduleNext, 140);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isNameRevealDone, isUnlocked, typingTargetText]);

  useEffect(() => {
    if (!isUnlocked) return;
    const timer = window.setTimeout(() => {
      setIsNameRevealDone(true);
    }, 980);
    return () => window.clearTimeout(timer);
  }, [isUnlocked]);

  return (
    <main className="mx-auto max-w-[1160px] px-5 py-8 md:px-8 md:py-10">
      <header className="mb-3 border-b border-line pb-3 md:mb-4">
        <h1 className="inline-flex items-center leading-none text-ink">
          <span className="font-ui text-[25px] font-normal tracking-[-0.06em]">The</span>
          <span className="-ml-[1px] font-ui text-[25px] font-normal tracking-[-0.06em]">–</span>
          <span className="ml-[2px] font-instrument text-[25px] italic tracking-[0.01em]">Signature</span>
        </h1>
      </header>

      {!isUnlocked ? (
        <motion.section
          className="relative mb-12 flex min-h-[520px] items-center justify-center md:mb-16 md:min-h-[640px]"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={
            isUnlocking
              ? {
                  opacity: 0,
                  y: -32,
                  scale: 0.94,
                  transition: { duration: 0.9, ease: EASE },
                }
              : { opacity: 1, y: 0, scale: 1 }
          }
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(17,17,17,0.06)_0%,rgba(17,17,17,0)_68%)]" />
          <button
            type="button"
            className="group relative cursor-pointer rounded-[2px] focus-visible:outline-none"
            onClick={handleUnlock}
            onMouseEnter={() => setIsLetterHovering(true)}
            onMouseLeave={() => {
              setIsLetterHovering(false);
              setPreviousHoverPillText(null);
            }}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setLetterHoverPos({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            aria-label="Unlock the portrait"
          >
            <motion.div
              initial={{ y: 14, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1, transition: { duration: 1, delay: 0.1, ease: EASE } }}
              whileHover={{ y: -6, scale: 1.015, transition: { duration: 0.35, ease: EASE } }}
            >
              <Image
                src="/intro/letter-copy-2.png"
                alt="Letter"
                width={560}
                height={760}
                priority
                className="h-auto w-[360px] object-contain shadow-[0_4px_14px_rgba(0,0,0,0.14)] md:w-[460px]"
              />
            </motion.div>
            {isLetterHovering ? (
              <motion.div
                className="pointer-events-none absolute z-10"
                style={{
                  left: letterHoverPos.x,
                  top: letterHoverPos.y,
                }}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
              >
                <div className="-translate-x-1/2 -translate-y-[130%]">
                  <div className="inline-flex h-[29px] items-center whitespace-nowrap rounded-[999px] bg-ink px-[11px] shadow-[0_10px_26px_rgba(17,17,17,0.22),0_2px_6px_rgba(17,17,17,0.16)]">
                    <span className="relative inline-flex min-w-[1px] items-center">
                      {previousHoverPillText ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper"
                          style={{ animation: "twt-cue-text-out 240ms cubic-bezier(0.22,1,0.36,1) forwards" }}
                        >
                          {previousHoverPillText}
                        </span>
                      ) : null}
                      <span
                        key={hoverPillIndex}
                        className="relative whitespace-nowrap font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper"
                        style={{ animation: "twt-cue-text-in 240ms cubic-bezier(0.22,1,0.36,1) both" }}
                      >
                        {hoverPillIndex === 0 ? "Decode Your References" : "Unlock a Portrait of Your Taste"}
                      </span>
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </button>
        </motion.section>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: EASE }}>
          <motion.p
            className="mb-14 font-ui text-[13px] font-normal leading-[1.5] tracking-[0.02em] text-meta md:mb-16"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          >
            A Portrait of Your Taste, Decoded Through Your References.
          </motion.p>

          <motion.section
            className="mb-14 md:mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.86, delay: 0.22, ease: EASE }}
          >
            <div className="relative mx-auto max-w-[760px] px-6 md:px-10">
              <motion.p
                className="pointer-events-none absolute -top-11 left-0 -translate-x-[10px] whitespace-nowrap font-belmonte text-[30px] leading-none text-accent"
                initial={{ opacity: 0, y: 8, filter: "blur(4px)", letterSpacing: "0.08em" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", letterSpacing: "0.015em" }}
                transition={{ duration: 0.95, delay: 0.2, ease: EASE }}
              >
                {nameDisplayText}
              </motion.p>

              <p
                className={`text-justify font-ui text-[13px] font-normal leading-[1.8] text-ink/90 ${
                  isTypingTopText ? "twt-type-glow" : ""
                }`}
              >
                {hasLeadPhrase ? (
                  <>
                    <span className="font-instrument text-[20px] italic leading-none text-ink">In a world</span>{" "}
                    {typedTopTextNodes}
                  </>
                ) : (
                  typedTopTextNodes
                )}
                {isTypingTopText ? <span aria-hidden="true" className="twt-type-caret">|</span> : null}
              </p>
            </div>
          </motion.section>

          {isGraphRevealReady ? (
            <motion.section
              className="relative mx-auto max-w-[840px] bg-paper p-3"
              initial={{
                opacity: 0,
                y: 56,
                scale: 0.95,
                filter: "blur(14px)",
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
              }}
              transition={{ duration: 2.05, ease: EASE }}
              onMouseLeave={() => {
                setHoveredClusterId(null);
                setActiveClusterId(null);
              }}
            >
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full"
              style={{
                backgroundColor: "rgba(254,254,253,0.99)",
                backgroundImage: "radial-gradient(rgba(17,17,17,0.02) 0.5px, transparent 0.5px)",
                backgroundSize: "3px 3px",
                overflow: "visible",
              }}
            >
              <defs>
                <filter id="nonactive-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="7.5" />
                </filter>
              </defs>

              <motion.g
                animate={{ opacity: activeClusterId ? 0.13 : 1 }}
                transition={{ duration: 1.2, ease: EASE }}
                style={{ filter: activeClusterId ? "url(#nonactive-blur)" : "none" }}
              >
                {allContours.map((contour, index) => (
                  <motion.path
                    key={`all-${index}`}
                    d={contoursPath(contour.coordinates as number[][][][])}
                    fill={overviewContourFill(index, allContours.length)}
                    stroke={overviewContourColor(index, allContours.length)}
                    strokeWidth={0.78}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 2.4, delay: index * 0.085, ease: EASE }}
                  />
                ))}

                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.15, delay: 0.95, ease: EASE }}
                >
                  {data.clusters.map((cluster) => {
                    const isHovered = hoveredClusterId === cluster.id || hintClusterId === cluster.id;
                    return (
                      <text
                        key={`label-${cluster.id}`}
                        x={cluster.cx}
                        y={cluster.cy}
                        textAnchor="middle"
                        className="select-none font-ui"
                        onMouseEnter={() => setHoveredClusterId(cluster.id)}
                        onMouseLeave={() => setHoveredClusterId(null)}
                        onClick={() => setActiveClusterId((current) => (current === cluster.id ? null : cluster.id))}
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          fill: isHovered ? "var(--accent)" : "var(--meta)",
                          letterSpacing: "0.015em",
                          cursor: "pointer",
                          transition: "fill 520ms cubic-bezier(0.22,1,0.36,1)",
                        }}
                      >
                        {cluster.name}
                      </text>
                    );
                  })}
                </motion.g>
              </motion.g>

            </svg>

            {activeCluster ? (
              <motion.div
                className="pointer-events-none absolute -inset-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.48, ease: EASE }}
              >
                <div
                  className="h-full w-full"
                  style={{
                    background: `
                      radial-gradient(
                        480px 320px at ${(activeCluster.cx / WIDTH) * 100}% ${(activeCluster.cy / HEIGHT) * 100}%,
                        rgba(112,114,128,0.12) 0%,
                        rgba(124,126,140,0.07) 36%,
                        rgba(137,139,152,0.03) 64%,
                        rgba(137,139,152,0) 100%
                      )
                    `,
                    filter: "blur(18px)",
                  }}
                />
              </motion.div>
            ) : null}

            {activeCluster ? (
              <motion.div
                className="absolute inset-3 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div
                  className="pointer-events-auto w-full max-w-[600px] max-h-[78%] overflow-y-auto rounded-[20px] border border-line/85 bg-[rgba(254,254,253,0.52)] px-8 py-7"
                  style={{
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 10px 26px rgba(17,17,17,0.08)",
                  }}
                >
                  <h2 className="inline-flex w-full max-w-[620px] items-center justify-start text-left leading-none text-ink">
                    <span className="font-ui text-[24px] font-normal tracking-[-0.06em]">
                      The
                    </span>
                    <span className="-ml-[2px] px-[2px] font-ui text-[24px] font-normal tracking-[-0.06em]">–</span>
                    <span className="ml-[1px] font-instrument text-[24px] italic tracking-[0.01em]">
                      {activeCluster.name}
                    </span>
                  </h2>

                  <p className="mt-6 max-w-[540px] text-[14px] font-normal leading-5 tracking-[0.02em] text-ink">
                    {thesisText}
                  </p>

                  <div className="mt-6 flex max-w-[540px] flex-wrap items-center gap-x-[10px] gap-y-[10px]">
                    {focusAttributes.map((word) => (
                      <span
                        key={`attr-pill-${word.id}`}
                        className="inline-flex h-[33px] items-center justify-center rounded-[999px] border border-line/80 bg-[#F5F5F6] px-4 font-ui text-[13px] font-normal leading-5 tracking-[0.02em] text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                      >
                        {word.label}
                      </span>
                    ))}
                  </div>

                </div>
              </motion.div>
            ) : null}
            </motion.section>
          ) : null}
        </motion.div>
      )}
      <style jsx>{`
        @keyframes twt-cue-text-in {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes twt-cue-text-out {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
        @keyframes twt-type-caret-blink {
          0%,
          45% {
            opacity: 1;
          }
          60%,
          100% {
            opacity: 0;
          }
        }
        @keyframes twt-type-glow-breathe {
          0%,
          100% {
            text-shadow: 0 0 0 rgba(53, 35, 122, 0);
          }
          50% {
            text-shadow: 0 0 8px rgba(53, 35, 122, 0.12);
          }
        }
        .twt-type-caret {
          display: inline-block;
          margin-left: 2px;
          color: var(--accent);
          animation: twt-type-caret-blink 900ms steps(1, end) infinite;
        }
        .twt-type-glow {
          animation: twt-type-glow-breathe 1.8s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
