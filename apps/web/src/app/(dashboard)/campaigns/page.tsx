"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Megaphone, Play, Pause } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PageTransition, FadeIn, motion } from "@/components/motion";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = () => {
    setLoading(true);
    api.campaigns.list()
      .then((res) => { setCampaigns(res.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const statusVariant = (s: string) => {
    switch (s) {
      case "running": return "success";
      case "paused": return "warning";
      case "completed": return "secondary";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.campaigns.start(id);
      toast.success("Campaign started");
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Failed to start campaign");
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.campaigns.pause(id);
      toast.success("Campaign paused");
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Failed to pause campaign");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <PageTransition className="space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage outbound calling campaigns</p>
          </div>
          <Link href="/campaigns/new">
            <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
          </Link>
        </div>
      </FadeIn>

      {campaigns.length === 0 ? (
        <FadeIn delay={0.15}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-muted-foreground text-sm mb-4">Create a campaign to start making outbound calls</p>
              <Link href="/campaigns/new">
                <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
              </Link>
            </CardContent>
          </Card>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Agent</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Progress</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Scheduled</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign: any, i: number) => (
                      <motion.tr
                        key={campaign.id}
                        className="border-b border-border hover:bg-accent transition-colors"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.15 + i * 0.04 }}
                      >
                      <td className="p-4">
                        <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                          {campaign.name}
                        </Link>
                      </td>
                      <td className="p-4 text-muted-foreground">{campaign.agent_name || campaign.agent_id?.slice(0, 8) || "--"}</td>
                      <td className="p-4">
                        <Badge variant={statusVariant(campaign.status) as any}>{campaign.status}</Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {campaign.completed_calls ?? 0}/{campaign.total_contacts ?? 0}
                        {campaign.total_contacts > 0 && (
                          <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(100, ((campaign.completed_calls || 0) / campaign.total_contacts) * 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {campaign.scheduled_at ? formatDate(campaign.scheduled_at) : "--"}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {campaign.status !== "running" && campaign.status !== "completed" && (
                            <Button variant="ghost" size="sm" onClick={() => handleStart(campaign.id)}>
                              <Play className="h-3 w-3 mr-1" /> Start
                            </Button>
                          )}
                          {campaign.status === "running" && (
                            <Button variant="ghost" size="sm" onClick={() => handlePause(campaign.id)}>
                              <Pause className="h-3 w-3 mr-1" /> Pause
                            </Button>
                          )}
                        </div>
                      </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </PageTransition>
  );
}
