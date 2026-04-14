import { clamp, mulberry32 } from "@/lib/taste/seededRandom";

export type LabelLayoutInput = {
  key: string;
  label: string;
  weight: number;
};

export type LabelLayoutOutput = {
  key: string;
  label: string;
  x: number;
  y: number;
  fontScale: number;
  opacity: number;
  sharpness: number;
};

type LayoutNode = LabelLayoutOutput & {
  vx: number;
  vy: number;
  boxW: number;
  boxH: number;
};

export function computeLabelLayout(
  labels: LabelLayoutInput[],
  options?: {
    seed?: number;
    width?: number;
    height?: number;
    iterations?: number;
  },
): LabelLayoutOutput[] {
  const width = options?.width ?? 820;
  const height = options?.height ?? 520;
  const seed = options?.seed ?? 1;
  const iterations = clamp(options?.iterations ?? 58, 30, 80);
  const rng = mulberry32(seed);

  if (labels.length === 0) return [];

  const cx = width * 0.5;
  const cy = height * 0.56;
  const maxRadius = Math.min(width * 0.43, height * 0.39);
  const baseRadius = Math.min(width, height) * 0.06;
  const radiusStep = Math.min(width, height) * 0.045;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const nodes: LayoutNode[] = labels.map((item, i) => {
    const w = clamp(item.weight, 0, 1);
    const fontScale = 12 + w * 10;
    const opacity = 0.25 + w * 0.75;
    const sharpness = w;
    const textWidth = item.label.length * (fontScale * 0.42);
    const boxW = clamp(textWidth + 18, 62, width * 0.42);
    const boxH = clamp(fontScale * 1.25, 18, 34);
    const angle = i * goldenAngle + (rng() - 0.5) * 0.28;
    const ring = Math.floor(i / 5);
    const radius = clamp(baseRadius + ring * radiusStep + rng() * 8, 0, maxRadius);
    const jitterX = (rng() - 0.5) * 14;
    const jitterY = (rng() - 0.5) * 10;
    return {
      key: item.key,
      label: item.label,
      x: cx + Math.cos(angle) * radius + jitterX,
      y: cy + Math.sin(angle) * radius + jitterY,
      fontScale,
      opacity,
      sharpness,
      vx: 0,
      vy: 0,
      boxW,
      boxH,
    };
  });

  const paddingX = 22;
  const paddingY = 26;
  const minDistFactor = 0.36;
  const centerPullX = width * 0.5;
  const centerPullY = height * 0.56;

  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = (Math.max(a.boxW, a.boxH) + Math.max(b.boxW, b.boxH)) * minDistFactor;
        if (dist >= minDist) continue;
        const overlap = (minDist - dist) / minDist;
        const ux = dx / dist;
        const uy = dy / dist;
        const push = overlap * 5.6;
        a.vx -= ux * push;
        a.vy -= uy * push;
        b.vx += ux * push;
        b.vy += uy * push;
      }
    }

    for (const node of nodes) {
      const pullX = (centerPullX - node.x) * 0.0019;
      const pullY = (centerPullY - node.y) * 0.0022;
      node.vx += pullX;
      node.vy += pullY;

      node.vx *= 0.86;
      node.vy *= 0.86;
      node.x += node.vx;
      node.y += node.vy;

      const halfW = node.boxW * 0.5;
      const halfH = node.boxH * 0.5;
      node.x = clamp(node.x, paddingX + halfW, width - paddingX - halfW);
      node.y = clamp(node.y, paddingY + halfH, height - paddingY - halfH);
    }
  }

  return nodes.map(({ key, label, x, y, fontScale, opacity, sharpness }) => ({
    key,
    label,
    x,
    y,
    fontScale,
    opacity,
    sharpness,
  }));
}
