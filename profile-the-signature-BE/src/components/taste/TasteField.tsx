"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MockTasteAttribute, MockUserProfile } from "@/data/mockUsers";

type ClusterMeta = {
  id: string;
  index: number;
  name: string;
  thesis: string;
  center: { x: number; y: number };
  radius: number;
  weight: number;
  imageIndexes: number[];
  color: string;
};

type ImageNode = {
  imageIndex: number;
  src: string;
  clusterId: string;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  size: number;
};

type AttributeMeta = {
  id: string;
  clusterId: string;
  attribute: MockTasteAttribute;
  emphasis: number;
};

type TasteFieldLayout = {
  clustersMeta: ClusterMeta[];
  imageNodes: ImageNode[];
  attributesByCluster: Record<string, AttributeMeta[]>;
  allAttributes: Record<string, AttributeMeta>;
  strongestClusterId: string;
  introDelayMs: number;
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function useTasteFieldLayout(user: MockUserProfile): TasteFieldLayout {
  return useMemo(() => {
    const clusters = user.tasteAttributes.clusters ?? [];
    const totalImages = Math.min(30, user.referenceSetForMainEdit.length);
    const palette = ["#B8C0CC", "#B7C6BE", "#C8BFB2", "#B8B8C8", "#C5BBB8", "#B5C1C3"];
    const seedBase = hashString(`${user.userId}-${user.name}`);
    const introDelayMs = 800 + (seedBase % 601);

    if (clusters.length === 0 || totalImages === 0) {
      return {
        clustersMeta: [],
        imageNodes: [],
        attributesByCluster: {},
        allAttributes: {},
        strongestClusterId: "",
        introDelayMs,
      };
    }

    const imageClusterWeights: number[][] = Array.from({ length: totalImages }, () =>
      Array.from({ length: clusters.length }, () => 0),
    );
    const clusterWeights = Array.from({ length: clusters.length }, () => 0);
    const attributesByCluster: Record<string, AttributeMeta[]> = {};
    const allAttributes: Record<string, AttributeMeta> = {};

    clusters.forEach((cluster, clusterIndex) => {
      const clusterId = `cluster-${clusterIndex}`;
      const attrs: AttributeMeta[] = [];
      cluster.attributes.forEach((attribute, attributeIndex) => {
        const evidence = attribute.evidence_images.filter((n) => n >= 1 && n <= totalImages);
        const localWeight = clamp(attribute.score, 0, 1) * clamp(attribute.confidence, 0, 1);
        const emphasis = localWeight * Math.max(1, evidence.length);
        clusterWeights[clusterIndex] += emphasis;

        evidence.forEach((imgNum) => {
          imageClusterWeights[imgNum - 1][clusterIndex] += localWeight;
        });

        const meta: AttributeMeta = {
          id: `${clusterId}::${attribute.key}::${attributeIndex}`,
          clusterId,
          attribute: { ...attribute, evidence_images: evidence },
          emphasis,
        };
        attrs.push(meta);
        allAttributes[meta.id] = meta;
      });
      attrs.sort((a, b) => b.emphasis - a.emphasis);
      attributesByCluster[clusterId] = attrs;
    });

    const strongestClusterIndex = clusterWeights.reduce((best, current, index, arr) => {
      if (current > arr[best]) return index;
      return best;
    }, 0);

    const assignments = Array.from({ length: totalImages }, (_, imageIdx) => {
      const row = imageClusterWeights[imageIdx];
      let bestIndex = strongestClusterIndex;
      let bestValue = row[bestIndex] ?? 0;
      for (let c = 0; c < clusters.length; c += 1) {
        if (row[c] > bestValue) {
          bestValue = row[c];
          bestIndex = c;
        }
      }
      return bestValue > 0 ? bestIndex : strongestClusterIndex;
    });

    const minW = Math.min(...clusterWeights);
    const maxW = Math.max(...clusterWeights);
    const normalizedWeight = (w: number) => {
      if (maxW === minW) return 0.5;
      return (w - minW) / (maxW - minW);
    };

    const clustersMeta: ClusterMeta[] = clusters.map((cluster, index) => {
      const clusterId = `cluster-${index}`;
      const seed = hashString(`${user.userId}-${cluster.cluster_name}`);
      const rng = makeRng(seed);
      const center = {
        x: 0.16 + rng() * 0.68,
        y: 0.14 + rng() * 0.72,
      };
      const radius = 0.09 + normalizedWeight(clusterWeights[index]) * 0.065;
      const imageIndexes = assignments
        .map((clusterIndex, imgIdx) => (clusterIndex === index ? imgIdx + 1 : -1))
        .filter((n) => n > 0);

      return {
        id: clusterId,
        index,
        name: cluster.cluster_name,
        thesis: cluster.cluster_thesis,
        center,
        radius,
        weight: clusterWeights[index],
        imageIndexes,
        color: palette[index % palette.length],
      };
    });

    for (let step = 0; step < 140; step += 1) {
      for (let i = 0; i < clustersMeta.length; i += 1) {
        for (let j = i + 1; j < clustersMeta.length; j += 1) {
          const a = clustersMeta[i];
          const b = clustersMeta[j];
          const dx = b.center.x - a.center.x;
          const dy = b.center.y - a.center.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.radius + b.radius + 0.06;
          if (dist >= minDist) continue;
          const push = (minDist - dist) * 0.52;
          const ux = dx / dist;
          const uy = dy / dist;
          a.center.x = clamp(a.center.x - ux * push * 0.5, 0.08, 0.92);
          a.center.y = clamp(a.center.y - uy * push * 0.5, 0.08, 0.92);
          b.center.x = clamp(b.center.x + ux * push * 0.5, 0.08, 0.92);
          b.center.y = clamp(b.center.y + uy * push * 0.5, 0.08, 0.92);
        }
      }
    }

    const imageNodes: ImageNode[] = [];
    const gridCols = 6;
    const gridRows = Math.ceil(totalImages / gridCols);

    clustersMeta.forEach((clusterMeta) => {
      const members = assignments
        .map((clusterIndex, imageIdx) => (clusterIndex === clusterMeta.index ? imageIdx : -1))
        .filter((idx) => idx >= 0);
      const clusterSeed = hashString(`${clusterMeta.id}-members`);
      const clusterRng = makeRng(clusterSeed);

      members.forEach((imageIdx, memberIdx) => {
        const imgWeight = imageClusterWeights[imageIdx][clusterMeta.index] ?? 0;
        const normImgWeight = clamp(imgWeight, 0, 1);
        const ring = Math.floor(memberIdx / 6);
        const inRing = memberIdx % 6;
        const angleBase = clusterRng() * Math.PI * 2;
        const angle = angleBase + (Math.PI * 2 * inRing) / 6;
        const radius = clusterMeta.radius * 0.38 + ring * 0.036 + clusterRng() * 0.01;
        const jitterX = (clusterRng() - 0.5) * 0.022;
        const jitterY = (clusterRng() - 0.5) * 0.022;
        const x = clamp(clusterMeta.center.x + Math.cos(angle) * radius + jitterX, 0.04, 0.96);
        const y = clamp(clusterMeta.center.y + Math.sin(angle) * radius + jitterY, 0.04, 0.96);

        const col = imageIdx % gridCols;
        const row = Math.floor(imageIdx / gridCols);
        const gridX = 0.09 + (col / Math.max(1, gridCols - 1)) * 0.82;
        const gridY = 0.12 + (row / Math.max(1, gridRows - 1)) * 0.76;

        imageNodes.push({
          imageIndex: imageIdx + 1,
          src: user.referenceSetForMainEdit[imageIdx]?.publicPath ?? "",
          clusterId: clusterMeta.id,
          x,
          y,
          gridX,
          gridY,
          size: 0.075 + normImgWeight * 0.025,
        });
      });
    });

    for (let step = 0; step < 110; step += 1) {
      for (let i = 0; i < imageNodes.length; i += 1) {
        for (let j = i + 1; j < imageNodes.length; j += 1) {
          const a = imageNodes[i];
          const b = imageNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = (a.size + b.size) * 0.42;
          if (dist >= minDist) continue;
          const push = (minDist - dist) * 0.5;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x = clamp(a.x - ux * push, 0.03, 0.97);
          a.y = clamp(a.y - uy * push, 0.03, 0.97);
          b.x = clamp(b.x + ux * push, 0.03, 0.97);
          b.y = clamp(b.y + uy * push, 0.03, 0.97);
        }
      }
    }

    return {
      clustersMeta,
      imageNodes,
      attributesByCluster,
      allAttributes,
      strongestClusterId: `cluster-${strongestClusterIndex}`,
      introDelayMs,
    };
  }, [user]);
}

type ContourSegment = [[number, number], [number, number]];

function marchingSquaresSegments(
  density: Float32Array,
  width: number,
  height: number,
  threshold: number,
): ContourSegment[] {
  const segments: ContourSegment[] = [];

  function at(x: number, y: number): number {
    return density[y * width + x] ?? 0;
  }

  function interp(v1: number, v2: number): number {
    const delta = v2 - v1;
    if (Math.abs(delta) < 1e-8) return 0.5;
    return clamp((threshold - v1) / delta, 0, 1);
  }

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const v0 = at(x, y);
      const v1 = at(x + 1, y);
      const v2 = at(x + 1, y + 1);
      const v3 = at(x, y + 1);

      const c0 = v0 >= threshold ? 1 : 0;
      const c1 = v1 >= threshold ? 2 : 0;
      const c2 = v2 >= threshold ? 4 : 0;
      const c3 = v3 >= threshold ? 8 : 0;
      const code = c0 | c1 | c2 | c3;
      if (code === 0 || code === 15) continue;

      const pTop: [number, number] = [x + interp(v0, v1), y];
      const pRight: [number, number] = [x + 1, y + interp(v1, v2)];
      const pBottom: [number, number] = [x + interp(v3, v2), y + 1];
      const pLeft: [number, number] = [x, y + interp(v0, v3)];

      switch (code) {
        case 1:
        case 14:
          segments.push([pLeft, pTop]);
          break;
        case 2:
        case 13:
          segments.push([pTop, pRight]);
          break;
        case 3:
        case 12:
          segments.push([pLeft, pRight]);
          break;
        case 4:
        case 11:
          segments.push([pRight, pBottom]);
          break;
        case 5:
          segments.push([pLeft, pTop], [pRight, pBottom]);
          break;
        case 6:
        case 9:
          segments.push([pTop, pBottom]);
          break;
        case 7:
        case 8:
          segments.push([pLeft, pBottom]);
          break;
        case 10:
          segments.push([pTop, pRight], [pBottom, pLeft]);
          break;
        default:
          break;
      }
    }
  }
  return segments;
}

