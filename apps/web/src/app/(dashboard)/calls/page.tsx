"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ChevronLeft, ChevronRight, Zap, Square } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";
import { useModeStore } from "@/store/mode";
import { toast } from "sonner";

const STATUS_OPTIONS = ["all", "queued", "ringing", "in_progress", "completed", "failed", "no_answer"];

export default function CallsPage() {
  const router = useRouter();
  const { mode } = useModeStore();
  const isV8 = mode === "v8";

  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // V8: agents list for the "quick call" widget
  const [v8Agents, setV8Agents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [callNumber, setCallNumber] = useState("");
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (isV8) {
      api.bolna.agents.list().then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setV8Agents(list);
        if (list.length > 0) setSelectedAgent(list[0].agent_id || list[0].id || "");
      }).catch(() => {});
    }
  }, [isV8]);

  useEffect(() => {
    loadCalls();
  }, [page, statusFilter, isV8]);

  const loadCalls = () => {
    setLoading(true);
    if (isV8) {
      // V8: if we have a selected agent, load its executions
      if (selectedAgent) {
        api.bolna.executions.list(selectedAgent, { page_number: page, page_size: 20 }).then((res) => {
          const list = res.data?.executions || res.data || [];
          setCalls(Array.isArray(list) ? list : []);
          setTotalPages(res.data?.total_pages || 1);
        }).catch(() => setCalls([])).finally(() => setLoading(false));
      } else {
        setCalls([]);
        setLoading(false);
      }
    } else {
      api.calls.list({
        page,
        status: statusFilter === "all" ? undefined : statusFilter,
      }).then((res) => {
        setCalls(res.data || []);
        setTotalPages(res.total_pages || 1);
      }).catch(() => setCalls([])).finally(() => setLoading(false));
    }
  };

  const handleV8Call = async () => {
    if (!selectedAgent || !callNumber) {
      toast.error("Select an agent and enter a phone number");
      return;
    }
    setCalling(true);
    try {
      await api.bolna.calls.make({ agent_id: selectedAgent, recipient_phone_number: callNumber });
      toast.success("Call initiated!");
      setCallNumber("");
      setTimeout(loadCalls, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to make call");
    } finally {
      setCalling(false);
    }
  };

  const handleStopV8Call = async (execId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.bolna.calls.stop(execId);
      toast.success("Call stopped");
      loadCalls();
    } catch (err: any) {
      toast.error(err.message || "Failed to stop call");
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed": return "success";
      case "failed": return "destructive";
      case "in_progress": case "in-progress": return "warning";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Calls
            {isV8 && <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1"><Zap className="h-3 w-3" /> V8</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isV8 ? "Make calls and view executions via V8" : "View and manage call history"}
          </p>
        </div>
      </div>

      {/* V8: Quick Call Widget */}
      {isV8 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label className="text-sm font-medium mb-1 block">Agent</label>
                <select value={selectedAgent}
                  onChange={(e) => { setSelectedAgent(e.target.value); setPage(1); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {v8Agents.map((a: any) => (
                    <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
                      {a.agent_config?.agent_name || a.agent_name || a.name || (a.agent_id || a.id)?.slice(0, 12)}
                    </option>
                  ))}
                  {v8Agents.length === 0 && <option value="">No agents — create one first</option>}
                </select>
              </div>
              <div className="flex-1 min-w-48">
                <label className="text-sm font-medium mb-1 block">Phone Number</label>
                <Input placeholder="+91XXXXXXXXXX" value={callNumber}
                  onChange={(e) => setCallNumber(e.target.value)} />
              </div>
              <Button onClick={handleV8Call} disabled={calling || !selectedAgent || !callNumber}
                className="bg-amber-500 hover:bg-amber-600 text-white">
                <Phone className="h-4 w-4 mr-2" />
                {calling ? "Calling..." : "Call Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters (custom mode only) */}
      {!isV8 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No calls found</p>
              <p className="text-muted-foreground text-sm">
                {isV8
                  ? selectedAgent ? "No executions yet for this agent." : "Select an agent to view call history."
                  : "Calls will appear here once agents start making them."}
              </p>
            </div>
          ) : isV8 ? (
            /* V8 executions table */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">Execution ID</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((exec: any) => {
                    const execId = exec.execution_id || exec.id;
                    const status = exec.status || exec.call_status || "unknown";
                    return (
                      <tr key={execId} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="p-4 font-mono text-xs">{execId?.slice(0, 20)}...</td>
                        <td className="p-4">
                          <Badge variant={statusVariant(status) as any}>{status}</Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">{exec.duration ? `${exec.duration}s` : "--"}</td>
                        <td className="p-4 text-muted-foreground">{exec.recipient_phone_number || exec.to_number || "--"}</td>
                        <td className="p-4">
                          {(status === "in-progress" || status === "in_progress" || status === "queued") && (
                            <Button variant="ghost" size="sm" onClick={(e) => handleStopV8Call(execId, e)}
                              className="text-destructive h-7">
                              <Square className="h-3 w-3 mr-1" /> Stop
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Custom calls table (original) */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">To Number</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call: any) => (
                    <tr
                      key={call.id}
                      onClick={() => router.push(`/calls/${call.id}`)}
                      className="border-b border-border hover:bg-accent cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-medium">{call.to_number}</td>
                      <td className="p-4">
                        <Badge variant={statusVariant(call.status) as any}>{call.status}</Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {call.duration_seconds ? formatDuration(call.duration_seconds) : "--"}
                      </td>
                      <td className="p-4 text-muted-foreground">{call.agent_name || call.agent_id?.slice(0, 8) || "--"}</td>
                      <td className="p-4 text-muted-foreground">{formatDate(call.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
