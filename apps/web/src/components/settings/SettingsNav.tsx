"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { href: "/settings/providers", label: "Providers" },
  { href: "/settings/v8", label: "V8" },
  { href: "/settings/usage", label: "Usage" },
  { href: "/settings/team", label: "Team" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-border mb-6">
      {SETTINGS_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "relative px-4 py-3 text-body-short-01 font-medium transition-colors",
            pathname === tab.href
              ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-layer-hover"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
