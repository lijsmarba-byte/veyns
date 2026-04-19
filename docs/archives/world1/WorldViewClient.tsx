"use client";

import dynamic from "next/dynamic";
import type { WorldViewProps } from "./WorldView";

const WorldViewNoSSR = dynamic(
  () => import("./WorldView").then((module) => module.WorldView),
  { ssr: false },
);

export function WorldViewClient(props: WorldViewProps) {
  return <WorldViewNoSSR {...props} />;
}
