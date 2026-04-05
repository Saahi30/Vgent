/**
 * Typed API client for the Vgent backend.
 * All endpoints return { data, error } shape.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ApiResponse<T> = { data: T | null; error: { code: string; message: string } | null };
type PaginatedResponse<T> = { data: T[]; total: number; page: number; page_size: number; total_pages: number; error: null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.detail || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {

  // Tenants
  tenants: {
    getCurrent: () => request<ApiResponse<any>>("/tenants/current"),
    updateCurrent: (data: any) => request<ApiResponse<any>>("/tenants/current", { method: "PATCH", body: JSON.stringify(data) }),
    usage: () => request<ApiResponse<any>>("/tenants/current/usage"),
  },

  // Team
  team: {
    members: () => request<ApiResponse<any[]>>("/team/members"),
    invite: (data: { email: string; full_name: string; role: string }) =>
      request<ApiResponse<any>>("/team/members/invite", { method: "POST", body: JSON.stringify(data) }),
    updateMember: (id: string, data: { role: string }) =>
      request<ApiResponse<any>>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeMember: (id: string) =>
      request<ApiResponse<any>>(`/team/members/${id}`, { method: "DELETE" }),
  },

  // Agents
  agents: {
    list: (params?: { page?: number; page_size?: number; is_active?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.page_size) qs.set("page_size", String(params.page_size));
      if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
      return request<PaginatedResponse<any>>(`/agents?${qs}`);
    },
    get: (id: string) => request<ApiResponse<any>>(`/agents/${id}`),
    create: (data: any) => request<ApiResponse<any>>("/agents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<ApiResponse<any>>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<ApiResponse<any>>(`/agents/${id}`, { method: "DELETE" }),
  },

  // Contacts
  contacts: {
    list: (params?: { page?: number; page_size?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.page_size) qs.set("page_size", String(params.page_size));
      if (params?.search) qs.set("search", params.search);
      return request<PaginatedResponse<any>>(`/contacts?${qs}`);
    },
    get: (id: string) => request<ApiResponse<any>>(`/contacts/${id}`),
    create: (data: any) => request<ApiResponse<any>>("/contacts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<ApiResponse<any>>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<ApiResponse<any>>(`/contacts/${id}`, { method: "DELETE" }),
    importPreview: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_URL}/api/contacts/import/preview`, {
        method: "POST",
        body: form,
      }).then(r => r.json()) as Promise<ApiResponse<{ headers: string[]; preview: Record<string, string>[]; total_rows: number }>>;
    },
    import: (file: File, mapping: { phone_number_col: string; first_name_col?: string; last_name_col?: string; email_col?: string }) => {
      const form = new FormData();
      form.append("file", file);
      const qs = new URLSearchParams();
      qs.set("phone_number_col", mapping.phone_number_col);
      if (mapping.first_name_col) qs.set("first_name_col", mapping.first_name_col);
      if (mapping.last_name_col) qs.set("last_name_col", mapping.last_name_col);
      if (mapping.email_col) qs.set("email_col", mapping.email_col);
      return fetch(`${API_URL}/api/contacts/import?${qs}`, {
        method: "POST",
        body: form,
      }).then(r => r.json()) as Promise<ApiResponse<{ imported: number; skipped: number; duplicates: number }>>;
    },
  },

  // Campaigns
  campaigns: {
    list: (params?: { page?: number; page_size?: number; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.page_size) qs.set("page_size", String(params.page_size));
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedResponse<any>>(`/campaigns?${qs}`);
    },
    get: (id: string) => request<ApiResponse<any>>(`/campaigns/${id}`),
    create: (data: any) => request<ApiResponse<any>>("/campaigns", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<ApiResponse<any>>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<ApiResponse<any>>(`/campaigns/${id}`, { method: "DELETE" }),
    start: (id: string) => request<ApiResponse<any>>(`/campaigns/${id}/start`, { method: "POST" }),
    pause: (id: string) => request<ApiResponse<any>>(`/campaigns/${id}/pause`, { method: "POST" }),
    contacts: (id: string, params?: { page?: number; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedResponse<any>>(`/campaigns/${id}/contacts?${qs}`);
    },
  },

  // Calls
  calls: {
    list: (params?: { page?: number; page_size?: number; status?: string; agent_id?: string; campaign_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.page_size) qs.set("page_size", String(params.page_size));
      if (params?.status) qs.set("status", params.status);
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.campaign_id) qs.set("campaign_id", params.campaign_id);
      return request<PaginatedResponse<any>>(`/calls?${qs}`);
    },
    get: (id: string) => request<ApiResponse<any>>(`/calls/${id}`),
    active: () => request<ApiResponse<any[]>>("/calls/active"),
    initiate: (data: { agent_id: string; to_number: string; contact_id?: string; campaign_id?: string }) =>
      request<ApiResponse<any>>("/calls/initiate", { method: "POST", body: JSON.stringify(data) }),
    testCall: (data: { agent_id: string }) =>
      request<ApiResponse<any>>("/calls/test-call", { method: "POST", body: JSON.stringify({ ...data, to_number: "webrtc-test" }) }),
  },

  // Providers
  providers: {
    list: (type?: string) => {
      const qs = type ? `?provider_type=${type}` : "";
      return request<ApiResponse<any[]>>(`/providers${qs}`);
    },
    get: (id: string) => request<ApiResponse<any>>(`/providers/${id}`),
    create: (data: any) => request<ApiResponse<any>>("/providers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<ApiResponse<any>>(`/providers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<ApiResponse<any>>(`/providers/${id}`, { method: "DELETE" }),
  },

  // Knowledge Bases
  knowledgeBases: {
    list: () => request<ApiResponse<any[]>>("/knowledge-bases"),
    get: (id: string) => request<ApiResponse<any>>(`/knowledge-bases/${id}`),
    create: (data: any) => request<ApiResponse<any>>("/knowledge-bases", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<ApiResponse<any>>(`/knowledge-bases/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<ApiResponse<any>>(`/knowledge-bases/${id}`, { method: "DELETE" }),
    documents: (id: string) => request<ApiResponse<any[]>>(`/knowledge-bases/${id}/documents`),
    uploadDocument: (kbId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_URL}/api/knowledge-bases/${kbId}/documents`, {
        method: "POST",
        body: form,
      }).then(r => r.json()) as Promise<ApiResponse<any>>;
    },
    importUrl: (kbId: string, url: string) =>
      request<ApiResponse<any>>(`/knowledge-bases/${kbId}/documents/url`, { method: "POST", body: JSON.stringify({ url }) }),
    deleteDocument: (kbId: string, docId: string) =>
      request<ApiResponse<any>>(`/knowledge-bases/${kbId}/documents/${docId}`, { method: "DELETE" }),
    search: (kbId: string, query: string, topK?: number) =>
      request<ApiResponse<any[]>>(`/knowledge-bases/${kbId}/search`, {
        method: "POST",
        body: JSON.stringify({ query, top_k: topK || 5 }),
      }),
  },

  // Admin
  admin: {
    tenants: (params?: { page?: number }) => {
      const qs = params?.page ? `?page=${params.page}` : "";
      return request<PaginatedResponse<any>>(`/admin/tenants${qs}`);
    },
    tenant: (id: string) => request<ApiResponse<any>>(`/admin/tenants/${id}`),
    updateTenant: (id: string, data: any) => request<ApiResponse<any>>(`/admin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    suspendTenant: (id: string) => request<ApiResponse<any>>(`/admin/tenants/${id}/suspend`, { method: "POST" }),
    calls: (params?: { page?: number; tenant_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.tenant_id) qs.set("tenant_id", params.tenant_id);
      return request<PaginatedResponse<any>>(`/admin/calls?${qs}`);
    },
    usage: () => request<ApiResponse<any>>("/admin/usage"),
    health: () => request<ApiResponse<any>>("/admin/health"),
  },

  health: () => request<any>("/health"),
};
