"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, Phone, Clock, Trash2, Square, RefreshCw,
  FileText, Cpu, AudioLines, Settings2, Volume2, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function V8AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [agent, setAgent] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "call" | "executions">("overview");

  const [callNumber, setCallNumber] = useState("");
  const [calling, setCalling] = useState(false);

  useEffect(() => { loadAgent(); }, [id]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const res = await api.bolna.agents.get(id);
      setAgent(res.data);
      loadExecutions();
    } catch { toast.error("Failed to load agent"); }
    finally { setLoading(false); }
  };

  const loadExecutions = async () => {
    try {
      const res = await api.bolna.executions.list(id, { page_size: 20 });
      const list = res.data?.executions || res.data || [];
      setExecutions(Array.isArray(list) ? list : []);
    } catch { /* ignore */ }
  };

  const handleCall = async () => {
    if (!callNumber) { toast.error("Enter a phone number"); return; }
    setCalling(true);
    try {
      await api.bolna.calls.make({ agent_id: id, recipient_phone_number: callNumber });
      toast.success("Call initiated!");
      setCallNumber("");
      setTimeout(loadExecutions, 2000);
    } catch (err: any) { toast.error(err.message || "Failed to make call"); }
    finally { setCalling(false); }
  };

  const handleStopCall = async (execId: string) => {
    try {
      await api.bolna.calls.stop(execId);
      toast.success("Call stopped");
      loadExecutions();
    } catch (err: any) { toast.error(err.message || "Failed to stop call"); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this V8 agent? This cannot be undone.")) return;
    try {
      await api.bolna.agents.delete(id);
      toast.success("Agent deleted");
      router.push("/agents");
    } catch (err: any) { toast.error(err.message || "Failed to delete"); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" /></div>;
  }
  if (!agent) {
    return <div className="text-center py-20 text-muted-foreground">Agent not found</div>;
  }

  const config = agent.agent_config || agent;
  const agentName = config.agent_name || agent.agent_name || "Unnamed Agent";
  const task = config.tasks?.[0] || {};
  const taskConfig = task.task_config || {};
  const toolsConfig = task.tools_config || {};
  const llm = toolsConfig.llm_agent || {};
  const transcriber = toolsConfig.transcriber || {};
  const synthesizer = toolsConfig.synthesizer || {};
  const synthConfig = synthesizer.provider_config || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/agents")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{agentName}</h1>
              <p className="text-sm text-muted-foreground font-mono">{agent.agent_id || id}</p>
            </div>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["overview", "call", "executions"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize",
              activeTab === tab
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ OVERVIEW ═══════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Welcome Message & Agent Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" /> Welcome Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{config.agent_welcome_message || "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Settings2 className="h-4 w-4" /> Agent Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success">{agent.agent_status || "active"}</Badge>
                </div>
                {config.webhook_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Webhook</span>
                    <span className="text-xs truncate max-w-40">{config.webhook_url}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Prompt */}
          {(config.agent_prompts?.prompt || config.prompt) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" /> Agent Prompt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-mono whitespace-pre-wrap bg-muted/50 rounded-md p-4 max-h-64 overflow-y-auto">
                  {config.agent_prompts?.prompt || config.prompt}
                </div>
              </CardContent>
            </Card>
          )}

          {/* LLM Config */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Cpu className="h-4 w-4" /> LLM Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Provider</span>
                  <p className="font-medium capitalize">{llm.provider || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Model</span>
                  <p className="font-medium">{llm.model || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Max Tokens</span>
                  <p className="font-medium">{llm.max_tokens || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Temperature</span>
                  <p className="font-medium">{llm.temperature ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audio Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Mic className="h-4 w-4" /> Speech-to-Text
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium capitalize">{transcriber.provider || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{transcriber.model || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium">{transcriber.language || "—"}</span>
                </div>
                {transcriber.keywords && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Keywords</span>
                    <span className="font-medium text-xs">{transcriber.keywords}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Volume2 className="h-4 w-4" /> Text-to-Speech
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium capitalize">{synthesizer.provider || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{synthesizer.model || "—"}</span>
                </div>
                {(synthConfig.voice_id || synthConfig.voice) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voice</span>
                    <span className="font-medium">{synthConfig.voice || synthConfig.voice_id}</span>
                  </div>
                )}
                {synthConfig.buffer_size && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buffer Size</span>
                    <span className="font-medium">{synthConfig.buffer_size}</span>
                  </div>
                )}
                {synthConfig.speed && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed</span>
                    <span className="font-medium">{synthConfig.speed}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Engine & Call Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Settings2 className="h-4 w-4" /> Engine Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {taskConfig.endpointing != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Endpointing</span>
                    <span className="font-medium">{taskConfig.endpointing}ms</span>
                  </div>
                )}
                {taskConfig.linear_delay != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Linear Delay</span>
                    <span className="font-medium">{taskConfig.linear_delay}ms</span>
                  </div>
                )}
                {taskConfig.interruption_threshold != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interruption Words</span>
                    <span className="font-medium">{taskConfig.interruption_threshold}</span>
                  </div>
                )}
                {taskConfig.response_rate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Rate</span>
                    <span className="font-medium capitalize">{taskConfig.response_rate}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User Online Check</span>
                  <span className="font-medium">{taskConfig.user_online_check ? "On" : "Off"}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> Call Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {taskConfig.call_terminate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Call Timeout</span>
                    <span className="font-medium">{taskConfig.call_terminate}s</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Noise Cancellation</span>
                  <span className="font-medium">{taskConfig.noise_cancellation ? "On" : "Off"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voicemail Detection</span>
                  <span className="font-medium">{taskConfig.voicemail ? "On" : "Off"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DTMF Input</span>
                  <span className="font-medium">{taskConfig.dtmf_enabled ? "On" : "Off"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ambient Noise</span>
                  <span className="font-medium">{taskConfig.ambient_noise ? "On" : "Off"}</span>
                </div>
                {taskConfig.hangup_after_silence > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hangup on Silence</span>
                    <span className="font-medium">{taskConfig.hangup_after_silence}s</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ MAKE A CALL ═══════════════════════════ */}
      {activeTab === "call" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-5 w-5 text-amber-500" /> Make a Call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Initiate an outbound call using this agent. Number must be in E.164 format (e.g. +11234567890).
            </p>
            <div className="flex gap-3">
              <Input placeholder="+91XXXXXXXXXX" value={callNumber}
                onChange={(e) => setCallNumber(e.target.value)} className="max-w-xs" />
              <Button onClick={handleCall} disabled={calling || !callNumber}
                className="bg-amber-500 hover:bg-amber-600 text-white">
                <Phone className="h-4 w-4 mr-2" />
                {calling ? "Calling..." : "Call Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════ EXECUTIONS ═══════════════════════════ */}
      {activeTab === "executions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Call Executions</CardTitle>
            <Button variant="outline" size="sm" onClick={loadExecutions}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {executions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No executions yet. Make a call to see results here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-muted-foreground">Execution ID</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((exec: any) => {
                      const execId = exec.execution_id || exec.id;
                      const status = exec.status || exec.call_status || "unknown";
                      return (
                        <tr key={execId} className="border-b border-border hover:bg-accent/50">
                          <td className="p-3 font-mono text-xs">{execId?.slice(0, 16)}...</td>
                          <td className="p-3">
                            <Badge variant={
                              status === "completed" ? "success" :
                              status === "in-progress" || status === "in_progress" ? "warning" :
                              status === "failed" ? "destructive" : "secondary"
                            }>{status}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{exec.duration ? `${exec.duration}s` : "—"}</td>
                          <td className="p-3 text-muted-foreground">{exec.recipient_phone_number || exec.to_number || "—"}</td>
                          <td className="p-3">
                            {(status === "in-progress" || status === "in_progress" || status === "queued") && (
                              <Button variant="ghost" size="sm" onClick={() => handleStopCall(execId)}
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
