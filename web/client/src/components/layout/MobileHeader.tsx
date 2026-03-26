import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, HelpCircle, Sun, Moon, Shield, LogOut, User } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";

export function MobileHeader() {
  const { isDark, toggle } = useThemeStore();
  const { user } = useAuthStore();
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();
  const navigate = useNavigate();
  
  const isMainApp = ['/dashboard', '/library', '/aisummary', '/stats'].some(p => location.pathname.startsWith(p));
  const logoHref = isMainApp ? "/" : "/dashboard";

  const isProfile = location.pathname.startsWith('/profile');
  const isAdmin = location.pathname.startsWith('/admin');
  const isHelp = location.pathname.startsWith('/help');
  const isContentPage = isProfile || isAdmin || isHelp;

  return (
    <div className="md:hidden flex items-center justify-between px-5 py-3 bg-white/95 dark:bg-[#0a0f1e]/95 border-b border-slate-200 dark:border-[#1f2937] sticky top-0 z-40 transition-colors duration-300">
      {/* Kiri: Brand Logo */}
      <Link to={logoHref} className="flex items-center gap-2.5">
         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <BookOpen className="w-4.5 h-4.5 text-white" />
         </div>
         <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white">
           LitAssist
         </span>
      </Link>
      
      {/* Kanan: Actions */}
      <div className="flex items-center gap-3.5">
         <Link to="/help" className="flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors" title="Bantuan">
            <HelpCircle className="w-5 h-5" />
         </Link>

         <button onClick={toggle} className="flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
         </button>
         
         {isContentPage ? (
           <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors ml-1" title="Logout">
              <LogOut className="w-5 h-5" />
           </button>
         ) : (
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <button className="w-8 h-8 rounded-full bg-[#8b5cf6] flex items-center justify-center font-bold text-[11px] text-white uppercase shadow-[0_0_12px_rgba(139,92,246,0.5)] border border-violet-400/30 ml-1 outline-none">
                  A
               </button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" className="w-56 mt-2 bg-white dark:bg-[#0f1422] border-slate-200 dark:border-[#2d3748] rounded-2xl shadow-xl z-50 p-2 text-slate-900 dark:text-white">
               <div className="px-2 py-2 mb-1">
                   <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Signed in as</p>
                   <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{user?.username || "User"}</p>
               </div>
               
               <DropdownMenuSeparator className="bg-slate-100 dark:bg-[#1f2937] -mx-2 my-1" />
               
               <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-white/5 focus:bg-slate-100 dark:focus:bg-white/5 rounded-xl mt-1 text-slate-700 dark:text-slate-300">
                 <User className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                 <span className="font-medium text-[13px]">Profile</span>
               </DropdownMenuItem>
               
              <DropdownMenuItem asChild>
                <Link to="/help" className="flex items-center cursor-pointer py-2.5 px-3 hover:bg-slate-100 dark:hover:bg-white/5 focus:bg-slate-100 dark:focus:bg-white/5 rounded-xl text-slate-700 dark:text-slate-300">
                  <HelpCircle className="mr-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="font-medium text-[13px]">Help</span>
                </Link>
              </DropdownMenuItem>
              {user?.role === 'admin' && (
               <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer py-2.5 px-3 hover:bg-violet-50 dark:hover:bg-violet-500/10 focus:bg-violet-50 dark:focus:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-xl mb-1">
                 <Shield className="mr-3 h-4 w-4" />
                 <span className="font-medium text-[13px]">Admin Panel</span>
               </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-[#1f2937] -mx-2 my-1" />
              <DropdownMenuItem 
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="cursor-pointer py-2.5 px-3 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400 rounded-xl"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="font-medium text-[13px]">Log out</span>
              </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
         )}
      </div>
    </div>
  );
}
