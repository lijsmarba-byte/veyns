import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        mist: "var(--mist)",
        ink: "var(--ink)",
        meta: "var(--meta)",
        inactive: "var(--inactive)",
        line: "var(--line)",
        archiveColor: "var(--archiveColor)",
        accent: "var(--accent)",
      },
      fontFamily: {
        ui: ["var(--font-ui-sans)", "sans-serif"],
        headline: ["var(--font-headline-serif)", "serif"],
        monoMeta: ["var(--font-meta-mono)", "monospace"],
        belmonte: ["var(--font-belmonte-ballpoint)", "serif"],
      },
      letterSpacing: {
        ui: "0.02em",
        headline: "-0.02em",
      },
    },
  },
};

export default config;
