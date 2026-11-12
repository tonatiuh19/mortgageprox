import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { FlowDetail, FlowEdge, FlowRunItem, FlowStep, FlowSummary, TemplateItem } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

type FlowList = { canEdit: boolean; stages: { id: number; name: string }[]; items: FlowSummary[] };
type FlowPayload = { canEdit: boolean; flow: FlowDetail; templates: TemplateItem[] };

export const fetchFlowList = createAsyncThunk("flows/list", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/app/reminders");
    return { canEdit: Boolean(data.canEdit), stages: data.stages || [], items: data.items || [] } as FlowList;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const createBlankFlow = createAsyncThunk("flows/create", async (body: { name: string; stageId: number | null }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/app/reminders", body);
    return Number(data.id);
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const fetchFlow = createAsyncThunk("flows/get", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/reminders/${id}`);
    return { canEdit: Boolean(data.canEdit), flow: data.flow as FlowDetail, templates: (data.templates || []) as TemplateItem[] } satisfies FlowPayload;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const saveFlow = createAsyncThunk(
  "flows/save",
  async (input: { id: number; name: string; description: string; stageId: number | null; stopOnReply: boolean; quietStartHour: number; quietEndHour: number; steps: FlowStep[]; edges: FlowEdge[] }, { rejectWithValue }) => {
    try {
      await api.put(`/api/app/reminders/${input.id}`, input);
      return true;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const setFlowEnabled = createAsyncThunk("flows/active", async (input: { id: number; enabled: boolean }, { dispatch, rejectWithValue }) => {
  try {
    await api.post(`/api/app/reminders/${input.id}/active`, { enabled: input.enabled });
    await dispatch(fetchFlowList());
    return input.enabled;
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const publishFlowTemplate = createAsyncThunk(
  "flows/template",
  async (body: { id: number | null; name: string; channel: string; subject: string; greeting: string; headline: string; body: string; buttonLabel: string; buttonUrl: string; details: { label: string; value: string }[]; footer: string }, { rejectWithValue }) => {
    try {
      if (body.id) {
        await api.put(`/api/app/templates/${body.id}`, body);
        return body.id;
      }
      const { data } = await api.post("/api/app/templates", body);
      return Number(data.id);
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const fetchFlowRuns = createAsyncThunk("flows/runs", async (id: number, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/app/reminders/${id}/runs`);
    return (data.items || []) as FlowRunItem[];
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

type FlowsState = {
  list: FlowList | null;
  detail: FlowPayload | null;
  runs: FlowRunItem[];
  status: "idle" | "loading" | "ready";
  errorKey: string | null;
};

const initialState: FlowsState = { list: null, detail: null, runs: [], status: "idle", errorKey: null };

const flowsSlice = createSlice({
  name: "flows",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFlowList.pending, (state) => {
        state.status = "loading";
        state.errorKey = null;
      })
      .addCase(fetchFlowList.fulfilled, (state, action) => {
        state.status = "ready";
        state.list = action.payload;
      })
      .addCase(fetchFlowList.rejected, (state, action) => {
        state.status = "ready";
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchFlow.fulfilled, (state, action) => {
        state.detail = action.payload;
        state.errorKey = null;
      })
      .addCase(fetchFlow.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(saveFlow.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(setFlowEnabled.rejected, (state, action) => {
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(fetchFlowRuns.fulfilled, (state, action) => {
        state.runs = action.payload;
      });
  },
});

export default flowsSlice.reducer;
