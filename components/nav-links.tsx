"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Props = { label: string; links: { href: string; text: string }[] };

export function NavLinks({ label, links }: Props) {
  const pathname = usePathname().replace(/\/?$/, "/");

  return (
    <nav aria-label={label} className="flex gap-1 text-sm">
      {links.map(({ href, text }, i) => {
        // The first link is the locale home and matches only exactly.
        const current =
          i === 0 ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              current
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-fg",
            )}
          >
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
