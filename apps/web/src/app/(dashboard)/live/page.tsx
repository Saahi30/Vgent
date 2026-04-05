"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Radio,
  Activity,
  Clock,
  Volume2,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";

interface ActiveCall {
  call_id: string;
  tenant_id: string;
  to_number: string;
  from_number?: string;
  agent_id: string;
  agent_name: string;
  provider: string;
  status: string;
  started_at?: string;
  last_event?: string;
  last_turn?: { role: string; content: string };
}

function formatDuration(startedAt?: string): string {
  if (!startedAt) return "0:00";
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "ringing":
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Ringing</Badge>;
    case "in_progress":
      return <Badge variant="outline" className="border-green-500 text-green-500">Live</Badge>;
    case "completed":
      return <Badge variant="secondary">Ended</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function LiveMonitorPage() {
  const { token } = useAuthStore();
  const [activeCalls, setActiveCalls] = useState<Map<string, ActiveCall>>(new Map());
  const [callsToday, setCallsToday] = useState(0);
  const [, setTick] = useState(0); // force re-render for duration timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial state via REST
  useEffect(() => {
    api.calls.active().then((res) => {
      if (res.data) {
        const map = new Map<string, ActiveCall>();
        for (const c of res.data) {
          map.set(c.call_id, c);
        }
        setActiveCalls(map);
      }
    }).catch(() => {});
  }, []);

  // Tick every second to update durations
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleMessage = useCallback((data: any) => {
    if (data.event === "snapshot") {
      const map = new Map<string, ActiveCall>();
      for (const c of data.calls || []) {
        map.set(c.call_id, c);
      }
      setActiveCalls(map);
      return;
    }

    const callId = data.call_id;
    if (!callId) return;

    setActiveCalls((prev) => {
      const next = new Map(prev);

      if (data.event === "call_started") {
        next.set(callId, {
          call_id: callId,
          tenant_id: data.payload?.tenant_id || "",
          to_number: data.payload?.to_number || "",
          agent_id: data.payload?.agent_id || "",
          agent_name: data.payload?.agent_name || "Agent",
          provider: data.payload?.provider || "",
          status: "ringing",
          started_at: data.timestamp,
        });
        setCallsToday((n) => n + 1);
      } else if (data.event === "call_ended") {
        next.delete(callId);
      } else if (data.event === "agent_joined") {
        const existing = next.get(callId);
        if (existing) {
          next.set(callId, { ...existing, status: "in_progress", last_event: "agent_joined" });
        }
      } else if (data.event === "turn") {
        const existing = next.get(callId);
        if (existing) {
          next.set(callId, {
            ...existing,
            last_turn: { role: data.role, content: data.content },
            last_event: "turn",
          });
        }
      } else {
        const existing = next.get(callId);
        if (existing) {
          next.set(callId, { ...existing, last_event: data.event });
        }
      }

      return next;
    });
  }, []);

  const { connected } = useWebSocket({
    path: "/ws/live",
    token,
    onMessage: handleMessage,
    enabled: !!token,
  });

  const calls = Array.from(activeCalls.values());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time view of active calls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{calls.length}</p>
              <p className="text-xs text-muted-foreground">Active Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{callsToday}</p>
              <p className="text-xs text-muted-foreground">Calls This Session</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {calls.filter((c) => c.status === "in_progress").length}
              </p>
              <p className="text-xs text-muted-foreground">In Conversation</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Calls Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="h-4 w-4" /> Active Calls
            <Badge variant="secondary" className="ml-2">
              {calls.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No active calls</p>
              <p className="text-muted-foreground text-sm">
                Active calls will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {calls.map((call) => (
                <Card key={call.call_id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            call.status === "in_progress"
                              ? "bg-green-500 animate-pulse"
                              : "bg-yellow-500 animate-pulse"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold">{call.to_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {call.agent_name}
                          </p>
                        </div>
                      </div>
                      {statusBadge(call.status)}
                    </div>

                    {/* Details */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.started_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3" />
                        {call.provider}
                      </span>
                    </div>

                    {/* Last transcript line */}
                    {call.last_turn && (
                      <div className="bg-accent/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                          {call.last_turn.role}
                        </p>
                        <p className="text-sm truncate">{call.last_turn.content}</p>
                      </div>
                    )}

                    {/* Activity indicator */}
                    {call.last_event && call.last_event !== "turn" && (
                      <p className="text-xs text-muted-foreground italic">
                        {call.last_event === "llm_started"
                          ? "AI is thinking..."
                          : call.last_event === "tts_started"
                          ? "Speaking..."
                          : call.last_event === "user_speech"
                          ? "User is speaking..."
                          : call.last_event}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
