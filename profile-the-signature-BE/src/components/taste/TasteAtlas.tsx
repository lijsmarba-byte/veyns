"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { MockUserProfile } from "@/data/mockUsers";
import { clamp, hashString, mulberry32 } from "@/lib/taste/seededRandom";

type ClusterModel = {
  id: string;
  name: string;
  thesis: string;
  weight: number;
  attrs: Array<{
    id: string;
    key: string;
    label: string;
    score: number;
    confidence: number;
    weight: number;
  }>;
};

type ClusterNode = {
  id: string;
  kind: "cluster";
  clusterId: string;
  label: string;
  x: number;
  y: number;
  r: number;
};

type AttributeNode = {
  id: string;
  kind: "attribute";
  clusterId: string;
  label: string;
  x: number;
  y: number;
  r: number;
  score: number;
  confidence: number;
  weight: number;
};

type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
  kind: "member" | "bridge";
};

type GraphLayout = {
  clusters: ClusterModel[];
  clusterNodes: ClusterNode[];
  attrNodes: AttributeNode[];
  edges: GraphEdge[];
};

function buildClusters(user: MockUserProfile, depthMode: "top" | "full"): ClusterModel[] {
  const base = (user.tasteAttributes.clusters ?? []).map((cluster, clusterIndex) => {
    const attrs = (cluster.attributes ?? []).map((attr, attrIndex) => {
      const score = clamp(attr.score, 0, 1);
      const confidence = clamp(attr.confidence, 0, 1);
      return {
        id: `c${clusterIndex}-a${attrIndex}-${attr.key}`,
        key: attr.key,
        label: attr.label,
        score,
        confidence,
        weight: score * confidence,
      };
    });
    attrs.sort((a, b) => b.weight - a.weight);
    return {
      id: `cluster-${clusterIndex}`,
      name: cluster.cluster_name,
      thesis: cluster.cluster_thesis,
      weight: attrs.reduce((sum, item) => sum + item.weight, 0),
      attrs,
    };
  });

  base.sort((a, b) => b.weight - a.weight);
  if (depthMode === "full") return base;

  const max = Math.max(...base.map((c) => c.weight), 1);
  return base.map((cluster) => {
    const normalized = cluster.weight / max;
    const count = 8 + Math.round(normalized * 4);
    return { ...cluster, attrs: cluster.attrs.slice(0, count) };
  });
}

function tokenSet(cluster: ClusterModel): Set<string> {
  const set = new Set<string>();
  cluster.attrs.forEach((attr) => {
    attr.key.split("_").forEach((part) => {
      if (part.length >= 3) set.add(part);
    });
    attr.label
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 4)
      .forEach((part) => set.add(part));
  });
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  a.forEach((value) => {
    if (b.has(value)) inter += 1;
  });
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

