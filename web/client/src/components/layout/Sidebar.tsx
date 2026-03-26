import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen, LayoutDashboard, Library, Sparkles, HelpCircle, Sun, Moon, LogOut, Shield, User, BarChart3, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useScrapeStore } from "@/stores/scrapeStore";
import { Loader2 } from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  isPro?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Library, label: "Library", href: "/library" },
  { icon: Sparkles, label: "AI Summary", href: "/aisummary", isPro: true },
  { icon: BarChart3, label: "Stats", href: "/stats" },
];

const secondaryNavItems: NavItem[] = [
  { icon: User, label: "Profile", href: "/profile" },
  { icon: HelpCircle, label: "Help", href: "/help" },
];

const adminNavItem: NavItem = { icon: Shield, label: "Admin", href: "/admin" };

export function Sidebar() {
  const location = useLocation();
  const { isDark, toggle, sidebarCollapsed, toggleSidebar } = useThemeStore();
  const { user } = useAuthStore();
  const { isScraping, scrapeProgress } = useScrapeStore();
  const logout = useAuthStore(state => state.logout);

  const isAdmin = user?.role === "admin";
  const visibleSecondaryItems = isAdmin
    ? [...secondaryNavItems, adminNavItem]
    : secondaryNavItems;

  const isActive = (href: string) => location.pathname === href;

  const isMainApp = ['/dashboard', '/library', '/aisummary', '/stats'].some(p => location.pathname.startsWith(p));
  const logoHref = isMainApp ? "/" : "/dashboard";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
        "bg-white dark:bg-[#0d111f] border-r border-slate-200 dark:border-[#1f2937] flex flex-col",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center relative overflow-hidden border-b border-slate-200 dark:border-[#1f2937]">
        {/* Expanded Content */}
        <div className={cn(
          "flex items-center justify-between w-full transition-all duration-300 absolute inset-0 px-4",
          sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <Link to={logoHref} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white whitespace-nowrap">LitAssist</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 shrink-0"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Collapsed Content */}
        <div className={cn(
          "flex items-center justify-center w-full transition-all duration-300 absolute inset-0",
          sidebarCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <button 
            onClick={toggleSidebar}
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/20"
            title="Expand Sidebar"
          >
            <BookOpen className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {mainNavItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start pl-3 pr-4 py-2 flex items-center text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-indigo-50 dark:bg-[#6366f1]/15 text-indigo-700 dark:text-[#a5b4fc] border-l-2 border-[#6366f1] hover:bg-indigo-100 dark:hover:bg-[#6366f1]/20 hover:text-indigo-800 dark:hover:text-[#c7d2fe]"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border-l-2 border-transparent"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className={cn(
                  "flex items-center justify-between overflow-hidden transition-all duration-300 whitespace-nowrap",
                  sidebarCollapsed ? "w-0 opacity-0" : "w-full opacity-100 ml-3"
                )}>
                  <span>{item.label}</span>
                  {item.isPro && (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-[4px] border border-indigo-500/20 ml-2">PRO</span>
                  )}
                </span>
              </Button>
            </Link>
          ))}
        </nav>

        {isScraping && (
          <div className={cn(
            "mx-2 mb-2 p-3 rounded-xl transition-all duration-300",
            "bg-indigo-500/5 border border-indigo-500/10 dark:bg-indigo-500/10 dark:border-indigo-500/20",
            sidebarCollapsed ? "px-0 flex flex-col items-center" : "px-3"
          )}>
            <div className={cn("flex items-center gap-2", !sidebarCollapsed && "mb-2")}>
              <Loader2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 animate-spin" />
              {!sidebarCollapsed && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Scraping Live</span>
              )}
            </div>
            
            {!sidebarCollapsed ? (
              <>
                <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-500" 
                    style={{ width: `${scrapeProgress.percentage}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 truncate font-medium">{scrapeProgress.message}</p>
              </>
            ) : (
                <div className="mt-1 text-[8px] font-bold text-indigo-500">{scrapeProgress.percentage}%</div>
            )}
          </div>
        )}

        <Separator className="my-4 bg-slate-200 dark:bg-[#1f2937]" />

        <nav className="space-y-1 px-2">
          {visibleSecondaryItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start pl-3 pr-4 py-2 flex items-center text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-l-2 border-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:text-indigo-300"
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border-l-2 border-transparent"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className={cn(
                  "overflow-hidden transition-all duration-300 whitespace-nowrap text-left",
                  sidebarCollapsed ? "w-0 opacity-0" : "w-full opacity-100 ml-3"
                )}>
                  {item.label}
                </span>
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-slate-200 dark:border-[#1f2937] p-2 space-y-1">
        <Button
          variant="ghost"
          onClick={toggle}
          className={cn(
            "w-full justify-start pl-3.5 pr-4 py-2 flex items-center text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          )}
        >
          {isDark ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
          <span className={cn(
            "overflow-hidden transition-all duration-300 whitespace-nowrap text-left",
            sidebarCollapsed ? "w-0 opacity-0" : "w-full opacity-100 ml-3"
          )}>
            {isDark ? "Light Mode" : "Dark Mode"}
          </span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className={cn(
            "w-full justify-start pl-3.5 pr-4 py-2 flex items-center text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={cn(
            "overflow-hidden transition-all duration-300 whitespace-nowrap text-left",
            sidebarCollapsed ? "w-0 opacity-0" : "w-full opacity-100 ml-3"
          )}>
            Logout
          </span>
        </Button>
      </div>
    </aside>
  );
}