"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  useLiveKitRoom,
  TranscriptEntry,
} from "@/components/live-monitor/LiveKitRoom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
} from "lucide-react";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

export default function AgentTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: authToken } = useAuthStore();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [agentName, setAgentName] = useState<string>("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Fetch agent name
  useEffect(() => {
    api.agents.get(id).then((res) => {
      if (res.data) setAgentName(res.data.name || "Agent");
    }).catch(() => {});
  }, [id]);

  const handleTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((t) => [...t, entry]);
  }, []);

  const handleStatusChange = useCallback(
    (s: "connecting" | "connected" | "disconnected") => {
      setStatus(s);
      if (s === "disconnected" && status === "connected") {
        setTranscript((t) => [
          ...t,
          { role: "system", text: "Call disconnected" },
        ]);
      }
    },
    [status]
  );

  // Initialize LiveKit hook with placeholder values — we'll call connect() after getting the token
  const livekitRef = useRef<{
    connect: () => Promise<void>;
    disconnect: () => void;
    setMuted: (m: boolean) => Promise<void>;
  } | null>(null);

  const [livekitConfig, setLivekitConfig] = useState<{
    url: string;
    token: string;
    callId: string;
  } | null>(null);

  const livekit = useLiveKitRoom({
    livekitUrl: livekitConfig?.url || "",
    token: livekitConfig?.token || "",
    callId: livekitConfig?.callId || "",
    wsToken: authToken || "",
    onStatusChange: handleStatusChange,
    onTranscript: handleTranscript,
    muted,
  });

  // Store livekit methods
  useEffect(() => {
    livekitRef.current = livekit;
  }, [livekit]);

  const startCall = async () => {
    setStatus("connecting");
    setTranscript([]);
    try {
      const res = await api.calls.testCall({ agent_id: id });
      const { call_id, room_name, livekit_url, token: lkToken } = res.data;
      setCallId(call_id);

      setTranscript([
        { role: "system", text: `Starting test call with ${agentName}...` },
      ]);

      // Set LiveKit config — this updates the hook, then connect
      setLivekitConfig({ url: livekit_url, token: lkToken, callId: call_id });

      // Small delay to let the hook update, then connect
      setTimeout(async () => {
        try {
          await livekitRef.current?.connect();
          toast.success("Connected to test call!");
        } catch {
          toast.error("Failed to connect audio");
          setStatus("idle");
        }
      }, 100);
    } catch (err: any) {
      toast.error(err.message || "Failed to start test call");
      setStatus("idle");
    }
  };

  const hangUp = async () => {
    livekitRef.current?.disconnect();
    setStatus("disconnected");
    setCallId(null);
    setLivekitConfig(null);
    toast.info("Call ended");
    setTranscript((t) => [...t, { role: "system", text: "Call ended" }]);
  };

  const toggleMute = async () => {
    const newMuted = !muted;
    setMuted(newMuted);
    await livekitRef.current?.setMuted(newMuted);
  };

  const statusColor: Record<ConnectionStatus, string> = {
    idle: "secondary",
    connecting: "outline",
    connected: "default",
    disconnected: "secondary",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Test Call</h1>
          <p className="text-sm text-muted-foreground">
            {agentName || `Agent ID: ${id}`}
          </p>
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                status === "connected"
                  ? "bg-green-500 animate-pulse"
                  : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-muted-foreground"
              }`}
            />
            <span className="text-sm font-medium capitalize">{status}</span>
            {callId && (
              <span className="text-xs text-muted-foreground">
                Call: {callId.slice(0, 8)}...
              </span>
            )}
          </div>
          <Badge variant={statusColor[status] as any}>{status}</Badge>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {status === "idle" || status === "disconnected" ? (
          <Button size="lg" onClick={startCall} className="gap-2">
            <Phone className="h-5 w-5" /> Start Test Call
          </Button>
        ) : status === "connecting" ? (
          <Button size="lg" disabled className="gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Connecting...
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant={muted ? "destructive" : "outline"}
              onClick={toggleMute}
              className="gap-2"
            >
              {muted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={hangUp}
              className="gap-2"
            >
              <PhoneOff className="h-5 w-5" /> Hang Up
            </Button>
          </>
        )}
      </div>

      {/* Browser permissions hint */}
      {status === "idle" && (
        <p className="text-xs text-muted-foreground text-center">
          Your browser will request microphone access when you start the call.
        </p>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Start a test call to see the live transcript here.
            </p>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {transcript.map((t, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    t.role === "system"
                      ? "bg-muted text-muted-foreground text-center italic"
                      : t.role === "user"
                      ? "bg-slate-800 mr-12"
                      : "bg-primary/10 ml-12"
                  }`}
                >
                  {t.role !== "system" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground capitalize">
                        {t.role === "user" ? "You" : "Agent"}
                      </span>
                      {t.timestamp !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {Math.floor(t.timestamp / 1000)}s
                        </span>
                      )}
                    </div>
                  )}
                  {t.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
