import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { PlanNav } from "@/components/PlanNav";
import { AskDataChat } from "@/components/AskDataChat";
import { isGeminiConfigured } from "@/lib/gemini";

export default async function PlanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const [plan, user] = await Promise.all([
    prisma.plan.findFirst({
      where: { id, userId },
      select: { id: true, name: true, archived: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { aiOptIn: true },
    }),
  ]);
  if (!plan) notFound();

  return (
    <div>
      <Link href="/plans" className="text-sm text-muted hover:text-ink">
        ← เป้าหมายทั้งหมด
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-ink">{plan.name}</h1>
        {plan.archived && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">
            เก็บถาวร
          </span>
        )}
      </div>
      <div className="mt-4">
        <PlanNav planId={plan.id} />
      </div>
      <div className="mt-6">{children}</div>
      {isGeminiConfigured() && (
        <AskDataChat scopePlanId={plan.id} optedIn={user.aiOptIn} />
      )}
    </div>
  );
}
