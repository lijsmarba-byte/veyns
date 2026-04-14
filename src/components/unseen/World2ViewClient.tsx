"use client";

import dynamic from "next/dynamic";
import type { World2ViewProps } from "@/components/unseen/World2View";

const World2ViewNoSSR = dynamic(
  () => import("@/components/unseen/World2View").then((module) => module.World2View),
  { ssr: false },
);

export function World2ViewClient(props: World2ViewProps) {
  return <World2ViewNoSSR {...props} />;
}
