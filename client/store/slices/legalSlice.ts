import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, apiErrorKey } from "@/lib/api";

function legalParams(input: { scope?: "platform"; office?: string }) {
  return {
    ...(input.scope === "platform" ? { scope: "platform" } : {}),
    ...(input.office ? { office: input.office } : {}),
  };
}

export function legalPreviewKey(input: { scope?: string; office?: string }) {
  return input.office ? `office:${input.office}` : input.scope || "";
}

export const fetchLegalPage = createAsyncThunk(
  "legal/page",
  async (input: { code: "terms" | "privacy"; scope?: "platform"; office?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/api/public/legal/${input.code}`, { params: legalParams(input) });
      return { code: input.code, body: String(data.page?.body || "") };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchLegalPreview = createAsyncThunk(
  "legal/preview",
  async (input: { code: "terms" | "privacy"; scope?: "platform"; office?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/api/public/legal/${input.code}`, { params: legalParams(input) });
      return { code: input.code, scope: legalPreviewKey(input), body: String(data.page?.body || "") };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchPublicHost = createAsyncThunk("legal/host", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/public/host");
    const tenant = data.tenant;
    if (!tenant || typeof tenant !== "object") return null;
    return {
      name: String(tenant.name || ""),
      logoUrl: tenant.logoUrl ? String(tenant.logoUrl) : null,
      primaryColor: tenant.primaryColor ? String(tenant.primaryColor) : null,
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchLegalDrafts = createAsyncThunk("legal/drafts", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/command/legal");
    const pages = Array.isArray(data.pages) ? data.pages : [];
    return {
      terms: String(pages.find((page: { code?: string }) => page.code === "terms")?.body || ""),
      privacy: String(pages.find((page: { code?: string }) => page.code === "privacy")?.body || ""),
    };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveLegalPage = createAsyncThunk(
  "legal/save",
  async (input: { code: "terms" | "privacy"; body: string }, { rejectWithValue }) => {
    try {
      await api.put(`/api/command/legal/${input.code}`, { body: input.body });
      return input;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

type LegalHost = { name: string; logoUrl: string | null; primaryColor: string | null };

type LegalState = {
  body: string;
  status: "idle" | "loading" | "ready";
  terms: string;
  privacy: string;
  drafts: "idle" | "loading" | "ready";
  saved: boolean;
  errorKey: string | null;
  hostStatus: "idle" | "loading" | "ready";
  host: LegalHost | null;
  previewCode: "terms" | "privacy" | null;
  previewScope: string;
  previewBody: string;
  previewStatus: "idle" | "loading" | "ready";
  previewError: string | null;
};

const initialState: LegalState = {
  body: "",
  status: "idle",
  terms: "",
  privacy: "",
  drafts: "idle",
  saved: false,
  errorKey: null,
  hostStatus: "idle",
  host: null,
  previewCode: null,
  previewScope: "",
  previewBody: "",
  previewStatus: "idle",
  previewError: null,
};

const legalSlice = createSlice({
  name: "legal",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalPage.pending, (state) => {
        state.status = "loading";
        state.errorKey = null;
        state.body = "";
      })
      .addCase(fetchLegalPage.fulfilled, (state, action) => {
        state.status = "ready";
        state.body = action.payload.body;
      })
      .addCase(fetchLegalPage.rejected, (state, action) => {
        state.status = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchLegalDrafts.pending, (state) => {
        state.drafts = "loading";
        state.saved = false;
        state.errorKey = null;
      })
      .addCase(fetchLegalDrafts.fulfilled, (state, action) => {
        state.drafts = "ready";
        state.terms = action.payload.terms;
        state.privacy = action.payload.privacy;
      })
      .addCase(fetchLegalDrafts.rejected, (state, action) => {
        state.drafts = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(saveLegalPage.fulfilled, (state) => {
        state.saved = true;
      })
      .addCase(saveLegalPage.rejected, (state, action) => {
        state.saved = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchLegalPreview.pending, (state, action) => {
        state.previewCode = action.meta.arg.code;
        state.previewScope = legalPreviewKey(action.meta.arg);
        state.previewStatus = "loading";
        state.previewBody = "";
        state.previewError = null;
      })
      .addCase(fetchLegalPreview.fulfilled, (state, action) => {
        if (state.previewCode !== action.payload.code || state.previewScope !== action.payload.scope) return;
        state.previewStatus = "ready";
        state.previewBody = action.payload.body;
      })
      .addCase(fetchLegalPreview.rejected, (state, action) => {
        const arg = action.meta.arg;
        if (state.previewCode !== arg.code || state.previewScope !== legalPreviewKey(arg)) return;
        state.previewStatus = "ready";
        state.previewError = String(action.payload || "errors.server");
      })
      .addCase(fetchPublicHost.pending, (state) => {
        state.hostStatus = "loading";
      })
      .addCase(fetchPublicHost.fulfilled, (state, action) => {
        state.hostStatus = "ready";
        state.host = action.payload;
      })
      .addCase(fetchPublicHost.rejected, (state) => {
        state.hostStatus = "ready";
        state.host = null;
      });
  },
});

export default legalSlice.reducer;