function TasteFieldCanvasBackground({
  layout,
  width,
  height,
  activeClusterId,
}: {
  layout: TasteFieldLayout;
  width: number;
  height: number;
  activeClusterId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((prev) => prev + 1), 110);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const now = performance.now() / 1000;
    const maxClusterWeight = Math.max(1, ...layout.clustersMeta.map((c) => c.weight));
    layout.clustersMeta.forEach((cluster, idx) => {
      const cx = cluster.center.x * width;
      const cy = cluster.center.y * height;
      const baseRadius = cluster.radius * Math.min(width, height) * 1.85;
      const normalized = cluster.weight / maxClusterWeight;
      const pulse = cluster.id === activeClusterId ? 0.018 * Math.sin(now * 1.25 + idx) : 0;
      const alpha = 0.04 + normalized * 0.05 + (cluster.id === activeClusterId ? 0.03 + pulse : 0);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
      gradient.addColorStop(0, hexToRgba(cluster.color, alpha));
      gradient.addColorStop(1, hexToRgba(cluster.color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - baseRadius, cy - baseRadius, baseRadius * 2, baseRadius * 2);
    });

    const gridW = 88;
    const gridH = 58;
    const density = new Float32Array(gridW * gridH);
    const sigma = 0.05;
    const sigma2 = sigma * sigma;

    for (let gy = 0; gy < gridH; gy += 1) {
      for (let gx = 0; gx < gridW; gx += 1) {
        const nx = gx / (gridW - 1);
        const ny = gy / (gridH - 1);
        let value = 0;
        layout.imageNodes.forEach((node) => {
          const dx = nx - node.x;
          const dy = ny - node.y;
          value += Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
        });
        density[gy * gridW + gx] = value;
      }
    }

    let maxDensity = 0;
    for (let i = 0; i < density.length; i += 1) {
      if (density[i] > maxDensity) maxDensity = density[i];
    }
    const thresholds = [0.2, 0.33, 0.46, 0.62, 0.78].map((t) => t * maxDensity);

    ctx.lineWidth = 0.8;
    thresholds.forEach((threshold, idx) => {
      const segments = marchingSquaresSegments(density, gridW, gridH, threshold);
      ctx.strokeStyle = `rgba(70, 75, 90, ${0.07 + idx * 0.024})`;
      ctx.beginPath();
      segments.forEach((segment) => {
        const [[x1, y1], [x2, y2]] = segment;
        const px1 = (x1 / (gridW - 1)) * width;
        const py1 = (y1 / (gridH - 1)) * height;
        const px2 = (x2 / (gridW - 1)) * width;
        const py2 = (y2 / (gridH - 1)) * height;
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
      });
      ctx.stroke();
    });
  }, [activeClusterId, height, layout, tick, width]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 rounded-[24px]" />;
}

