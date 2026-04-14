"use client";

import dynamic from "next/dynamic";
import type { WorldViewProps } from "@/components/unseen/WorldView";

const WorldViewNoSSR = dynamic(
  () => import("@/components/unseen/WorldView").then((module) => module.WorldView),
  { ssr: false },
);

export function WorldViewClient(props: WorldViewProps) {
  return <WorldViewNoSSR {...props} />;
}

