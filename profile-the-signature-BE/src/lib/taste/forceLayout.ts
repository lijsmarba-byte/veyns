import { clamp, hashString, mulberry32 } from "@/lib/taste/seededRandom";

export type AtlasClusterInput = {
  id: string;
  name: string;
  weight: number;
};

export type AtlasNodeInput = {
  id: string;
  clusterId: string;
  label: string;
  weight: number;
  confidence: number;
  fontSize: number;
};

export type AtlasCenter = {
  clusterId: string;
  x: number;
  y: number;
};

export type AtlasNodePosition = {
  id: string;
  clusterId: string;
  x: number;
  y: number;
};

export type AtlasLayoutResult = {
  centers: AtlasCenter[];
  nodes: AtlasNodePosition[];
};

type SolverParams = {
  width: number;
  height: number;
  seedKey: string;
  clusters: AtlasClusterInput[];
  nodes: AtlasNodeInput[];
  iterations?: number;
};

function normalizeWeights(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function solveTasteAtlasLayout({
  width,
  height,
  seedKey,
  clusters,
  nodes,
  iterations = 110,
}: SolverParams): AtlasLayoutResult {
  if (clusters.length === 0 || nodes.length === 0 || width <= 0 || height <= 0) {
    return { centers: [], nodes: [] };
  }

  const clusterWeights = normalizeWeights(clusters.map((c) => c.weight));
  const centers: AtlasCenter[] = clusters.map((cluster, index) => {
    const seed = hashString(`${seedKey}-${cluster.name}-${index}`);
    const rng = mulberry32(seed);
    return {
      clusterId: cluster.id,
      x: (0.15 + rng() * 0.7) * width,
      y: (0.15 + rng() * 0.7) * height,
    };
  });

  for (let step = 0; step < 130; step += 1) {
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        const a = centers[i];
        const b = centers[j];
        const ai = clusters.findIndex((c) => c.id === a.clusterId);
        const bi = clusters.findIndex((c) => c.id === b.clusterId);
        const aw = clusterWeights[Math.max(0, ai)] ?? 0.5;
        const bw = clusterWeights[Math.max(0, bi)] ?? 0.5;
        const minDist = (130 + aw * 70) + (130 + bw * 70);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        if (dist >= minDist) continue;
        const push = (minDist - dist) * 0.44;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x = clamp(a.x - ux * push * 0.5, 80, width - 80);
        a.y = clamp(a.y - uy * push * 0.5, 70, height - 70);
        b.x = clamp(b.x + ux * push * 0.5, 80, width - 80);
        b.y = clamp(b.y + uy * push * 0.5, 70, height - 70);
      }
    }
  }

  const centerMap = new Map(centers.map((c) => [c.clusterId, c]));

  const positions = nodes.map((node, index) => {
    const center = centerMap.get(node.clusterId) ?? centers[0];
    const rng = mulberry32(hashString(`${seedKey}-${node.id}-${index}`));
    const angle = rng() * Math.PI * 2;
    const radius = 22 + rng() * 72;
    const estTextWidth = Math.max(28, node.label.length * node.fontSize * 0.5);
    const estTextHeight = Math.max(14, node.fontSize * 1.15);
    const collisionRadius = Math.max(16, Math.hypot(estTextWidth * 0.5, estTextHeight * 0.5));
    return {
      id: node.id,
      clusterId: node.clusterId,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: collisionRadius,
      weight: node.weight,
      confidence: node.confidence,
      estTextWidth,
      estTextHeight,
      targetX: center.x + Math.cos(angle) * radius,
      targetY: center.y + Math.sin(angle) * radius,
    };
  });

  const membersByCluster = new Map<string, typeof positions>();
  positions.forEach((node) => {
    const existing = membersByCluster.get(node.clusterId);
    if (existing) {
      existing.push(node);
      return;
    }
    membersByCluster.set(node.clusterId, [node]);
  });

  membersByCluster.forEach((members, clusterId) => {
    const center = centerMap.get(clusterId) ?? centers[0];
    members.sort((a, b) => b.weight - a.weight);
    const baseSeed = hashString(`${seedKey}-${clusterId}-targets`);
    const rng = mulberry32(baseSeed);
    const golden = Math.PI * (3 - Math.sqrt(5));

    members.forEach((node, idx) => {
      const radialBase = 28 + Math.sqrt(idx + 1) * 24;
      const extra = (rng() - 0.5) * 10;
      const angle = idx * golden + rng() * 0.4;
      const spread = radialBase + extra + node.radius * 0.2;
      node.targetX = center.x + Math.cos(angle) * spread;
      node.targetY = center.y + Math.sin(angle) * spread;
    });
  });

  for (let step = 0; step < iterations; step += 1) {
    for (let i = 0; i < positions.length; i += 1) {
      const node = positions[i];
      const attract = 0.016 + node.weight * 0.06;
      node.vx += (node.targetX - node.x) * attract;
      node.vy += (node.targetY - node.y) * attract;

      for (let j = i + 1; j < positions.length; j += 1) {
        const other = positions[j];
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = node.radius + other.radius + 12;
        if (dist >= minDist) continue;
        const force = ((minDist - dist) / minDist) * 0.9;
        const ux = dx / dist;
        const uy = dy / dist;
        node.vx -= ux * force;
        node.vy -= uy * force;
        other.vx += ux * force;
        other.vy += uy * force;
      }

      const marginX = node.estTextWidth * 0.55 + 10;
      const marginY = node.estTextHeight * 0.75 + 8;
      if (node.x < marginX) node.vx += (marginX - node.x) * 0.1;
      if (node.x > width - marginX) node.vx -= (node.x - (width - marginX)) * 0.1;
      if (node.y < marginY) node.vy += (marginY - node.y) * 0.1;
      if (node.y > height - marginY) node.vy -= (node.y - (height - marginY)) * 0.1;
    }

    positions.forEach((node) => {
      node.vx *= 0.74;
      node.vy *= 0.74;
      const marginX = node.estTextWidth * 0.55 + 10;
      const marginY = node.estTextHeight * 0.75 + 8;
      node.x = clamp(node.x + node.vx, marginX, width - marginX);
      node.y = clamp(node.y + node.vy, marginY, height - marginY);
    });
  }

  return {
    centers,
    nodes: positions.map((n) => ({ id: n.id, clusterId: n.clusterId, x: n.x, y: n.y })),
  };
}
