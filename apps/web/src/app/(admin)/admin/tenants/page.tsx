"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [suspending, setSuspending] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all tenant organizations
          </p>
        </div>
      </div>

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
                Tenants will appear here once users sign up.
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
