import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, apiErrorKey } from "@/lib/api";

function pagesOf(data: { pages?: Array<{ code?: string; body?: string }> }) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return {
    terms: String(pages.find((page) => page.code === "terms")?.body || ""),
    privacy: String(pages.find((page) => page.code === "privacy")?.body || ""),
  };
}

export const fetchTenantLegal = createAsyncThunk(
  "tenantLegal/load",
  async (input: { tenantId: number } | undefined, { rejectWithValue }) => {
    try {
      const url = input?.tenantId ? `/api/command/tenants/${input.tenantId}/legal` : "/api/app/legal";
      const { data } = await api.get(url);
      return { tenantId: input?.tenantId ?? null, ...pagesOf(data) };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const saveTenantLegal = createAsyncThunk(
  "tenantLegal/save",
  async (input: { code: "terms" | "privacy"; body: string; tenantId?: number }, { rejectWithValue }) => {
    try {
      const url = input.tenantId ? `/api/command/tenants/${input.tenantId}/legal/${input.code}` : `/api/app/legal/${input.code}`;
      await api.put(url, { body: input.body });
      return input;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

type TenantLegalState = {
  terms: string;
  privacy: string;
  drafts: "idle" | "loading" | "ready";
  tenantId: number | null;
  saved: boolean;
  errorKey: string | null;
};

const initialState: TenantLegalState = {
  terms: "",
  privacy: "",
  drafts: "idle",
  tenantId: null,
  saved: false,
  errorKey: null,
};

const tenantLegalSlice = createSlice({
  name: "tenantLegal",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenantLegal.pending, (state, action) => {
        state.drafts = "loading";
        state.saved = false;
        state.errorKey = null;
        state.tenantId = action.meta.arg?.tenantId ?? null;
      })
      .addCase(fetchTenantLegal.fulfilled, (state, action) => {
        state.drafts = "ready";
        state.tenantId = action.payload.tenantId;
        state.terms = action.payload.terms;
        state.privacy = action.payload.privacy;
      })
      .addCase(fetchTenantLegal.rejected, (state, action) => {
        state.drafts = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(saveTenantLegal.fulfilled, (state, action) => {
        state.saved = true;
        if (action.payload.code === "terms") state.terms = action.payload.body;
        else state.privacy = action.payload.body;
      })
      .addCase(saveTenantLegal.rejected, (state, action) => {
        state.saved = false;
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export default tenantLegalSlice.reducer;
