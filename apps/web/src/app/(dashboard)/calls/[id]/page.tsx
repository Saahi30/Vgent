"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Clock, User, Bot, Activity } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [call, setCall] = useState<any>(null);
  const [turns, setTurns] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.calls.get(id).then((res) => {
      const data = res.data;
      setCall(data.call || data);
      setTurns(data.turns || []);
      setEvents(data.events || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed": return "success";
      case "failed": return "destructive";
      case "in_progress": return "warning";
      default: return "secondary";
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!call) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Call not found</p>
        <Link href="/calls"><Button variant="outline" className="mt-4">Back to Calls</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Call Details</h1>
          <p className="text-sm text-muted-foreground">{call.id}</p>
        </div>
      </div>

      {/* Metadata Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="text-sm font-medium">{call.from_number || "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">To</p>
              <p className="text-sm font-medium">{call.to_number || "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium">{call.duration_seconds ? formatDuration(call.duration_seconds) : "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={statusVariant(call.status) as any} className="mt-0.5">{call.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-sm font-medium">{formatDate(call.created_at)}</p>
            </div>
          </div>
          {(call.stt_provider || call.llm_provider || call.tts_provider) && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              {call.stt_provider && <Badge variant="outline" className="text-xs">STT: {call.stt_provider}</Badge>}
              {call.llm_provider && <Badge variant="outline" className="text-xs">LLM: {call.llm_provider}</Badge>}
              {call.tts_provider && <Badge variant="outline" className="text-xs">TTS: {call.tts_provider}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-4 w-4" /> Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          {turns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transcript available for this call.</p>
          ) : (
            <div className="space-y-3">
              {turns.map((turn: any, i: number) => {
                const isUser = turn.role === "user";
                return (
                  <div key={i} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-lg p-3 ${isUser ? "bg-slate-800" : "bg-primary/10"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {isUser ? (
                          <User className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Bot className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold text-muted-foreground capitalize">{turn.role}</span>
                        {turn.timestamp_ms !== undefined && (
                          <span className="text-xs text-muted-foreground">{(turn.timestamp_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      <p className="text-sm">{turn.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events Timeline */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4" /> Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {events.map((event: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-accent/50">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{event.event_type || event.type}</p>
                      {event.timestamp_ms !== undefined && (
                        <span className="text-xs text-muted-foreground shrink-0">{(event.timestamp_ms / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    {event.detail && <p className="text-xs text-muted-foreground truncate">{typeof event.detail === "string" ? event.detail : JSON.stringify(event.detail)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
