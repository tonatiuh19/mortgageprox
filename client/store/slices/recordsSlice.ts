import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type {
  BroadcastItem,
  ComplianceItem,
  ContactItem,
  CreditItem,
  DocumentItem,
  FlowItem,
  OfficeMenuRole,
  OfficeMenuSection,
  MailboxItem,
  OfficeNavItem,
  PaginationInfo,
  PhoneDesk,
  ReportSnapshot,
  StageItem,
  TaskItem,
  TemplateItem,
  ThreadItem,
  ThreadMessage,
  TranscriptItem,
} from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

type List = { search?: string; sort?: string; dir?: string; page?: number; channel?: string; loanId?: number; clientId?: number; scope?: string };

export const fetchOfficeNav = createAsyncThunk("records/nav", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/office");
    return data.items as OfficeNavItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchOfficeMenu = createAsyncThunk("records/menu", async (tenantId: number | null, { rejectWithValue }) => {
  try {
    const url = tenantId ? `/api/command/tenants/${tenantId}/menu` : "/api/app/office/menu";
    const { data } = await api.get(url);
    return data as { sections: OfficeMenuSection[]; roles: OfficeMenuRole[] };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveOfficeMenu = createAsyncThunk(
  "records/menuSave",
  async (input: { tenantId: number | null; sections: OfficeMenuSection[]; roles: OfficeMenuRole[] }, { rejectWithValue }) => {
    try {
      const body = {
        sections: input.sections.map((section) => ({
          id: section.id,
          customLabel: section.customLabel,
          hidden: section.hidden,
          sort: section.sort,
        })),
        roles: input.roles.map((role) => ({ role: role.role, sectionId: role.sectionId, visible: role.visible })),
      };
      const url = input.tenantId ? `/api/command/tenants/${input.tenantId}/menu` : "/api/app/office/menu";
      await api.patch(url, body);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchContacts = createAsyncThunk("records/contacts", async (query: List, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/contacts", { params: query });
    return data as { items: ContactItem[]; pagination: PaginationInfo };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createContact = createAsyncThunk("records/contactCreate", async (body: Record<string, string>, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/contacts", body);
    return data as { id: number };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const convertContact = createAsyncThunk("records/convert", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/api/app/contacts/${id}/convert`);
    return data as { clientId: number };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchThreads = createAsyncThunk("records/threads", async (query: List, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/conversations", { params: query });
    return data as { items: ThreadItem[]; pagination: PaginationInfo; twilio: boolean };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchThread = createAsyncThunk("records/thread", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/conversations/${id}`);
    return data as {
      thread: ThreadItem & { email: string | null; phone: string | null; contactId: number | null; clientId: number | null };
      messages: ThreadMessage[];
      twilio: boolean;
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const sendThread = createAsyncThunk("records/send", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    const url = body.threadId ? `/api/app/conversations/${body.threadId}/messages` : "/api/app/conversations";
    const { data } = await api.post(url, body);
    return data as { id?: number; status: string; notice?: string | null };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchTasks = createAsyncThunk("records/tasks", async (query: { q: string; page: number }, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/tasks", { params: { q: query.q, page: query.page, limit: 20 } });
    return {
      items: (data.items || []) as TaskItem[],
      staff: (data.staff || []) as { id: number; name: string }[],
      loans: (data.loans || []) as { id: number; name: string }[],
      pagination: (data.pagination || null) as PaginationInfo | null,
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveTask = createAsyncThunk("records/task", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    if (body.id) await api.patch(`/api/app/tasks/${body.id}`, body);
    else await api.post("/api/app/tasks", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchDocuments = createAsyncThunk("records/documents", async (query: number | { loanId: number; sort?: string; dir?: string }, { rejectWithValue }) => {
  try {
    const loanId = typeof query === "number" ? query : query.loanId;
    const sort = typeof query === "number" ? "" : query.sort || "";
    const dir = typeof query === "number" ? "" : query.dir || "";
    const { data } = await api.get("/api/app/documents", { params: { loanId, sort, dir } });
    return data.items as DocumentItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveDocument = createAsyncThunk("records/document", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    if (body.id) await api.patch(`/api/app/documents/${body.id}`, body);
    else await api.post("/api/app/documents", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchCompliance = createAsyncThunk("records/compliance", async (loanId: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/compliance", { params: { loanId } });
    return data.items as ComplianceItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveCompliance = createAsyncThunk("records/complianceSave", async (body: { id: number; status: string; dueOn?: string; documentId?: number }, { rejectWithValue }) => {
  try {
    await api.patch(`/api/app/compliance/${body.id}`, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchTemplates = createAsyncThunk("records/templates", async (query: { search?: string } = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/templates", { params: { search: query?.search || "" } });
    return data.items as TemplateItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createTemplate = createAsyncThunk("records/template", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    await api.post("/api/app/templates", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveTemplate = createAsyncThunk("records/templateSave", async (body: TemplateItem, { rejectWithValue }) => {
  try {
    await api.put(`/api/app/templates/${body.id}`, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchFlows = createAsyncThunk("records/flows", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/reminders");
    return data.items as FlowItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createFlow = createAsyncThunk("records/flow", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    await api.post("/api/app/reminders", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchBroadcasts = createAsyncThunk("records/broadcasts", async (query: { search?: string } = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/broadcasts", { params: { search: query?.search || "" } });
    return data.items as BroadcastItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createBroadcast = createAsyncThunk("records/broadcast", async (body: Record<string, string>, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/broadcasts", body);
    return data as { status: string };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchCredit = createAsyncThunk("records/credit", async (query: { search?: string } = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/credit", { params: { search: query?.search || "" } });
    return data.items as CreditItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createCredit = createAsyncThunk("records/creditCreate", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    const url = body.portal ? "/api/portal/credit" : "/api/app/credit";
    await api.post(url, body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchStages = createAsyncThunk("records/stages", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/stages");
    return data.items as StageItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveStage = createAsyncThunk("records/stage", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    if (body.ids) await api.patch("/api/app/stages/reorder", { ids: body.ids });
    else if (body.id) await api.patch(`/api/app/stages/${body.id}`, body);
    else await api.post("/api/app/stages", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const moveLoan = createAsyncThunk("records/moveLoan", async (body: { id: number; stageId: number }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/api/app/loans/${body.id}`, { stageId: body.stageId });
    return { id: body.id, stageId: body.stageId, status: String(data.status || "open") };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchReport = createAsyncThunk("records/report", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/reports");
    return data.report as ReportSnapshot;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchMailboxes = createAsyncThunk("records/mailboxes", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/mailboxes");
    return data as { items: MailboxItem[]; microsoft: boolean };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const connectMailbox = createAsyncThunk("records/mailbox", async (body: { email: string; displayName: string }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/mailboxes", body);
    return data as { id: number; status: string; authUrl: string | null };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchTranscripts = createAsyncThunk("records/transcripts", async (query: { search?: string } = {}, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/transcripts", { params: { search: query?.search || "" } });
    return data.items as TranscriptItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchPhone = createAsyncThunk("records/phone", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/phone");
    return data as PhoneDesk & { ok: boolean };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const savePhoneSettings = createAsyncThunk("records/phoneSettings", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    await api.put("/api/app/phone/settings", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const savePhoneLine = createAsyncThunk("records/phoneLine", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    await api.post("/api/app/phone/lines", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const blockNumber = createAsyncThunk("records/block", async (body: { e164: string; note: string; blockCalls?: boolean; blockTexts?: boolean }, { rejectWithValue }) => {
  try {
    await api.post("/api/app/phone/blocked", body);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const unblockNumber = createAsyncThunk("records/unblock", async (id: number, { rejectWithValue }) => {
  try {
    await api.delete(`/api/app/phone/blocked/${id}`);
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchCalculatorSaves = createAsyncThunk("records/calcs", async (loanId: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/calculators", { params: { loanId: loanId || undefined } });
    return data.items as { id: number; kind: string; title: string; createdAt: string }[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveCalculator = createAsyncThunk("records/calc", async (body: Record<string, unknown>, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/calculators", body);
    return data as { id: number };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

interface RecordsState {
  nav: OfficeNavItem[] | null;
  sections: OfficeMenuSection[];
  roles: OfficeMenuRole[];
  contacts: ContactItem[];
  contactsPagination: PaginationInfo | null;
  threads: ThreadItem[];
  threadsPagination: PaginationInfo | null;
  messages: ThreadMessage[];
  activeThread: (ThreadItem & { email?: string | null; phone?: string | null }) | null;
  tasks: TaskItem[];
  taskStaff: { id: number; name: string }[];
  taskLoans: { id: number; name: string }[];
  taskPagination: PaginationInfo | null;
  documents: DocumentItem[];
  compliance: ComplianceItem[];
  templates: TemplateItem[];
  flows: FlowItem[];
  broadcasts: BroadcastItem[];
  credit: CreditItem[];
  stages: StageItem[];
  report: ReportSnapshot | null;
  phone: PhoneDesk | null;
  mailboxes: MailboxItem[];
  microsoftReady: boolean;
  transcripts: TranscriptItem[];
  notice: string | null;
  loading: boolean;
  errorKey: string | null;
}

const initialState: RecordsState = {
  nav: null,
  sections: [],
  roles: [],
  contacts: [],
  contactsPagination: null,
  threads: [],
  threadsPagination: null,
  messages: [],
  activeThread: null,
  tasks: [],
  taskStaff: [],
  taskLoans: [],
  taskPagination: null,
  documents: [],
  compliance: [],
  templates: [],
  flows: [],
  broadcasts: [],
  credit: [],
  stages: [],
  report: null,
  phone: null,
  mailboxes: [],
  microsoftReady: false,
  transcripts: [],
  notice: null,
  loading: false,
  errorKey: null,
};

const recordsSlice = createSlice({
  name: "records",
  initialState,
  reducers: {
    clearNotice(state) {
      state.notice = null;
      state.errorKey = null;
    },
    setSections(state, action: { payload: OfficeMenuSection[] }) {
      state.sections = action.payload;
    },
    setRoles(state, action: { payload: OfficeMenuRole[] }) {
      state.roles = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOfficeNav.fulfilled, (state, action) => {
        state.nav = action.payload;
      })
      .addCase(fetchOfficeMenu.fulfilled, (state, action) => {
        state.sections = action.payload.sections;
        state.roles = action.payload.roles;
      })
      .addCase(saveOfficeMenu.fulfilled, (state) => {
        state.notice = "command.saved";
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.loading = false;
        state.contacts = action.payload.items;
        state.contactsPagination = action.payload.pagination;
      })
      .addCase(fetchThreads.fulfilled, (state, action) => {
        state.loading = false;
        state.threads = action.payload.items;
        state.threadsPagination = action.payload.pagination;
      })
      .addCase(fetchThread.fulfilled, (state, action) => {
        state.activeThread = action.payload.thread;
        state.messages = action.payload.messages;
      })
      .addCase(sendThread.fulfilled, (state, action) => {
        state.notice = action.payload.notice || (action.payload.status === "sent" ? "app.emailSent" : "app.queued");
      })
      .addCase(fetchPhone.fulfilled, (state, action) => {
        state.loading = false;
        state.phone = action.payload;
      })
      .addCase(fetchMailboxes.fulfilled, (state, action) => {
        state.loading = false;
        state.mailboxes = action.payload.items;
        state.microsoftReady = action.payload.microsoft;
      })
      .addCase(fetchTranscripts.fulfilled, (state, action) => {
        state.loading = false;
        state.transcripts = action.payload;
      })
      .addCase(savePhoneSettings.fulfilled, (state) => {
        state.notice = "app.phoneSaved";
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload.items;
        state.taskStaff = action.payload.staff;
        state.taskLoans = action.payload.loans;
        state.taskPagination = action.payload.pagination;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload;
      })
      .addCase(fetchCompliance.fulfilled, (state, action) => {
        state.loading = false;
        state.compliance = action.payload;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.templates = action.payload;
      })
      .addCase(fetchFlows.fulfilled, (state, action) => {
        state.loading = false;
        state.flows = action.payload;
      })
      .addCase(fetchBroadcasts.fulfilled, (state, action) => {
        state.loading = false;
        state.broadcasts = action.payload;
      })
      .addCase(fetchCredit.fulfilled, (state, action) => {
        state.loading = false;
        state.credit = action.payload;
      })
      .addCase(fetchStages.fulfilled, (state, action) => {
        state.stages = action.payload;
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.loading = false;
        state.report = action.payload;
      });

    const pending = [
      fetchContacts, fetchThreads, fetchTasks, fetchDocuments, fetchCompliance, fetchTemplates,
      fetchFlows, fetchBroadcasts, fetchCredit, fetchReport, fetchPhone, fetchMailboxes, fetchTranscripts,
    ] as const;
    for (const thunk of pending) {
      builder.addCase(thunk.pending, (state) => {
        state.loading = true;
        state.errorKey = null;
      });
      builder.addCase(thunk.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = String(action.payload || "errors.server");
      });
    }
    const writes = [
      createContact, convertContact, sendThread, saveTask, saveDocument, saveCompliance,
      createTemplate, saveTemplate, createFlow, createBroadcast, createCredit, saveStage, moveLoan, saveCalculator, saveOfficeMenu,
      savePhoneSettings, savePhoneLine, blockNumber, unblockNumber, connectMailbox,
    ] as const;
    for (const thunk of writes) {
      builder.addCase(thunk.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      });
    }
  },
});

export const { clearNotice, setSections, setRoles } = recordsSlice.actions;
export default recordsSlice.reducer;
