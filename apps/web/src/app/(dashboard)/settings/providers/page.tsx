"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SettingsNav } from "@/components/settings/SettingsNav";

const TABS = [
  { key: "telephony", label: "Telephony" },
  { key: "llm", label: "LLM" },
  { key: "stt", label: "STT" },
  { key: "tts", label: "TTS" },
];

const PROVIDER_OPTIONS: Record<string, { value: string; label: string; fields: string[] }[]> = {
  telephony: [
    { value: "twilio", label: "Twilio", fields: ["account_sid", "auth_token", "phone_number"] },
    { value: "plivo", label: "Plivo", fields: ["auth_id", "auth_token", "phone_number"] },
  ],
  llm: [
    { value: "groq", label: "Groq", fields: ["api_key"] },
    { value: "google", label: "Google AI", fields: ["api_key"] },
    { value: "openai", label: "OpenAI", fields: ["api_key"] },
    { value: "mistral", label: "Mistral", fields: ["api_key"] },
  ],
  stt: [
    { value: "deepgram", label: "Deepgram", fields: ["api_key"] },
    { value: "google_stt", label: "Google STT", fields: ["api_key"] },
    { value: "sarvam", label: "Sarvam AI", fields: ["api_key"] },
  ],
  tts: [
    { value: "edge_tts", label: "Edge TTS (Free)", fields: [] },
    { value: "elevenlabs", label: "ElevenLabs", fields: ["api_key"] },
    { value: "sarvam", label: "Sarvam AI", fields: ["api_key"] },
  ],
};

export default function ProvidersPage() {
  const [activeTab, setActiveTab] = useState("telephony");
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    provider_name: "",
    label: "",
    credentials: {} as Record<string, string>,
  });

  const loadProviders = (type: string) => {
    setLoading(true);
    api.providers.list(type).then((res) => {
      setProviders((res.data as any) || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProviders(activeTab);
  }, [activeTab]);

  const options = PROVIDER_OPTIONS[activeTab] || [];
  const selectedProvider = options.find((o) => o.value === formData.provider_name);

  const resetForm = () => {
    setFormData({ provider_name: "", label: "", credentials: {} });
    setShowForm(false);
  };

  const handleProviderChange = (name: string) => {
    const opt = options.find((o) => o.value === name);
    const creds: Record<string, string> = {};
    opt?.fields.forEach((f) => { creds[f] = ""; });
    setFormData({ provider_name: name, label: "", credentials: creds });
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.providers.create({
        provider_type: activeTab,
        provider_name: formData.provider_name,
        label: formData.label || formData.provider_name,
        credentials: formData.credentials,
      });
      toast.success("Provider added!");
      resetForm();
      loadProviders(activeTab);
    } catch (err: any) {
      toast.error(err.message || "Failed to add provider");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm("Delete this provider?")) return;
    try {
      await api.providers.delete(providerId);
      toast.success("Provider deleted");
      loadProviders(activeTab);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete provider");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your telephony, LLM, STT, and TTS providers</p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" /> Add Provider
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); resetForm(); }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add Provider Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Add {TABS.find((t) => t.key === activeTab)?.label} Provider</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Provider</label>
              <select
                value={formData.provider_name}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select provider...</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Label</label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Production Twilio"
                className="mt-1"
              />
            </div>
            {selectedProvider?.fields.map((field) => (
              <div key={field}>
                <label className="text-sm font-medium">{field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                <Input
                  type={field.includes("key") || field.includes("token") || field.includes("secret") ? "password" : "text"}
                  value={formData.credentials[field] || ""}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      credentials: { ...f.credentials, [field]: e.target.value },
                    }))
                  }
                  placeholder={field}
                  className="mt-1"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !formData.provider_name}>
                {saving ? "Adding..." : "Add Provider"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">No {TABS.find((t) => t.key === activeTab)?.label} providers configured</p>
            <p className="text-muted-foreground text-sm mb-4">Add a provider to get started</p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Provider</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider: any) => (
            <Card key={provider.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{provider.label || provider.provider_name}</p>
                    <p className="text-sm text-muted-foreground">{provider.provider_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.is_default && <Badge variant="success">Default</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(provider.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Added {formatDate(provider.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