function useGraphLayout(
  user: MockUserProfile,
  depthMode: "top" | "full",
  width: number,
  height: number,
): GraphLayout {
  return useMemo(() => {
    const clusters = buildClusters(user, depthMode);
    if (clusters.length === 0) {
      return { clusters: [], clusterNodes: [], attrNodes: [], edges: [] };
    }

    const clusterNodes: ClusterNode[] = clusters.map((cluster, idx) => {
      const rng = mulberry32(hashString(`${user.userId}-${cluster.name}-${idx}`));
      const normalized = cluster.weight / Math.max(clusters[0]?.weight || 1, 1);
      return {
        id: `node-${cluster.id}`,
        kind: "cluster",
        clusterId: cluster.id,
        label: cluster.name,
        x: (0.16 + rng() * 0.68) * width,
        y: (0.14 + rng() * 0.72) * height,
        r: 8 + normalized * 8,
      };
    });

    for (let step = 0; step < 140; step += 1) {
      for (let i = 0; i < clusterNodes.length; i += 1) {
        for (let j = i + 1; j < clusterNodes.length; j += 1) {
          const a = clusterNodes[i];
          const b = clusterNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = 135 + (a.r + b.r) * 2.1;
          if (dist >= minDist) continue;
          const push = ((minDist - dist) / minDist) * 12;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x = clamp(a.x - ux * push, width * 0.09, width * 0.91);
          a.y = clamp(a.y - uy * push, height * 0.1, height * 0.9);
          b.x = clamp(b.x + ux * push, width * 0.09, width * 0.91);
          b.y = clamp(b.y + uy * push, height * 0.1, height * 0.9);
        }
      }
    }

    const clusterNodeMap = new Map(clusterNodes.map((node) => [node.clusterId, node]));

    const attrNodes: AttributeNode[] = [];
    clusters.forEach((cluster, clusterIdx) => {
      const clusterNode = clusterNodeMap.get(cluster.id);
      if (!clusterNode) return;

      const rng = mulberry32(hashString(`${user.userId}-${cluster.name}-attrs-${clusterIdx}`));
      const baseAngle = rng() * Math.PI * 2;
      const golden = Math.PI * (3 - Math.sqrt(5));
      cluster.attrs.forEach((attr, attrIdx) => {
        const ring = Math.floor(attrIdx / 10);
        const localAngle = baseAngle + attrIdx * golden + (rng() - 0.5) * 0.26;
        const distance = 58 + ring * 34 + (1 - attr.weight) * 14;
        attrNodes.push({
          id: `node-${attr.id}`,
          kind: "attribute",
          clusterId: cluster.id,
          label: attr.label,
          x: clusterNode.x + Math.cos(localAngle) * distance,
          y: clusterNode.y + Math.sin(localAngle) * distance,
          r: 3 + attr.weight * 7,
          score: attr.score,
          confidence: attr.confidence,
          weight: attr.weight,
        });
      });
    });

    const edges: GraphEdge[] = [];
    attrNodes.forEach((node) => {
      edges.push({
        id: `edge-member-${node.clusterId}-${node.id}`,
        sourceId: `node-${node.clusterId}`,
        targetId: node.id,
        strength: node.weight,
        kind: "member",
      });
    });

    const clusterTokens = clusters.map(tokenSet);
    const bridges: Array<{ i: number; j: number; score: number }> = [];
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const score = jaccard(clusterTokens[i], clusterTokens[j]);
        if (score > 0.02) bridges.push({ i, j, score });
      }
    }

    bridges.sort((a, b) => b.score - a.score);
    bridges.slice(0, Math.max(28, clusters.length * 3)).forEach((bridge) => {
      edges.push({
        id: `edge-bridge-${bridge.i}-${bridge.j}`,
        sourceId: `node-${clusters[bridge.i].id}`,
        targetId: `node-${clusters[bridge.j].id}`,
        strength: bridge.score,
        kind: "bridge",
      });
    });

    if (!edges.some((edge) => edge.kind === "bridge") && clusters.length > 2) {
      for (let i = 0; i < clusters.length; i += 1) {
        const j = (i + 1) % clusters.length;
        edges.push({
          id: `edge-ring-${i}-${j}`,
          sourceId: `node-${clusters[i].id}`,
          targetId: `node-${clusters[j].id}`,
          strength: 0.08,
          kind: "bridge",
        });
      }
    }

    return { clusters, clusterNodes, attrNodes, edges };
  }, [depthMode, height, user, width]);
}

function nodeMap(layout: GraphLayout): Map<string, ClusterNode | AttributeNode> {
  const map = new Map<string, ClusterNode | AttributeNode>();
  layout.clusterNodes.forEach((node) => map.set(node.id, node));
  layout.attrNodes.forEach((node) => map.set(node.id, node));
  return map;
}

