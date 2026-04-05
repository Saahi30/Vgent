"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsNav } from "@/components/settings/SettingsNav";

interface UsageData {
  plan: string;
  agents_count: number;
  max_agents: number;
  calls_this_month: number;
  minutes_used: number;
  monthly_call_minutes_limit: number;
  max_concurrent_calls: number;
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isHigh = percentage >= 80;
  const isFull = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} / {max}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            isFull ? "bg-destructive" : isHigh ? "bg-yellow-500" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.tenants
      .usage()
      .then((res) => {
        setUsage((res.data as UsageData) || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const planLabel: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <div className="space-y-6">
      <SettingsNav />
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor your plan usage and limits
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !usage ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">Unable to load usage data</p>
            <p className="text-muted-foreground text-sm">Please try again later</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Plan Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <Badge variant="secondary" className="text-sm">
                  {planLabel[usage.plan] || usage.plan}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your organization is on the{" "}
                <span className="font-medium text-foreground">
                  {planLabel[usage.plan] || usage.plan}
                </span>{" "}
                plan. Contact support to upgrade your plan.
              </p>
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold">{usage.calls_this_month}</p>
                  <p className="text-sm text-muted-foreground">Calls This Month</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold">{usage.minutes_used}</p>
                  <p className="text-sm text-muted-foreground">Minutes Used</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold">{usage.max_concurrent_calls}</p>
                  <p className="text-sm text-muted-foreground">Max Concurrent Calls</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bars */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProgressBar
                value={usage.minutes_used}
                max={usage.monthly_call_minutes_limit}
                label="Monthly Call Minutes"
              />
              <ProgressBar
                value={usage.agents_count}
                max={usage.max_agents}
                label="Active Agents"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
