import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ActivityItem, PaginationInfo, TenantListItem } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

export interface TenantQuery {
  search?: string;
  status?: string;
  sort?: string;
  dir?: "ASC" | "DESC";
  page?: number;
}

export const fetchTenants = createAsyncThunk("command/tenants", async (query: TenantQuery, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/command/tenants", { params: query });
    return data as { items: TenantListItem[]; pagination: PaginationInfo };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchTenant = createAsyncThunk("command/tenant", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/command/tenants/${id}`);
    return data.tenant;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const updateTenant = createAsyncThunk(
  "command/updateTenant",
  async (body: { id: number; patch: Record<string, unknown> }, { rejectWithValue }) => {
    try {
      await api.patch(`/api/command/tenants/${body.id}`, body.patch);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchCampaignCapacity = createAsyncThunk("command/campaignCapacity", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/command/campaigns");
    return { ceiling: Number(data.ceiling || 0), used: Number(data.used || 0) };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveCampaignCapacity = createAsyncThunk("command/saveCampaignCapacity", async (ceiling: number, { rejectWithValue }) => {
  try {
    const { data } = await api.patch("/api/command/campaigns", { ceiling });
    return { ceiling: Number(data.ceiling || ceiling), used: Number(data.used || 0) };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchActivity = createAsyncThunk(
  "command/activity",
  async (query: TenantQuery, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/command/activity", { params: query });
      return data as { items: ActivityItem[]; pagination: PaginationInfo };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

interface CommandState {
  tenants: TenantListItem[];
  pagination: PaginationInfo | null;
  loading: boolean;
  tenant: Record<string, unknown> | null;
  activity: ActivityItem[];
  activityPagination: PaginationInfo | null;
  errorKey: string | null;
  saved: boolean;
  campaignCeiling: number | null;
  campaignCeilingUsed: number;
}

const initialState: CommandState = {
  tenants: [],
  pagination: null,
  loading: false,
  tenant: null,
  activity: [],
  activityPagination: null,
  errorKey: null,
  saved: false,
  campaignCeiling: null,
  campaignCeilingUsed: 0,
};

const commandSlice = createSlice({
  name: "command",
  initialState,
  reducers: {
    clearSaved(state) {
      state.saved = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTenants.fulfilled, (state, action) => {
        state.loading = false;
        state.tenants = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchTenants.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchTenant.fulfilled, (state, action) => {
        state.tenant = action.payload;
      })
      .addCase(updateTenant.fulfilled, (state) => {
        state.saved = true;
      })
      .addCase(updateTenant.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchActivity.fulfilled, (state, action) => {
        state.activity = action.payload.items;
        state.activityPagination = action.payload.pagination;
        state.loading = false;
      })
      .addCase(fetchActivity.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCampaignCapacity.fulfilled, (state, action) => {
        state.campaignCeiling = action.payload.ceiling;
        state.campaignCeilingUsed = action.payload.used;
      })
      .addCase(saveCampaignCapacity.fulfilled, (state, action) => {
        state.campaignCeiling = action.payload.ceiling;
        state.campaignCeilingUsed = action.payload.used;
        state.saved = true;
      })
      .addCase(saveCampaignCapacity.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export const { clearSaved } = commandSlice.actions;
export default commandSlice.reducer;
