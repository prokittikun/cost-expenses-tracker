import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui";

async function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost">
        ออกจากระบบ
      </Button>
    </form>
  );
}

export default async function PlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/5 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/plans" className="font-bold text-ink">
            💰 Savings Planner
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {session?.user?.name || session?.user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
