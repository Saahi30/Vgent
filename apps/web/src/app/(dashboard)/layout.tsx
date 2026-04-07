"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AuthLoader } from "@/components/AuthLoader";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <AuthLoader>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className={cn("transition-all duration-300", sidebarOpen ? "ml-64" : "ml-16")}>
          <Topbar />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </AuthLoader>
  );
}
