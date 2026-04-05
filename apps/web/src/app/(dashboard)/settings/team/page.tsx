"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { formatDate } from "@/lib/utils";

interface Member {
  id: string;
  tenant_id: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === "owner" || user?.role === "superadmin";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "member",
  });

  const loadMembers = () => {
    setLoading(true);
    api.team
      .members()
      .then((res) => {
        setMembers((res.data as Member[]) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const resetInviteForm = () => {
    setInviteForm({ email: "", full_name: "", role: "member" });
    setShowInvite(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      await api.team.invite(inviteForm);
      toast.success("Team member invited!");
      resetInviteForm();
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite member");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await api.team.updateMember(memberId, { role: newRole });
      toast.success("Role updated");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemove = async (memberId: string, memberName: string | null) => {
    if (!confirm(`Remove ${memberName || "this member"} from the team?`)) return;
    try {
      await api.team.removeMember(memberId);
      toast.success("Member removed");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your team members and their roles
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowInvite(true)} disabled={showInvite}>
            <Plus className="h-4 w-4 mr-2" /> Invite Member
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Invite Team Member</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetInviteForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={inviteForm.full_name}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, full_name: e.target.value }))
                }
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="john@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((f) => ({ ...f, role: e.target.value }))
                }
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetInviteForm}>
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={saving || !inviteForm.email || !inviteForm.full_name}
              >
                {saving ? "Inviting..." : "Invite Member"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">No team members found</p>
            <p className="text-muted-foreground text-sm mb-4">
              Invite members to start collaborating
            </p>
            {isOwner && (
              <Button onClick={() => setShowInvite(true)}>
                <Plus className="h-4 w-4 mr-2" /> Invite Member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {members.map((member) => {
                const isSelf = member.id === user?.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {(member.full_name || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.full_name || "Unknown"}
                          {isSelf && (
                            <span className="text-muted-foreground text-sm ml-2">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Joined {formatDate(member.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOwner && !isSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value)
                          }
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="member">Member</option>
                          <option value="owner">Owner</option>
                        </select>
                      ) : (
                        <Badge
                          variant={
                            member.role === "owner" ? "default" : "secondary"
                          }
                        >
                          {member.role}
                        </Badge>
                      )}
                      {isOwner && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleRemove(member.id, member.full_name)
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
