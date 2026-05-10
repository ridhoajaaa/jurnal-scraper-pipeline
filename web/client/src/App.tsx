import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "sonner";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

// Lazy load all pages — enables code splitting per route
const Landing = lazy(() => import("@/pages/Landing").then((m) => ({ default: m.Landing })));
const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Library = lazy(() => import("@/pages/Library").then((m) => ({ default: m.Library })));
const Profile = lazy(() => import("@/pages/Profile").then((m) => ({ default: m.Profile })));
const Stats = lazy(() => import("@/pages/Stats").then((m) => ({ default: m.Stats })));
const Help = lazy(() => import("@/pages/Help").then((m) => ({ default: m.Help })));
const AISummary = lazy(() => import("@/pages/AISummary").then((m) => ({ default: m.AISummary })));
const Admin = lazy(() => import("@/pages/Admin").then((m) => ({ default: m.Admin })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx client errors (401, 403, 400, 404, 409, etc.)
        if (typeof error === 'string') return false;
        const status = error?.response?.status || error?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

// Full-page skeleton shown while lazy chunks load
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-2 gap-4 pt-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Redirects non-admin users away from admin routes
function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

// Syncs isDark state → <html class="dark"> after every toggle
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmProvider>
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/library" element={<Library />} />
                <Route path="/aisummary" element={<AISummary />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/help" element={<Help />} />
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<Admin />} />
                </Route>
              </Route>
              
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster 
          position="bottom-right"
          gap={8}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: 'flex items-center gap-3 w-full px-4 py-3 rounded-xl border shadow-xl backdrop-blur-lg font-sans text-[14px] min-w-[320px] bg-white/95 dark:bg-[#111727]/95 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 shadow-black/10 dark:shadow-black/30',
              title: 'font-semibold text-[13px]',
              description: 'text-[11px] text-slate-500 dark:text-slate-400',
              success: '!border-emerald-500/30 !shadow-emerald-500/10 dark:!shadow-emerald-500/5',
              error: '!bg-red-50 dark:!bg-red-950/80 !border-red-500/50 !text-red-700 dark:!text-red-300',
              warning: '!border-amber-500/30 !shadow-amber-500/10 dark:!shadow-amber-500/5',
              info: '!border-indigo-500/30 !shadow-indigo-500/10 dark:!shadow-indigo-500/5',
              actionButton: 'bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg',
              cancelButton: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg',
            },
          }}
        />
        </ConfirmProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;