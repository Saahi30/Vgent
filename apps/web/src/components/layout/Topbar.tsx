"use client";

import { useUIStore } from "@/store/ui";
import { useModeStore } from "@/store/mode";
import { Menu, Wallet, Clock, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UsageData {
  minutes_used: number;
  monthly_call_minutes_limit: number;
  calls_this_month: number;
  total_cost_usd: number;
  cost_per_minute: number;
}

interface BolnaBalance {
  balance: number;
  currency: string;
}

function CostCounter() {
  const mode = useModeStore((s) => s.mode);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [bolnaBalance, setBolnaBalance] = useState<BolnaBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        if (mode === "v8") {
          const res = await api.bolna.user.me();
          if (!cancelled && res?.data) {
            setBolnaBalance({
              balance: (res.data.wallet ?? res.data.wallet_balance ?? res.data.balance ?? 0) / 100,
              currency: res.data.currency || "USD",
            });
          }
        }

        const usageRes = await api.tenants.usage();
        if (!cancelled && usageRes?.data) {
          setUsage(usageRes.data as UsageData);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode]);

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-4 w-32 animate-pulse bg-layer-02" />
      </div>
    );
  }

  const costPerMinute = usage && usage.cost_per_minute > 0
    ? `$${usage.cost_per_minute.toFixed(3)}`
    : usage && usage.calls_this_month > 0
    ? "$0.00"
    : null;

  return (
    <div className="flex items-center gap-4">
      {/* Bolna Wallet Balance (V8 mode) */}
      {mode === "v8" && bolnaBalance && (
        <div className="flex items-center gap-3 bg-primary/8 px-4 py-2">
          <Wallet className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-caption-01 text-muted-foreground">Balance</span>
            <span className="text-body-short-01 font-semibold text-primary">
              ${bolnaBalance.balance.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Minutes Used */}
      {usage && (
        <div className="flex items-center gap-3 bg-layer-01 px-4 py-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-caption-01 text-muted-foreground">Minutes</span>
            <span className="text-body-short-01 font-semibold text-foreground">
              {usage.minutes_used}
              <span className="text-muted-foreground font-normal">/{usage.monthly_call_minutes_limit}</span>
            </span>
          </div>
        </div>
      )}

      {/* Cost per Minute */}
      {costPerMinute && (
        <div className="flex items-center gap-3 bg-layer-01 px-4 py-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-caption-01 text-muted-foreground">Cost/min</span>
            <span className="text-body-short-01 font-semibold text-foreground">{costPerMinute}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <CostCounter />
    </header>
  );
}
