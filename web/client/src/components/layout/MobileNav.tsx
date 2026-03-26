import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Library,
  BarChart3,
  Search,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useScrapeStore } from "@/stores/scrapeStore";

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isScraping } = useScrapeStore();

  const isContentPage = ['/profile', '/admin', '/help'].some(p => location.pathname.startsWith(p));

  if (isContentPage) {
    return (
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 md:hidden">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 px-6 py-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-[2rem] shadow-[0_8px_25px_rgba(139,92,246,0.4)] transition-transform active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={3} />
          <span className="text-[13px] tracking-wide">Back</span>
        </button>
      </div>
    );
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Jurnal", href: "/dashboard" }, // <-- Diubah di sini
    { icon: Library, label: "Library", href: "/library" },
    { icon: Search, label: "Scraper", href: "#scraper", isAction: true },
    { icon: BarChart3, label: "Stats", href: "/stats" },
    { icon: Sparkles, label: "AI", href: "/aisummary" },
  ];

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname !== "/dashboard") {
      navigate("/dashboard?action=scrape");
    } else {
      window.dispatchEvent(new Event("openScraperModal"));
    }
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 md:hidden">
      <nav className="flex items-center justify-between bg-white/95 dark:bg-[#161d2f]/95 backdrop-blur-xl border border-slate-200 dark:border-[#2d3748] rounded-[2rem] px-5 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)] w-full max-w-sm transition-colors duration-300">
        {navItems.map((item) => {
          const isActive = item.href === "/dashboard" 
            ? location.pathname === "/dashboard" 
            : location.pathname.startsWith(item.href);

          if (item.isAction) {
            return (
              <div key={item.label} className="relative -top-6 px-1 shrink-0">
                {isScraping && (
                  <div className="absolute inset-0 -top-1 rounded-full bg-indigo-500/50 animate-ping" />
                )}
                <button
                  onClick={handleSearchClick}
                  className={cn(
                    "relative w-14 h-14 rounded-full flex items-center justify-center text-white transition-all active:scale-95 z-10",
                    isScraping 
                      ? "bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)]" 
                      : "bg-[#8b5cf6] shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:bg-[#7c3aed]"
                  )}
                >
                  {isScraping ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <item.icon className="w-6 h-6" />
                  )}
                </button>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2 rounded-full transition-all duration-300",
                isActive
                  ? "bg-[#8b5cf6] text-white px-4 py-2.5 shadow-[0_4px_15px_rgba(139,92,246,0.3)]"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 p-2.5 bg-transparent"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <span className="text-[13px] font-bold whitespace-nowrap tracking-wide">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}