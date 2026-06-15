"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./toast";
import type { ActionResult } from "@/lib/action-state";

// Fires a toast whenever a Server Action returns a new ActionResult.
// Dedupes by nonce so the same result object doesn't toast twice on re-render.
export function useActionToast(state: ActionResult) {
  const { success, error } = useToast();
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;
    if (lastNonce.current === state.nonce) return;
    lastNonce.current = state.nonce;
    if (state.status === "success") success(state.message);
    else error(state.message);
  }, [state, success, error]);
}
