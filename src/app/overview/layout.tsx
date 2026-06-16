import { AppShell } from "@/components/AppShell";

export default function OverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
