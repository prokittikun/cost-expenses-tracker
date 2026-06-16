import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

// Auth-gated area — keep all plan pages out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
