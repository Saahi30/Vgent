"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"];

const defaultForm = {
  name: "",
  slug: "",
  plan: "free",
  max_agents: 3,
  max_concurrent_calls: 2,
  monthly_call_minutes_limit: 100,
  allocated_minutes: 0,
  allocated_dollars: 0,
  monthly_spend_limit_usd: 0,
  spending_limit_action: "pause",
  owner_email: "",
  owner_password: "",
  owner_name: "",
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const fetchTenants = (p: number) => {
    setLoading(true);
    api.admin
      .tenants({ page: p })
      .then((res) => {
        setTenants(res.data || []);
        setTotalPages(res.total_pages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants(page);
  }, [page]);

  const handleSuspend = async (tenant: any) => {
    const action = tenant.status === "suspended" ? "unsuspend" : "suspend";
    if (!confirm(`Are you sure you want to ${action} "${tenant.name}"?`)) return;

    setSuspending(tenant.id);
    try {
      await api.admin.suspendTenant(tenant.id);
      toast.success(
        `Tenant ${action === "suspend" ? "suspended" : "unsuspended"} successfully`
      );
      fetchTenants(page);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} tenant`);
    } finally {
      setSuspending(null);
    }
  };

  const updateForm = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    updateForm("name", name);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);
    updateForm("slug", slug);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.admin.createTenant(form);
      toast.success(`Tenant "${form.name}" created with owner account!`);
      setShowCreate(false);
      setForm(defaultForm);
      fetchTenants(1);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all tenant organizations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Tenant
        </Button>
      </div>

      {/* Create Tenant Dialog */}
      {showCreate && (
        <Card className="border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Tenant</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-6">
              {/* Tenant Details */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Organization
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Acme Corp"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={form.slug}
                      onChange={(e) => updateForm("slug", e.target.value)}
                      placeholder="acme-corp"
                      required
                      pattern="^[a-z0-9-]+$"
                      className="mt-1"
                    />
                  </div>
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
                </div>
              </div>

              {/* Limits */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Limits & Spending
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Max Agents</label>
                    <Input
                      type="number"
                      value={form.max_agents}
                      onChange={(e) =>
                        updateForm("max_agents", parseInt(e.target.value) || 1)
                      }
                      min={1}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Max Concurrent Calls
                    </label>
                    <Input
                      type="number"
                      value={form.max_concurrent_calls}
                      onChange={(e) =>
                        updateForm(
                          "max_concurrent_calls",
                          parseInt(e.target.value) || 1
                        )
                      }
                      min={1}
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
                      min={0}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Allocated Minutes</label>
                    <Input
                      type="number"
                      value={form.allocated_minutes}
                      onChange={(e) =>
                        updateForm("allocated_minutes", parseInt(e.target.value) || 0)
                      }
                      min={0}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Allocated Dollars</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.allocated_dollars}
                      onChange={(e) =>
                        updateForm("allocated_dollars", parseFloat(e.target.value) || 0)
                      }
                      min={0}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Limit Action</label>
                    <select
                      value={form.spending_limit_action}
                      onChange={(e) => updateForm("spending_limit_action", e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="pause">Pause (stop campaigns)</option>
                      <option value="block">Block (reject new calls)</option>
                      <option value="warn">Warn (allow but notify)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Owner Account */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Owner Account
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <Input
                      value={form.owner_name}
                      onChange={(e) => updateForm("owner_name", e.target.value)}
                      placeholder="John Doe"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={form.owner_email}
                      onChange={(e) =>
                        updateForm("owner_email", e.target.value)
                      }
                      placeholder="john@acme.com"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={form.owner_password}
                      onChange={(e) =>
                        updateForm("owner_password", e.target.value)
                      }
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Tenant"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No tenants found</p>
              <p className="text-muted-foreground text-sm">
                Click &quot;Create Tenant&quot; to add your first customer.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Slug
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Plan
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Agents
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant: any) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-border hover:bg-accent transition-colors"
                    >
                      <td className="p-4 font-medium">
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="text-primary hover:underline"
                        >
                          {tenant.name}
                        </Link>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {tenant.slug}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{tenant.plan || "free"}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            tenant.status === "suspended"
                              ? "destructive"
                              : "success"
                          }
                        >
                          {tenant.status || "active"}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {tenant.agents_count ?? 0}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDate(tenant.created_at)}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuspend(tenant)}
                          disabled={suspending === tenant.id}
                        >
                          {suspending === tenant.id
                            ? "..."
                            : tenant.status === "suspended"
                            ? "Unsuspend"
                            : "Suspend"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
