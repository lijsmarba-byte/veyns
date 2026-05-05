import type { Metadata } from "next";
import localFont from "next/font/local";
import { BrowserEnvSync } from "@/components/unseen/BrowserEnvSync";
import { BrowserCompatibilityNotice } from "@/components/unseen/BrowserCompatibilityNotice";
import { MobileZoomGuard } from "@/components/unseen/MobileZoomGuard";
import { ReturnTransitionBridge } from "@/components/unseen/ReturnTransitionBridge";
import "./globals.css";

const inter = localFont({
  variable: "--font-ui-sans",
  src: [
    {
      path: "../../public/fonts/inter/Inter-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter/Inter-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

const instrumentSerif = localFont({
  variable: "--font-headline-serif",
  src: [
    {
      path: "../../public/fonts/instrument-serif/InstrumentSerif-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/instrument-serif/InstrumentSerif-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
});

const ibmPlexMono = localFont({
  variable: "--font-meta-mono",
  src: [
    {
      path: "../../public/fonts/ibm-plex-mono/IBMPlexMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
  ],
});

const belmonteBallpoint = localFont({
  variable: "--font-belmonte-ballpoint",
  src: [
    {
      path: "../../public/fonts/BelmonteBallpoint-Print.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/BelmonteBallpoint-Cursive.ttf",
      weight: "400",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "cenoir",
  description: "Editorial gallery interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-ui-ready="0">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} ${belmonteBallpoint.variable} antialiased`}
      >
        <BrowserEnvSync />
        <MobileZoomGuard />
        <BrowserCompatibilityNotice />
        {children}
        <ReturnTransitionBridge />
      </body>
    </html>
  );
}
