import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { MobileHeader } from "./MobileHeader";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";
import { useProfile } from "@/hooks/queries";
import { useScrapeManager } from "@/hooks/useScrapeManager";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  const sidebarCollapsed = useThemeStore((s) => s.sidebarCollapsed);
  // Fetch profile on every page to sync role/username to authStore
  useProfile();
  // Global Scrape Manager handles background state & recovery
  useScrapeManager();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1e] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content — margin tracks sidebar width */}
      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64",
          "pb-20 md:pb-0",
          className
        )}
      >
        {children}
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}