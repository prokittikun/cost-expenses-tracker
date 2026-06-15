import Link from "next/link";
import type { ComponentProps } from "react";

export function Card({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-2xl border border-ink/5 bg-card p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}

export function Stat({
  label,
  value,
  accent = "ink",
}: {
  label: string;
  value: string;
  accent?: "ink" | "gold" | "jade" | "warn" | "muted";
}) {
  const colors: Record<string, string> = {
    ink: "text-ink",
    gold: "text-gold",
    jade: "text-jade",
    warn: "text-warn",
    muted: "text-muted",
  };
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export const btnVariants = {
  primary: `${btnBase} bg-ink text-white hover:bg-ink/90`,
  gold: `${btnBase} bg-gold text-white hover:bg-gold/90`,
  outline: `${btnBase} border border-ink/15 bg-white text-ink hover:bg-ink/5`,
  danger: `${btnBase} border border-warn/30 bg-white text-warn hover:bg-warn/10`,
  ghost: `${btnBase} text-ink hover:bg-ink/5`,
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof btnVariants }) {
  return <button className={`${btnVariants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof btnVariants }) {
  return <Link className={`${btnVariants[variant]} ${className}`} {...props} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none";

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">{children}</p>;
}
