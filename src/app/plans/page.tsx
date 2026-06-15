import Link from "next/link";
import { requireUserId, getUserPlans } from "@/lib/data";
import { LinkButton, Card } from "@/components/ui";
import { formatMoney, formatDate, formatPercent } from "@/lib/format";
import type { CategoryType } from "@/lib/categories";

export default async function PlansPage() {
  const userId = await requireUserId();
  const plans = await getUserPlans(userId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">เป้าหมายของฉัน</h1>
          <p className="mt-1 text-sm text-muted">
            {plans.length ? `${plans.length} เป้าหมาย` : "ยังไม่มีเป้าหมาย"}
          </p>
        </div>
        <LinkButton href="/plans/new" variant="gold">
          + สร้างเป้าหมาย
        </LinkButton>
      </div>

      {plans.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="text-muted">
            เริ่มต้นด้วยการสร้างเป้าหมายการเก็บเงินแรกของคุณ
          </p>
          <div className="mt-4">
            <LinkButton href="/plans/new" variant="gold">
              สร้างเป้าหมายแรก
            </LinkButton>
          </div>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            // savedSoFar from SAVING-category transactions
            const savingCatIds = new Set(
              plan.categories
                .filter((c) => (c.type as CategoryType) === "SAVING")
                .map((c) => c.id),
            );
            const saved = plan.transactions
              .filter((t) => savingCatIds.has(t.categoryId))
              .reduce((s, t) => s + t.amount, 0);
            const progress =
              plan.targetAmount > 0 ? saved / plan.targetAmount : 0;

            return (
              <Link key={plan.id} href={`/plans/${plan.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <h2 className="font-semibold text-ink">{plan.name}</h2>
                    {plan.archived && (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">
                        เก็บถาวร
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="mt-1 line-clamp-1 text-sm text-muted">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-4 h-2 w-full rounded-full bg-ink/10">
                    <div
                      className="h-2 rounded-full bg-gold"
                      style={{ width: `${Math.min(progress * 100, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="font-medium text-gold tabular">
                      {formatPercent(Math.min(progress, 1))}
                    </span>
                    <span className="text-muted tabular">
                      {formatMoney(saved, plan.currency)} /{" "}
                      {formatMoney(plan.targetAmount, plan.currency)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    ครบกำหนด {formatDate(plan.targetDate)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
