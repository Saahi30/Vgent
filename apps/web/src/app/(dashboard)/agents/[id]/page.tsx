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
import { ArrowLeft, Save, Phone, Trash2, Ban } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { LLM_MODELS, VOICE_OPTIONS, AMBIENT_NOISE_OPTIONS } from "@/lib/constants";

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

  // Group LLM models by provider
  const groupedModels = LLM_MODELS.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, typeof LLM_MODELS>);

  const providerLabels: Record<string, string> = {
    groq: "Groq (Free)", google: "Google (Free)", mistral: "Mistral (Free)",
    cohere: "Cohere (Free Trial)", together: "Together AI", openai: "OpenAI", anthropic: "Anthropic",
  };

  // Group voices by provider
  const groupedVoices = VOICE_OPTIONS.reduce((acc, v) => {
    if (!acc[v.provider]) acc[v.provider] = [];
    acc[v.provider].push(v);
    return acc;
  }, {} as Record<string, typeof VOICE_OPTIONS>);

  const voiceProviderLabels: Record<string, string> = {
    edge_tts: "Edge TTS (Free)", sarvam: "Sarvam (Indian Languages - Free)",
    elevenlabs: "ElevenLabs", cartesia: "Cartesia",
  };

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
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi</option>
              <option value="ta-IN">Tamil</option>
              <option value="te-IN">Telugu</option>
              <option value="bn-IN">Bengali</option>
              <option value="mr-IN">Marathi</option>
              <option value="kn-IN">Kannada</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="ja-JP">Japanese</option>
              <option value="ar-SA">Arabic</option>
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
              {Object.entries(groupedModels).map(([provider, models]) => (
                <optgroup key={provider} label={providerLabels[provider] || provider}>
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}{m.free ? " ✓" : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Models marked with ✓ are free to use</p>
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
              <input type="range" min="0" max="2" step="0.01" value={form.llm_temperature || 0.7}
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
              {Object.entries(groupedVoices).map(([provider, voices]) => (
                <optgroup key={provider} label={voiceProviderLabels[provider] || provider}>
                  {voices.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Voice Speed ({form.voice_speed || 1.0}x)</label>
              <input type="range" min="0.5" max="2" step="0.1" value={form.voice_speed || 1.0}
                onChange={(e) => update("voice_speed", parseFloat(e.target.value))}
                className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Voice Stability ({form.voice_stability || 0.75})</label>
              <input type="range" min="0" max="1" step="0.05" value={form.voice_stability || 0.75}
                onChange={(e) => update("voice_stability", parseFloat(e.target.value))}
                className="mt-1 w-full" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">First Message</label>
            <Input value={form.first_message || ""} onChange={(e) => update("first_message", e.target.value)} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Engine Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engine Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium">Response Rate</label>
            <select value={form.response_latency_mode || "normal"} onChange={(e) => update("response_latency_mode", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="fast">Fast — may interrupt in long pauses</option>
              <option value="normal">Normal — balanced latency and patience</option>
              <option value="relaxed">Relaxed — waits longer before responding</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Endpointing ({form.endpointing_ms || 700} ms)</label>
              <input type="range" min="100" max="3000" step="50" value={form.endpointing_ms || 700}
                onChange={(e) => update("endpointing_ms", parseInt(e.target.value))}
                className="mt-1 w-full" />
              <p className="text-xs text-muted-foreground">Wait time before generating response</p>
            </div>
            <div>
              <label className="text-sm font-medium">Linear Delay ({form.linear_delay_ms || 1200} ms)</label>
              <input type="range" min="0" max="3000" step="50" value={form.linear_delay_ms || 1200}
                onChange={(e) => update("linear_delay_ms", parseInt(e.target.value))}
                className="mt-1 w-full" />
              <p className="text-xs text-muted-foreground">Accounts for long pauses mid-sentence</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Words to wait before interrupting</label>
            <Input type="number" min={1} max={10} value={form.interruption_words_count || 1}
              onChange={(e) => update("interruption_words_count", parseInt(e.target.value) || 1)}
              className="mt-1 w-32" />
          </div>
          <hr className="border-border" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="user_online_edit" checked={form.user_online_detection ?? true}
              onChange={(e) => update("user_online_detection", e.target.checked)} className="rounded" />
            <label htmlFor="user_online_edit" className="text-sm font-medium">User Online Detection</label>
          </div>
          {form.user_online_detection && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <label className="text-sm font-medium">Invoke after ({form.user_online_timeout_seconds || 9}s)</label>
                <input type="range" min="3" max="30" step="1" value={form.user_online_timeout_seconds || 9}
                  onChange={(e) => update("user_online_timeout_seconds", parseInt(e.target.value))}
                  className="mt-1 w-full" />
              </div>
              <div>
                <label className="text-sm font-medium">Message</label>
                <Input value={form.user_online_message || ""} onChange={(e) => update("user_online_message", e.target.value)}
                  placeholder="Hey, are you still there" className="mt-1" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Call Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium">Ambient Noise</label>
            <select value={form.ambient_noise || "none"} onChange={(e) => update("ambient_noise", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {AMBIENT_NOISE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Noise Cancellation</span>
                <p className="text-xs text-muted-foreground">Reduce background noise during calls</p>
              </div>
              <input type="checkbox" checked={form.noise_cancellation ?? false}
                onChange={(e) => update("noise_cancellation", e.target.checked)} className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Voicemail Detection</span>
                <p className="text-xs text-muted-foreground">Detect and handle voicemail answering machines</p>
              </div>
              <input type="checkbox" checked={form.voicemail_detection ?? false}
                onChange={(e) => update("voicemail_detection", e.target.checked)} className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Keypad Input (DTMF)</span>
                <p className="text-xs text-muted-foreground">Allow recipients to use phone keypad during calls</p>
              </div>
              <input type="checkbox" checked={form.keypad_input_enabled ?? false}
                onChange={(e) => update("keypad_input_enabled", e.target.checked)} className="rounded" />
            </div>
          </div>
          <hr className="border-border" />
          <div>
            <label className="text-sm font-medium">Final Call Message</label>
            <textarea
              value={form.final_call_message || ""}
              onChange={(e) => update("final_call_message", e.target.value)}
              rows={2}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Thank you for your time. Goodbye!"
            />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Hangup on Silence ({form.silence_timeout_seconds || 10}s)</label>
              <input type="range" min="3" max="60" step="1" value={form.silence_timeout_seconds || 10}
                onChange={(e) => update("silence_timeout_seconds", parseInt(e.target.value))}
                className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium">Total Call Timeout ({form.max_call_duration_seconds || 300}s)</label>
              <input type="range" min="30" max="3600" step="30" value={form.max_call_duration_seconds || 300}
                onChange={(e) => update("max_call_duration_seconds", parseInt(e.target.value))}
                className="mt-1 w-full" />
            </div>
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
