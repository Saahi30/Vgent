"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Phone, Trash2, Ban, Bot } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const LLM_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Google)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Google)" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (Groq)" },
  { value: "mistral-small-latest", label: "Mistral Small" },
];

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    api.agents.get(id).then((res) => {
      setForm(res.data);
    }).catch((err) => {
      toast.error(err.message || "Failed to load agent");
    }).finally(() => setLoading(false));
  }, [id]);

  const update = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.agents.update(id, form);
      toast.success("Agent updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await api.agents.update(id, { is_active: !form.is_active });
      setForm((f: any) => ({ ...f, is_active: !f.is_active }));
      toast.success(form.is_active ? "Agent deactivated" : "Agent activated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update agent");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent? This cannot be undone.")) return;
    try {
      await api.agents.delete(id);
      toast.success("Agent deleted");
      router.push("/agents");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agent");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!form) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Agent not found</p>
        <Link href="/agents"><Button variant="outline" className="mt-4">Back to Agents</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form.name}</h1>
            <p className="text-sm text-muted-foreground">Created {formatDate(form.created_at)}</p>
          </div>
          <Badge variant={form.is_active ? "success" : "secondary"}>
            {form.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/agents/${id}/test`}>
            <Button variant="outline"><Phone className="h-4 w-4 mr-2" /> Test Call</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={form.name || ""} onChange={(e) => update("name", e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={form.description || ""} onChange={(e) => update("description", e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Language</label>
            <select value={form.language || "en-US"} onChange={(e) => update("language", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="hi-IN">Hindi</option>
              <option value="ta-IN">Tamil</option>
              <option value="te-IN">Telugu</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* LLM Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">LLM Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Model</label>
            <select value={form.llm_model || ""} onChange={(e) => update("llm_model", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {LLM_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">System Prompt</label>
            <textarea
              value={form.system_prompt || ""}
              onChange={(e) => update("system_prompt", e.target.value)}
              rows={6}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Temperature ({form.llm_temperature})</label>
              <input type="range" min="0" max="2" step="0.1" value={form.llm_temperature || 0.7}
                onChange={(e) => update("llm_temperature", parseFloat(e.target.value))}
                className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Max Tokens</label>
              <Input type="number" value={form.llm_max_tokens || 300} onChange={(e) => update("llm_max_tokens", parseInt(e.target.value))} className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voice Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">TTS Voice</label>
            <select value={form.voice_id || ""} onChange={(e) => update("voice_id", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <optgroup label="Edge TTS (Free)">
                <option value="en-US-JennyNeural">Jenny (US Female)</option>
                <option value="en-US-GuyNeural">Guy (US Male)</option>
                <option value="en-US-AriaNeural">Aria (US Female)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                <option value="en-IN-NeerjaNeural">Neerja (Indian English Female)</option>
              </optgroup>
              <optgroup label="Sarvam (Indian Languages)">
                <option value="meera">Meera (Hindi Female)</option>
                <option value="arvind">Arvind (Hindi Male)</option>
                <option value="pavithra">Pavithra (Tamil Female)</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Voice Speed ({form.voice_speed || 1.0}x)</label>
            <input type="range" min="0.5" max="2" step="0.1" value={form.voice_speed || 1.0}
              onChange={(e) => update("voice_speed", parseFloat(e.target.value))}
              className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium">First Message</label>
            <Input value={form.first_message || ""} onChange={(e) => update("first_message", e.target.value)} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Behaviour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Behaviour</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">End Call Phrases</label>
            <Input
              value={(form.end_call_phrases || []).join(", ")}
              onChange={(e) => update("end_call_phrases", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
              placeholder="goodbye, bye, end call"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated phrases that trigger hangup</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Max Call Duration (seconds)</label>
              <Input type="number" value={form.max_call_duration_seconds || 300}
                onChange={(e) => update("max_call_duration_seconds", parseInt(e.target.value))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Silence Timeout (seconds)</label>
              <Input type="number" value={form.silence_timeout_seconds || 10}
                onChange={(e) => update("silence_timeout_seconds", parseInt(e.target.value))} className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="interrupt" checked={form.interrupt_on_user_speech ?? true}
              onChange={(e) => update("interrupt_on_user_speech", e.target.checked)}
              className="rounded" />
            <label htmlFor="interrupt" className="text-sm">Interrupt agent when user speaks</label>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button variant="outline" onClick={handleDeactivate}>
            <Ban className="h-4 w-4 mr-2" /> {form.is_active ? "Deactivate" : "Activate"} Agent
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete Agent
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
