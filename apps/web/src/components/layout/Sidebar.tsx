"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useModeStore, type PlatformMode } from "@/store/mode";
import {
  Bot, Phone, Users, Megaphone, BookOpen, Settings,
  Activity, LayoutDashboard, Shield, ChevronLeft, Zap, LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

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
  const logout = useAuthStore((s) => s.logout);

  const isV8 = mode === "v8";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-background border-r border-border transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo — Carbon masthead style */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-border">
        {sidebarOpen && (
          <Link href="/" className="text-body-long-01 font-semibold tracking-tight text-foreground">
            Vgent
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
        </button>
      </div>

      {/* Mode Toggle — Carbon toggle style */}
      <div className="px-3 pt-4">
        <div className={cn(
          "flex items-center bg-layer-01 p-0.5",
          !sidebarOpen && "flex-col gap-0.5"
        )}>
          <button
            onClick={() => setMode("custom")}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 text-caption-01 font-medium transition-all",
              sidebarOpen ? "flex-1" : "w-full",
              !isV8
                ? "bg-layer-02 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-layer-hover"
            )}
          >
            <Bot className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && <span>Custom</span>}
          </button>
          <button
            onClick={() => setMode("v8")}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 text-caption-01 font-medium transition-all",
              sidebarOpen ? "flex-1" : "w-full",
              isV8
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-layer-hover"
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && <span>V8</span>}
          </button>
        </div>
      </div>

      {/* Navigation — Carbon side-nav pattern */}
      <nav className="flex flex-col mt-4 flex-1">
        {navItems.map((item: any) => {
          const prefix = item.matchPrefix || item.href;
          const isActive = pathname === item.href || (prefix !== "/" && pathname.startsWith(prefix));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-body-short-01 transition-colors border-l-2",
                isActive
                  ? "border-l-primary bg-layer-01 text-primary font-medium"
                  : "border-l-transparent text-muted-foreground hover:bg-layer-hover hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin divider */}
        <div className="my-2 mx-4 border-t border-border" />
        {adminItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-body-short-01 transition-colors border-l-2",
                isActive
                  ? "border-l-primary bg-layer-01 text-primary font-medium"
                  : "border-l-transparent text-muted-foreground hover:bg-layer-hover hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border">
        {sidebarOpen && isV8 && (
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 text-caption-01 text-primary">
              <Zap className="h-3.5 w-3.5" />
              <span>V8 Mode Active</span>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 text-body-short-01 text-muted-foreground hover:bg-layer-hover hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {sidebarOpen && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
