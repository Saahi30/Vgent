"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Megaphone,
  Search,
  Users,
} from "lucide-react";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const STEPS = ["Basics", "Contacts", "Schedule", "Review"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<any[]>([]);

  // Step 2: Contacts
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(true);

  // Step 3: Schedule
  const [timezone, setTimezone] = useState("UTC");
  const [callingHoursStart, setCallingHoursStart] = useState("09:00");
  const [callingHoursEnd, setCallingHoursEnd] = useState("18:00");
  const [callingDays, setCallingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [maxRetries, setMaxRetries] = useState(2);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(60);
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState(1);

  useEffect(() => {
    api.agents.list({ page_size: 100, is_active: true })
      .then((res) => setAgents(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setContactsLoading(true);
    const timer = setTimeout(() => {
      api.contacts.list({ page_size: 200, search: contactSearch || undefined })
        .then((res) => setContacts(res.data || []))
        .catch(() => {})
        .finally(() => setContactsLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllContacts = () => {
    const callable = contacts.filter((c) => !c.do_not_call);
    if (selectedContactIds.size === callable.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(callable.map((c) => c.id)));
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim() && agentId;
      case 1: return selectedContactIds.size > 0;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        agent_id: agentId,
        contact_ids: Array.from(selectedContactIds),
        timezone,
        calling_hours_start: callingHoursStart + ":00",
        calling_hours_end: callingHoursEnd + ":00",
        calling_days: callingDays,
        max_retries: maxRetries,
        retry_delay_minutes: retryDelayMinutes,
        max_concurrent_calls: maxConcurrentCalls,
      };

      const res = await api.campaigns.create(payload);
      toast.success("Campaign created!");
      router.push(`/campaigns/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  const selectedAgent = agents.find((a) => a.id === agentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Campaign</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create an outbound calling campaign</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary cursor-pointer"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {label}
            </button>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 Sales Outreach"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this campaign's purpose..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="agent">AI Agent *</Label>
                <Select
                  id="agent"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
                {agents.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No active agents found. Create one first.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Contacts */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Select Contacts</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedContactIds.size} selected
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={selectAllContacts}>
                  {selectedContactIds.size === contacts.filter((c) => !c.do_not_call).length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="pl-9"
                />
              </div>

              <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
                {contactsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2" />
                    <p className="text-sm">No contacts found</p>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                        contact.do_not_call ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedContactIds.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                        disabled={contact.do_not_call}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{contact.phone_number}</p>
                      </div>
                      {contact.do_not_call && (
                        <Badge variant="destructive">DNC</Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1.5"
                >
                  <option value="UTC">UTC</option>
                  <option value="US/Eastern">US/Eastern</option>
                  <option value="US/Central">US/Central</option>
                  <option value="US/Mountain">US/Mountain</option>
                  <option value="US/Pacific">US/Pacific</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hours-start">Calling Hours Start</Label>
                  <Input
                    id="hours-start"
                    type="time"
                    value={callingHoursStart}
                    onChange={(e) => setCallingHoursStart(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="hours-end">Calling Hours End</Label>
                  <Input
                    id="hours-end"
                    type="time"
                    value={callingHoursEnd}
                    onChange={(e) => setCallingHoursEnd(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label>Calling Days</Label>
                <div className="flex gap-2 mt-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        setCallingDays((prev) =>
                          prev.includes(day.value)
                            ? prev.filter((d) => d !== day.value)
                            : [...prev, day.value].sort()
                        );
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        callingDays.includes(day.value)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:bg-accent"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="concurrent">Concurrent Calls</Label>
                  <Input
                    id="concurrent"
                    type="number"
                    min={1}
                    max={50}
                    value={maxConcurrentCalls}
                    onChange={(e) => setMaxConcurrentCalls(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="retries">Max Retries</Label>
                  <Input
                    id="retries"
                    type="number"
                    min={0}
                    max={10}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="retry-delay">Retry Delay (min)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    min={1}
                    max={1440}
                    value={retryDelayMinutes}
                    onChange={(e) => setRetryDelayMinutes(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Review Campaign</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Campaign Name</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">AI Agent</p>
                  <p className="font-medium">{selectedAgent?.name || "--"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contacts</p>
                  <p className="font-medium">{selectedContactIds.size} contacts selected</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Timezone</p>
                  <p className="font-medium">{timezone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Calling Hours</p>
                  <p className="font-medium">{callingHoursStart} — {callingHoursEnd}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Calling Days</p>
                  <p className="font-medium">
                    {callingDays.map((d) => DAYS.find((dd) => dd.value === d)?.label).join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Concurrent Calls</p>
                  <p className="font-medium">{maxConcurrentCalls}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Retries</p>
                  <p className="font-medium">{maxRetries} (delay: {retryDelayMinutes}min)</p>
                </div>
              </div>
              {description && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Description</p>
                  <p>{description}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step > 0 ? setStep(step - 1) : router.push("/campaigns"))}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving}>
            <Megaphone className="h-4 w-4 mr-2" />
            {saving ? "Creating..." : "Create Campaign"}
          </Button>
        )}
      </div>
    </div>
  );
}