function TasteFieldLensPanel({
  activeCluster,
  clusterAttributes,
  activeAttributeId,
  onAttributeEnter,
  onAttributeLeave,
}: {
  activeCluster?: ClusterMeta;
  clusterAttributes: AttributeMeta[];
  activeAttributeId: string | null;
  onAttributeEnter: (id: string) => void;
  onAttributeLeave: () => void;
}) {
  if (!activeCluster) return null;
  return (
    <aside className="rounded-[20px] border border-line bg-mist/80 p-4 md:p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-meta">Lens</p>
      <h2 className="mt-2 font-serif text-[24px] leading-[1.2] text-ink">{activeCluster.name}</h2>
      <p className="mt-3 text-sm leading-6 text-ink">{activeCluster.thesis}</p>

      <div className="mt-5 space-y-2">
        {clusterAttributes.slice(0, 10).map((meta) => {
          const isActive = activeAttributeId === meta.id;
          const scorePercent = Math.round(clamp(meta.attribute.score, 0, 1) * 100);
          return (
            <button
              key={meta.id}
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                isActive ? "border-accent/45 bg-paper" : "border-line bg-paper/75 hover:border-meta/40"
              }`}
              onMouseEnter={() => onAttributeEnter(meta.id)}
              onFocus={() => onAttributeEnter(meta.id)}
              onMouseLeave={onAttributeLeave}
              onBlur={onAttributeLeave}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{meta.attribute.label}</span>
                <span className="text-[11px] text-meta">{meta.attribute.confidence.toFixed(2)} conf</span>
              </div>
              <div className="mt-2 h-[3px] w-full rounded-full bg-line">
                <div className="h-full rounded-full bg-accent/75" style={{ width: `${scorePercent}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-meta">evidence: {meta.attribute.evidence_images.join(", ")}</p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default function TasteField({ user }: { user: MockUserProfile }) {
  const layout = useTasteFieldLayout(user);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });
  const [hasMorphed, setHasMorphed] = useState(false);
  const [activeClusterId, setActiveClusterId] = useState(layout.strongestClusterId);
  const [activeAttributeId, setActiveAttributeId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setHasMorphed(true), layout.introDelayMs);
    return () => window.clearTimeout(timer);
  }, [layout.introDelayMs]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setFieldSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeCluster = layout.clustersMeta.find((cluster) => cluster.id === activeClusterId) ?? layout.clustersMeta[0];
  const clusterAttributes = activeCluster ? layout.attributesByCluster[activeCluster.id] ?? [] : [];
  const activeAttribute = activeAttributeId ? layout.allAttributes[activeAttributeId] : undefined;

  const highlightedImages = useMemo(() => {
    if (activeAttribute) {
      return new Set(activeAttribute.attribute.evidence_images);
    }
    if (!activeCluster) return null;
    return new Set(activeCluster.imageIndexes);
  }, [activeAttribute, activeCluster]);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6 border-b border-line pb-4">
        <p className="text-xs uppercase tracking-[0.12em] text-meta">Taste Field</p>
        <h1 className="mt-2 font-serif text-[30px] leading-[1.1] text-ink">Juna</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-meta">
          A data-driven visual field generated from cluster evidence, attribute score and confidence.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {layout.clustersMeta.map((cluster) => {
              const isActive = cluster.id === activeCluster?.id;
              return (
                <button
                  key={cluster.id}
                  type="button"
                  onMouseEnter={() => {
                    setActiveClusterId(cluster.id);
                    setActiveAttributeId(null);
                  }}
                  onFocus={() => {
                    setActiveClusterId(cluster.id);
                    setActiveAttributeId(null);
                  }}
                  onClick={() => {
                    setActiveClusterId(cluster.id);
                    setActiveAttributeId(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs tracking-[0.04em] transition ${
                    isActive
                      ? "border-accent/40 bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,0.07)]"
                      : "border-line bg-mist text-meta hover:text-ink"
                  }`}
                >
                  {cluster.name}
                </button>
              );
            })}
          </div>

          <div
            ref={fieldRef}
            className="relative h-[62vh] min-h-[480px] overflow-hidden rounded-[24px] border border-line bg-[color:var(--paper)]"
          >
            <TasteFieldCanvasBackground
              layout={layout}
              width={fieldSize.width}
              height={fieldSize.height}
              activeClusterId={activeCluster?.id ?? ""}
            />

            {layout.imageNodes.map((node) => {
              const isHighlighted = highlightedImages ? highlightedImages.has(node.imageIndex) : true;
              const isDimmed = highlightedImages ? !isHighlighted : false;
              const left = hasMorphed ? node.x * 100 : node.gridX * 100;
              const top = hasMorphed ? node.y * 100 : node.gridY * 100;
              const sizePx = Math.round(
                (hasMorphed ? node.size * Math.min(fieldSize.width, fieldSize.height) : 72) || 64,
              );

              return (
                <div
                  key={`img-${node.imageIndex}`}
                  className="absolute rounded-[12px] border border-paper/50 bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${sizePx}px`,
                    height: `${sizePx}px`,
                    transform: `translate(-50%, -50%) scale(${isHighlighted ? 1.04 : 0.96})`,
                    opacity: isDimmed ? 0.3 : 1,
                    filter: isDimmed ? "grayscale(0.2)" : "none",
                    transition:
                      "left 1.45s cubic-bezier(0.22,1,0.36,1), top 1.45s cubic-bezier(0.22,1,0.36,1), transform 280ms ease, opacity 280ms ease, filter 280ms ease, width 1.45s cubic-bezier(0.22,1,0.36,1), height 1.45s cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  <Image
                    src={node.src}
                    alt={`Reference ${node.imageIndex}`}
                    fill
                    sizes="(max-width: 1024px) 72px, 84px"
                    className="rounded-[12px] object-cover"
                    draggable={false}
                  />
                  <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-paper/85 px-1 text-[10px] text-meta">
                    {node.imageIndex}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <TasteFieldLensPanel
          activeCluster={activeCluster}
          clusterAttributes={clusterAttributes}
          activeAttributeId={activeAttributeId}
          onAttributeEnter={(id) => {
            setActiveAttributeId(id);
            const clusterId = layout.allAttributes[id]?.clusterId;
            if (clusterId) setActiveClusterId(clusterId);
          }}
          onAttributeLeave={() => setActiveAttributeId(null)}
        />
      </div>
    </main>
  );
}
