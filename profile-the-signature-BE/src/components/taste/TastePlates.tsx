"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { MockTasteCluster, MockUserProfile } from "@/data/mockUsers";
import { clamp } from "@/lib/taste/seededRandom";

type Mode = "calm" | "deep";

type ClusterAttribute = {
  id: string;
  label: string;
  weight: number;
};

type ClusterModel = {
  id: string;
  clusterName: string;
  thesis: string;
  attributes: ClusterAttribute[];
  clusterWeight: number;
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function buildClusters(clusters: MockTasteCluster[]): ClusterModel[] {
  const mapped = clusters.map((cluster, clusterIndex) => {
    const attributes = cluster.attributes.map((attribute, attrIndex) => {
      const score = typeof attribute.score === "number" ? attribute.score : 0;
      const confidence = typeof attribute.confidence === "number" ? attribute.confidence : 0;
      return {
        id: `${clusterIndex}-${attribute.key}-${attrIndex}`,
        label: attribute.label,
        weight: clamp(score * confidence, 0, 1),
      };
    });

    attributes.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.label.localeCompare(b.label);
    });

    const clusterWeight = attributes.reduce((sum, item) => sum + item.weight, 0);

    return {
      id: `cluster-${clusterIndex}`,
      clusterName: cluster.cluster_name,
      thesis: cluster.cluster_thesis,
      attributes,
      clusterWeight,
    };
  });

  mapped.sort((a, b) => {
    if (b.clusterWeight !== a.clusterWeight) return b.clusterWeight - a.clusterWeight;
    return a.clusterName.localeCompare(b.clusterName);
  });

  return mapped;
}

function resolveVisibleAttributes(cluster: ClusterModel, mode: Mode, query: string): ClusterAttribute[] {
  const maxCount = mode === "calm" ? 12 : 28;
  const base = cluster.attributes.slice(0, maxCount);
  const term = query.trim().toLowerCase();
  if (!term) return base;
  return base.filter((attribute) => attribute.label.toLowerCase().includes(term));
}

function splitColumns(items: ClusterAttribute[]) {
  const midpoint = Math.ceil(items.length / 2);
  return {
    left: items.slice(0, midpoint),
    right: items.slice(midpoint),
  };
}

function attributeStyle(weight: number) {
  const opacity = 0.45 + weight * 0.55;
  const letterSpacing = 0.004 + (1 - weight) * 0.01;
  return { opacity, letterSpacing: `${letterSpacing}em` };
}

