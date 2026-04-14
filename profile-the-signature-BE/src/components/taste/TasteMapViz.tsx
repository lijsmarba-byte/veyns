"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MockTasteCluster } from "@/data/mockUsers";

const PAPER = "#FEFEFD";
const INK = "#111111";
const META = "#888894";
const LINE = "#ECEDEF";

type TasteMapVizProps = {
  clusters: MockTasteCluster[];
  styleDescription: string;
};

type ClusterNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
};

type AttributeNode = {
  id: string;
  clusterId: string;
  clusterName: string;
  label: string;
  x: number;
  y: number;
  angle: number;
  rotation: number;
  textAnchor: "start" | "end";
  fontSize: number;
};

type LinkNode = {
  id: string;
  clusterId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type LayoutData = {
  clusterNodes: ClusterNode[];
  attributeNodes: AttributeNode[];
  links: LinkNode[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function polarPoint(radius: number, angle: number) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

function wrapText(input: string, maxCharsPerLine = 100, maxLines = 3) {
  const words = input.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = word;

    if (lines.length >= maxLines - 1) break;
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (lines.length === 0) {
    return ["Style summary unavailable."];
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}...`;
  }

  return lines;
}

function buildLayout(clusters: MockTasteCluster[], width: number, height: number): LayoutData {
  if (!clusters.length || width <= 0 || height <= 0) {
    return { clusterNodes: [], attributeNodes: [], links: [] };
  }

  const centerX = width / 2;
  const centerY = height * 0.92;
  const outerRadius = clamp(Math.min(width * 0.46, height * 0.84), 280, 640);
  const clusterRadius = clamp(outerRadius * 0.46, 150, 320);
  // Top semicircle sweep (left -> right over the upper half)
  const fanStart = Math.PI * 1.04;
  const fanEnd = Math.PI * 1.96;
  const fullFan = fanEnd - fanStart;
  const totalAttributes = clusters.reduce((sum, cluster) => sum + cluster.attributes.length, 0);
  const clusterGap = 0.02;
  const totalGap = clusterGap * Math.max(0, clusters.length - 1);
  const usableFan = Math.max(0.0001, fullFan - totalGap);

  let cursor = fanStart;
  const clusterNodes: ClusterNode[] = [];
  const attributeNodes: AttributeNode[] = [];
  const links: LinkNode[] = [];

  const mirrorX = (relativeX: number) => centerX - relativeX;

  clusters.forEach((cluster, clusterIndex) => {
    const clusterId = `cluster-${clusterIndex}`;
    const attributeCount = cluster.attributes.length;
    const sweep = usableFan * (attributeCount / Math.max(1, totalAttributes));
    const start = cursor;
    const end = start + sweep;
    const mid = start + sweep / 2;
    const clusterAngle = mid;
    const clusterPos = polarPoint(clusterRadius, clusterAngle);

    clusterNodes.push({
      id: clusterId,
      name: cluster.cluster_name,
      x: mirrorX(clusterPos.x),
      y: centerY + clusterPos.y,
      angle: clusterAngle,
    });

    const sortedAttributes = [...cluster.attributes].sort((a, b) => {
      const scoreA = typeof a.score === "number" ? a.score : Number.NEGATIVE_INFINITY;
      const scoreB = typeof b.score === "number" ? b.score : Number.NEGATIVE_INFINITY;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.label.localeCompare(b.label);
    });

    const availableSweep = Math.max(0.0001, end - start - 0.03);
    const attributeStart = start + 0.015;

    sortedAttributes.forEach((attribute, attributeIndex) => {
      const t = (attributeIndex + 1) / (sortedAttributes.length + 1);
      const baseAngle = attributeStart + t * availableSweep;
      const jitter = ((attributeIndex % 4) - 1.5) * 0.003;
      const angle = baseAngle + jitter;
      const attrPos = polarPoint(outerRadius, angle);

      const isLeftSide = Math.cos(angle) < 0;
      let rotation = (angle * 180) / Math.PI + 90;
      if (isLeftSide) rotation += 180;

      let fontSize = 14;
      if (attribute.label.length > 30) {
        fontSize = 12;
      } else if (attribute.label.length > 22) {
        fontSize = 13;
      }

      const attributeId = `${clusterId}-attribute-${attributeIndex}`;
      attributeNodes.push({
        id: attributeId,
        clusterId,
        clusterName: cluster.cluster_name,
        label: attribute.label,
        x: mirrorX(attrPos.x),
        y: centerY + attrPos.y,
        angle,
        rotation,
        textAnchor: isLeftSide ? "end" : "start",
        fontSize,
      });

      links.push({
        id: `${clusterId}-link-${attributeIndex}`,
        clusterId,
        x1: mirrorX(clusterPos.x),
        y1: centerY + clusterPos.y,
        x2: mirrorX(attrPos.x),
        y2: centerY + attrPos.y,
      });
    });

    cursor = end + clusterGap;
  });

  return { clusterNodes, attributeNodes, links };
}

export default function TasteMapViz({ clusters, styleDescription }: TasteMapVizProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1400, height: 900 });
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [hoveredAttributeId, setHoveredAttributeId] = useState<string | null>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: rect.width, height: rect.height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const descriptionLines = useMemo(() => wrapText(styleDescription), [styleDescription]);
  const layout = useMemo(
    () => buildLayout(clusters, size.width, size.height),
    [clusters, size.height, size.width],
  );

  const activeClusterId = useMemo(() => {
    if (hoveredAttributeId) {
      return (
        layout.attributeNodes.find((node) => node.id === hoveredAttributeId)?.clusterId ??
        hoveredClusterId
      );
    }
    return hoveredClusterId;
  }, [hoveredAttributeId, hoveredClusterId, layout.attributeNodes]);

  return (
    <main className="min-h-screen bg-[#FEFEFD] px-5 py-6 md:px-8 md:py-8">
      <div
        ref={frameRef}
        className="mx-auto grid aspect-[16/10] w-full max-w-[1400px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] border border-[#ECEDEF] bg-[#FEFEFD] p-6 shadow-[0_3px_14px_rgba(17,17,17,0.05)]"
      >
        <header className="mx-auto max-w-[900px] pb-3 text-center">
          <p className="font-ui text-[12px] uppercase tracking-[0.14em] text-[#888894]">Style Description</p>
          <div className="mt-2 space-y-1.5">
            {descriptionLines.map((line, index) => (
              <p key={`${line}-${index}`} className="font-ui text-[14px] leading-6 text-[#111111]">
                {line}
              </p>
            ))}
          </div>
        </header>

        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size.width} ${size.height}`}
          className="h-full w-full"
          style={{ background: PAPER }}
        >
          {layout.links.map((link) => {
            const active = activeClusterId === link.clusterId;
            const hasActive = Boolean(activeClusterId);
            const opacity = hasActive ? (active ? 0.22 : 0.08) : 0.14;
            return (
              <line
                key={link.id}
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={LINE}
                strokeWidth={1}
                strokeOpacity={opacity}
                className="transition-opacity duration-150"
              />
            );
          })}

          {layout.clusterNodes.map((cluster) => {
            const active = activeClusterId === cluster.id;
            const hasActive = Boolean(activeClusterId);
            const opacity = hasActive ? (active ? 1 : 0.35) : 1;

            return (
              <g
                key={cluster.id}
                opacity={opacity}
                onPointerEnter={() => setHoveredClusterId(cluster.id)}
                onPointerLeave={() => setHoveredClusterId((prev) => (prev === cluster.id ? null : prev))}
                className="transition-opacity duration-150"
              >
                <circle
                  cx={cluster.x}
                  cy={cluster.y}
                  r={22}
                  fill={PAPER}
                  stroke={LINE}
                  strokeWidth={1}
                />
                <text
                  x={cluster.x}
                  y={cluster.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={META}
                  fontSize={11}
                  style={{ letterSpacing: "0.02em" }}
                  className="font-ui"
                >
                  {cluster.name}
                </text>
              </g>
            );
          })}

          {layout.attributeNodes.map((attribute) => {
            const activeCluster = activeClusterId === attribute.clusterId;
            const activeLabel = hoveredAttributeId === attribute.id;
            const hasActive = Boolean(activeClusterId);
            const opacity = hasActive ? (activeCluster ? 0.95 : 0.28) : 0.92;
            const scale = activeLabel ? 1.03 : 1;

            return (
              <g
                key={attribute.id}
                transform={`translate(${attribute.x} ${attribute.y}) rotate(${attribute.rotation}) scale(${scale})`}
                opacity={opacity}
                onPointerEnter={() => {
                  setHoveredAttributeId(attribute.id);
                  setHoveredClusterId(attribute.clusterId);
                }}
                onPointerLeave={() => {
                  setHoveredAttributeId((prev) => (prev === attribute.id ? null : prev));
                }}
                className="transition-[opacity,transform] duration-150"
              >
                <text
                  x={0}
                  y={0}
                  textAnchor={attribute.textAnchor}
                  dominantBaseline="middle"
                  fill={INK}
                  fontSize={attribute.fontSize}
                  className="font-ui"
                >
                  {attribute.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </main>
  );
}
