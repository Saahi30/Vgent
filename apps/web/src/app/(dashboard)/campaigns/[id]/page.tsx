"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  Phone,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const token = typeof window !== "undefined" ? localStorage.getItem("vgent_token") : null;

  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  const loadCampaign = useCallback(() => {
    api.campaigns.get(campaignId)
      .then((res) => setCampaign(res.data))
      .catch(() => toast.error("Campaign not found"));
  }, [campaignId]);

  const loadContacts = useCallback(() => {
    api.campaigns.contacts(campaignId, { page: 1 })
      .then((res) => setContacts(res.data || []))
      .catch(() => {});
  }, [campaignId]);

  const loadCalls = useCallback(() => {
    api.calls.list({ campaign_id: campaignId, page_size: 50 })
      .then((res) => setCalls(res.data || []))
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    Promise.all([
      api.campaigns.get(campaignId),
      api.campaigns.contacts(campaignId, { page: 1 }),
      api.calls.list({ campaign_id: campaignId, page_size: 50 }),
    ])
      .then(([campRes, contactsRes, callsRes]) => {
        setCampaign(campRes.data);
        setContacts(contactsRes.data || []);
        setCalls(callsRes.data || []);
      })
      .catch(() => toast.error("Failed to load campaign"))
      .finally(() => setLoading(false));
  }, [campaignId]);

  // Live WebSocket updates
  const onWsMessage = useCallback((data: any) => {
    setLiveEvents((prev) => [data, ...prev].slice(0, 50));

    // Refresh data on key events
    if (["call_result", "campaign_completed", "calls_dispatched"].includes(data.event)) {
      loadCampaign();
      loadContacts();
      loadCalls();
    }
  }, [loadCampaign, loadContacts, loadCalls]);

  useWebSocket({
    path: `/ws/campaigns/${campaignId}`,
    token,
    onMessage: onWsMessage,
    enabled: campaign?.status === "running",
  });

  const handleStart = async () => {
    try {
      await api.campaigns.start(campaignId);
      toast.success("Campaign started");
      loadCampaign();
    } catch (err: any) {
      toast.error(err.message || "Failed to start");
    }
  };

  const handlePause = async () => {
    try {
      await api.campaigns.pause(campaignId);
      toast.success("Campaign paused");
      loadCampaign();
    } catch (err: any) {
      toast.error(err.message || "Failed to pause");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      await api.campaigns.delete(campaignId);
      toast.success("Campaign deleted");
      router.push("/campaigns");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button variant="outline" onClick={() => router.push("/campaigns")} className="mt-4">
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const completedPct =
    campaign.total_contacts > 0
      ? Math.round(((campaign.completed_calls + campaign.failed_calls) / campaign.total_contacts) * 100)
      : 0;

  const statusVariant = (s: string) => {
    switch (s) {
      case "running": return "success";
      case "paused": return "warning";
      case "completed": return "secondary";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  const contactStatusIcon = (s: string) => {
    switch (s) {
      case "completed": return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "calling": return <Phone className="h-4 w-4 text-primary animate-pulse" />;
      case "do_not_call": return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge variant={statusVariant(campaign.status) as any}>{campaign.status}</Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status !== "running" && campaign.status !== "completed" && (
            <Button onClick={handleStart}>
              <Play className="h-4 w-4 mr-2" /> Start
            </Button>
          )}
          {campaign.status === "running" && (
            <Button variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-2" /> Pause
            </Button>
          )}
          {campaign.status !== "running" && (
            <Button variant="ghost" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" /> Total Contacts
            </div>
            <p className="text-2xl font-bold mt-1">{campaign.total_contacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="h-4 w-4" /> Completed
            </div>
            <p className="text-2xl font-bold mt-1 text-success">{campaign.completed_calls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <XCircle className="h-4 w-4" /> Failed
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">{campaign.failed_calls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Activity className="h-4 w-4" /> Progress
            </div>
            <p className="text-2xl font-bold mt-1">{completedPct}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Progress value={campaign.completed_calls + campaign.failed_calls} max={campaign.total_contacts || 1} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
          {campaign.status === "running" && <TabsTrigger value="live">Live Feed</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <p className="text-muted-foreground">Agent</p>
                  <p className="font-medium">{campaign.agent_id?.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timezone</p>
                  <p className="font-medium">{campaign.timezone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Calling Hours</p>
                  <p className="font-medium">{campaign.calling_hours_start} — {campaign.calling_hours_end}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Calling Days</p>
                  <p className="font-medium">
                    {(campaign.calling_days || []).map((d: number) =>
                      ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]
                    ).join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Concurrent Calls</p>
                  <p className="font-medium">{campaign.max_concurrent_calls}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Retries</p>
                  <p className="font-medium">{campaign.max_retries} (delay: {campaign.retry_delay_minutes}min)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(campaign.created_at)}</p>
                </div>
                {campaign.scheduled_at && (
                  <div>
                    <p className="text-muted-foreground">Scheduled At</p>
                    <p className="font-medium">{formatDate(campaign.scheduled_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Attempts</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Last Attempted</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        No contacts in this campaign
                      </td>
                    </tr>
                  ) : (
                    contacts.map((cc: any) => (
                      <tr key={cc.id} className="border-b border-border hover:bg-accent">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {contactStatusIcon(cc.status)}
                            <span className="capitalize">{cc.status}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium">{cc.contact_id?.slice(0, 8)}...</td>
                        <td className="p-4 text-muted-foreground">{cc.attempts}</td>
                        <td className="p-4 text-muted-foreground">
                          {cc.last_attempted_at ? formatDate(cc.last_attempted_at) : "--"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls */}
        <TabsContent value="calls">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">To</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        No calls yet
                      </td>
                    </tr>
                  ) : (
                    calls.map((call: any) => (
                      <tr key={call.id} className="border-b border-border hover:bg-accent">
                        <td className="p-4 font-medium">
                          <Link href={`/calls/${call.id}`} className="hover:underline">
                            {call.to_number}
                          </Link>
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            call.status === "completed" ? "success" as any :
                            call.status === "failed" ? "destructive" :
                            "secondary"
                          }>
                            {call.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, "0")}` : "--"}
                        </td>
                        <td className="p-4 text-muted-foreground">{formatDate(call.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Feed */}
        <TabsContent value="live">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <p className="text-sm font-medium">Live Campaign Events</p>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {liveEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Waiting for events...
                  </p>
                ) : (
                  liveEvents.map((event, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-muted/50 text-sm">
                      <Badge variant="outline" className="shrink-0">{event.event}</Badge>
                      <pre className="text-xs text-muted-foreground overflow-auto flex-1">
                        {JSON.stringify(event, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