function ClusterRail({
  clusters,
  activeIndex,
  previewIndex,
  onHover,
  onLeave,
  onSelect,
}: {
  clusters: ClusterModel[];
  activeIndex: number;
  previewIndex: number | null;
  onHover: (index: number) => void;
  onLeave: () => void;
  onSelect: (index: number) => void;
}) {
  const resolved = previewIndex ?? activeIndex;

  return (
    <aside className="rounded-[24px] border border-line/80 bg-paper/85 p-4">
      <p className="px-1 pb-3 font-mono-meta text-[11px] tracking-[0.08em] text-meta">Clusters</p>
      <div className="flex flex-col gap-1">
        {clusters.map((cluster, index) => {
          const isActive = index === resolved;
          return (
            <button
              key={cluster.id}
              type="button"
              onMouseEnter={() => onHover(index)}
              onFocus={() => onHover(index)}
              onMouseLeave={onLeave}
              onBlur={onLeave}
              onClick={() => onSelect(index)}
              className="relative rounded-[14px] px-3 py-2 text-left transition-colors duration-500"
              style={{
                color: isActive ? "var(--ink)" : "var(--meta)",
                backgroundColor: isActive ? "rgba(17,17,17,0.04)" : "transparent",
              }}
            >
              <span className="font-ui text-[14px] leading-5">{cluster.clusterName}</span>
              <span
                className="absolute bottom-1 left-3 h-px bg-[rgba(17,17,17,0.22)] transition-all duration-700"
                style={{ width: isActive ? "42%" : "0%" }}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function AttributeColumn({ items }: { items: ClusterAttribute[] }) {
  if (items.length === 0) {
    return <p className="font-ui text-[13px] text-meta">No matching attributes.</p>;
  }

  return (
    <div className="grid auto-rows-[30px]">
      {items.map((item, index) => {
        const style = attributeStyle(item.weight);
        const showDivider = index > 0 && index % 4 === 0;
        return (
          <div key={item.id} className="relative flex items-center">
            {showDivider ? (
              <span className="absolute -top-[7px] left-0 right-0 h-px bg-[rgba(17,17,17,0.08)]" />
            ) : null}
            <span
              className="font-ui text-[13px] leading-5 text-ink transition-[opacity,letter-spacing] duration-300"
              style={style}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function plateTransforms(offset: number) {
  if (offset === 0) {
    return {
      z: 44,
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      blur: 0,
      zIndex: 30,
    };
  }

  const abs = Math.abs(offset);
  const direction = offset < 0 ? -1 : 1;
  return {
    z: 20 - abs * 10,
    x: direction * abs * 20,
    y: abs * 12,
    scale: 0.985 - abs * 0.012,
    opacity: 0.62 - abs * 0.08,
    blur: Math.min(1, abs * 0.5),
    zIndex: 30 - abs,
  };
}

function Stage({
  clusters,
  activeIndex,
  mode,
  query,
}: {
  clusters: ClusterModel[];
  activeIndex: number;
  mode: Mode;
  query: string;
}) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const visibleIndexes = useMemo(
    () => [activeIndex - 2, activeIndex - 1, activeIndex, activeIndex + 1, activeIndex + 2].filter(
      (index) => index >= 0 && index < clusters.length,
    ),
    [activeIndex, clusters.length],
  );

  return (
    <section
      className="relative min-h-[700px] overflow-hidden rounded-[30px] border border-line bg-paper p-4 md:p-6"
      style={{
        perspective: "1200px",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -24px 42px rgba(17,17,17,0.03)",
        backgroundImage:
          "radial-gradient(rgba(17,17,17,0.035) 0.4px, transparent 0.4px), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,248,246,0.96))",
        backgroundSize: "3px 3px, 100% 100%",
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        setParallax({
          x: clamp(px * 12, -6, 6),
          y: clamp(py * 8, -4, 4),
        });
      }}
      onMouseLeave={() => setParallax({ x: 0, y: 0 })}
    >
      <motion.div
        className="relative mx-auto h-[640px] w-full max-w-[960px]"
        animate={{
          x: parallax.x,
          y: parallax.y,
          rotateY: parallax.x * 0.12,
          rotateX: -parallax.y * 0.12,
        }}
        transition={{ duration: 0.75, ease: EASE }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {visibleIndexes.map((clusterIndex) => {
          const cluster = clusters[clusterIndex];
          const offset = clusterIndex - activeIndex;
          const t = plateTransforms(offset);
          const visibleAttributes = resolveVisibleAttributes(cluster, mode, query);
          const columns = splitColumns(visibleAttributes);

          return (
            <motion.article
              key={cluster.id}
              className="absolute left-1/2 top-1/2 h-[620px] w-[900px] max-w-[98%] rounded-[28px] border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.72)]"
              initial={{
                opacity: 0,
                scale: 0.97,
                x: -50,
                y: -46,
                z: 0,
                filter: "blur(0.5px)",
              }}
              animate={{
                opacity: t.opacity,
                scale: t.scale,
                x: `calc(-50% + ${t.x}px)`,
                y: `calc(-50% + ${t.y}px)`,
                z: t.z,
                filter: `blur(${t.blur}px)`,
              }}
              transition={{ duration: 0.78, ease: EASE }}
              style={{
                zIndex: t.zIndex,
                transformStyle: "preserve-3d",
                boxShadow:
                  "0 8px 24px rgba(17,17,17,0.04), inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 -8px 18px rgba(17,17,17,0.02)",
                backdropFilter: "blur(2px)",
              }}
            >
              <div className="px-7 pb-7 pt-7 md:px-10 md:pb-9">
                <h2 className="truncate font-headline text-[42px] leading-[1.02] text-ink">{cluster.clusterName}</h2>
                <p className="mt-2 line-clamp-2 max-w-[86ch] font-ui text-[13px] leading-5 text-meta">{cluster.thesis}</p>

                <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
                  <AttributeColumn items={columns.left} />
                  <AttributeColumn items={columns.right} />
                </div>
              </div>
            </motion.article>
          );
        })}
      </motion.div>
    </section>
  );
}

export default function TastePlates({ user }: { user: MockUserProfile }) {
  const clusters = useMemo(() => buildClusters(user.tasteAttributes.clusters ?? []), [user]);
  const [activeClusterIndex, setActiveClusterIndex] = useState(0);
  const [previewClusterIndex, setPreviewClusterIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("calm");
  const [query, setQuery] = useState("");

  const safeActiveIndex = useMemo(() => {
    if (clusters.length === 0) return 0;
    return Math.min(activeClusterIndex, clusters.length - 1);
  }, [activeClusterIndex, clusters.length]);

  const displayIndex = previewClusterIndex ?? safeActiveIndex;

  if (clusters.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-headline text-[34px] text-ink">Taste Plates</h1>
        <p className="mt-3 font-ui text-sm text-meta">No taste clusters found for this profile.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1560px] px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6 border-b border-line pb-5">
        <p className="font-mono-meta text-[11px] tracking-[0.08em] text-meta">Taste Plates</p>
        <h1 className="mt-2 font-headline text-[46px] leading-[0.98] text-ink">{user.name}</h1>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("calm")}
          className="rounded-full px-3 py-1.5 font-ui text-[13px] transition-colors duration-500"
          style={{
            backgroundColor: mode === "calm" ? "rgba(17,17,17,0.08)" : "rgba(17,17,17,0.03)",
            color: mode === "calm" ? "var(--ink)" : "var(--meta)",
          }}
        >
          Calm
        </button>
        <button
          type="button"
          onClick={() => setMode("deep")}
          className="rounded-full px-3 py-1.5 font-ui text-[13px] transition-colors duration-500"
          style={{
            backgroundColor: mode === "deep" ? "rgba(17,17,17,0.08)" : "rgba(17,17,17,0.03)",
            color: mode === "deep" ? "var(--ink)" : "var(--meta)",
          }}
        >
          Deep
        </button>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter attributes"
          className="ml-0 h-8 min-w-[200px] rounded-full border border-line bg-paper px-3 font-ui text-[13px] text-ink outline-none placeholder:text-meta focus:border-meta/50 md:ml-2"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <ClusterRail
          clusters={clusters}
          activeIndex={safeActiveIndex}
          previewIndex={previewClusterIndex}
          onHover={setPreviewClusterIndex}
          onLeave={() => setPreviewClusterIndex(null)}
          onSelect={(index) => {
            setActiveClusterIndex(index);
            setPreviewClusterIndex(null);
          }}
        />

        <Stage clusters={clusters} activeIndex={displayIndex} mode={mode} query={query} />
      </div>
    </main>
  );
}
