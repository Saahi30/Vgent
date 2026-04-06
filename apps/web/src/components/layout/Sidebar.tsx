"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useModeStore, type PlatformMode } from "@/store/mode";
import {
  Bot, Phone, Users, Megaphone, BookOpen, Settings,
  Activity, LayoutDashboard, Shield, ChevronLeft, Zap,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/knowledge-bases", label: "Knowledge Bases", icon: BookOpen },
  { href: "/live", label: "Live Monitor", icon: Activity },
  { href: "/settings/providers", label: "Settings", icon: Settings, matchPrefix: "/settings" },
];

const adminItems = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { mode, setMode } = useModeStore();

  const isV8 = mode === "v8";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-background transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {sidebarOpen && (
          <Link href="/" className="text-xl font-semibold tracking-tight text-primary">
            Vgent
          </Link>
        )}
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
          <ChevronLeft className={cn("h-5 w-5 transition-transform", !sidebarOpen && "rotate-180")} />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="px-3 pt-3">
        <div className={cn(
          "flex items-center rounded-lg border border-border bg-muted/50 p-0.5",
          !sidebarOpen && "flex-col gap-0.5"
        )}>
          <button
            onClick={() => setMode("custom")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              sidebarOpen ? "flex-1" : "w-full",
              !isV8
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && <span>Custom</span>}
          </button>
          <button
            onClick={() => setMode("v8")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              sidebarOpen ? "flex-1" : "w-full",
              isV8
                ? "bg-amber-500/10 text-amber-600 shadow-sm border border-amber-500/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && <span>V8</span>}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 mt-2 flex-1">
        {navItems.map((item: any) => {
          const prefix = item.matchPrefix || item.href;
          const isActive = pathname === item.href || (prefix !== "/" && pathname.startsWith(prefix));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin section */}
        <div className="my-2 border-t border-border" />
        {adminItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Mode indicator at bottom */}
      {sidebarOpen && isV8 && (
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            <Zap className="h-3.5 w-3.5" />
            <span>V8 Mode Active</span>
          </div>
        </div>
      )}
    </aside>
  );
}
