"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Upload, Users, X, Pencil, Trash2, PhoneOff, Phone } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create/Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    email: "",
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadContacts = (searchQuery?: string) => {
    setLoading(true);
    api.contacts.list({ page_size: 50, search: searchQuery || undefined })
      .then((res) => { setContacts(res.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadContacts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const resetForm = () => {
    setForm({ first_name: "", last_name: "", phone_number: "", email: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.phone_number) {
      toast.error("Phone number is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.contacts.update(editingId, form);
        toast.success("Contact updated");
      } else {
        await api.contacts.create(form);
        toast.success("Contact added");
      }
      resetForm();
      loadContacts(search);
    } catch (err: any) {
      toast.error(err.message || "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (contact: any) => {
    setEditingId(contact.id);
    setForm({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      phone_number: contact.phone_number || "",
      email: contact.email || "",
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.contacts.delete(deleteId);
      toast.success("Contact deleted");
      setDeleteId(null);
      loadContacts(search);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleDNC = async (contact: any) => {
    try {
      await api.contacts.update(contact.id, { do_not_call: !contact.do_not_call });
      toast.success(contact.do_not_call ? "Removed from DNC list" : "Added to DNC list");
      loadContacts(search);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your contact list</p>
        </div>
        <div className="flex gap-2">
          <Link href="/contacts/import">
            <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
          </Link>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="pl-9"
        />
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold">{editingId ? "Edit Contact" : "New Contact"}</p>
              <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">First Name</Label>
                <Input
                  placeholder="First name"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Last Name</Label>
                <Input
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input
                  placeholder="Phone number"
                  value={form.phone_number}
                  onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Add Contact"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No contacts found</p>
              <p className="text-muted-foreground text-sm mb-4">
                {search ? "Try a different search term" : "Add contacts to get started"}
              </p>
              {!search && (
                <Button onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Contact
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">DNC</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact: any) => (
                    <tr key={contact.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="p-4 font-medium">
                        {contact.first_name} {contact.last_name}
                      </td>
                      <td className="p-4 text-muted-foreground">{contact.phone_number}</td>
                      <td className="p-4 text-muted-foreground">{contact.email || "--"}</td>
                      <td className="p-4">
                        {contact.do_not_call ? (
                          <Badge variant="destructive">DNC</Badge>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground">{formatDate(contact.created_at)}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(contact)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleDNC(contact)}
                            title={contact.do_not_call ? "Remove from DNC" : "Add to DNC"}
                          >
                            {contact.do_not_call ? (
                              <Phone className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <PhoneOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteId(contact.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogClose onClose={() => setDeleteId(null)} />
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this contact? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
