/**
 * Typed API client for the Vgent backend.
 * All endpoints return { data, error } shape.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ApiResponse<T> = { data: T | null; error: { code: string; message: string } | null };
type PaginatedResponse<T> = { data: T[]; total: number; page: number; page_size: number; total_pages: number; error: null };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      signal: controller.signal,
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
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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

  // ── Bolna Mode ──────────────────────────────────────────────
  bolna: {
    validateKey: () => request<{ valid: boolean; message?: string }>("/bolna/validate-key"),

    // User / Account
    user: {
      me: () => request<{ data: any }>("/bolna/user/me"),
      info: () => request<{ data: any }>("/bolna/user/info"),
    },

    // Agents
    agents: {
      list: () => request<{ data: any[] }>("/bolna/agents"),
      get: (id: string) => request<{ data: any }>(`/bolna/agents/${id}`),
      create: (agent_config: any) =>
        request<{ data: any }>("/bolna/agents", { method: "POST", body: JSON.stringify({ agent_config }) }),
      update: (id: string, agent_config: any) =>
        request<{ data: any }>(`/bolna/agents/${id}`, { method: "PUT", body: JSON.stringify({ agent_config }) }),
      patch: (id: string, updates: any) =>
        request<{ data: any }>(`/bolna/agents/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
      delete: (id: string) =>
        request<{ data: any }>(`/bolna/agents/${id}`, { method: "DELETE" }),
      stopAllCalls: (id: string) =>
        request<{ data: any }>(`/bolna/agents/${id}/stop`, { method: "POST" }),
    },

    // Calls
    calls: {
      make: (data: { agent_id: string; recipient_phone_number: string; user_data?: any; retry_config?: any }) =>
        request<{ data: any }>("/bolna/calls", { method: "POST", body: JSON.stringify(data) }),
      stop: (executionId: string) =>
        request<{ data: any }>(`/bolna/calls/${executionId}/stop`, { method: "POST" }),
    },

    // Executions
    executions: {
      listAll: (params?: { page_number?: number; page_size?: number }) => {
        const qs = new URLSearchParams();
        if (params?.page_number) qs.set("page_number", String(params.page_number));
        if (params?.page_size) qs.set("page_size", String(params.page_size));
        return request<{ data: any }>(`/bolna/executions?${qs}`);
      },
      get: (id: string) => request<{ data: any }>(`/bolna/executions/${id}`),
      getLog: (id: string) => request<{ data: any }>(`/bolna/executions/${id}/log`),
      list: (agentId: string, params?: { page_number?: number; page_size?: number }) => {
        const qs = new URLSearchParams();
        if (params?.page_number) qs.set("page_number", String(params.page_number));
        if (params?.page_size) qs.set("page_size", String(params.page_size));
        return request<{ data: any }>(`/bolna/agents/${agentId}/executions?${qs}`);
      },
    },

    // Batches
    batches: {
      create: (agentId: string, file: File) => {
        const form = new FormData();
        form.append("file", file);
        form.append("agent_id", agentId);
        return fetch(`${API_URL}/api/bolna/batches`, {
          method: "POST",
          body: form,
        }).then(r => r.json());
      },
      schedule: (batchId: string, scheduledAt?: string) =>
        request<{ data: any }>(`/bolna/batches/${batchId}/schedule`, {
          method: "POST",
          body: JSON.stringify({ scheduled_at: scheduledAt }),
        }),
      stop: (batchId: string) =>
        request<{ data: any }>(`/bolna/batches/${batchId}/stop`, { method: "POST" }),
      get: (batchId: string) => request<{ data: any }>(`/bolna/batches/${batchId}`),
      delete: (batchId: string) =>
        request<{ data: any }>(`/bolna/batches/${batchId}`, { method: "DELETE" }),
      list: (agentId: string) => request<{ data: any }>(`/bolna/agents/${agentId}/batches`),
      executions: (batchId: string) => request<{ data: any }>(`/bolna/batches/${batchId}/executions`),
    },

    // Knowledge Bases
    knowledgebases: {
      list: () => request<{ data: any[] }>("/bolna/knowledgebases"),
      get: (ragId: string) => request<{ data: any }>(`/bolna/knowledgebases/${ragId}`),
      createFromFile: (file: File) => {
        const form = new FormData();
        form.append("file", file);
        return fetch(`${API_URL}/api/bolna/knowledgebases`, {
          method: "POST",
          body: form,
        }).then(r => r.json());
      },
      createFromURL: (url: string) =>
        request<{ data: any }>("/bolna/knowledgebases/url", { method: "POST", body: JSON.stringify({ url }) }),
      delete: (ragId: string) => request<{ data: any }>(`/bolna/knowledgebases/${ragId}`, { method: "DELETE" }),
    },

    // Phone Numbers
    phoneNumbers: {
      list: () => request<{ data: any[] }>("/bolna/phone-numbers"),
      search: (params?: { country_iso?: string; area_code?: string }) => {
        const qs = new URLSearchParams();
        if (params?.country_iso) qs.set("country_iso", params.country_iso);
        if (params?.area_code) qs.set("area_code", params.area_code);
        return request<{ data: any[] }>(`/bolna/phone-numbers/search?${qs}`);
      },
      buy: (phoneNumber: string) =>
        request<{ data: any }>("/bolna/phone-numbers/buy", { method: "POST", body: JSON.stringify({ phone_number: phoneNumber }) }),
      delete: (phoneNumberId: string) =>
        request<{ data: any }>(`/bolna/phone-numbers/${phoneNumberId}`, { method: "DELETE" }),
    },

    // Inbound Call Setup
    inbound: {
      setup: (agentId: string, phoneNumber: string) =>
        request<{ data: any }>("/bolna/inbound/setup", {
          method: "POST",
          body: JSON.stringify({ agent_id: agentId, phone_number: phoneNumber }),
        }),
      unlink: (phoneNumber: string) =>
        request<{ data: any }>("/bolna/inbound/unlink", {
          method: "POST",
          body: JSON.stringify({ phone_number: phoneNumber }),
        }),
      deleteAgent: (phoneNumber: string) =>
        request<{ data: any }>(`/bolna/inbound/agent/${encodeURIComponent(phoneNumber)}`, { method: "DELETE" }),
    },

    // Voices
    voices: {
      list: () => request<{ data: any[] }>("/bolna/voices"),
    },

    // Providers (Bolna-side LLM/telephony/voice providers)
    bolnaProviders: {
      list: () => request<{ data: any[] }>("/bolna/providers"),
      add: (config: any) =>
        request<{ data: any }>("/bolna/providers", { method: "POST", body: JSON.stringify(config) }),
      delete: (keyName: string) =>
        request<{ data: any }>(`/bolna/providers/${keyName}`, { method: "DELETE" }),
    },

    // Extractions
    extractions: {
      list: () => request<{ data: any[] }>("/bolna/extractions"),
      get: (templateId: string) => request<{ data: any }>(`/bolna/extractions/${templateId}`),
    },

    // SIP Trunks
    sipTrunks: {
      list: () => request<{ data: any[] }>("/bolna/sip-trunks"),
      create: (config: any) =>
        request<{ data: any }>("/bolna/sip-trunks", { method: "POST", body: JSON.stringify(config) }),
      get: (trunkId: string) => request<{ data: any }>(`/bolna/sip-trunks/${trunkId}`),
      update: (trunkId: string, updates: any) =>
        request<{ data: any }>(`/bolna/sip-trunks/${trunkId}`, { method: "PATCH", body: JSON.stringify(updates) }),
      delete: (trunkId: string) =>
        request<{ data: any }>(`/bolna/sip-trunks/${trunkId}`, { method: "DELETE" }),
      addNumber: (trunkId: string, phoneNumber: string) =>
        request<{ data: any }>(`/bolna/sip-trunks/${trunkId}/numbers`, {
          method: "POST",
          body: JSON.stringify({ phone_number: phoneNumber }),
        }),
      listNumbers: (trunkId: string) => request<{ data: any[] }>(`/bolna/sip-trunks/${trunkId}/numbers`),
      deleteNumber: (trunkId: string, phoneNumberId: string) =>
        request<{ data: any }>(`/bolna/sip-trunks/${trunkId}/numbers/${phoneNumberId}`, { method: "DELETE" }),
    },
  },
};
