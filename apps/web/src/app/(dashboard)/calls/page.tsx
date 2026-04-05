"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

const STATUS_OPTIONS = ["all", "queued", "ringing", "in_progress", "completed", "failed", "no_answer"];

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.calls.list({
      page,
      status: statusFilter === "all" ? undefined : statusFilter,
    }).then((res) => {
      setCalls(res.data || []);
      setTotalPages(res.total_pages || 1);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, statusFilter]);

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed": return "success";
      case "failed": return "destructive";
      case "in_progress": return "warning";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calls</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage call history</p>
        </div>
      </div>

      {/* Filters */}
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
              <p className="text-muted-foreground text-sm">Calls will appear here once agents start making them.</p>
            </div>
          ) : (
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
                      className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
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
