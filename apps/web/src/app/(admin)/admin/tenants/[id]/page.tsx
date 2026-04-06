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
import { ArrowLeft, Save, Ban, Phone } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/utils";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"];

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.admin.tenant(id),
      api.admin.calls({ tenant_id: id, page: 1 }),
    ])
      .then(([t, c]) => {
        setTenant(t.data);
        setForm({
          plan: t.data.plan || "free",
          max_agents: t.data.max_agents ?? 5,
          max_concurrent_calls: t.data.max_concurrent_calls ?? 2,
          monthly_call_minutes_limit: t.data.monthly_call_minutes_limit ?? 100,
        });
        setCalls(c.data || []);
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
      // Refresh tenant data
      const res = await api.admin.tenant(id);
      setTenant(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendToggle = async () => {
    const action = tenant.status === "suspended" ? "unsuspend" : "suspend";
    if (!confirm(`Are you sure you want to ${action} this tenant?`)) return;

    try {
      await api.admin.suspendTenant(id);
      const res = await api.admin.tenant(id);
      setTenant(res.data);
      toast.success(
        `Tenant ${action === "suspend" ? "suspended" : "unsuspended"} successfully`
      );
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} tenant`);
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "completed":
        return "success";
      case "failed":
        return "destructive";
      case "in_progress":
        return "warning";
      default:
        return "secondary";
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
          <Button variant="outline" className="mt-4">
            Back to Tenants
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
          <Badge
            variant={tenant.status === "suspended" ? "destructive" : "success"}
          >
            {tenant.status || "active"}
          </Badge>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tenant Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-sm font-medium mt-1">{tenant.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Slug
              </label>
              <p className="text-sm font-medium mt-1">{tenant.slug}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                ID
              </label>
              <p className="text-sm font-mono mt-1">{tenant.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Created
              </label>
              <p className="text-sm mt-1">{formatDate(tenant.created_at)}</p>
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
            <div>
              <label className="text-sm font-medium">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => updateForm("plan", e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Max Agents</label>
                <Input
                  type="number"
                  value={form.max_agents}
                  onChange={(e) =>
                    updateForm("max_agents", parseInt(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Concurrent Calls</label>
                <Input
                  type="number"
                  value={form.max_concurrent_calls}
                  onChange={(e) =>
                    updateForm(
                      "max_concurrent_calls",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Monthly Minutes Limit
                </label>
                <Input
                  type="number"
                  value={form.monthly_call_minutes_limit}
                  onChange={(e) =>
                    updateForm(
                      "monthly_call_minutes_limit",
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspend / Unsuspend */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant={tenant.status === "suspended" ? "outline" : "destructive"}
            onClick={handleSuspendToggle}
          >
            <Ban className="h-4 w-4 mr-2" />
            {tenant.status === "suspended" ? "Unsuspend Tenant" : "Suspend Tenant"}
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
            <p className="text-center text-muted-foreground py-8">
              No calls found for this tenant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      To Number
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calls.slice(0, 10).map((call: any) => (
                    <tr
                      key={call.id}
                      className="border-b border-border hover:bg-accent transition-colors"
                    >
                      <td className="p-3 font-medium">{call.to_number}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(call.status) as any}>
                          {call.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {call.duration_seconds
                          ? formatDuration(call.duration_seconds)
                          : "--"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(call.created_at)}
                      </td>
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
