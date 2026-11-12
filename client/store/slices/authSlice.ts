import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { AuthUser } from "@shared/api";
import { api, apiErrorKey } from "@/lib/api";

export const fetchMe = createAsyncThunk("auth/me", async () => {
  try {
    const { data } = await api.get("/api/auth/me");
    return data.user as AuthUser;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return null;
    throw error;
  }
});

export const requestOtp = createAsyncThunk("auth/requestOtp", async (email: string, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ ok: boolean; sent?: boolean }>("/api/auth/otp/request", { email });
    return Boolean(data.sent);
  } catch (error) {
    return rejectWithValue(apiErrorKey(error));
  }
});

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (body: { email: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/auth/otp/verify", body);
      return data.user as AuthUser;
    } catch (error) {
      return rejectWithValue(apiErrorKey(error));
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await api.post("/api/auth/logout");
});

interface AuthState {
  user: AuthUser | null;
  bootstrapped: boolean;
  loading: boolean;
  errorKey: string | null;
}

const initialState: AuthState = { user: null, bootstrapped: false, loading: false, errorKey: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError(state) {
      state.errorKey = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.bootstrapped = true;
        state.loading = false;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.bootstrapped = true;
        state.loading = false;
      })
      .addCase(requestOtp.pending, (state) => {
        state.loading = true;
        state.errorKey = null;
      })
      .addCase(requestOtp.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(requestOtp.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.errorKey = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.user = action.payload;
        state.bootstrapped = true;
        state.loading = false;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.errorKey = String(action.payload || "errors.server");
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.bootstrapped = true;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
