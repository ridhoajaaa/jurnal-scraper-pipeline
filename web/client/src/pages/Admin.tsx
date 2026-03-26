import { useState } from "react";
import { Copy, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Users, BookOpen, Shield, Trash2, Key, CheckCircle2, ChevronUp, User, Loader2, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAdminUsers,
  useAdminJournals,
  useAdminDeleteUser,
  useAdminVerifyUser,
  useAdminPromoteUser,
  useAdminGenerateToken,
  useAdminDeleteJournal,
} from "@/hooks/queries";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useAuthStore } from "@/stores/authStore";

export function Admin() {
  const [activeTab, setActiveTab] = useState<"users" | "journals">("users");
  const { user: currentUser } = useAuthStore();
  const confirm = useConfirm();

  const [generatedToken, setGeneratedToken] = useState("");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  // Superadmin = admin@gmail.com — the highest role, only they can delete users
  const SUPERADMIN_EMAIL = "admin@gmail.com";
  const isSuperAdmin = currentUser?.email === SUPERADMIN_EMAIL;

  const { data: users = [], isLoading: usersLoading } = useAdminUsers();
  const { data: journals = [], isLoading: journalsLoading } = useAdminJournals();

  const deleteUserMutation = useAdminDeleteUser();
  const verifyUserMutation = useAdminVerifyUser();
  const promoteUserMutation = useAdminPromoteUser();
  const generateTokenMutation = useAdminGenerateToken();
  const deleteJournalMutation = useAdminDeleteJournal();

  const handleDeleteUser = async (id: string, username: string) => {
    if (!isSuperAdmin) {
      toast.error("Only Superadmin can delete users.");
      return;
    }
    const ok = await confirm({
      title: `Delete user "${username}"?`,
      description: "All their data (journals, notes, account) will be permanently deleted.",
      confirmText: "Delete User",
      variant: "danger",
    });
    if (ok) {
      deleteUserMutation.mutate(id, {
        onSuccess: () => toast.success("User deleted"),
        onError: () => toast.error("Failed to delete user"),
      });
    }
  };

  const handleVerify = (id: string) => {
    verifyUserMutation.mutate(id, {
      onSuccess: () => toast.success("Email verified"),
      onError: () => toast.error("Failed to verify"),
    });
  };

  const handleToken = (id: string) => {
    generateTokenMutation.mutate(id, {
      onSuccess: (data: any) => {
        setGeneratedToken(data.token || "");
        setIsTokenModalOpen(true);
        toast.success("Token generated successfully!");
      },
      onError: () => toast.error("Failed to generate token"),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Token copied to clipboard!");
  };

  const handlePromote = async (id: string, username: string) => {
    const ok = await confirm({
      title: `Promote "${username}" to Admin?`,
      description: "This user will gain full admin privileges.",
      confirmText: "Promote",
      variant: "warning",
    });
    if (ok) {
      promoteUserMutation.mutate(id, {
        onSuccess: () => toast.success("User promoted"),
        onError: () => toast.error("Failed to promote"),
      });
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const ok = await confirm({
      title: "Delete this journal?",
      description: "This journal entry will be permanently removed from the database.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) {
      deleteJournalMutation.mutate(id, {
        onSuccess: () => toast.success("Journal deleted"),
        onError: () => toast.error("Failed to delete journal"),
      });
    }
  };

  const fadeParams = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 }
  };

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-6xl mx-auto pb-32 md:pb-8 min-h-[calc(100vh-80px)]">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 transition-colors">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Admin</h1>
                  {isSuperAdmin && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase font-black tracking-widest bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                      <Crown className="w-3 h-3" /> Superadmin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manage litassist platform users and databases.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Custom Segmented Control Tab */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-[#0a0f1e] md:bg-white/80 md:dark:bg-[#111727]/80 rounded-xl w-fit border border-slate-200 dark:border-slate-800/60 shadow-sm transition-colors backdrop-blur-sm">
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'users' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" /> Users <span className="opacity-60 text-[10px]">({users.length})</span>
            </button>
            <button 
              onClick={() => setActiveTab('journals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'journals' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Journals <span className="opacity-60 text-[10px]">({journals.length})</span>
            </button>
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            
            {/* USERS TAB */}
            {activeTab === 'users' && (
              <motion.div key="users" {...fadeParams} className="space-y-4">
                
                {usersLoading && (
                  <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                )}

                {!usersLoading && (
                  <>
                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-3">
                      {users.map((user: any) => (
                        <div key={user._id} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/20 flex-shrink-0">
                                {user.username?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.username}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-widest ${
                              user.role === 'admin' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50' : 
                              user.role === 'premium' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50' : 
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            <span className="flex gap-1.5 items-center"><BookOpen className="w-3.5 h-3.5 text-indigo-500" /> <span className="font-bold text-slate-800 dark:text-slate-200">{user.journalCount || 0}</span> journals</span>
                            <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
                          </div>
                          
                          <div className="flex gap-2 flex-wrap">
                            {!user.isEmailVerified && (
                              <button onClick={() => handleVerify(user._id)} className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all bg-white dark:bg-transparent">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                              </button>
                            )}
                            {user.isEmailVerified && (
                              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-500 px-2 py-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                              </span>
                            )}
                            
                            {user.role !== 'admin' && (
                              <>
                                <button 
                                  disabled={user.role === 'premium' || user.hasActiveToken}
                                  onClick={() => handleToken(user._id)}
                                  className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                    (user.role === 'premium' || user.hasActiveToken) 
                                      ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50' 
                                      : 'text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 bg-white dark:bg-transparent'
                                  }`}
                                >
                                  <Key className="w-3.5 h-3.5" /> Token
                                </button>
                                <button onClick={() => handlePromote(user._id, user.username)} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all bg-white dark:bg-transparent">
                                  <ChevronUp className="w-3.5 h-3.5" /> Promote
                                </button>
                              </>
                            )}
                            
                            {/* Delete user — superadmin only */}
                            {isSuperAdmin && user.email !== SUPERADMIN_EMAIL && (
                              <button onClick={() => handleDeleteUser(user._id, user.username)} className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ml-auto bg-white dark:bg-transparent">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {users.length === 0 && <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">No users found.</div>}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm transition-colors">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/60 tracking-wider">
                              <th className="px-5 py-4">User</th>
                              <th className="px-5 py-4">Email</th>
                              <th className="px-5 py-4">Role</th>
                              <th className="px-5 py-4 text-center">Journals</th>
                              <th className="px-5 py-4">Joined</th>
                              <th className="px-5 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((user: any) => (
                              <tr key={user._id} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                      {user.username?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">{user.username}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">{user.email}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-widest ${
                                    user.role === 'admin' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50' : 
                                    user.role === 'premium' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50' : 
                                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/30">
                                    {user.journalCount || 0}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">
                                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex gap-2 justify-end">
                                    {!user.isEmailVerified && (
                                      <button onClick={() => handleVerify(user._id)} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                        Verify
                                      </button>
                                    )}
                                    {user.isEmailVerified && (
                                      <span className="flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-500 px-2.5 py-1.5 min-w-[56px] text-center">
                                        Verified
                                      </span>
                                    )}
                                    
                                    <button 
                                      disabled={user.role === 'admin' || user.role === 'premium' || user.hasActiveToken}
                                      onClick={() => handleToken(user._id)}
                                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                        (user.role === 'admin' || user.role === 'premium' || user.hasActiveToken) 
                                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' 
                                          : 'text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                                      }`}
                                    >
                                      Token
                                    </button>
                                    
                                    <button 
                                      disabled={user.role === 'admin'}
                                      onClick={() => handlePromote(user._id, user.username)}
                                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                        user.role === 'admin'
                                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                          : 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                      }`}
                                    >
                                      Promote
                                    </button>
                                    
                                    {/* Delete user — superadmin only */}
                                    {isSuperAdmin && user.email !== SUPERADMIN_EMAIL && (
                                      <button onClick={() => handleDeleteUser(user._id, user.username)} className="text-[10px] font-bold text-red-600 dark:text-red-400 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {users.length === 0 && <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">No users found.</div>}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* JOURNALS TAB */}
            {activeTab === 'journals' && (
              <motion.div key="journals" {...fadeParams} className="space-y-4">
                
                {journalsLoading && (
                  <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                )}

                {!journalsLoading && (
                  <>
                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-3">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Latest journals across system</p>
                      {journals.map((j: any) => (
                        <div key={j._id} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-relaxed flex-1">{j.judul}</p>
                            <button onClick={() => handleDeleteJournal(j._id)} className="text-[10px] font-bold text-red-600 dark:text-red-400 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 bg-white dark:bg-transparent flex justify-center items-center">
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-1.5">
                              <User className="w-3 h-3" /> {j.username || '-'}
                            </span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{j.source || '-'}</span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{j.tahun || '-'}</span>
                          </div>
                        </div>
                      ))}
                      {journals.length === 0 && <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">No journals found.</div>}
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm transition-colors">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Latest journals across system</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-slate-100/50 dark:bg-slate-900/50 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800/60">
                              <th className="px-5 py-3 w-[45%]">Title</th>
                              <th className="px-5 py-3">User</th>
                              <th className="px-5 py-3">Source</th>
                              <th className="px-5 py-3 text-center">Year</th>
                              <th className="px-5 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {journals.map((j: any) => (
                              <tr key={j._id} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                <td className="px-5 py-3.5">
                                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs line-clamp-2 max-w-sm leading-relaxed">{j.judul}</p>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded border border-indigo-200 dark:border-indigo-800/50 inline-block">
                                    {j.username || '-'}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="bg-slate-100 dark:bg-slate-800 font-medium px-2 py-1 rounded">{j.source || '-'}</span>
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 text-center font-bold">
                                  {j.tahun || '-'}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex justify-end">
                                    <button onClick={() => handleDeleteJournal(j._id)} className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-1.5">
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {journals.length === 0 && <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">No journals found.</div>}
                      </div>
                    </div>
                  </>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isTokenModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsTokenModalOpen(false)} 
              className="absolute inset-0 bg-slate-900/40 dark:bg-[#0a0f1e]/80 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="relative w-full max-w-md bg-white dark:bg-[#111727] border border-slate-200 dark:border-indigo-500/30 rounded-3xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <Key className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Access Token</h2>
                    <p className="text-[10px] font-bold text-violet-500/60 tracking-widest uppercase mt-0.5">Copy & Save Safely</p>
                  </div>
                </div>
                <button onClick={() => setIsTokenModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white flex items-center justify-center transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl break-all font-mono text-sm text-center text-slate-800 dark:text-indigo-400 shadow-inner">
                  {generatedToken}
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => copyToClipboard(generatedToken)}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
                  >
                    <Copy className="w-4 h-4" /> Copy Token
                  </button>
                  <button 
                    onClick={() => setIsTokenModalOpen(false)}
                    className="w-full py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>

                <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider leading-relaxed">
                  Warning: This token will not be shown again. <br/> Please copy it now.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
