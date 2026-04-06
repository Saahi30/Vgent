"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Basic Info", "LLM", "Voice", "Behaviour", "Review"];

const LLM_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", free: true },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)", free: true },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Google)", free: true },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Google)", free: true },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B (Groq)", free: true },
  { value: "mistral-small-latest", label: "Mistral Small", free: true },
];

export default function CreateAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    language: "en-US",
    system_prompt: "You are a helpful AI assistant making an outbound call. Be conversational, friendly, and concise. Stay on topic.",
    llm_model: "llama-3.3-70b-versatile",
    llm_temperature: 0.7,
    llm_max_tokens: 300,
    voice_id: "en-US-JennyNeural",
    voice_speed: 1.0,
    first_message: "Hello! This is an AI assistant calling. How are you today?",
    end_call_phrases: ["goodbye", "bye", "end call", "hang up"],
    max_call_duration_seconds: 300,
    silence_timeout_seconds: 10,
    interrupt_on_user_speech: true,
  });

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.agents.create(form);
      toast.success("Agent created!");
      router.push(`/agents/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Create Agent</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Agent Name *</label>
                <Input placeholder="e.g. Sales Agent" value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input placeholder="What does this agent do?" value={form.description} onChange={(e) => update("description", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Language</label>
                <select value={form.language} onChange={(e) => update("language", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="ta-IN">Tamil</option>
                  <option value="te-IN">Telugu</option>
                  <option value="bn-IN">Bengali</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 1: LLM */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">LLM Model *</label>
                <select value={form.llm_model} onChange={(e) => update("llm_model", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {LLM_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}{m.free ? " (Free)" : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">System Prompt *</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => update("system_prompt", e.target.value)}
                  rows={6}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="You are a helpful AI assistant..."
                />
                <p className="text-xs text-muted-foreground mt-1">Variables: {"{{contact_name}}"}, {"{{contact_phone}}"}, {"{{campaign_name}}"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Temperature ({form.llm_temperature})</label>
                  <input type="range" min="0" max="2" step="0.1" value={form.llm_temperature}
                    onChange={(e) => update("llm_temperature", parseFloat(e.target.value))}
                    className="mt-1 w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Tokens</label>
                  <Input type="number" value={form.llm_max_tokens} onChange={(e) => update("llm_max_tokens", parseInt(e.target.value))} className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Voice */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">TTS Voice</label>
                <select value={form.voice_id} onChange={(e) => update("voice_id", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <optgroup label="Edge TTS (Free)">
                    <option value="en-US-JennyNeural">Jenny (US Female)</option>
                    <option value="en-US-GuyNeural">Guy (US Male)</option>
                    <option value="en-US-AriaNeural">Aria (US Female)</option>
                    <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                    <option value="en-IN-NeerjaNeural">Neerja (Indian English Female)</option>
                  </optgroup>
                  <optgroup label="Sarvam (Indian Languages - Free)">
                    <option value="meera">Meera (Hindi Female)</option>
                    <option value="arvind">Arvind (Hindi Male)</option>
                    <option value="pavithra">Pavithra (Tamil Female)</option>
                    <option value="karthik">Karthik (Tamil Male)</option>
                    <option value="pushpak">Pushpak (Telugu Male)</option>
                    <option value="lakshmi">Lakshmi (Telugu Female)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Voice Speed ({form.voice_speed}x)</label>
                <input type="range" min="0.5" max="2" step="0.1" value={form.voice_speed}
                  onChange={(e) => update("voice_speed", parseFloat(e.target.value))}
                  className="mt-1 w-full" />
              </div>
              <div>
                <label className="text-sm font-medium">First Message</label>
                <Input
                  value={form.first_message}
                  onChange={(e) => update("first_message", e.target.value)}
                  placeholder="What the agent says when the call connects"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 3: Behaviour */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">End Call Phrases</label>
                <Input
                  value={form.end_call_phrases.join(", ")}
                  onChange={(e) => update("end_call_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="goodbye, bye, end call"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated phrases that trigger hangup</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Call Duration (seconds)</label>
                  <Input type="number" value={form.max_call_duration_seconds}
                    onChange={(e) => update("max_call_duration_seconds", parseInt(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Silence Timeout (seconds)</label>
                  <Input type="number" value={form.silence_timeout_seconds}
                    onChange={(e) => update("silence_timeout_seconds", parseInt(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="interrupt" checked={form.interrupt_on_user_speech}
                  onChange={(e) => update("interrupt_on_user_speech", e.target.checked)}
                  className="rounded" />
                <label htmlFor="interrupt" className="text-sm">Interrupt agent when user speaks</label>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Review Agent Configuration</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {form.name || "—"}</div>
                <div><span className="text-muted-foreground">Language:</span> {form.language}</div>
                <div><span className="text-muted-foreground">Model:</span> {form.llm_model}</div>
                <div><span className="text-muted-foreground">Voice:</span> {form.voice_id}</div>
                <div><span className="text-muted-foreground">Temperature:</span> {form.llm_temperature}</div>
                <div><span className="text-muted-foreground">Max Duration:</span> {form.max_call_duration_seconds}s</div>
              </div>
              <div className="mt-3">
                <span className="text-sm text-muted-foreground">System Prompt:</span>
                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md font-mono whitespace-pre-wrap">{form.system_prompt}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">First Message:</span>
                <p className="text-sm mt-1">{form.first_message || "—"}</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !form.name}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !form.name || !form.system_prompt}>
                {saving ? "Creating..." : "Create Agent"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
