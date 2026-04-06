"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Phone, Cpu, Mic, Volume2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents.list({ page_size: 50 }).then((res) => {
      setAgents(res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage your AI voice agents</p>
        </div>
        <Link href="/agents/new">
          <Button><Plus className="h-4 w-4 mr-2" /> Create Agent</Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No agents yet</p>
            <p className="text-muted-foreground text-sm mb-4">Create your first AI voice agent to get started</p>
            <Link href="/agents/new">
              <Button><Plus className="h-4 w-4 mr-2" /> Create Agent</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
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
