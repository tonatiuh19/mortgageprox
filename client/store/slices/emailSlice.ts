import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PlatformEmailItem, TemplateItem } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

export const fetchPlatformEmails = createAsyncThunk("emails/platform", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/command/emails");
    return data.emails as PlatformEmailItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const savePlatformEmail = createAsyncThunk("emails/platformSave", async (email: PlatformEmailItem, { rejectWithValue }) => {
  try {
    await api.put(`/api/command/emails/${email.code}`, email);
    return email.code;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchCommandTemplates = createAsyncThunk("emails/tenant", async (tenantId: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/command/tenants/${tenantId}/templates`);
    return data.items as TemplateItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveCommandTemplate = createAsyncThunk(
  "emails/tenantSave",
  async (input: { tenantId: number; item: TemplateItem }, { rejectWithValue }) => {
    try {
      await api.put(`/api/command/tenants/${input.tenantId}/templates/${input.item.id}`, input.item);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

interface EmailState {
  platform: PlatformEmailItem[];
  status: "idle" | "loading" | "ready";
  saved: boolean;
  errorKey: string | null;
}

const emailSlice = createSlice({
  name: "emails",
  initialState: { platform: [], status: "idle", saved: false, errorKey: null } as EmailState,
  reducers: {
    clearEmailSaved(state) {
      state.saved = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlatformEmails.pending, (state) => {
        state.status = "loading";
        state.errorKey = null;
      })
      .addCase(fetchPlatformEmails.fulfilled, (state, action) => {
        state.platform = action.payload;
        state.status = "ready";
      })
      .addCase(fetchPlatformEmails.rejected, (state, action) => {
        state.status = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(savePlatformEmail.fulfilled, (state) => {
        state.saved = true;
        state.errorKey = null;
      })
      .addCase(savePlatformEmail.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export const { clearEmailSaved } = emailSlice.actions;
export default emailSlice.reducer;
