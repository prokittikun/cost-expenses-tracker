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

// Shared signed-in chrome: header + top nav (overview / plans) + centered main.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/5 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-5">
            <Link href="/overview" className="font-bold text-ink">
              💰 Savings Planner
            </Link>
            <nav className="hidden gap-4 text-sm sm:flex">
              <Link href="/overview" className="text-muted hover:text-ink">
                ภาพรวม
              </Link>
              <Link href="/plans" className="text-muted hover:text-ink">
                เป้าหมาย
              </Link>
            </nav>
          </div>
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
