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
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "@/components/motion";

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
  const user = useAuthStore((s) => s.user);
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
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Link href="/" className="text-body-long-01 font-semibold tracking-tight text-foreground">
                Vgent
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          onClick={toggleSidebar}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
        </motion.button>
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
        {navItems.map((item: any, i: number) => {
          const prefix = item.matchPrefix || item.href;
          const isActive = pathname === item.href || (prefix !== "/" && pathname.startsWith(prefix));
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-body-short-01 transition-colors border-l-2",
                  isActive
                    ? "border-l-primary bg-layer-01 text-primary font-medium"
                    : "border-l-transparent text-muted-foreground hover:bg-layer-hover hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}

        {/* Admin divider — only show for superadmin */}
        {user?.role === "superadmin" && (
          <>
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
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border">
        <AnimatePresence>
          {sidebarOpen && isV8 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pt-3 overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 text-caption-01 text-primary">
                <Zap className="h-3.5 w-3.5" />
                <span>V8 Mode Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <ThemeToggle collapsed={!sidebarOpen} />
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