export default function TasteAtlas({ user }: { user: MockUserProfile }) {
  const [depthMode, setDepthMode] = useState<"top" | "full">("full");
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [activeAttrId, setActiveAttrId] = useState<string | null>(null);

  const width = 980;
  const height = 700;
  const layout = useGraphLayout(user, depthMode, width, height);
  const nodes = useMemo(() => nodeMap(layout), [layout]);

  const hoveredAttr = activeAttrId ? (nodes.get(activeAttrId) as AttributeNode | undefined) : undefined;
  const focusClusterId = hoveredAttr?.clusterId ?? activeClusterId ?? null;
  const focusCluster = layout.clusters.find((cluster) => cluster.id === focusClusterId) ?? layout.clusters[0];
  const centerByClusterId = new Map(layout.clusterNodes.map((node) => [node.clusterId, node]));

  return (
    <main className="mx-auto max-w-[1460px] px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6 border-b border-line pb-4">
        <p className="text-xs uppercase tracking-[0.14em] text-meta">Taste Atlas</p>
        <h1 className="mt-2 font-ui text-[32px] leading-[1.05] text-ink">{user.name}</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[18px] border border-line bg-mist/75 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.12em] text-meta">Clusters</p>
            <div className="inline-flex rounded-full border border-line bg-paper p-1 text-xs">
              <button
                type="button"
                onClick={() => setDepthMode("top")}
                className={`rounded-full px-3 py-1 ${depthMode === "top" ? "bg-ink text-paper" : "text-meta"}`}
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setDepthMode("full")}
                className={`rounded-full px-3 py-1 ${depthMode === "full" ? "bg-ink text-paper" : "text-meta"}`}
              >
                Full
              </button>
            </div>
          </div>

          <ul className="space-y-1.5">
            {layout.clusters.map((cluster) => {
              const active = cluster.id === focusClusterId;
              return (
                <li key={cluster.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      active ? "border-accent/35 bg-paper text-ink" : "border-transparent text-meta hover:text-ink"
                    }`}
                    onMouseEnter={() => setActiveClusterId(cluster.id)}
                    onMouseLeave={() => setActiveClusterId(null)}
                    onFocus={() => setActiveClusterId(cluster.id)}
                    onBlur={() => setActiveClusterId(null)}
                  >
                    <p className="text-sm font-medium">{cluster.name}</p>
                    <p className="mt-1 text-[11px] text-meta">weight {(cluster.weight / Math.max(cluster.attrs.length, 1)).toFixed(2)}</p>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs uppercase tracking-[0.12em] text-meta">Cluster Thesis</p>
            <p className="mt-2 text-sm leading-6 text-ink">{focusCluster?.thesis ?? "No cluster selected."}</p>
            {hoveredAttr ? (
              <p className="mt-3 text-xs text-meta">
                {hoveredAttr.label} | score {hoveredAttr.score.toFixed(2)} | confidence {hoveredAttr.confidence.toFixed(2)}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="rounded-[22px] border border-line bg-mist/45 p-3 md:p-4">
          <motion.svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[74vh] min-h-[580px] w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <g>
              {layout.edges.map((edge) => {
                const source = nodes.get(edge.sourceId);
                const target = nodes.get(edge.targetId);
                if (!source || !target) return null;

                const sourceCluster = source.kind === "cluster" ? source.clusterId : source.clusterId;
                const targetCluster = target.kind === "cluster" ? target.clusterId : target.clusterId;
                const isFocused = !focusClusterId || sourceCluster === focusClusterId || targetCluster === focusClusterId;
                const opacity = edge.kind === "member" ? (isFocused ? 0.32 : 0.1) : isFocused ? 0.3 : 0.14;
                const strokeWidth = edge.kind === "member" ? 0.75 + edge.strength * 1.1 : 0.8 + edge.strength * 2.4;

                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.kind === "member" ? "#9ca3af" : "#5d7db2"}
                    strokeOpacity={opacity}
                    strokeWidth={strokeWidth}
                  />
                );
              })}
            </g>

            <g>
              {layout.attrNodes.map((node) => {
                const focused = activeAttrId === node.id;
                const inCluster = node.clusterId === focusClusterId;
                const isAnyClusterActive = Boolean(focusClusterId);
                const clusterCenter = centerByClusterId.get(node.clusterId);
                const zoomFactor = inCluster ? 1.16 : 1;
                const zoomX = clusterCenter ? clusterCenter.x + (node.x - clusterCenter.x) * zoomFactor : node.x;
                const zoomY = clusterCenter ? clusterCenter.y + (node.y - clusterCenter.y) * zoomFactor : node.y;
                const renderX = isAnyClusterActive ? zoomX : node.x;
                const renderY = isAnyClusterActive ? zoomY : node.y;
                const opacity = focused ? 1 : isAnyClusterActive ? (inCluster ? 0.98 : 0.18) : 0.34;
                const fill = inCluster ? "#6f9bd8" : "#8893a6";
                const showLabel = focused || (isAnyClusterActive && inCluster);

                return (
                  <motion.g
                    key={node.id}
                    onMouseEnter={() => setActiveAttrId(node.id)}
                    onMouseLeave={() => setActiveAttrId(null)}
                    initial={false}
                    animate={{ scale: focused ? 1.13 : inCluster ? 1.04 : 1 }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.circle
                      cx={renderX}
                      cy={renderY}
                      r={inCluster && isAnyClusterActive ? node.r * 1.18 : node.r}
                      fill={fill}
                      fillOpacity={opacity}
                      stroke="#d0d7e4"
                      strokeOpacity={focused ? 0.72 : 0.3}
                      strokeWidth={focused ? 1.1 : 0.45}
                      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
                    />
                    {showLabel ? (
                      <motion.text
                        x={renderX + 7}
                        y={renderY - 6}
                        fill={focused ? "#111111" : "#29303f"}
                        fillOpacity={focused ? 1 : inCluster ? 0.84 : 0.28}
                        fontSize={focused ? 13 : 11.5}
                        fontFamily="var(--font-sans)"
                        style={{ transition: "all 240ms ease", pointerEvents: "none" }}
                        transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {node.label}
                      </motion.text>
                    ) : null}
                  </motion.g>
                );
              })}
            </g>

            <g>
              {layout.clusterNodes.map((node) => {
                const focused = node.clusterId === focusClusterId;
                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setActiveClusterId(node.clusterId)}
                    onMouseLeave={() => setActiveClusterId(null)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r + (focused ? 2 : 0)}
                      fill={focused ? "#e6edf8" : "#dce2ed"}
                      fillOpacity={focused ? 0.88 : 0.72}
                      stroke={focused ? "#8ea8cf" : "#c0c9d8"}
                      strokeOpacity={focused ? 0.95 : 0.65}
                      strokeWidth={focused ? 1.4 : 1}
                    />
                    <text
                      x={node.x}
                      y={node.y - node.r - 10}
                      textAnchor="middle"
                      fill={focused ? "#111111" : "#6f788b"}
                      fillOpacity={focused ? 1 : 0.68}
                      fontFamily="var(--font-sans)"
                      fontSize={focused ? 18 : 15}
                      style={{ transition: "all 220ms ease", pointerEvents: "none" }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </motion.svg>
        </section>
      </div>
    </main>
  );
}
