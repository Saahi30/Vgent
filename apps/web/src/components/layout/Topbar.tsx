"use client";

import { useUIStore } from "@/store/ui";
import { Menu } from "lucide-react";

export function Topbar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="lg:hidden p-2 rounded-md hover:bg-accent">
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
