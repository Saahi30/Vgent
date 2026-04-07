"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Phone, Megaphone, Clock, Plus, ArrowRight, DollarSign, AlertTriangle } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";
import { FadeIn, StaggerContainer, StaggerItem, PageTransition, motion, AnimatePresence } from "@/components/motion";

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.agents.list({ page_size: 5 }),
      api.calls.list({ page_size: 10 }),
      api.campaigns.list({ page_size: 5 }),
      api.tenants.usage(),
    ]).then(([a, c, camp, u]) => {
      setAgents(a.data || []);
      setCalls(c.data || []);
      setCampaigns(camp.data || []);
      setUsage(u.data || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeCampaigns = campaigns.filter(c => c.status === "running").length;
  const callsToday = calls.filter(c => {
    const d = new Date(c.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const minutesLimit = usage?.minutes_limit || 0;
  const dollarsLimit = usage?.dollars_limit || 0;
  const minutesPercent = minutesLimit > 0 ? Math.min(100, (usage?.used_minutes || 0) / minutesLimit * 100) : 0;
  const dollarsPercent = dollarsLimit > 0 ? Math.min(100, (usage?.used_dollars || 0) / dollarsLimit * 100) : 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <h1 className="text-heading-05">Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/agents/new">
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Agent</Button>
            </Link>
            <Link href="/campaigns/new">
              <Button size="sm" variant="outline"><Megaphone className="h-4 w-4 mr-2" /> New Campaign</Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Spending Warning Banner */}
      <AnimatePresence>
        {usage?.spending_warning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">{usage.spending_warning}</p>
              {!usage.can_make_calls && (
                <p className="text-xs text-muted-foreground mt-1">
                  Contact your administrator to increase your allocation.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats — Carbon tile grid */}
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        <StaggerItem><StatsCard title="Total Agents" value={agents.length} icon={Bot} /></StaggerItem>
        <StaggerItem><StatsCard title="Active Campaigns" value={activeCampaigns} icon={Megaphone} /></StaggerItem>
        <StaggerItem><StatsCard title="Calls Today" value={callsToday} icon={Phone} /></StaggerItem>
        <StaggerItem><StatsCard title="Total Calls" value={calls.length} icon={Clock} subtitle="Last 20" /></StaggerItem>
      </StaggerContainer>

      {/* Usage / Balance Cards */}
      {usage && (minutesLimit > 0 || dollarsLimit > 0) && (
        <FadeIn delay={0.3}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {minutesLimit > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Minutes Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold">{usage.used_minutes}</span>
                    <span className="text-sm text-muted-foreground">
                      of {minutesLimit} min
                    </span>
                  </div>
                  <Progress value={minutesPercent} className="h-2" />
                  {usage.remaining_minutes !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {usage.remaining_minutes} minutes remaining
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {dollarsLimit > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Spending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold">${usage.used_dollars}</span>
                    <span className="text-sm text-muted-foreground">
                      of ${dollarsLimit}
                    </span>
                  </div>
                  <Progress value={dollarsPercent} className="h-2" />
                  {usage.remaining_dollars !== null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ${usage.remaining_dollars} remaining
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </FadeIn>
      )}

      {/* Analytics Charts */}
      <FadeIn delay={0.4}>
        <AnalyticsCharts />
      </FadeIn>

      {/* Recent Calls — Carbon data table style */}
      <FadeIn delay={0.5}>
        <div className="bg-layer-01">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-heading-03">Recent Calls</h2>
            <Link href="/calls">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          <div>
            {calls.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-body-long-01">
                No calls yet. Create an agent and start calling!
              </p>
            ) : (
              <div>
                {calls.slice(0, 5).map((call: any, i: number) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: 0.55 + i * 0.05 }}
                  >
                    <Link
                      href={`/calls/${call.id}`}
                      className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-layer-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-body-short-01 font-medium">{call.to_number}</p>
                          <p className="text-caption-01 text-muted-foreground">{formatDate(call.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {call.duration_seconds && (
                          <span className="text-caption-01 text-muted-foreground font-mono">{formatDuration(call.duration_seconds)}</span>
                        )}
                        <Badge variant={call.status === "completed" ? "success" : call.status === "failed" ? "destructive" : "secondary"}>
                          {call.status}
                        </Badge>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </PageTransition>
  );
}
