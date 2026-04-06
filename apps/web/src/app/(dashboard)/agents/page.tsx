"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Cpu, Zap, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useModeStore } from "@/store/mode";
import { toast } from "sonner";

export default function AgentsPage() {
  const { mode } = useModeStore();
  const isV8 = mode === "v8";

  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = () => {
    setLoading(true);
    if (isV8) {
      api.bolna.agents.list().then((res) => {
        // V8 returns array directly or in data field
        const list = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setAgents(list);
      }).catch(() => setAgents([])).finally(() => setLoading(false));
    } else {
      api.agents.list({ page_size: 50 }).then((res) => {
        setAgents(res.data || []);
      }).catch(() => setAgents([])).finally(() => setLoading(false));
    }
  };

  useEffect(() => { loadAgents(); }, [isV8]);

  const handleDeleteV8 = async (agentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this V8 agent?")) return;
    try {
      await api.bolna.agents.delete(agentId);
      toast.success("Agent deleted");
      loadAgents();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Agents
            {isV8 && <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1"><Zap className="h-3 w-3" /> V8</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isV8 ? "Manage your V8 voice AI agents" : "Create and manage your AI voice agents"}
          </p>
        </div>
        <Link href={isV8 ? "/agents/new-v8" : "/agents/new"}>
          <Button><Plus className="h-4 w-4 mr-2" /> Create Agent</Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            {isV8 ? <Zap className="h-12 w-12 text-amber-500 mb-4" /> : <Bot className="h-12 w-12 text-muted-foreground mb-4" />}
            <p className="text-lg font-medium">No agents yet</p>
            <p className="text-muted-foreground text-sm mb-4">
              {isV8 ? "Create your first V8 voice agent" : "Create your first AI voice agent to get started"}
            </p>
            <Link href={isV8 ? "/agents/new-v8" : "/agents/new"}>
              <Button><Plus className="h-4 w-4 mr-2" /> Create Agent</Button>
            </Link>
          </CardContent>
        </Card>
      ) : isV8 ? (
        /* V8 agents grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => {
            const agentId = agent.agent_id || agent.id;
            const agentName = agent.agent_config?.agent_name || agent.agent_name || agent.name || "Unnamed";
            return (
              <Link key={agentId} href={`/agents/v8/${agentId}`}>
                <Card className="hover:border-amber-500/30 transition-colors cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold">{agentName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{agentId?.slice(0, 12)}...</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteV8(agentId, e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {agent.agent_config?.agent_welcome_message && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{agent.agent_config.agent_welcome_message}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30">
                        <Zap className="h-3 w-3" /> V8
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Custom agents grid (original) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="hover:border-foreground/20 transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.language}</p>
                      </div>
                    </div>
                    <Badge variant={agent.is_active ? "success" : "secondary"}>
                      {agent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {agent.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Cpu className="h-3 w-3" /> {agent.llm_model}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">Created {formatDate(agent.created_at)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
