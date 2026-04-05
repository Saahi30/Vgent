"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Phone, Megaphone, Clock, Plus, ArrowRight } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.agents.list({ page_size: 5 }),
      api.calls.list({ page_size: 10 }),
      api.campaigns.list({ page_size: 5 }),
    ]).then(([a, c, camp]) => {
      setAgents(a.data || []);
      setCalls(c.data || []);
      setCampaigns(camp.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeCampaigns = campaigns.filter(c => c.status === "running").length;
  const callsToday = calls.filter(c => {
    const d = new Date(c.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/agents/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Agent</Button>
          </Link>
          <Link href="/campaigns/new">
            <Button size="sm" variant="outline"><Megaphone className="h-4 w-4 mr-1" /> New Campaign</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Agents" value={agents.length} icon={Bot} />
        <StatsCard title="Active Campaigns" value={activeCampaigns} icon={Megaphone} />
        <StatsCard title="Calls Today" value={callsToday} icon={Phone} />
        <StatsCard title="Total Calls" value={calls.length} icon={Clock} subtitle="Last 20" />
      </div>

      {/* Recent Calls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Calls</CardTitle>
          <Link href="/calls"><Button variant="ghost" size="sm">View all <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No calls yet. Create an agent and start calling!</p>
          ) : (
            <div className="space-y-2">
              {calls.slice(0, 5).map((call: any) => (
                <Link key={call.id} href={`/calls/${call.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{call.to_number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(call.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {call.duration_seconds && (
                      <span className="text-xs text-muted-foreground">{formatDuration(call.duration_seconds)}</span>
                    )}
                    <Badge variant={call.status === "completed" ? "success" : call.status === "failed" ? "destructive" : "secondary"}>
                      {call.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
