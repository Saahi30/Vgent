export const LLM_PROVIDERS = [
  { name: "groq", label: "Groq", free: true },
  { name: "google", label: "Google Gemini", free: true },
  { name: "mistral", label: "Mistral", free: true },
  { name: "cohere", label: "Cohere", free: true },
  { name: "together", label: "Together AI", free: false },
  { name: "openai", label: "OpenAI", free: false },
  { name: "anthropic", label: "Anthropic", free: false },
];

export const STT_PROVIDERS = [
  { name: "deepgram", label: "Deepgram", free: false },
  { name: "google", label: "Google STT", free: false },
  { name: "assemblyai", label: "AssemblyAI", free: false },
];

export const TTS_PROVIDERS = [
  { name: "edge_tts", label: "Edge TTS", free: true },
  { name: "gtts", label: "Google TTS (gTTS)", free: true },
  { name: "sarvam", label: "Sarvam AI", free: true },
  { name: "elevenlabs", label: "ElevenLabs", free: false },
  { name: "cartesia", label: "Cartesia", free: false },
  { name: "google_tts", label: "Google Cloud TTS", free: false },
];

export const TELEPHONY_PROVIDERS = [
  { name: "webrtc", label: "WebRTC (Browser)", free: true },
  { name: "vobiz", label: "Vobiz (SIP)", free: false },
  { name: "twilio", label: "Twilio", free: false },
  { name: "plivo", label: "Plivo", free: false },
];

export const LLM_MODELS = [
  // Groq (Free)
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", free: true },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", provider: "groq", free: true },
  { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B", provider: "groq", free: true },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "groq", free: true },
  { value: "gemma2-9b-it", label: "Gemma 2 9B", provider: "groq", free: true },
  // Google (Free)
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google", free: true },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", provider: "google", free: true },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "google", free: true },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "google", free: true },
  // Mistral (Free tier)
  { value: "mistral-small-latest", label: "Mistral Small", provider: "mistral", free: true },
  { value: "mistral-medium-latest", label: "Mistral Medium", provider: "mistral", free: true },
  { value: "open-mistral-nemo", label: "Mistral Nemo", provider: "mistral", free: true },
  // Cohere (Free trial)
  { value: "command-r-plus", label: "Command R+", provider: "cohere", free: true },
  { value: "command-r", label: "Command R", provider: "cohere", free: true },
  // Together AI
  { value: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", label: "Llama 3.1 70B Turbo", provider: "together", free: false },
  { value: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Llama 3.1 8B Turbo", provider: "together", free: false },
  { value: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B", provider: "together", free: false },
  // OpenAI
  { value: "gpt-4o", label: "GPT-4o", provider: "openai", free: false },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", free: false },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai", free: false },
  // Anthropic
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic", free: false },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "anthropic", free: false },
];

export const VOICE_OPTIONS = [
  // Edge TTS (Free)
  { value: "en-US-JennyNeural", label: "Jenny (US Female)", provider: "edge_tts", lang: "en" },
  { value: "en-US-GuyNeural", label: "Guy (US Male)", provider: "edge_tts", lang: "en" },
  { value: "en-US-AriaNeural", label: "Aria (US Female)", provider: "edge_tts", lang: "en" },
  { value: "en-US-DavisNeural", label: "Davis (US Male)", provider: "edge_tts", lang: "en" },
  { value: "en-US-JaneNeural", label: "Jane (US Female)", provider: "edge_tts", lang: "en" },
  { value: "en-GB-SoniaNeural", label: "Sonia (UK Female)", provider: "edge_tts", lang: "en" },
  { value: "en-GB-RyanNeural", label: "Ryan (UK Male)", provider: "edge_tts", lang: "en" },
  { value: "en-IN-NeerjaNeural", label: "Neerja (Indian English Female)", provider: "edge_tts", lang: "en" },
  { value: "en-IN-PrabhatNeural", label: "Prabhat (Indian English Male)", provider: "edge_tts", lang: "en" },
  { value: "hi-IN-SwaraNeural", label: "Swara (Hindi Female)", provider: "edge_tts", lang: "hi" },
  { value: "hi-IN-MadhurNeural", label: "Madhur (Hindi Male)", provider: "edge_tts", lang: "hi" },
  { value: "es-ES-ElviraNeural", label: "Elvira (Spanish Female)", provider: "edge_tts", lang: "es" },
  { value: "fr-FR-DeniseNeural", label: "Denise (French Female)", provider: "edge_tts", lang: "fr" },
  // Sarvam (Indian Languages - Free)
  { value: "meera", label: "Meera (Hindi Female)", provider: "sarvam", lang: "hi" },
  { value: "arvind", label: "Arvind (Hindi Male)", provider: "sarvam", lang: "hi" },
  { value: "pavithra", label: "Pavithra (Tamil Female)", provider: "sarvam", lang: "ta" },
  { value: "karthik", label: "Karthik (Tamil Male)", provider: "sarvam", lang: "ta" },
  { value: "pushpak", label: "Pushpak (Telugu Male)", provider: "sarvam", lang: "te" },
  { value: "lakshmi", label: "Lakshmi (Telugu Female)", provider: "sarvam", lang: "te" },
  // ElevenLabs (Paid)
  { value: "rachel", label: "Rachel (Female)", provider: "elevenlabs", lang: "en" },
  { value: "domi", label: "Domi (Female)", provider: "elevenlabs", lang: "en" },
  { value: "bella", label: "Bella (Female)", provider: "elevenlabs", lang: "en" },
  { value: "antoni", label: "Antoni (Male)", provider: "elevenlabs", lang: "en" },
  { value: "josh", label: "Josh (Male)", provider: "elevenlabs", lang: "en" },
  { value: "arnold", label: "Arnold (Male)", provider: "elevenlabs", lang: "en" },
  { value: "sam", label: "Sam (Male)", provider: "elevenlabs", lang: "en" },
  // Cartesia (Paid)
  { value: "cartesia-default-female", label: "Default Female", provider: "cartesia", lang: "en" },
  { value: "cartesia-default-male", label: "Default Male", provider: "cartesia", lang: "en" },
  { value: "cartesia-imran", label: "Imran (Male)", provider: "cartesia", lang: "hi" },
  { value: "cartesia-neerja", label: "Neerja (Female)", provider: "cartesia", lang: "hi" },
];

export const AMBIENT_NOISE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "office", label: "Office" },
  { value: "cafe", label: "Cafe" },
  { value: "call-center", label: "Call Center" },
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
  { value: "scheduled", label: "Scheduled", color: "bg-primary/[0.15] text-primary border border-primary/30" },
  { value: "running", label: "Running", color: "bg-success/20 text-success" },
  { value: "paused", label: "Paused", color: "bg-warning/20 text-warning" },
  { value: "completed", label: "Completed", color: "bg-success/20 text-success" },
  { value: "failed", label: "Failed", color: "bg-destructive/20 text-destructive" },
];
