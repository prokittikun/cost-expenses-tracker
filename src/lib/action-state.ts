// Shared result shape for Server Actions driven by useActionState.
// `ok` flips on each successful run (toggled id) so the client can fire a toast
// even when two successes carry the same message.
export type ActionResult =
  | { status: "success"; message: string; nonce: number }
  | { status: "error"; message: string; nonce: number }
  | undefined;

let counter = 0;
function nonce() {
  // monotonic per server instance — only used to make consecutive results distinct
  return ++counter;
}

export function ok(message: string): ActionResult {
  return { status: "success", message, nonce: nonce() };
}

export function fail(message: string): ActionResult {
  return { status: "error", message, nonce: nonce() };
}
