"use client";

import { useEffect, useRef, useState } from "react";
import { markMilestonesCelebratedAction } from "@/app/actions/plans";
import { useToast } from "./toast";

// Fires a small confetti burst once when a new milestone is crossed, then records
// it server-side so it never repeats. Skips the animation entirely when the user
// prefers reduced motion (still records, so it won't re-trigger later).
export function MilestoneCelebration({
  planId,
  newlyReached,
}: {
  planId: string;
  newlyReached: number[];
}) {
  const [pieces, setPieces] = useState<number[]>([]);
  const { success } = useToast();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (newlyReached.length === 0) return;
    done.current = true;

    const highest = Math.max(...newlyReached);
    success(`ยินดีด้วย! เก็บถึง ${highest}% ของเป้าหมายแล้ว 🎉`);

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduceMotion) {
      setPieces(Array.from({ length: 80 }, (_, i) => i));
      const t = setTimeout(() => setPieces([]), 2500);
      // record after firing so it won't repeat on next load
      void markMilestonesCelebratedAction(planId, newlyReached);
      return () => clearTimeout(t);
    }

    void markMilestonesCelebratedAction(planId, newlyReached);
  }, [planId, newlyReached, success]);

  if (pieces.length === 0) return null;

  const colors = ["#D8A24A", "#2F8F83", "#1B2A4A", "#C0492F"];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.8 + Math.random() * 0.9;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}vw`,
              width: size,
              height: size,
              background: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
