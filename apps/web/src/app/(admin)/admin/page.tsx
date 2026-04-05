"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Phone,
  PhoneCall,
  Clock,
  ArrowRight,
  Database,
  Server,
  Activity,
} from "lucide-react";

export default function AdminOverviewPage() {
  const [usage, setUsage] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.admin.usage(), api.admin.health()])
      .then(([u, h]) => {
        setUsage(u.data);
        setHealth(h.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            System-wide metrics and health status
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Tenants"
          value={usage?.total_tenants ?? 0}
          icon={Building2}
        />
        <StatsCard
          title="Calls Today"
          value={usage?.calls_today ?? 0}
          icon={Phone}
        />
        <StatsCard
          title="Active Calls Now"
          value={usage?.active_calls ?? 0}
          icon={PhoneCall}
        />
        <StatsCard
          title="Total Minutes Today"
          value={usage?.total_minutes_today ?? 0}
          icon={Clock}
        />
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Database</p>
                    <p className="text-xs text-muted-foreground">PostgreSQL</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      health.db === "ok" || health.database === "ok"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {health.db === "ok" || health.database === "ok"
                      ? "Healthy"
                      : "Unhealthy"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Redis</p>
                    <p className="text-xs text-muted-foreground">Cache & Queue</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      health.redis === "ok" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {health.redis === "ok" ? "Healthy" : "Unhealthy"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Unable to fetch health status
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Tenants</CardTitle>
            <Link href="/admin/tenants">
              <Button variant="ghost" size="sm">
                Manage <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              View and manage all tenant organizations, plans, and limits.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">All Calls</CardTitle>
            <Link href="/admin/calls">
              <Button variant="ghost" size="sm">
                View <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Browse call history across all tenants, filter by tenant or status.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
