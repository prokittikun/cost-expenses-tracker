import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

// Auth-gated area — not indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
