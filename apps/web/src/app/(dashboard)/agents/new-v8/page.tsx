"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, FileText, Cpu, AudioLines, Settings2, Phone,
  Volume2, Mic, MessageSquare, Timer, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "agent", label: "Agent", icon: FileText },
  { key: "llm", label: "LLM", icon: Cpu },
  { key: "audio", label: "Audio", icon: AudioLines },
  { key: "engine", label: "Engine", icon: Settings2 },
  { key: "call", label: "Call", icon: Phone },
];

const LLM_PROVIDERS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  openai: {
    label: "OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
  google: {
    label: "Google",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Preview)" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    ],
  },
  groq: {
    label: "Groq",
    models: [
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
      { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
  },
  azure: {
    label: "Azure OpenAI",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
};

const STT_PROVIDERS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  deepgram: {
    label: "Deepgram",
    models: [
      { value: "nova-2", label: "Nova 2" },
      { value: "nova-2-general", label: "Nova 2 General" },
      { value: "nova-2-phonecall", label: "Nova 2 Phone Call" },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    models: [
      { value: "scribe_v2_realtime", label: "Scribe V2 Realtime" },
      { value: "scribe_v1", label: "Scribe V1" },
    ],
  },
  google: {
    label: "Google",
    models: [
      { value: "latest_long", label: "Latest Long" },
      { value: "latest_short", label: "Latest Short" },
    ],
  },
  azure: {
    label: "Azure",
    models: [
      { value: "azure-stt", label: "Azure STT" },
    ],
  },
};

const TTS_PROVIDERS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  cartesia: {
    label: "Cartesia",
    models: [
      { value: "sonic-3", label: "Sonic 3" },
      { value: "sonic-2", label: "Sonic 2" },
      { value: "sonic-english", label: "Sonic English" },
      { value: "sonic-multilingual", label: "Sonic Multilingual" },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    models: [
      { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
      { value: "eleven_turbo_v2", label: "Turbo v2" },
      { value: "eleven_multilingual_v2", label: "Multilingual v2" },
      { value: "eleven_monolingual_v1", label: "Monolingual v1" },
    ],
  },
  openai: {
    label: "OpenAI TTS",
    models: [
      { value: "tts-1", label: "TTS-1" },
      { value: "tts-1-hd", label: "TTS-1 HD" },
    ],
  },
  deepgram: {
    label: "Deepgram",
    models: [
      { value: "aura-asteria-en", label: "Aura Asteria" },
      { value: "aura-luna-en", label: "Aura Luna" },
      { value: "aura-stella-en", label: "Aura Stella" },
    ],
  },
  polly: {
    label: "AWS Polly",
    models: [
      { value: "standard", label: "Standard" },
      { value: "neural", label: "Neural" },
      { value: "generative", label: "Generative" },
    ],
  },
};

const TELEPHONY_PROVIDERS = [
  { value: "twilio", label: "Twilio" },
  { value: "plivo", label: "Plivo" },
  { value: "exotel", label: "Exotel" },
  { value: "vonage", label: "Vonage" },
];

const AMBIENT_NOISE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "coffee_shop", label: "Coffee Shop" },
  { value: "office", label: "Office" },
  { value: "call_center", label: "Call Center" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "mr", label: "Marathi" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "gu", label: "Gujarati" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
];

export default function CreateV8AgentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("agent");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Agent
    agent_name: "",
    agent_welcome_message: "Hello! How can I help you today?",
    prompt: "You are a helpful AI voice assistant. Be conversational, friendly, and concise.",
    webhook_url: "",

    // LLM
    llm_provider: "google",
    llm_model: "gemini-2.0-flash",
    max_tokens: 500,
    temperature: 0.4,

    // Audio — Language
    language: "en",
    // Audio — STT
    stt_provider: "deepgram",
    stt_model: "nova-2",
    stt_keywords: "",
    // Audio — TTS
    tts_provider: "cartesia",
    tts_model: "sonic-3",
    tts_voice: "",
    tts_buffer_size: 150,
    tts_speed: 1.0,
    tts_similarity_boost: 0.75,
    tts_stability: 0.5,
    tts_style_exaggeration: 0,

    // Engine
    response_rate: "normal",
    endpointing_ms: 700,
    linear_delay_ms: 1200,
    interruption_words_count: 1,
    generate_precise_transcript: false,
    user_online_detection: true,
    user_online_message: "Hey, are you still there",
    user_online_timeout_seconds: 9,

    // Call
    telephony_provider: "twilio",
    ambient_noise: "none",
    noise_cancellation: false,
    voicemail_detection: false,
    keypad_input_enabled: false,
    auto_reschedule: false,
    outbound_timing_restrictions: false,
    final_call_message: "",
    hangup_on_silence_seconds: 15,
    total_call_timeout_seconds: 300,
    hangup_on_silence_enabled: true,
  });

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  const handleCreate = async () => {
    if (!form.agent_name) { toast.error("Agent name is required"); return; }
    setSaving(true);
    try {
      const agentConfig: any = {
        agent_name: form.agent_name,
        agent_welcome_message: form.agent_welcome_message,
        webhook_url: form.webhook_url || undefined,
        agent_prompts: { prompt: form.prompt },
        tasks: [
          {
            task_type: "conversation",
            toolchain: {
              execution: "parallel",
              pipelines: [["transcriber", "llm", "synthesizer"]],
            },
            task_config: {
              voicemail: form.voicemail_detection,
              use_fillers: false,
              dtmf_enabled: form.keypad_input_enabled,
              ambient_noise: form.ambient_noise !== "none",
              ambient_noise_preset: form.ambient_noise !== "none" ? form.ambient_noise : undefined,
              call_terminate: form.total_call_timeout_seconds,
              hangup_after_silence: form.hangup_on_silence_enabled ? form.hangup_on_silence_seconds : -1,
              noise_cancellation: form.noise_cancellation,
              endpointing: form.endpointing_ms,
              linear_delay: form.linear_delay_ms,
              interruption_threshold: form.interruption_words_count,
              response_rate: form.response_rate,
              user_online_check: form.user_online_detection,
              user_online_check_message: form.user_online_message,
              user_online_check_interval: form.user_online_timeout_seconds,
            },
            tools_config: {
              llm_agent: {
                provider: form.llm_provider,
                model: form.llm_model,
                max_tokens: form.max_tokens,
                temperature: form.temperature,
              },
              transcriber: {
                provider: form.stt_provider,
                model: form.stt_model,
                language: form.language,
                ...(form.stt_keywords ? { keywords: form.stt_keywords } : {}),
              },
              synthesizer: {
                provider: form.tts_provider,
                model: form.tts_model,
                provider_config: {
                  ...(form.tts_voice ? { voice_id: form.tts_voice, voice: form.tts_voice } : {}),
                  buffer_size: form.tts_buffer_size,
                  speed: form.tts_speed,
                  similarity_boost: form.tts_similarity_boost,
                  stability: form.tts_stability,
                  style: form.tts_style_exaggeration,
                },
              },
            },
          },
        ],
      };

      if (form.final_call_message) {
        agentConfig.tasks[0].task_config.final_message = form.final_call_message;
      }

      const res = await api.bolna.agents.create(agentConfig);
      toast.success("V8 agent created!");
      const newId = res.data?.agent_id || res.data?.id;
      router.push(newId ? `/agents/v8/${newId}` : "/agents");
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  const llmModels = LLM_PROVIDERS[form.llm_provider]?.models || [];
  const sttModels = STT_PROVIDERS[form.stt_provider]?.models || [];
  const ttsModels = TTS_PROVIDERS[form.tts_provider]?.models || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold">Create V8 Agent</h1>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={saving || !form.agent_name}
          className="bg-amber-500 hover:bg-amber-600 text-white">
          <Zap className="h-4 w-4 mr-2" />
          {saving ? "Creating..." : "Create Agent"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════ AGENT TAB ═══════════════════════════ */}
      {activeTab === "agent" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Agent Welcome Message</h3>
              </div>
              <div>
                <Input value={form.agent_welcome_message}
                  onChange={(e) => update("agent_welcome_message", e.target.value)}
                  placeholder="Hello! How can I help you today?" />
                <p className="text-xs text-muted-foreground mt-1.5">
                  You can define variables using {"{variable_name}"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-base">Agent Prompt</h3>
                </div>
              </div>
              <textarea
                value={form.prompt}
                onChange={(e) => update("prompt", e.target.value)}
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="You are a helpful AI assistant..."
              />
              <p className="text-xs text-muted-foreground">
                Structure your prompt with: personality, context, instructions, and guardrails.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-base">Agent Details</h3>
              <div>
                <label className="text-sm font-medium">Agent Name *</label>
                <Input placeholder="e.g. Sales Agent" value={form.agent_name}
                  onChange={(e) => update("agent_name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Webhook URL</label>
                <Input value={form.webhook_url} onChange={(e) => update("webhook_url", e.target.value)}
                  className="mt-1" placeholder="https://your-app.com/webhook" />
                <p className="text-xs text-muted-foreground mt-1">Get real-time call progress and data on a webhook</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════ LLM TAB ═══════════════════════════ */}
      {activeTab === "llm" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Choose LLM Model</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select value={form.llm_provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      update("llm_provider", p);
                      const firstModel = LLM_PROVIDERS[p]?.models[0]?.value || "";
                      update("llm_model", firstModel);
                    }}
                    className={cn(selectClass, "mt-1")}>
                    {Object.entries(LLM_PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <select value={form.llm_model} onChange={(e) => update("llm_model", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    {llmModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="font-semibold text-base">Model Parameters</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Tokens generated on each LLM output</label>
                    <Input type="number" value={form.max_tokens}
                      onChange={(e) => update("max_tokens", parseInt(e.target.value) || 100)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="50" max="2000" step="50" value={form.max_tokens}
                    onChange={(e) => update("max_tokens", parseInt(e.target.value))}
                    className="w-full accent-amber-500" />
                  <p className="text-xs text-amber-600 mt-1">Increasing tokens enables longer responses but increases latency</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Temperature</label>
                    <Input type="number" value={form.temperature} step="0.01"
                      onChange={(e) => update("temperature", parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="0" max="2" step="0.01" value={form.temperature}
                    onChange={(e) => update("temperature", parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                  <p className="text-xs text-amber-600 mt-1">Higher temperature = more creative, may deviate from prompt</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════ AUDIO TAB ═══════════════════════════ */}
      {activeTab === "audio" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <AudioLines className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Configure Language</h3>
              </div>
              <div>
                <label className="text-sm font-medium">Language</label>
                <select value={form.language} onChange={(e) => update("language", e.target.value)}
                  className={cn(selectClass, "mt-1 max-w-xs")}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Speech-to-Text</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select value={form.stt_provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      update("stt_provider", p);
                      update("stt_model", STT_PROVIDERS[p]?.models[0]?.value || "");
                    }}
                    className={cn(selectClass, "mt-1")}>
                    {Object.entries(STT_PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <select value={form.stt_model} onChange={(e) => update("stt_model", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    {sttModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Keywords</label>
                <Input value={form.stt_keywords} onChange={(e) => update("stt_keywords", e.target.value)}
                  className="mt-1" placeholder="e.g. Bruce:100, Acme:80" />
                <p className="text-xs text-muted-foreground mt-1">Boost transcription accuracy for specific words (word:weight format)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Text-to-Speech</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Provider</label>
                  <select value={form.tts_provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      update("tts_provider", p);
                      update("tts_model", TTS_PROVIDERS[p]?.models[0]?.value || "");
                    }}
                    className={cn(selectClass, "mt-1")}>
                    {Object.entries(TTS_PROVIDERS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <select value={form.tts_model} onChange={(e) => update("tts_model", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    {ttsModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Voice</label>
                  <Input value={form.tts_voice} onChange={(e) => update("tts_voice", e.target.value)}
                    className="mt-1" placeholder="Voice ID or name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Buffer Size</label>
                    <Input type="number" value={form.tts_buffer_size}
                      onChange={(e) => update("tts_buffer_size", parseInt(e.target.value) || 50)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="50" max="500" step="10" value={form.tts_buffer_size}
                    onChange={(e) => update("tts_buffer_size", parseInt(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Speed Rate</label>
                    <Input type="number" value={form.tts_speed} step="0.1"
                      onChange={(e) => update("tts_speed", parseFloat(e.target.value) || 0.5)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={form.tts_speed}
                    onChange={(e) => update("tts_speed", parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Similarity Boost</label>
                    <span className="text-xs text-muted-foreground">{form.tts_similarity_boost}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={form.tts_similarity_boost}
                    onChange={(e) => update("tts_similarity_boost", parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Stability</label>
                    <span className="text-xs text-muted-foreground">{form.tts_stability}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={form.tts_stability}
                    onChange={(e) => update("tts_stability", parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Style Exaggeration</label>
                    <span className="text-xs text-muted-foreground">{form.tts_style_exaggeration}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={form.tts_style_exaggeration}
                    onChange={(e) => update("tts_style_exaggeration", parseFloat(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════ ENGINE TAB ═══════════════════════════ */}
      {activeTab === "engine" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Transcription & Interruptions</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Generate precise transcript</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Higher accuracy but slightly more latency</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.generate_precise_transcript}
                    onChange={(e) => update("generate_precise_transcript", e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Number of words to wait for before interrupting</label>
                  <Input type="number" min={1} max={10} value={form.interruption_words_count}
                    onChange={(e) => update("interruption_words_count", parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-right text-sm" />
                </div>
                <input type="range" min="1" max="10" step="1" value={form.interruption_words_count}
                  onChange={(e) => update("interruption_words_count", parseInt(e.target.value))}
                  className="w-full accent-amber-500" />
                <p className="text-xs text-muted-foreground mt-1">
                  Agent will not consider interruptions until {form.interruption_words_count + 1} words are spoken
                  (Stopwords such as &quot;Stop&quot;, &quot;Wait&quot;, &quot;Hold On&quot; always pause)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-base">Response Latency</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Response Rate</label>
                  <select value={form.response_rate} onChange={(e) => update("response_rate", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    <option value="fast">Fast</option>
                    <option value="normal">Normal</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Endpointing (in ms)</label>
                    <Input type="number" value={form.endpointing_ms}
                      onChange={(e) => update("endpointing_ms", parseInt(e.target.value) || 100)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="100" max="3000" step="50" value={form.endpointing_ms}
                    onChange={(e) => update("endpointing_ms", parseInt(e.target.value))}
                    className="mt-2 w-full accent-amber-500" />
                  <p className="text-xs text-muted-foreground mt-1">Milliseconds agent waits before generating response</p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Linear delay (in ms)</label>
                    <Input type="number" value={form.linear_delay_ms}
                      onChange={(e) => update("linear_delay_ms", parseInt(e.target.value) || 0)}
                      className="w-20 h-8 text-right text-sm" />
                  </div>
                  <input type="range" min="0" max="3000" step="50" value={form.linear_delay_ms}
                    onChange={(e) => update("linear_delay_ms", parseInt(e.target.value))}
                    className="mt-2 w-full accent-amber-500" />
                  <p className="text-xs text-muted-foreground mt-1">Accounts for long pauses mid-sentence</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-500/5 rounded-md px-3 py-2">
                Agent will balance low latency and patient responses, may interrupt in long pauses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">User Online Detection</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.user_online_detection}
                    onChange={(e) => update("user_online_detection", e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
              {form.user_online_detection && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <Input value={form.user_online_message}
                      onChange={(e) => update("user_online_message", e.target.value)}
                      className="mt-1" placeholder="Hey, are you still there" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Invoke message after (seconds)</label>
                      <span className="text-sm font-medium">{form.user_online_timeout_seconds}</span>
                    </div>
                    <input type="range" min="3" max="30" step="1" value={form.user_online_timeout_seconds}
                      onChange={(e) => update("user_online_timeout_seconds", parseInt(e.target.value))}
                      className="mt-2 w-full accent-amber-500" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════ CALL TAB ═══════════════════════════ */}
      {activeTab === "call" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="font-semibold text-base">Call Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Telephony Provider</label>
                  <select value={form.telephony_provider}
                    onChange={(e) => update("telephony_provider", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    {TELEPHONY_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Ambient Noise</label>
                  <select value={form.ambient_noise} onChange={(e) => update("ambient_noise", e.target.value)}
                    className={cn(selectClass, "mt-1")}>
                    {AMBIENT_NOISE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-2">
                {[
                  { key: "noise_cancellation", label: "Noise Cancellation", desc: "Reduce background noise during calls" },
                  { key: "voicemail_detection", label: "Voicemail Detection", desc: "Detect and handle voicemail machines" },
                  { key: "keypad_input_enabled", label: "Keypad Input (DTMF)", desc: "Allow recipients to use phone keypad" },
                  { key: "auto_reschedule", label: "Auto Reschedule", desc: "Automatically retry failed calls" },
                ].map((toggle) => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{toggle.label}</span>
                      <p className="text-xs text-muted-foreground">{toggle.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={(form as any)[toggle.key]}
                        onChange={(e) => update(toggle.key, e.target.checked)}
                        className="sr-only peer" />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Outbound call timing restrictions</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.outbound_timing_restrictions}
                    onChange={(e) => update("outbound_timing_restrictions", e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
              {form.outbound_timing_restrictions && (
                <p className="text-xs text-muted-foreground">
                  Calls will only be made during allowed hours. Configure specific times on the Bolna dashboard.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-base">Final Call Message</h3>
              <textarea
                value={form.final_call_message}
                onChange={(e) => update("final_call_message", e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Thank you for your time. Goodbye!"
              />
              <p className="text-xs text-muted-foreground">Message played right before the call ends</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="font-semibold text-base">Call Management</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Hangup on User Silence</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={form.hangup_on_silence_enabled}
                          onChange={(e) => update("hangup_on_silence_enabled", e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" value={form.hangup_on_silence_seconds}
                        onChange={(e) => update("hangup_on_silence_seconds", parseInt(e.target.value) || 5)}
                        className="w-16 h-8 text-right text-sm" disabled={!form.hangup_on_silence_enabled} />
                      <span className="text-sm text-muted-foreground">s</span>
                    </div>
                  </div>
                  <input type="range" min="3" max="60" step="1" value={form.hangup_on_silence_seconds}
                    onChange={(e) => update("hangup_on_silence_seconds", parseInt(e.target.value))}
                    className="w-full accent-amber-500" disabled={!form.hangup_on_silence_enabled} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Total Call Timeout</label>
                    <div className="flex items-center gap-1">
                      <Input type="number" value={form.total_call_timeout_seconds}
                        onChange={(e) => update("total_call_timeout_seconds", parseInt(e.target.value) || 30)}
                        className="w-20 h-8 text-right text-sm" />
                      <span className="text-sm text-muted-foreground">s</span>
                    </div>
                  </div>
                  <input type="range" min="30" max="3600" step="30" value={form.total_call_timeout_seconds}
                    onChange={(e) => update("total_call_timeout_seconds", parseInt(e.target.value))}
                    className="w-full accent-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Create Bar */}
      <div className="sticky bottom-0 bg-background border-t border-border -mx-6 px-6 py-4 flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleCreate} disabled={saving || !form.agent_name}
          className="bg-amber-500 hover:bg-amber-600 text-white">
          <Zap className="h-4 w-4 mr-2" />
          {saving ? "Creating..." : "Create V8 Agent"}
        </Button>
      </div>
    </div>
  );
}
