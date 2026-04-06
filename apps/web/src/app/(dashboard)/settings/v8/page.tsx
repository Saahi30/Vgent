"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, CheckCircle, XCircle, ExternalLink, Phone } from "lucide-react";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { useModeStore } from "@/store/mode";

export default function V8SettingsPage() {
  const { mode, setMode } = useModeStore();
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"unknown" | "valid" | "invalid">("unknown");
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);

  useEffect(() => {
    validateKey();
  }, []);

  const validateKey = async () => {
    setValidating(true);
    try {
      const res = await api.bolna.validateKey();
      setKeyStatus(res.valid ? "valid" : "invalid");
      if (res.valid) {
        loadPhoneNumbers();
      }
    } catch {
      setKeyStatus("invalid");
    } finally {
      setValidating(false);
    }
  };

  const loadPhoneNumbers = async () => {
    try {
      const res = await api.bolna.phoneNumbers.list();
      setPhoneNumbers(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <SettingsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" /> V8 Configuration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your V8 Voice AI integration</p>
        </div>
        <Button
          variant={mode === "v8" ? "default" : "outline"}
          onClick={() => setMode(mode === "v8" ? "custom" : "v8")}
          className={mode === "v8" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
        >
          <Zap className="h-4 w-4 mr-2" />
          {mode === "v8" ? "V8 Active" : "Switch to V8"}
        </Button>
      </div>

      {/* API Key Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Key Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {validating ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            ) : keyStatus === "valid" ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : keyStatus === "invalid" ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : null}
            <span className="text-sm font-medium">
              {validating ? "Validating..." :
                keyStatus === "valid" ? "V8 API key is configured and valid" :
                keyStatus === "invalid" ? "V8 API key is not configured or invalid" :
                "Checking API key..."}
            </span>
          </div>

          {keyStatus === "invalid" && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Setup Instructions:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Sign up at <a href="https://www.bolna.ai" target="_blank" rel="noopener noreferrer" className="text-primary underline">bolna.ai</a></li>
                <li>Go to Developers section and create an API key</li>
                <li>Add <code className="bg-muted px-1 py-0.5 rounded text-xs">BOLNA_API_KEY=your_key</code> to your <code className="bg-muted px-1 py-0.5 rounded text-xs">.env.local</code></li>
                <li>Restart the backend server</li>
              </ol>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={validateKey} disabled={validating}>
              Re-validate
            </Button>
            <a href="https://www.bolna.ai/docs/api-reference" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> API Docs
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Phone Numbers */}
      {keyStatus === "valid" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-5 w-5" /> Phone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phoneNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No phone numbers found. Buy numbers from the V8 dashboard to make outbound calls.
              </p>
            ) : (
              <div className="space-y-2">
                {phoneNumbers.map((num: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border">
                    <span className="text-sm font-mono">{num.phone_number || num.number || JSON.stringify(num)}</span>
                    <Badge variant="outline" className="text-xs">{num.provider || num.type || "phone"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-2">About V8 Mode</h3>
          <p className="text-sm text-muted-foreground mb-3">
            When V8 mode is active, agent management and call operations are handled entirely through
            the V8 cloud platform. This means:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Agents are created and managed via V8 API</li>
            <li>Calls are initiated through V8 telephony infrastructure</li>
            <li>Call recordings and transcripts are stored in V8</li>
            <li>You can use V8 batch calling for campaigns</li>
            <li>No need to configure individual LLM/STT/TTS providers</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
