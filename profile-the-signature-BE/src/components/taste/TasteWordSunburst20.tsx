"use client";

import { useMemo } from "react";
import type { MockUserProfile } from "@/data/mockUsers";

type SunburstAttribute = {
  id: string;
  label: string;
  weight: number;
};

type SunburstCategory = {
  id: string;
  name: string;
  thesis: string;
  attributes: SunburstAttribute[];
  weight: number;
};

type FittedText = {
  text: string;
  fontSize: number;
  letterSpacing: number;
};

const MAX_CATEGORIES = 10;
const MAX_ATTRIBUTES = 7;

const WIDTH = 940;
const HEIGHT = 940;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

const INNER_RADIUS = 104;
const RING_STEP = 44;
const SEGMENT_ANGLE_GAP = 0.018;
const RING_GAP = 2.2;
const START_ANGLE = Math.PI;
const SWEEP_ANGLE = Math.PI;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toWeight(score: number, confidence: number) {
  const safeScore = Number.isFinite(score) ? score : 0;
  const safeConfidence = Number.isFinite(confidence) ? confidence : 0;
  return clamp(safeScore * safeConfidence, 0, 1);
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function ringSectorPath(cx: number, cy: number, innerR: number, outerR: number, start: number, end: number) {
  const outerStart = polarToCartesian(cx, cy, outerR, start);
  const outerEnd = polarToCartesian(cx, cy, outerR, end);
  const innerEnd = polarToCartesian(cx, cy, innerR, end);
  const innerStart = polarToCartesian(cx, cy, innerR, start);
  const largeArcFlag = end - start > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR.toFixed(2)} ${innerR.toFixed(2)} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function fitTextToWidth(rawText: string, maxWidth: number, minFont = 7.2, maxFont = 11.4): FittedText {
  const input = rawText.trim().replace(/\s+/g, " ");
  if (!input) {
    return { text: "", fontSize: minFont, letterSpacing: 0.01 };
  }

  const estimateWidth = (text: string, fontSize: number, letterSpacing: number) => {
    const charWidth = fontSize * 0.53;
    return text.length * charWidth + Math.max(0, text.length - 1) * fontSize * letterSpacing;
  };

  for (let size = maxFont; size >= minFont; size -= 0.2) {
    const letterSpacing = size > 9.8 ? 0.02 : 0.012;

    if (estimateWidth(input, size, letterSpacing) <= maxWidth) {
      return { text: input, fontSize: Number(size.toFixed(2)), letterSpacing };
    }

    for (let i = input.length - 1; i >= 3; i -= 1) {
      const candidate = `${input.slice(0, i).trimEnd()}…`;
      if (estimateWidth(candidate, size, letterSpacing) <= maxWidth) {
        return { text: candidate, fontSize: Number(size.toFixed(2)), letterSpacing };
      }
    }
  }

  return { text: `${input.slice(0, 2)}…`, fontSize: minFont, letterSpacing: 0.01 };
}

function normalizeAngleDeg(angleRad: number) {
  let deg = (angleRad * 180) / Math.PI;
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}

function labelRotationDeg(angleRad: number) {
  const tangent = (angleRad * 180) / Math.PI + 90;
  const normalized = normalizeAngleDeg(angleRad);
  const isLeftSide = normalized > 90 && normalized < 270;
  return isLeftSide ? tangent + 180 : tangent;
}

function buildSunburstData(user: MockUserProfile): SunburstCategory[] {
  const clusters = user.tasteAttributes.clusters ?? [];

  return clusters
    .map((cluster, clusterIndex) => {
      const attributes = (cluster.attributes ?? [])
        .map((attr, attrIndex) => ({
          id: `cluster-${clusterIndex}-attr-${attrIndex}-${attr.key}`,
          label: attr.label,
          weight: toWeight(attr.score, attr.confidence),
        }))
        .sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          return a.label.localeCompare(b.label);
        })
        .slice(0, MAX_ATTRIBUTES);

      const weight = attributes.reduce((sum, attr) => sum + attr.weight, 0);

      return {
        id: `cluster-${clusterIndex}`,
        name: cluster.cluster_name,
        thesis: cluster.cluster_thesis,
        attributes,
        weight,
      };
    })
    .filter((cluster) => cluster.attributes.length > 0)
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_CATEGORIES);
}

