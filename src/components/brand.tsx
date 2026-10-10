import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="co-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5cf6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#111a3d" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="url(#co-g)" strokeWidth="3" />
      <circle cx="16" cy="16" r="3" fill="#fff" />
      <circle cx="24.5" cy="9" r="2" fill="#a855f7" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight text-ink-950">
        Campus<span className="text-brand-600">OS</span>
      </span>
    </Link>
  );
}
