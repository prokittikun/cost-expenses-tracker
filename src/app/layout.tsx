import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const sansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans-thai",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

// Public base URL for absolute OG/canonical links. Set NEXT_PUBLIC_SITE_URL
// (or AUTH_URL) in prod; falls back to localhost in dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.AUTH_URL ??
  "http://localhost:3000";

const SITE_NAME = "Savings Planner";
const SITE_DESC =
  "วางแผนและติดตามการเก็บเงินตามเป้าหมายของคุณ — ตั้งเป้า คำนวณยอดเก็บต่อเดือน และติดตามรายรับรายจ่ายจริง";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Savings Planner — วางแผนเก็บเงิน",
    template: "%s — Savings Planner",
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  keywords: [
    "วางแผนเก็บเงิน",
    "ออมเงิน",
    "เป้าหมายการเงิน",
    "ติดตามรายรับรายจ่าย",
    "savings planner",
    "budget",
    "เก็บเงิน",
  ],
  authors: [{ name: SITE_NAME }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: siteUrl,
    siteName: SITE_NAME,
    title: "Savings Planner — วางแผนเก็บเงิน",
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "Savings Planner — วางแผนเก็บเงิน",
    description: SITE_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${sansThai.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
