import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { loadStripe } from "@stripe/stripe-js";
import type { BillingSnapshot } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

export const fetchBilling = createAsyncThunk("billing/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/billing");
    return data.billing as BillingSnapshot;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createMcpKey = createAsyncThunk("billing/mcpKey", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/billing/mcp-key");
    return { token: String(data.token || ""), prefix: String(data.prefix || "") };
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const changeSeats = createAsyncThunk("billing/seats", async (action: "add" | "remove", { dispatch, rejectWithValue }) => {
  try {
    await api.post("/api/app/billing/seats", { action });
    await dispatch(fetchBilling());
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const changeCampaignPacks = createAsyncThunk("billing/campaignPacks", async (action: "add" | "remove", { dispatch, rejectWithValue }) => {
  try {
    await api.post("/api/app/billing/campaign-packs", { action });
    await dispatch(fetchBilling());
    return true;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const buyPack = createAsyncThunk(
  "billing/pack",
  async (input: { code: string; publishableKey: string | null }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/app/billing/packs", { code: input.code });
      if (data.requiresAction) {
        if (!input.publishableKey) return rejectWithValue("errors.stripe");
        const stripe = await loadStripe(input.publishableKey);
        if (!stripe) return rejectWithValue("errors.stripe");
        const result = await stripe.confirmCardPayment(String(data.clientSecret || ""));
        if (result.error || result.paymentIntent?.status !== "succeeded") return rejectWithValue("errors.billing.card");
        await api.post("/api/app/billing/packs/complete", { paymentIntentId: data.paymentIntentId });
      }
      await dispatch(fetchBilling());
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const startCheckout = createAsyncThunk("billing/checkout", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/billing/checkout");
    return String(data.clientSecret || "");
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

type BillingState = {
  snapshot: BillingSnapshot | null;
  clientSecret: string | null;
  status: "idle" | "loading" | "ready";
  errorKey: string | null;
};

const initialState: BillingState = {
  snapshot: null,
  clientSecret: null,
  status: "idle",
  errorKey: null,
};

const billingSlice = createSlice({
  name: "billing",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBilling.pending, (state) => {
        state.status = "loading";
        state.errorKey = null;
      })
      .addCase(fetchBilling.fulfilled, (state, action) => {
        state.status = "ready";
        state.snapshot = action.payload;
      })
      .addCase(fetchBilling.rejected, (state, action) => {
        state.status = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(createMcpKey.fulfilled, (state, action) => {
        if (state.snapshot?.mcp) state.snapshot.mcp.tokenPrefix = action.payload.prefix;
      })
      .addCase(createMcpKey.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(startCheckout.fulfilled, (state, action) => {
        state.clientSecret = action.payload || null;
      })
      .addCase(startCheckout.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(changeSeats.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(buyPack.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(changeCampaignPacks.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      });
  },
});

export default billingSlice.reducer;
