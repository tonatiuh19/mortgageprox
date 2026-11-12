import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, apiErrorKey } from "@/lib/api";
import { fetchMe } from "@/store/slices/authSlice";
import { fetchBilling } from "@/store/slices/billingSlice";
import { fetchOfficeNav } from "@/store/slices/recordsSlice";

export type ModuleOffer = {
  code: string;
  category: string;
  enabled: boolean;
  included: boolean;
  minimumPlan: string;
};

export type PlanPrice = { code: string; priceCents: number };

type Catalog = {
  planCode: string;
  owner: boolean;
  items: ModuleOffer[];
  plans: PlanPrice[];
};

export const fetchModules = createAsyncThunk("modules/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/modules");
    return {
      planCode: String(data.planCode || ""),
      owner: Boolean(data.owner),
      items: (data.items || []) as ModuleOffer[],
      plans: (data.plans || []) as PlanPrice[],
    } satisfies Catalog;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const setModule = createAsyncThunk(
  "modules/set",
  async (input: { code: string; enabled: boolean }, { dispatch, rejectWithValue }) => {
    try {
      await api.post("/api/app/modules", input);
      await dispatch(fetchMe());
      await dispatch(fetchOfficeNav());
      await dispatch(fetchModules());
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const upgradePlan = createAsyncThunk(
  "modules/upgrade",
  async (input: { planCode: string; moduleCode?: string }, { dispatch, rejectWithValue }) => {
    try {
      await api.post("/api/app/billing/upgrade", input);
      await dispatch(fetchMe());
      await dispatch(fetchBilling());
      await dispatch(fetchOfficeNav());
      await dispatch(fetchModules());
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

type ModulesState = {
  catalog: Catalog | null;
  status: "idle" | "loading" | "ready";
  errorKey: string | null;
};

const initialState: ModulesState = { catalog: null, status: "idle", errorKey: null };

const modulesSlice = createSlice({
  name: "modules",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchModules.pending, (state) => {
        state.status = "loading";
        state.errorKey = null;
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.status = "ready";
        state.catalog = action.payload;
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.status = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(setModule.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(upgradePlan.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(setModule.pending, (state) => {
        state.errorKey = null;
      })
      .addCase(upgradePlan.pending, (state) => {
        state.errorKey = null;
      });
  },
});

export default modulesSlice.reducer;
