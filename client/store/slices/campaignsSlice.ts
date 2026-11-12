import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import type { CampaignDesk, CampaignPerson } from "@shared/api";
import { api } from "@/lib/api";

export interface CampaignPackQuote {
  packs: number;
  priceCents: number;
}

function campaignFailure(error: unknown): { error: string; packs?: number; priceCents?: number } {
  if (axios.isAxiosError(error) && error.response?.data && typeof error.response.data === "object") {
    const data = error.response.data as { error?: string; packs?: number; priceCents?: number };
    return {
      error: typeof data.error === "string" && data.error ? data.error : "errors.server",
      packs: typeof data.packs === "number" ? data.packs : undefined,
      priceCents: typeof data.priceCents === "number" ? data.priceCents : undefined,
    };
  }
  return { error: "errors.server" };
}

export const fetchCampaigns = createAsyncThunk(
  "campaigns/fetch",
  async (query: { topicId?: number; search?: string } = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/app/campaigns", { params: { topicId: query.topicId || "", search: query.search || "" } });
      return data as CampaignDesk;
    } catch (error) {
      return rejectWithValue(campaignFailure(error));
    }
  },
);

export const fetchCampaignPeople = createAsyncThunk(
  "campaigns/people",
  async (query: { source: string; topicId: number; search: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/api/app/campaigns/people", { params: query });
      return (data.people || []) as CampaignPerson[];
    } catch (error) {
      return rejectWithValue(campaignFailure(error));
    }
  },
);

export const createCampaignTopic = createAsyncThunk("campaigns/topic", async (name: string, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/campaigns/topics", { name });
    return Number(data.id || 0);
  } catch (error) {
    return rejectWithValue(campaignFailure(error));
  }
});

export const addCampaignAudience = createAsyncThunk(
  "campaigns/add",
  async (body: { topicId: number; source: string; ids: number[]; confirmPacks?: number }, { rejectWithValue }) => {
    try {
      await api.post("/api/app/campaigns/audience", body);
      return true;
    } catch (error) {
      return rejectWithValue(campaignFailure(error));
    }
  },
);

export const removeCampaignContact = createAsyncThunk(
  "campaigns/remove",
  async (body: { topicId: number; contactId: number }, { rejectWithValue }) => {
    try {
      await api.post("/api/app/campaigns/audience/remove", body);
      return true;
    } catch (error) {
      return rejectWithValue(campaignFailure(error));
    }
  },
);

export const sendCampaign = createAsyncThunk(
  "campaigns/send",
  async (body: { topicId: number; name: string; subject: string; body: string }, { rejectWithValue }) => {
    try {
      await api.post("/api/app/campaigns", body);
      return true;
    } catch (error) {
      return rejectWithValue(campaignFailure(error));
    }
  },
);

interface CampaignState {
  desk: CampaignDesk | null;
  people: CampaignPerson[];
  loading: boolean;
  errorKey: string | null;
  packQuote: CampaignPackQuote | null;
}

const initialState: CampaignState = {
  desk: null,
  people: [],
  loading: false,
  errorKey: null,
  packQuote: null,
};

const campaignsSlice = createSlice({
  name: "campaigns",
  initialState,
  reducers: {
    clearCampaignQuote(state) {
      state.packQuote = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCampaigns.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loading = false;
        state.desk = action.payload;
        state.errorKey = null;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = (action.payload as { error?: string } | undefined)?.error || "errors.server";
      })
      .addCase(fetchCampaignPeople.fulfilled, (state, action) => {
        state.people = action.payload;
      })
      .addCase(addCampaignAudience.fulfilled, (state) => {
        state.packQuote = null;
        state.errorKey = null;
      })
      .addCase(addCampaignAudience.rejected, (state, action) => {
        const payload = action.payload as { error?: string; packs?: number; priceCents?: number } | undefined;
        if (payload?.packs) {
          state.packQuote = { packs: payload.packs, priceCents: payload.priceCents || 0 };
          state.errorKey = null;
          return;
        }
        state.packQuote = null;
        state.errorKey = payload?.error || "errors.server";
      })
      .addCase(createCampaignTopic.rejected, (state, action) => {
        state.errorKey = (action.payload as { error?: string } | undefined)?.error || "errors.server";
      })
      .addCase(removeCampaignContact.rejected, (state, action) => {
        state.errorKey = (action.payload as { error?: string } | undefined)?.error || "errors.server";
      })
      .addCase(sendCampaign.rejected, (state, action) => {
        state.errorKey = (action.payload as { error?: string } | undefined)?.error || "errors.server";
      });
  },
});

export const { clearCampaignQuote } = campaignsSlice.actions;
export default campaignsSlice.reducer;
