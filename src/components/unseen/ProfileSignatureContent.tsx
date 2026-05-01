"use client";

import { contourDensity } from "d3-contour";
import { AnimatePresence, motion } from "framer-motion";
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

function limitToSentences(text: string, maxSentences: number): string {
  if (!text) return "";
  const parts = text.match(/[^.!?]+[.!?]?/g) ?? [];
  return parts
    .slice(0, maxSentences)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function ProfileSignatureContent({ user }: { user: MockUserProfile }) {
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [hintClusterId, setHintClusterId] = useState<string | null>(null);
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
    if (didRunClusterHintRef.current || data.clusters.length === 0) return;

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
  }, [data.clusters]);

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

  return (
    <div className="mx-auto w-full max-w-none px-10 pb-8 pt-0 md:px-10 md:pb-10 md:pt-0">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: EASE }}>
          <motion.section
            className="mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.86, delay: 0.22, ease: EASE }}
          >
            <div className="relative mx-auto max-w-[760px] px-6 md:px-10">
              <div className="flex items-start gap-3 pl-3 pt-2">
                <span className="font-instrument text-[80px] italic leading-[0.7] text-ink/80">“</span>
                <p
                  className="pt-1 text-justify font-ui text-[13px] font-normal leading-[1.8] text-ink/90"
                >
                  {topTasteText}
                </p>
              </div>
            </div>
          </motion.section>

            <motion.section
              className="relative mx-auto max-w-[680px] bg-paper p-2"
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
              }}
            >
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full"
              style={{
                backgroundColor: "var(--paper)",
                overflow: "visible",
              }}
            >
              <defs>
                <filter id="nonactive-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="7.5" />
                </filter>
                <filter id="contour-fringe" x="-16%" y="-16%" width="132%" height="132%">
                  <feGaussianBlur stdDeviation="1.6" />
                </filter>
              </defs>

              <motion.g
                animate={{ opacity: activeClusterId ? 0.13 : 1 }}
                transition={{ duration: 1.2, ease: EASE }}
                style={{ filter: activeClusterId ? "url(#nonactive-blur)" : "none" }}
              >
                {allContours.map((contour, index) => {
                  const pathData = contoursPath(contour.coordinates as number[][][][]);
                  const fillColor = overviewContourFill(index, allContours.length);
                  const strokeColor = overviewContourColor(index, allContours.length);

                  return (
                    <g key={`all-${index}`}>
                      <motion.path
                        d={pathData}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={1.18}
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        filter="url(#contour-fringe)"
                        opacity={0.42}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.42 }}
                        transition={{ duration: 2.4, delay: index * 0.085, ease: EASE }}
                      />
                      <motion.path
                        d={pathData}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={0.72}
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 2.4, delay: index * 0.085, ease: EASE }}
                      />
                    </g>
                  );
                })}

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
                          fill: activeClusterId
                            ? cluster.id === activeClusterId
                              ? "var(--ink)"
                              : "var(--meta)"
                            : isHovered
                              ? "var(--accent)"
                              : "var(--meta)",
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

            <AnimatePresence>
              {activeCluster ? (
                <motion.div
                  className="absolute inset-3 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setActiveClusterId(null);
                      setHoveredClusterId(null);
                    }
                  }}
                >
                  <div className="pointer-events-auto relative w-full max-w-[680px] max-h-[78%] overflow-y-auto bg-paper/96 p-8">
                    <button
                      type="button"
                      aria-label="Close detail card"
                      className="absolute right-8 top-8 inline-flex h-[14px] w-[20px] items-center justify-center text-meta transition-colors duration-150 hover:text-ink focus-visible:outline-none"
                      onClick={() => {
                        setActiveClusterId(null);
                        setHoveredClusterId(null);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 block h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 block h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
                      />
                    </button>

                    <h2 className="inline-flex w-full items-center justify-start text-left leading-none text-ink">
                      <span className="font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">The</span>
                      <span className="-ml-[2px] px-[2px] font-ui text-[25px] font-normal leading-none tracking-[-0.06em]">
                        –
                      </span>
                      <span className="ml-[2px] font-instrument text-[25px] italic leading-none tracking-[0.01em]">
                        {activeCluster.name}
                      </span>
                    </h2>

                    <p className="mt-4 text-justify font-ui text-[14px] font-normal leading-[1.7] text-ink">
                      {thesisText}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {focusAttributes.map((word) => (
                        <span
                          key={`detail-tag-${word.id}`}
                          className="relative isolate inline-flex h-[25px] items-center justify-center whitespace-nowrap bg-[#6F7381] px-[14px] font-ui text-[14px] font-normal leading-[18px] tracking-[-0.03em] text-paper shadow-[inset_0_0_0_1px_#6F7381,0_1px_2px_rgba(0,0,0,0.12)] before:absolute before:left-[-7px] before:top-1/2 before:-z-10 before:h-[29px] before:w-[20px] before:-translate-y-1/2 before:rounded-full before:bg-[#6F7381] before:shadow-[inset_0_0_0_1px_#6F7381] before:content-[''] after:absolute after:right-[-7px] after:top-1/2 after:-z-10 after:h-[29px] after:w-[20px] after:-translate-y-1/2 after:rounded-full after:bg-[#6F7381] after:shadow-[inset_0_0_0_1px_#6F7381] after:content-['']"
                        >
                          {word.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            </motion.section>
      </motion.div>
    </div>
  );
}
