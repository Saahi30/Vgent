"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sun, Moon, Zap, Waves, Trees, Sunset,
  ChevronDown,
} from "lucide-react";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "cyberpunk", label: "Cyberpunk", icon: Zap },
  { value: "ocean", label: "Ocean", icon: Waves },
  { value: "forest", label: "Forest", icon: Trees },
  { value: "sunset", label: "Sunset", icon: Sunset },
] as const;

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const current = themes.find((t) => t.value === theme) ?? themes[1];
  const CurrentIcon = current.icon;

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center w-full p-2 text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors"
          title={`Theme: ${current.label}`}
        >
          <CurrentIcon className="h-5 w-5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
            <div className="absolute left-full bottom-0 ml-2 z-50 min-w-[160px] bg-card border border-border shadow-lg">
              {themes.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => { setTheme(t.value); setOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-body-short-01 transition-colors",
                      theme === t.value
                        ? "bg-layer-01 text-primary"
                        : "text-muted-foreground hover:bg-layer-hover hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-body-short-01 text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          <CurrentIcon className="h-4 w-4" />
          <span>{current.label}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-1 w-full z-50 bg-card border border-border shadow-lg">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => { setTheme(t.value); setOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-body-short-01 transition-colors",
                    theme === t.value
                      ? "bg-layer-01 text-primary"
                      : "text-muted-foreground hover:bg-layer-hover hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