export default function TasteWordSunburst20({ user }: { user: MockUserProfile }) {
  const categories = useMemo(() => buildSunburstData(user), [user]);

  const categoryCount = categories.length;
  const fullStep = categoryCount > 0 ? SWEEP_ANGLE / categoryCount : 0;
  const outerRadius = INNER_RADIUS + MAX_ATTRIBUTES * RING_STEP;

  return (
    <main className="mx-auto max-w-[1160px] px-5 py-8 md:px-8 md:py-10">
      <header className="mb-5 border-b border-line pb-4">
        <p className="font-ui text-[11px] tracking-[0.08em] text-meta">Taste Word Topography 2.0</p>
        <h1 className="mt-2 font-ui text-[20px] leading-[1.02] text-ink">{user.name}</h1>
      </header>

      <section className="mb-6">
        <p className="font-ui text-[13px] font-normal leading-[1.8] text-ink/90" style={{ textIndent: "4.25rem" }}>
          {user.tasteDescription.tasteThesis}
        </p>
      </section>

      <section className="mx-auto max-w-[1020px] rounded-[18px] border border-line bg-paper/95 p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-ui text-[11px] tracking-[0.08em] text-meta">Sunburst with fitted labels per segment</p>
          <p className="font-ui text-[11px] tracking-[0.08em] text-meta">max 10 categories · max 7 attributes</p>
        </div>

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          style={{
            backgroundColor: "rgba(254,254,253,0.99)",
            backgroundImage: "radial-gradient(rgba(17,17,17,0.018) 0.55px, transparent 0.55px)",
            backgroundSize: "3px 3px",
          }}
        >
          <circle cx={CENTER_X} cy={CENTER_Y} r={INNER_RADIUS - 24} fill="rgba(17,17,17,0.028)" />
          <text
            x={CENTER_X}
            y={CENTER_Y - 5}
            textAnchor="middle"
            className="font-ui"
            style={{ fontSize: "11px", letterSpacing: "0.09em", fill: "var(--meta)" }}
          >
            TASTE CORE
          </text>
          <text
            x={CENTER_X}
            y={CENTER_Y + 13}
            textAnchor="middle"
            className="font-ui"
            style={{ fontSize: "9px", letterSpacing: "0.06em", fill: "rgba(17,17,17,0.5)" }}
          >
            {categoryCount} CATEGORIES
          </text>

          {categories.map((category, categoryIndex) => {
            const rawStart = START_ANGLE + categoryIndex * fullStep;
            const rawEnd = rawStart + fullStep;
            const start = rawStart + SEGMENT_ANGLE_GAP;
            const end = rawEnd - SEGMENT_ANGLE_GAP;
            const mid = (start + end) / 2;

            const boundary = polarToCartesian(CENTER_X, CENTER_Y, outerRadius, rawStart);

            return (
              <g key={category.id}>
                <line
                  x1={CENTER_X}
                  y1={CENTER_Y}
                  x2={boundary.x}
                  y2={boundary.y}
                  stroke="rgba(17,17,17,0.22)"
                  strokeWidth={1}
                />

                {category.attributes.map((attribute, attributeIndex) => {
                  const level = attributeIndex + 1;
                  const innerR = INNER_RADIUS + (level - 1) * RING_STEP + RING_GAP;
                  const outerR = INNER_RADIUS + level * RING_STEP - RING_GAP;
                  const midR = (innerR + outerR) / 2;
                  const textPoint = polarToCartesian(CENTER_X, CENTER_Y, midR, mid);
                  const cellArcLength = (end - start) * midR;
                  const usableTextWidth = Math.max(20, cellArcLength - 16);
                  const labelText = level === 1 ? category.name.toUpperCase() : attribute.label;
                  const textFit = fitTextToWidth(
                    labelText,
                    usableTextWidth,
                    level === 1 ? 8.2 : 7.1,
                    level === 1 ? 11.8 : 10.8,
                  );
                  const textRotation = labelRotationDeg(mid);

                  const baseShade = 234 - attributeIndex * 12;
                  const opacity = 0.24 + attribute.weight * 0.36;

                  return (
                    <g key={attribute.id}>
                      <path
                        d={ringSectorPath(CENTER_X, CENTER_Y, innerR, outerR, start, end)}
                        fill={`rgba(${baseShade}, ${baseShade}, ${baseShade + 2}, ${opacity.toFixed(3)})`}
                        stroke="rgba(17,17,17,0.16)"
                        strokeWidth={0.72}
                      />

                      <text
                        x={textPoint.x}
                        y={textPoint.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="font-ui"
                        transform={`rotate(${textRotation.toFixed(2)} ${textPoint.x.toFixed(2)} ${textPoint.y.toFixed(2)})`}
                        style={{
                          fontSize: `${textFit.fontSize}px`,
                          letterSpacing: `${textFit.letterSpacing}em`,
                          fill: "rgba(17,17,17,0.88)",
                          fontWeight: level === 1 ? 600 : 450,
                        }}
                      >
                        {textFit.text}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <circle cx={CENTER_X} cy={CENTER_Y} r={outerRadius} fill="none" stroke="rgba(53,35,122,0.2)" strokeWidth={1.2} />
        </svg>
      </section>
    </main>
  );
}
