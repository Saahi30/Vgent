"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LLM_MODELS, VOICE_OPTIONS, AMBIENT_NOISE_OPTIONS } from "@/lib/constants";

const STEPS = ["Basic Info", "LLM", "Voice", "Engine", "Call", "Behaviour", "Review"];

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
    voice_stability: 0.75,
    first_message: "Hello! This is an AI assistant calling. How are you today?",
    end_call_phrases: ["goodbye", "bye", "end call", "hang up"],
    max_call_duration_seconds: 300,
    silence_timeout_seconds: 10,
    interrupt_on_user_speech: true,
    // Engine settings
    response_latency_mode: "normal",
    endpointing_ms: 700,
    linear_delay_ms: 1200,
    interruption_words_count: 1,
    user_online_detection: true,
    user_online_message: "Hey, are you still there",
    user_online_timeout_seconds: 9,
    // Call settings
    noise_cancellation: false,
    voicemail_detection: false,
    keypad_input_enabled: false,
    final_call_message: "",
    ambient_noise: "none",
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Create Agent</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
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
            </div>
          )}

          {/* Step 1: LLM */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">LLM Model *</label>
                <select value={form.llm_model} onChange={(e) => update("llm_model", e.target.value)}
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
                  <input type="range" min="0" max="2" step="0.01" value={form.llm_temperature}
                    onChange={(e) => update("llm_temperature", parseFloat(e.target.value))}
                    className="mt-1 w-full" />
                  <p className="text-xs text-muted-foreground">Higher = more creative, lower = more focused</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Max Tokens</label>
                  <Input type="number" value={form.llm_max_tokens} onChange={(e) => update("llm_max_tokens", parseInt(e.target.value))} className="mt-1" />
                  <p className="text-xs text-muted-foreground">More tokens = longer responses but higher latency</p>
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
                  <label className="text-sm font-medium">Voice Speed ({form.voice_speed}x)</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={form.voice_speed}
                    onChange={(e) => update("voice_speed", parseFloat(e.target.value))}
                    className="mt-1 w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium">Voice Stability ({form.voice_stability})</label>
                  <input type="range" min="0" max="1" step="0.05" value={form.voice_stability}
                    onChange={(e) => update("voice_stability", parseFloat(e.target.value))}
                    className="mt-1 w-full" />
                  <p className="text-xs text-muted-foreground">Higher = more consistent tone</p>
                </div>
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

          {/* Step 3: Engine */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-base">Response Latency</h3>
              <div>
                <label className="text-sm font-medium">Response Rate</label>
                <select value={form.response_latency_mode} onChange={(e) => update("response_latency_mode", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="fast">Fast — may interrupt in long pauses</option>
                  <option value="normal">Normal — balanced latency and patience</option>
                  <option value="relaxed">Relaxed — waits longer before responding</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Endpointing ({form.endpointing_ms} ms)</label>
                  <input type="range" min="100" max="3000" step="50" value={form.endpointing_ms}
                    onChange={(e) => update("endpointing_ms", parseInt(e.target.value))}
                    className="mt-1 w-full" />
                  <p className="text-xs text-muted-foreground">How long the agent waits before generating response</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Linear Delay ({form.linear_delay_ms} ms)</label>
                  <input type="range" min="0" max="3000" step="50" value={form.linear_delay_ms}
                    onChange={(e) => update("linear_delay_ms", parseInt(e.target.value))}
                    className="mt-1 w-full" />
                  <p className="text-xs text-muted-foreground">Accounts for long pauses mid-sentence</p>
                </div>
              </div>

              <hr className="border-border" />
              <h3 className="font-semibold text-base">Transcription & Interruptions</h3>
              <div>
                <label className="text-sm font-medium">Words to wait before interrupting</label>
                <Input type="number" min={1} max={10} value={form.interruption_words_count}
                  onChange={(e) => update("interruption_words_count", parseInt(e.target.value) || 1)}
                  className="mt-1 w-32" />
                <p className="text-xs text-muted-foreground mt-1">Agent won&apos;t consider interruptions until this many words are spoken (Stopwords like &quot;Stop&quot;, &quot;Wait&quot;, &quot;Hold On&quot; always pause)</p>
              </div>

              <hr className="border-border" />
              <h3 className="font-semibold text-base">User Online Detection</h3>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="user_online" checked={form.user_online_detection}
                  onChange={(e) => update("user_online_detection", e.target.checked)} className="rounded" />
                <label htmlFor="user_online" className="text-sm">Enable user online detection</label>
              </div>
              {form.user_online_detection && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div>
                    <label className="text-sm font-medium">Invoke message after ({form.user_online_timeout_seconds}s)</label>
                    <input type="range" min="3" max="30" step="1" value={form.user_online_timeout_seconds}
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
            </div>
          )}

          {/* Step 4: Call */}
          {step === 4 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-base">Call Configuration</h3>
              <div>
                <label className="text-sm font-medium">Ambient Noise</label>
                <select value={form.ambient_noise} onChange={(e) => update("ambient_noise", e.target.value)}
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
                  <input type="checkbox" checked={form.noise_cancellation}
                    onChange={(e) => update("noise_cancellation", e.target.checked)} className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Voicemail Detection</span>
                    <p className="text-xs text-muted-foreground">Detect and handle voicemail answering machines</p>
                  </div>
                  <input type="checkbox" checked={form.voicemail_detection}
                    onChange={(e) => update("voicemail_detection", e.target.checked)} className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Keypad Input (DTMF)</span>
                    <p className="text-xs text-muted-foreground">Allow recipients to use phone keypad during calls</p>
                  </div>
                  <input type="checkbox" checked={form.keypad_input_enabled}
                    onChange={(e) => update("keypad_input_enabled", e.target.checked)} className="rounded" />
                </div>
              </div>

              <hr className="border-border" />
              <h3 className="font-semibold text-base">Final Call Message</h3>
              <div>
                <textarea
                  value={form.final_call_message}
                  onChange={(e) => update("final_call_message", e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Thank you for your time. Goodbye!"
                />
                <p className="text-xs text-muted-foreground mt-1">Message played before the call ends</p>
              </div>

              <hr className="border-border" />
              <h3 className="font-semibold text-base">Call Management</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Hangup on User Silence ({form.silence_timeout_seconds}s)</label>
                  <input type="range" min="3" max="60" step="1" value={form.silence_timeout_seconds}
                    onChange={(e) => update("silence_timeout_seconds", parseInt(e.target.value))}
                    className="mt-1 w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium">Total Call Timeout ({form.max_call_duration_seconds}s)</label>
                  <input type="range" min="30" max="3600" step="30" value={form.max_call_duration_seconds}
                    onChange={(e) => update("max_call_duration_seconds", parseInt(e.target.value))}
                    className="mt-1 w-full" />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Behaviour */}
          {step === 5 && (
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
              <div className="flex items-center gap-2">
                <input type="checkbox" id="interrupt" checked={form.interrupt_on_user_speech}
                  onChange={(e) => update("interrupt_on_user_speech", e.target.checked)}
                  className="rounded" />
                <label htmlFor="interrupt" className="text-sm">Interrupt agent when user speaks</label>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Review Agent Configuration</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Name:</span> {form.name || "—"}</div>
                <div><span className="text-muted-foreground">Language:</span> {form.language}</div>
                <div><span className="text-muted-foreground">Model:</span> {LLM_MODELS.find(m => m.value === form.llm_model)?.label || form.llm_model}</div>
                <div><span className="text-muted-foreground">Voice:</span> {VOICE_OPTIONS.find(v => v.value === form.voice_id)?.label || form.voice_id}</div>
                <div><span className="text-muted-foreground">Temperature:</span> {form.llm_temperature}</div>
                <div><span className="text-muted-foreground">Max Duration:</span> {form.max_call_duration_seconds}s</div>
                <div><span className="text-muted-foreground">Response Mode:</span> {form.response_latency_mode}</div>
                <div><span className="text-muted-foreground">Endpointing:</span> {form.endpointing_ms}ms</div>
                <div><span className="text-muted-foreground">Noise Cancel:</span> {form.noise_cancellation ? "On" : "Off"}</div>
                <div><span className="text-muted-foreground">Voicemail Detect:</span> {form.voicemail_detection ? "On" : "Off"}</div>
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
