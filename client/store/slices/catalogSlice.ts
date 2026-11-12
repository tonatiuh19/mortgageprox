import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { CatalogResponse, PlanRecommendation, WizardSelection } from "@shared/api";
import type { BrandDirection } from "@/lib/brand";
import { api, apiErrorKey } from "@/lib/api";

export const fetchCatalog = createAsyncThunk("catalog/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<CatalogResponse>("/api/public/catalog");
    return data;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const recommendPackage = createAsyncThunk(
  "catalog/recommend",
  async (selection: WizardSelection, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/public/wizard/recommend", selection);
      return data.recommendation as PlanRecommendation;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const previewWizardHost = createAsyncThunk("catalog/host", async (name: string, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/public/wizard/host", { params: { name } });
    const host = String(data.host || "");
    if (!host) return rejectWithValue("errors.server");
    return { name, host };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const prepareWizardCheckout = createAsyncThunk(
  "catalog/checkout",
  async (
    body: WizardSelection & { brokerageName: string; firstName: string; lastName: string; email: string; phone: string; domain?: string; brand?: BrandDirection },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post("/api/public/wizard/checkout", wizardBody(body));
      const clientSecret = String(data.clientSecret || "");
      const publishableKey = String(data.publishableKey || "");
      const intentId = Number(data.intentId || 0);
      if (!clientSecret || !publishableKey || !intentId) return rejectWithValue("errors.stripe");
      return { clientSecret, publishableKey, intentId };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const completeWizard = createAsyncThunk(
  "catalog/complete",
  async (intentId: number, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/public/wizard/complete", { intentId });
      return data as { email: string; emailSent: boolean; recommendation: PlanRecommendation; name?: string; host?: string };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

function wizardBody(body: WizardSelection & { brokerageName: string; firstName: string; lastName: string; email: string; phone: string; domain?: string; brand?: BrandDirection }) {
  return {
    selection: {
      modules: body.modules,
      seats: body.seats,
      customStyles: body.customStyles,
      twilio: body.twilio,
      customDomain: body.customDomain,
    },
    brokerageName: body.brokerageName,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    domain: body.domain,
    brand: body.brand,
  };
}

export const startTrial = createAsyncThunk(
  "catalog/start",
  async (
    body: WizardSelection & { brokerageName: string; firstName: string; lastName: string; email: string; phone: string; domain?: string; brand?: BrandDirection },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await api.post("/api/public/wizard/start", wizardBody(body));
      return data as { email: string; emailSent: boolean; recommendation: PlanRecommendation; name?: string; host?: string };
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

interface CatalogState {
  modules: CatalogResponse["modules"];
  plans: CatalogResponse["plans"];
  addons: CatalogResponse["addons"];
  trialDays: number;
  status: "idle" | "loading" | "ready" | "error";
  recommendation: PlanRecommendation | null;
  recommending: boolean;
  starting: boolean;
  errorKey: string | null;
  startedEmail: string | null;
  startedName: string | null;
  startedHost: string | null;
  emailSent: boolean;
  host: string | null;
  hostName: string | null;
}

const initialState: CatalogState = {
  modules: [],
  plans: [],
  addons: [],
  trialDays: 30,
  status: "idle",
  recommendation: null,
  recommending: false,
  starting: false,
  errorKey: null,
  startedEmail: null,
  startedName: null,
  startedHost: null,
  emailSent: false,
  host: null,
  hostName: null,
};

function officeOpened(state: CatalogState, payload: { email: string; emailSent: boolean; name?: string; host?: string }) {
  state.starting = false;
  state.startedEmail = payload.email;
  state.emailSent = payload.emailSent;
  state.startedName = payload.name || null;
  state.startedHost = payload.host || null;
  state.recommendation = null;
  state.host = null;
  state.hostName = null;
  state.errorKey = null;
}

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalog.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchCatalog.fulfilled, (state, action) => {
        state.modules = action.payload.modules;
        state.plans = action.payload.plans;
        state.addons = action.payload.addons;
        state.trialDays = action.payload.trialDays;
        state.status = "ready";
      })
      .addCase(fetchCatalog.rejected, (state) => {
        state.status = "error";
      })
      .addCase(recommendPackage.pending, (state) => {
        state.recommending = true;
        state.errorKey = null;
      })
      .addCase(recommendPackage.fulfilled, (state, action) => {
        state.recommending = false;
        state.recommendation = action.payload;
      })
      .addCase(recommendPackage.rejected, (state, action) => {
        state.recommending = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(previewWizardHost.pending, (state, action) => {
        if (state.hostName !== action.meta.arg) state.host = null;
      })
      .addCase(previewWizardHost.fulfilled, (state, action) => {
        state.hostName = action.payload.name;
        state.host = action.payload.host;
      })
      .addCase(previewWizardHost.rejected, (state) => {
        state.host = null;
      })
      .addCase(startTrial.pending, (state) => {
        state.starting = true;
        state.errorKey = null;
      })
      .addCase(startTrial.fulfilled, (state, action) => {
        officeOpened(state, action.payload);
      })
      .addCase(completeWizard.pending, (state) => {
        state.starting = true;
        state.errorKey = null;
      })
      .addCase(completeWizard.fulfilled, (state, action) => {
        officeOpened(state, action.payload);
      })
      .addCase(completeWizard.rejected, (state, action) => {
        state.starting = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(startTrial.rejected, (state, action) => {
        state.starting = false;
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export default catalogSlice.reducer;
