export const LLM_PROVIDERS = [
  { name: "groq", label: "Groq", free: true },
  { name: "google", label: "Google Gemini", free: true },
  { name: "mistral", label: "Mistral", free: true },
  { name: "together", label: "Together AI", free: false },
  { name: "openai", label: "OpenAI", free: false },
  { name: "anthropic", label: "Anthropic", free: false },
];

export const STT_PROVIDERS = [
  { name: "deepgram", label: "Deepgram", free: false },
];

export const TTS_PROVIDERS = [
  { name: "edge_tts", label: "Edge TTS", free: true },
  { name: "gtts", label: "Google TTS (gTTS)", free: true },
  { name: "sarvam", label: "Sarvam AI", free: true },
];

export const TELEPHONY_PROVIDERS = [
  { name: "webrtc", label: "WebRTC (Browser)", free: true },
  { name: "vobiz", label: "Vobiz (SIP)", free: false },
  { name: "twilio", label: "Twilio", free: false },
];

export const CALL_STATUSES = [
  { value: "initiated", label: "Initiated", color: "text-muted-foreground" },
  { value: "ringing", label: "Ringing", color: "text-warning" },
  { value: "in_progress", label: "In Progress", color: "text-primary" },
  { value: "completed", label: "Completed", color: "text-success" },
  { value: "failed", label: "Failed", color: "text-destructive" },
  { value: "busy", label: "Busy", color: "text-warning" },
  { value: "no_answer", label: "No Answer", color: "text-muted-foreground" },
];

export const CAMPAIGN_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-muted" },
  { value: "scheduled", label: "Scheduled", color: "bg-secondary text-foreground" },
  { value: "running", label: "Running", color: "bg-success/20 text-success" },
  { value: "paused", label: "Paused", color: "bg-warning/20 text-warning" },
  { value: "completed", label: "Completed", color: "bg-success/20 text-success" },
  { value: "failed", label: "Failed", color: "bg-destructive/20 text-destructive" },
];
