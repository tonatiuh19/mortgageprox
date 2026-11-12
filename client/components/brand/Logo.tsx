import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M7.5 15.5 16 8l8.5 7.5"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 14v9.5h11V14"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="19.5" r="2" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="hidden whitespace-nowrap text-[17px] font-semibold tracking-tight min-[380px]:inline">
        Mortgage<span className="text-primary">Prox</span>
      </span>
    </span>
  );
}
