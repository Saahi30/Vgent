"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Save, Ban, Phone, DollarSign, Clock, RotateCcw, Plus } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"];
const LIMIT_ACTIONS = ["pause", "block", "warn"];

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [usageDetail, setUsageDetail] = useState<any>(null);
  const [allocateForm, setAllocateForm] = useState({ minutes_delta: 0, dollars_delta: 0, note: "" });
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.admin.tenant(id),
      api.admin.calls({ tenant_id: id, page: 1 }),
      api.admin.tenantUsageDetail(id),
    ])
      .then(([t, c, u]) => {
        setTenant(t.data);
        setForm({
          plan: t.data.plan || "free",
          max_agents: t.data.max_agents ?? 5,
          max_concurrent_calls: t.data.max_concurrent_calls ?? 2,
          monthly_call_minutes_limit: t.data.monthly_call_minutes_limit ?? 100,
          allocated_minutes: t.data.allocated_minutes ?? 0,
          allocated_dollars: t.data.allocated_dollars ?? 0,
          monthly_spend_limit_usd: t.data.monthly_spend_limit_usd ?? 0,
          spending_limit_action: t.data.spending_limit_action ?? "pause",
        });
        setCalls(c.data || []);
        setUsageDetail(u.data || null);
      })
      .catch((err: any) => {
        toast.error(err.message || "Failed to load tenant");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateForm = (key: string, value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.admin.updateTenant(id, form);
      toast.success("Tenant updated!");
      const res = await api.admin.tenant(id);
      setTenant(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  };

  const handleAllocate = async () => {
    if (allocateForm.minutes_delta === 0 && allocateForm.dollars_delta === 0) {
      toast.error("Enter minutes or dollars to allocate");
      return;
    }
    setAllocating(true);
    try {
      await api.admin.allocateBalance(id, allocateForm);
      toast.success("Balance allocated!");
      setAllocateForm({ minutes_delta: 0, dollars_delta: 0, note: "" });
      // Refresh
      const [t, u] = await Promise.all([api.admin.tenant(id), api.admin.tenantUsageDetail(id)]);
      setTenant(t.data);
      setUsageDetail(u.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to allocate");
    } finally {
      setAllocating(false);
    }
  };

  const handleResetUsage = async () => {
    if (!confirm("Reset this tenant's used minutes and dollars to zero?")) return;
    try {
      await api.admin.resetUsage(id, { note: "Admin manual reset" });
      toast.success("Usage reset!");
      const [t, u] = await Promise.all([api.admin.tenant(id), api.admin.tenantUsageDetail(id)]);
      setTenant(t.data);
      setUsageDetail(u.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    }
  };

  const handleSuspendToggle = async () => {
    const action = tenant.status === "suspended" || !tenant.is_active ? "unsuspend" : "suspend";
    if (!confirm(`Are you sure you want to ${action} this tenant?`)) return;
    try {
      await api.admin.suspendTenant(id);
      const res = await api.admin.tenant(id);
      setTenant(res.data);
      toast.success(`Tenant ${action}ed successfully`);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} tenant`);
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed": return "success";
      case "failed": return "destructive";
      case "in_progress": return "warning";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Tenant not found</p>
        <Link href="/admin/tenants">
          <Button variant="outline" className="mt-4">Back to Tenants</Button>
        </Link>
      </div>
    );
  }

  const usage = usageDetail?.current_usage;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
            <p className="text-sm text-muted-foreground">
              {tenant.slug} &middot; Created {formatDate(tenant.created_at)}
            </p>
          </div>
          <Badge variant={tenant.status === "suspended" || !tenant.is_active ? "destructive" : "success"}>
            {tenant.status || "active"}
          </Badge>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Usage Overview */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" /> Minutes Used
              </div>
              <p className="text-2xl font-bold">{usage.used_minutes}</p>
              {usage.remaining_minutes !== null && (
                <>
                  <Progress value={usage.percent_minutes_used} className="mt-2 h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {usage.remaining_minutes} remaining of {usageDetail?.limits?.minutes_limit}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" /> Dollars Spent
              </div>
              <p className="text-2xl font-bold">${usage.used_dollars}</p>
              {usage.remaining_dollars !== null && (
                <>
                  <Progress value={usage.percent_dollars_used} className="mt-2 h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    ${usage.remaining_dollars} remaining of ${usageDetail?.limits?.dollars_limit}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Phone className="h-4 w-4" /> Calls This Month
              </div>
              <p className="text-2xl font-bold">{usage.calls_this_month}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-sm text-muted-foreground mb-1">Plan</div>
              <p className="text-2xl font-bold capitalize">{tenant.plan}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Limit action: {tenant.spending_limit_action}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Allocate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" /> Allocate Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium">Add Minutes</label>
              <Input
                type="number"
                value={allocateForm.minutes_delta}
                onChange={(e) => setAllocateForm(f => ({ ...f, minutes_delta: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 500"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Add Dollars</label>
              <Input
                type="number"
                step="0.01"
                value={allocateForm.dollars_delta}
                onChange={(e) => setAllocateForm(f => ({ ...f, dollars_delta: parseFloat(e.target.value) || 0 }))}
                placeholder="e.g. 50.00"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Note</label>
              <Input
                value={allocateForm.note}
                onChange={(e) => setAllocateForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Optional note"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAllocate} disabled={allocating}>
                {allocating ? "..." : "Allocate"}
              </Button>
              <Button variant="outline" onClick={handleResetUsage} title="Reset used minutes/dollars to zero">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan & Limits */}
      {form && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan & Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => updateForm("plan", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Limit Action</label>
                <select
                  value={form.spending_limit_action}
                  onChange={(e) => updateForm("spending_limit_action", e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {LIMIT_ACTIONS.map((a) => (
                    <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Max Agents</label>
                <Input type="number" value={form.max_agents} onChange={(e) => updateForm("max_agents", parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Max Concurrent Calls</label>
                <Input type="number" value={form.max_concurrent_calls} onChange={(e) => updateForm("max_concurrent_calls", parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Monthly Minutes Limit</label>
                <Input type="number" value={form.monthly_call_minutes_limit} onChange={(e) => updateForm("monthly_call_minutes_limit", parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Allocated Minutes</label>
                <Input type="number" value={form.allocated_minutes} onChange={(e) => updateForm("allocated_minutes", parseInt(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Allocated Dollars</label>
                <Input type="number" step="0.01" value={form.allocated_dollars} onChange={(e) => updateForm("allocated_dollars", parseFloat(e.target.value) || 0)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Monthly Spend Limit ($)</label>
                <Input type="number" step="0.01" value={form.monthly_spend_limit_usd} onChange={(e) => updateForm("monthly_spend_limit_usd", parseFloat(e.target.value) || 0)} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tenant Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-sm font-medium mt-1">{tenant.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Slug</label>
              <p className="text-sm font-medium mt-1">{tenant.slug}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID</label>
              <p className="text-sm font-mono mt-1">{tenant.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{formatDate(tenant.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suspend / Unsuspend */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant={tenant.status === "suspended" || !tenant.is_active ? "outline" : "destructive"}
            onClick={handleSuspendToggle}
          >
            <Ban className="h-4 w-4 mr-2" />
            {tenant.status === "suspended" || !tenant.is_active ? "Unsuspend Tenant" : "Suspend Tenant"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No calls found for this tenant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">To Number</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cost</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.slice(0, 10).map((call: any) => (
                    <tr key={call.id} className="border-b border-border hover:bg-accent transition-colors">
                      <td className="p-3 font-medium">{call.to_number}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(call.status) as any}>{call.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {call.duration_seconds ? formatDuration(call.duration_seconds) : "--"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        ${(call.cost_usd || 0).toFixed(4)}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(call.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
