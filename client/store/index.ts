import { configureStore } from "@reduxjs/toolkit";
import auth from "@/store/slices/authSlice";
import catalog from "@/store/slices/catalogSlice";
import command from "@/store/slices/commandSlice";
import workspace from "@/store/slices/workspaceSlice";
import records from "@/store/slices/recordsSlice";
import billing from "@/store/slices/billingSlice";
import legal from "@/store/slices/legalSlice";
import tenantLegal from "@/store/slices/tenantLegalSlice";
import emails from "@/store/slices/emailSlice";
import modules from "@/store/slices/modulesSlice";
import flows from "@/store/slices/flowsSlice";
import campaigns from "@/store/slices/campaignsSlice";

export const store = configureStore({
  reducer: { auth, catalog, command, workspace, records, billing, legal, tenantLegal, emails, modules, flows, campaigns },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: { auth, catalog, command, workspace, records, billing, legal, tenantLegal, emails, modules, flows, campaigns },
    preloadedState,
  });
}
