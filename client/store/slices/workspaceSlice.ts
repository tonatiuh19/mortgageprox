import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { BrandProfile, ClientListItem, LoanBoardColumn, LoanListItem, LoanOfficerOption, PaginationInfo, TeamMember } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

export interface ListQuery {
  search?: string;
  sort?: string;
  dir?: "ASC" | "DESC";
  page?: number;
}

export interface DashboardStage {
  id: number;
  name: string;
  count: number;
}

export interface DashboardTask {
  id: number;
  title: string;
  dueAt: string | null;
}

export interface DashboardLoan {
  id: number;
  name: string;
  stage: string;
  amountCents: number;
  purpose: string;
}

export interface DashboardSnapshot {
  scope: "own" | "all";
  clients: number;
  openLoans: number;
  openTasks: number | null;
  daysLeft: number | null;
  startFeeStatus: string | null;
  unread: number | null;
  seatsUsed: number | null;
  seatLimit: number | null;
  revenueCents?: number;
  approvalPct?: number;
  purposes?: { code: string; count: number }[];
  stages: DashboardStage[];
  dueTasks: DashboardTask[] | null;
  recentLoans: DashboardLoan[];
}

export const fetchDashboard = createAsyncThunk("workspace/dashboard", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/dashboard");
    return data as DashboardSnapshot;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchClients = createAsyncThunk("workspace/clients", async (query: ListQuery, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/clients", { params: query });
    return data as { items: ClientListItem[]; pagination: PaginationInfo };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createClient = createAsyncThunk(
  "workspace/createClient",
  async (body: { firstName: string; lastName: string; email: string; phone: string; source: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/app/clients", body);
      return Number(data.id);
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchLoans = createAsyncThunk("workspace/loans", async (query: ListQuery, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/loans", { params: query });
    return data as { items: LoanListItem[]; pagination: PaginationInfo };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export interface LoanBoardQuery {
  search?: string;
  purpose?: string;
  assigneeId?: number;
  range?: string;
}

export const fetchLoanBoard = createAsyncThunk("workspace/loanBoard", async (query: LoanBoardQuery, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/loans", {
      params: { board: 1, limit: 20, search: query.search || "", purpose: query.purpose || "", assigneeId: query.assigneeId || undefined, range: query.range || "" },
    });
    return data as { columns: LoanBoardColumn[]; officers: LoanOfficerOption[] };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchLoanBoardMore = createAsyncThunk(
  "workspace/loanBoardMore",
  async (query: LoanBoardQuery & { stageId: number; offset: number }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/app/loans", {
        params: {
          board: 1,
          limit: 20,
          stageId: query.stageId,
          offset: query.offset,
          search: query.search || "",
          purpose: query.purpose || "",
          assigneeId: query.assigneeId || undefined,
          range: query.range || "",
        },
      });
      return data as { column: LoanBoardColumn };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const createLoan = createAsyncThunk(
  "workspace/createLoan",
  async (body: { clientId: number; purpose: string; amountCents: number; addressLine?: string; city?: string; region?: string; postalCode?: string; propertyType?: string; propertyValueCents?: number; downPaymentCents?: number; employer?: string; jobTitle?: string; annualIncomeCents?: number; incomeType?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/app/loans", body);
      return Number(data.id);
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchTeam = createAsyncThunk("workspace/team", async (query: ListQuery, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/team", { params: query });
    return data as { items: TeamMember[]; pagination: PaginationInfo };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const inviteTeammate = createAsyncThunk(
  "workspace/invite",
  async (body: { firstName: string; lastName: string; email: string; role: string }, { rejectWithValue }) => {
    try {
      await api.post("/api/app/team", body);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export interface StaffProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photoUrl: string | null;
  nmls: string;
  bio: string;
  timezone: string;
  specializations: string[];
  publicSlug: string;
  website?: string;
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyAlso?: string;
  notifyEvents?: string[];
  unread?: number;
  host: string;
}

export interface SavedFilter {
  id: number;
  name: string;
  query: { search?: string; sort?: string; dir?: "ASC" | "DESC" };
}

export const fetchProfile = createAsyncThunk("workspace/profileRead", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/profile");
    return data.profile as StaffProfile;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveProfile = createAsyncThunk("workspace/profileSave", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    await api.patch("/api/app/profile", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const uploadProfilePhoto = createAsyncThunk("workspace/profilePhoto", async (body: { dataUrl?: string; clear?: boolean }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/profile/photo", body);
    return data.url ? String(data.url) : null;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchFilters = createAsyncThunk("workspace/filters", async (screen: string, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/filters", { params: { screen } });
    return (data.items || []) as SavedFilter[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveFilter = createAsyncThunk("workspace/filterSave", async (body: { screen: string; name: string; query: SavedFilter["query"] }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/filters", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const deleteFilter = createAsyncThunk("workspace/filterDelete", async (id: number, { rejectWithValue }) => {
  try {
    await api.delete(`/api/app/filters/${id}`);
    return id;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const exportGrid = createAsyncThunk("workspace/export", async (body: { path: string; query: ListQuery; filename: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(body.path, { params: { ...body.query, format: "csv" }, responseType: "blob" });
    return { blob: data as Blob, filename: body.filename };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchLetterHold = createAsyncThunk("workspace/letters", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/letters");
    return Boolean(data.hold);
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchSite = createAsyncThunk("workspace/site", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/site");
    return data as { slug: string; pages: { code: string; title: string; body: string }[] };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveSite = createAsyncThunk("workspace/siteSave", async (pages: { code: string; title: string; body: string }[], { rejectWithValue }) => {
  try {
    await api.put("/api/app/site", { pages });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchPublicSite = createAsyncThunk("workspace/publicSite", async (slug: string, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/public/site/${slug}`);
    return data as {
      name: string;
      slug: string;
      phone: string;
      nmls: string;
      address: string;
      supportEmail: string;
      primaryColor: string | null;
      logoUrl: string | null;
      pages: { code: string; title: string; body: string }[];
      people: { name: string; photoUrl: string | null; nmls: string; bio: string; slug: string }[];
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const sendSiteNote = createAsyncThunk("workspace/siteNote", async (body: { slug: string; firstName: string; lastName: string; email: string; phone: string; message: string }, { rejectWithValue }) => {
  try {
    await api.post(`/api/public/site/${body.slug}/contact`, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchLoanFile = createAsyncThunk("workspace/loanFile", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/loans/${id}`);
    return data as {
      loan: Record<string, unknown>;
      canMove: boolean;
      people: { id: number; name: string; role: string }[];
      stages: { id: number; name: string }[];
      realtors: { id: number; name: string }[];
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveLoanFile = createAsyncThunk("workspace/loanSave", async (body: { id: number; patch: Record<string, unknown> }, { rejectWithValue }) => {
  try {
    await api.put(`/api/app/loans/${body.id}`, body.patch);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const downloadLoanFile = createAsyncThunk("workspace/loanDownload", async (body: { id: number; kind: "mismo" | "packet" }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/loans/${body.id}/${body.kind}`, { responseType: "blob" });
    return { blob: data as Blob, filename: body.kind === "mismo" ? `loan-${body.id}.xml` : `loan-${body.id}-packet.pdf` };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const addLoanTask = createAsyncThunk("workspace/loanTask", async (body: { loanId: number; title: string; detail: string; category: string; priority: string; dueAt: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/tasks", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const bulkLoanTasks = createAsyncThunk("workspace/loanTasksBulk", async (ids: number[], { rejectWithValue }) => {
  try {
    await api.post("/api/app/tasks/bulk", { ids, column: "done" });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const removeLoanTask = createAsyncThunk("workspace/loanTaskDelete", async (id: number, { rejectWithValue }) => {
  try {
    await api.delete(`/api/app/tasks/${id}`);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const importClients = createAsyncThunk("workspace/importClients", async (rows: { firstName: string; lastName: string; email: string; phone: string; source: string }[], { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/clients/import", { rows });
    return Number(data.created || 0);
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchRealtors = createAsyncThunk("workspace/realtors", async (search: string, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/realtors", { params: { search } });
    return data.items as { id: number; firstName: string; lastName: string; email: string; phone: string; brokerage: string; status: string }[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveRealtorStatus = createAsyncThunk("workspace/realtorStatus", async (body: { id: number; status: string }, { rejectWithValue }) => {
  try {
    await api.patch(`/api/app/realtors/${body.id}`, { status: body.status });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createRealtor = createAsyncThunk("workspace/realtor", async (body: { firstName: string; lastName: string; email: string; phone: string; brokerage: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/realtors", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchGroups = createAsyncThunk("workspace/groups", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/groups");
    return data.items as { id: number; name: string; kind: string; members: number; people?: string }[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createGroup = createAsyncThunk("workspace/group", async (body: { name: string; kind: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/groups", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchCalendar = createAsyncThunk("workspace/calendar", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/calendar");
    return data as { items: { id: number; name: string; email: string; phone: string; startsAt: string; note: string; status: string }[]; tasks: { title: string; dueOn: string }[]; birthdays: { name: string; date: string }[] };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveAppointment = createAsyncThunk("workspace/appointment", async (body: { id: number; status: string }, { rejectWithValue }) => {
  try {
    await api.patch(`/api/app/calendar/${body.id}`, { status: body.status });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export type PublicLinks = { website: string; linkedin: string; facebook: string; instagram: string; youtube: string };

export type PublicOfficer = {
  name: string;
  photoUrl: string | null;
  nmls: string;
  bio: string;
  email: string;
  phone: string;
  role: string;
  specializations: string[];
  links: PublicLinks;
};

export type PublicOffice = {
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  nmls: string;
  primaryColor: string | null;
  logoUrl: string | null;
  officer: PublicOfficer | null;
};

const EMPTY_LINKS: PublicLinks = { website: "", linkedin: "", facebook: "", instagram: "", youtube: "" };

export const fetchPublicOffice = createAsyncThunk("workspace/publicOffice", async (arg: string | { slug: string; officer?: string }, { rejectWithValue }) => {
  try {
    const slug = typeof arg === "string" ? arg : arg.slug;
    const officer = typeof arg === "string" ? "" : arg.officer || "";
    const { data } = await api.get(`/api/public/office/${slug}`, { params: officer ? { officer } : {} });
    const person = data.officer;
    return {
      name: String(data.name || ""),
      slug: String(data.slug || slug),
      phone: String(data.phone || ""),
      email: String(data.email || ""),
      address: String(data.address || ""),
      nmls: String(data.nmls || ""),
      primaryColor: data.primaryColor ? String(data.primaryColor) : null,
      logoUrl: data.logoUrl ? String(data.logoUrl) : null,
      officer: person ? {
        name: String(person.name || ""),
        photoUrl: person.photoUrl ? String(person.photoUrl) : null,
        nmls: String(person.nmls || ""),
        bio: String(person.bio || ""),
        email: String(person.email || ""),
        phone: String(person.phone || ""),
        role: String(person.role || ""),
        specializations: Array.isArray(person.specializations) ? person.specializations.map(String) : [],
        links: { ...EMPTY_LINKS, ...(person.links || {}) },
      } : null,
    } satisfies PublicOffice;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const submitPublicApply = createAsyncThunk("workspace/publicApply", async (body: Record<string, unknown> & { slug: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/api/public/apply/${body.slug}`, body);
    return Boolean(data.welcomed);
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveApplyDraft = createAsyncThunk("workspace/applyDraft", async (body: { slug: string; token?: string; officer?: string; step: number; payload: Record<string, unknown> }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/api/public/apply/${body.slug}/draft`, body);
    return String(data.token || "");
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchApplyDraft = createAsyncThunk("workspace/applyDraftRead", async (body: { slug: string; token: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/public/apply/${body.slug}/draft`, { params: { token: body.token } });
    return data.draft as { token: string; step: number; payload: Record<string, string> } | null;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const submitPublicBook = createAsyncThunk("workspace/publicBook", async (body: { slug: string; officer?: string; firstName: string; lastName: string; email: string; phone: string; startsAt: string; note: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/api/public/book/${body.slug}`, body);
    return String(data.token || "");
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const moveBooking = createAsyncThunk("workspace/bookMove", async (body: { token: string; startsAt: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/public/book/move", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchBookSlots = createAsyncThunk("workspace/bookSlots", async (body: { slug: string; date: string; officer?: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/public/book/${body.slug}/slots`, { params: { date: body.date, officer: body.officer || "" } });
    return (data.slots || []) as string[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const submitPublicAnalysis = createAsyncThunk("workspace/publicAnalysis", async (body: Record<string, unknown> & { slug: string }, { rejectWithValue }) => {
  try {
    await api.post(`/api/public/analyze/${body.slug}`, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveClient = createAsyncThunk("workspace/clientSave", async (body: { id: number; birthday?: string; phone?: string; email?: string }, { rejectWithValue }) => {
  try {
    await api.patch(`/api/app/clients/${body.id}`, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const addGroupMember = createAsyncThunk("workspace/groupMember", async (body: { groupId: number; clientId: number }, { rejectWithValue }) => {
  try {
    await api.post(`/api/app/groups/${body.groupId}/members`, { clientId: body.clientId });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const savePortalProfile = createAsyncThunk("workspace/portalProfile", async (body: { firstName: string; lastName: string; phone: string; addressLine: string; city: string; region: string; postalCode: string }, { rejectWithValue }) => {
  try {
    await api.put("/api/portal/profile", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchClientFile = createAsyncThunk("workspace/clientFile", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/clients/${id}`);
    return data as { client: Record<string, string | number>; loans: { id: number; purpose: string; amountCents: number; status: string; address: string }[]; conversations: { id: number; channel: string; subject: string }[] };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveLoanDraft = createAsyncThunk("workspace/loanDraft", async (body: { step: number; payload: Record<string, string> }, { rejectWithValue }) => {
  try {
    await api.put("/api/app/loan-draft", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchLoanDraft = createAsyncThunk("workspace/loanDraftRead", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/loan-draft");
    return data.draft as { step: number; payload: Record<string, string> } | null;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchShareLink = createAsyncThunk("workspace/shareRead", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/share-link");
    return { link: String(data.link || ""), slug: String(data.slug || "") };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const emailShareLink = createAsyncThunk("workspace/shareEmail", async (body: { email: string; note: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/share-link", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const rotateShareLink = createAsyncThunk("workspace/shareRotate", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/share-link/rotate");
    return { link: String(data.link || ""), slug: String(data.slug || "") };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchTaskTemplates = createAsyncThunk("workspace/taskTemplates", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/task-templates");
    return data.items as { id: number; title: string; detail: string; category: string; priority: string }[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveTaskTemplate = createAsyncThunk("workspace/taskTemplate", async (body: { title: string; detail: string; category: string; priority: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/task-templates", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchScheduler = createAsyncThunk("workspace/scheduler", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/scheduler");
    return data.settings as { timezone: string; slotMinutes: number; bufferMinutes: number; advanceDays: number; minHours: number; hours: string };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveScheduler = createAsyncThunk("workspace/schedulerSave", async (body: { timezone: string; slotMinutes: number; bufferMinutes: number; advanceDays: number; minHours: number; hours: string }, { rejectWithValue }) => {
  try {
    await api.put("/api/app/scheduler", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const finishPortalTask = createAsyncThunk("workspace/portalTask", async (body: { id: number; status?: string; note?: string }, { rejectWithValue }) => {
  try {
    await api.patch(`/api/portal/tasks/${body.id}`, { status: body.status, note: body.note });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const uploadPortalDocument = createAsyncThunk("workspace/portalDocument", async (body: { loanId: number; name: string; fileName: string; fileBase64: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/portal/documents", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const logLoanCall = createAsyncThunk("workspace/loanCall", async (body: { clientId: number; loanId: number; body: string; transcript: string }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/conversations", { ...body, channel: "call", subject: "Call" });
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const downloadClientTemplate = createAsyncThunk("workspace/clientTemplate", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/clients/template", { responseType: "blob" });
    return data as Blob;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchPortalHome = createAsyncThunk("workspace/portalHome", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/portal/home");
    return data as {
      loans: { id: number; purpose: string; amountCents: number; status: string; stage: string }[];
      tasks: { id: number; loanId: number; title: string; status: string; column?: string; note?: string }[];
      documents: { id: number; loanId: number; name: string; status: string }[];
      profile: { firstName: string; lastName: string; phone: string; addressLine: string; city: string; region: string; postalCode: string } | null;
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchBrand = createAsyncThunk("workspace/brandRead", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/brand");
    return data.brand as BrandProfile;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const uploadBrandAsset = createAsyncThunk(
  "workspace/brandAsset",
  async (body: { kind: "logo" | "favicon"; dataUrl?: string; clear?: boolean }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/app/brand/asset", body);
      return { kind: body.kind, url: data.url ? String(data.url) : null };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const saveBrand = createAsyncThunk(
  "workspace/brand",
  async (body: { name: string; phone: string; nmls: string; addressLine: string; city: string; region: string; postalCode: string; letterHold: boolean; supportEmail: string; primaryColor: string; brandRadius: string; brandHeadline: string; customDomain?: string }, { rejectWithValue }) => {
    try {
      await api.patch("/api/app/brand", body);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

interface WorkspaceState {
  dashboard: DashboardSnapshot | null;
  dashboardStatus: "idle" | "loading" | "ready";
  clientsCount: number;
  openLoans: number;
  openTasks: number | null;
  daysLeft: number | null;
  clients: ClientListItem[];
  loans: LoanListItem[];
  loanBoard: LoanBoardColumn[];
  loanOfficers: LoanOfficerOption[];
  loanBoardLoading: boolean;
  team: TeamMember[];
  clientsPagination: PaginationInfo | null;
  loansPagination: PaginationInfo | null;
  teamPagination: PaginationInfo | null;
  brandProfile: BrandProfile | null;
  staffProfile: StaffProfile | null;
  savedFilters: SavedFilter[];
  loading: boolean;
  errorKey: string | null;
}

const initialState: WorkspaceState = {
  dashboard: null,
  dashboardStatus: "idle",
  clientsCount: 0,
  openLoans: 0,
  openTasks: 0,
  daysLeft: null,
  clients: [],
  loans: [],
  loanBoard: [],
  loanOfficers: [],
  loanBoardLoading: false,
  team: [],
  clientsPagination: null,
  loansPagination: null,
  teamPagination: null,
  brandProfile: null,
  staffProfile: null,
  savedFilters: [],
  loading: false,
  errorKey: null,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    clearWorkspaceError(state) {
      state.errorKey = null;
    },
    loanMoved(state, action: { payload: { id: number; toId: number; status: string } }) {
      const from = state.loanBoard.find((column) => column.items.some((card) => card.id === action.payload.id));
      const to = state.loanBoard.find((column) => column.id === action.payload.toId);
      if (!from || !to || from.id === to.id) return;
      const index = from.items.findIndex((card) => card.id === action.payload.id);
      const [card] = from.items.splice(index, 1);
      card.status = action.payload.status;
      to.items.unshift(card);
      from.total = Math.max(0, from.total - 1);
      to.total += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.dashboardStatus = "loading";
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.dashboardStatus = "ready";
        state.dashboard = action.payload;
        state.clientsCount = action.payload.clients;
        state.openLoans = action.payload.openLoans;
        state.openTasks = action.payload.openTasks;
        state.daysLeft = action.payload.daysLeft;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.dashboardStatus = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchClients.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading = false;
        state.clients = action.payload.items;
        state.clientsPagination = action.payload.pagination;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchLoans.fulfilled, (state, action) => {
        state.loading = false;
        state.loans = action.payload.items;
        state.loansPagination = action.payload.pagination;
      })
      .addCase(fetchLoans.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLoanBoard.pending, (state) => {
        state.loanBoardLoading = true;
        state.errorKey = null;
      })
      .addCase(fetchLoanBoard.fulfilled, (state, action) => {
        state.loanBoardLoading = false;
        state.loanBoard = action.payload.columns;
        state.loanOfficers = action.payload.officers;
      })
      .addCase(fetchLoanBoard.rejected, (state, action) => {
        state.loanBoardLoading = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchLoanBoardMore.fulfilled, (state, action) => {
        const next = action.payload.column;
        const column = state.loanBoard.find((item) => item.id === next.id);
        if (!column) return;
        const seen = new Set(column.items.map((card) => card.id));
        for (const card of next.items) {
          if (!seen.has(card.id)) column.items.push(card);
        }
        column.total = next.total;
        column.hasMore = next.hasMore;
      })
      .addCase(fetchLoanBoardMore.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.team = action.payload.items;
        state.teamPagination = action.payload.pagination;
        state.loading = false;
      })
      .addCase(createClient.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(createLoan.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(inviteTeammate.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.staffProfile = action.payload;
      })
      .addCase(fetchShareLink.fulfilled, (state, action) => {
        if (state.staffProfile && action.payload.slug) state.staffProfile.publicSlug = action.payload.slug;
      })
      .addCase(rotateShareLink.fulfilled, (state, action) => {
        if (state.staffProfile && action.payload.slug) state.staffProfile.publicSlug = action.payload.slug;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(saveProfile.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchFilters.fulfilled, (state, action) => {
        state.savedFilters = action.payload;
      })
      .addCase(fetchBrand.fulfilled, (state, action) => {
        state.brandProfile = action.payload;
      })
      .addCase(fetchBrand.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(uploadBrandAsset.fulfilled, (state, action) => {
        if (!state.brandProfile) return;
        if (action.payload.kind === "logo") state.brandProfile.logoUrl = action.payload.url;
        else state.brandProfile.faviconUrl = action.payload.url;
      })
      .addCase(uploadBrandAsset.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(saveBrand.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export const { clearWorkspaceError, loanMoved } = workspaceSlice.actions;
export default workspaceSlice.reducer;
