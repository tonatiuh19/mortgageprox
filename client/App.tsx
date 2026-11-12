import "./global.css";
import "./i18n";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Provider } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { store } from "@/store";
import SiteLayout from "@/components/layout/SiteLayout";
import Index from "./pages/Index";
import Pipeline from "./pages/Pipeline";
import Pricing from "./pages/Pricing";
import StartWizard from "./pages/StartWizard";
import LegalPage from "./pages/LegalPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CommandLayout from "./pages/command/CommandLayout";
import CommandOverview from "./pages/command/Overview";
import Tenants from "./pages/command/Tenants";
import TenantDetail from "./pages/command/TenantDetail";
import ActivityPage from "./pages/command/ActivityPage";
import LegalPages from "./pages/command/LegalPages";
import Emails from "./pages/command/Emails";
import AppLayout from "./pages/app/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Clients from "./pages/app/Clients";
import LoanPipeline from "./pages/app/Pipeline";
import Team from "./pages/app/Team";
import Settings from "./pages/app/Settings";
import Billing from "./pages/app/Billing";
import Modules from "./pages/app/Modules";
import ModulePage from "./pages/app/ModulePage";
import Contacts from "./pages/app/Contacts";
import Conversations from "./pages/app/Conversations";
import EmailDesk from "./pages/app/EmailDesk";
import Phone from "./pages/app/Phone";
import Transcripts from "./pages/app/Transcripts";
import Calculators from "./pages/app/Calculators";
import Tasks from "./pages/app/Tasks";
import Documents from "./pages/app/Documents";
import Compliance from "./pages/app/Compliance";
import Templates from "./pages/app/Templates";
import Reminders from "./pages/app/Reminders";
import FlowDetailPage from "./pages/app/FlowDetail";
import Broadcasts from "./pages/app/Broadcasts";
import Campaigns from "./pages/app/Campaigns";
import Credit from "./pages/app/Credit";
import Reports from "./pages/app/Reports";
import Profile from "./pages/app/Profile";
import Website from "./pages/app/Website";
import Letters from "./pages/app/Letters";
import PublicSite from "./pages/PublicSite";
import Apply from "./pages/Apply";
import Book from "./pages/Book";
import Analyze from "./pages/Analyze";
import ClientFile from "./pages/app/ClientFile";
import LoanFile from "./pages/app/LoanFile";
import Letter from "./pages/app/Letter";
import Applications from "./pages/app/Applications";
import Realtors from "./pages/app/Realtors";
import CalendarPage from "./pages/app/Calendar";
import Groups from "./pages/app/Groups";
import { BorrowerHome, BorrowerLayout } from "./pages/portal/Borrower";

const App = () => (
  <Provider store={store}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/start" element={<StartWizard />} />
            <Route path="/terms" element={<LegalPage code="terms" />} />
            <Route path="/privacy" element={<LegalPage code="privacy" />} />
            <Route path="/pipeline" element={<Pipeline />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/w/:slug" element={<PublicSite />} />
          <Route path="/w/:slug/:page" element={<PublicSite />} />
          <Route path="/apply/:slug" element={<Apply />} />
          <Route path="/apply/:slug/:officer" element={<Apply />} />
          <Route path="/book/:slug" element={<Book />} />
          <Route path="/book/:slug/:officer" element={<Book />} />
          <Route path="/analyze/:slug" element={<Analyze />} />
          <Route path="/analyze/:slug/:officer" element={<Analyze />} />
          <Route path="/command" element={<CommandLayout />}>
            <Route index element={<CommandOverview />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenants/:id" element={<TenantDetail />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="legal" element={<LegalPages />} />
            <Route path="emails" element={<Emails />} />
          </Route>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pipeline" element={<LoanPipeline />} />
            <Route path="clients/:id" element={<ClientFile />} />
            <Route path="loans/:id" element={<LoanFile />} />
            <Route path="loans/:id/letter" element={<Letter />} />
            <Route path="applications" element={<Applications />} />
            <Route path="realtors" element={<Realtors />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="groups" element={<Groups />} />
            <Route path="clients" element={<Clients />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="email" element={<EmailDesk />} />
            <Route path="transcripts" element={<Transcripts />} />
            <Route path="phone" element={<Phone />} />
            <Route path="calculators" element={<Calculators />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="documents" element={<Documents />} />
            <Route path="compliance" element={<Compliance />} />
            <Route path="templates" element={<Templates />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="reminders/:id" element={<FlowDetailPage />} />
            <Route path="broadcasts" element={<Broadcasts />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="credit" element={<Credit />} />
            <Route path="reports" element={<Reports />} />
            <Route path="team" element={<Team />} />
            <Route path="billing" element={<Billing />} />
            <Route path="modules" element={<Modules />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="website" element={<Website />} />
            <Route path="letters" element={<Letters />} />
            <Route path="m/:code" element={<ModulePage />} />
          </Route>
          <Route path="/portal" element={<BorrowerLayout />}>
            <Route index element={<BorrowerHome />} />
          </Route>
          <Route path="/admin" element={<Navigate to="/command" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </Provider>
);

createRoot(document.getElementById("root")!).render(<App />);
