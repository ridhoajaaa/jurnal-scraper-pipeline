import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import {
  User as UserIcon,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Crown,
  CreditCard,
  Mail,
  X,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile, useUpdateProfile, useActivatePremium } from "@/hooks/queries";
import { toast } from "sonner";

export function Profile() {
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const activatePremiumMutation = useActivatePremium();

  // States untuk Upgrade Premium
  const [tokenInput, setTokenInput] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // States untuk Pengaturan Akun
  const [editUsername, setEditUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  const [editPassword, setEditPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });

  const handleActivatePremium = () => {
    if (!tokenInput) return;
    setIsActivating(true);
    
    activatePremiumMutation.mutate(tokenInput, {
      onSuccess: (data: any) => {
        setIsActivating(false);
        if (data.success) {
          toast.success(data.message || "Selamat! Akun kamu sekarang Premium.");
          setTokenInput("");
        } else {
          toast.error(data.error || "Gagal mengaktifkan premium.");
        }
      },
      onError: (err: any) => {
        setIsActivating(false);
        toast.error(err?.response?.data?.error || "Validasi token gagal. Pastikan token benar.");
      }
    });
  };

  const handleSaveUsername = () => {
    if (!newUsername) return;
    updateProfileMutation.mutate({ username: newUsername }, {
      onSuccess: () => {
        toast.success("Username berhasil diubah!");
        setEditUsername(false);
      },
      onError: (err: any) => {
        toast.error(err as string || "Gagal mengubah username");
      }
    });
  };

  const handleSavePassword = () => {
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error("Password baru tidak cocok!");
      return;
    }
    updateProfileMutation.mutate({ 
      currentPassword: pwForm.current,
      newPassword: pwForm.newPw
    }, {
      onSuccess: () => {
        toast.success("Password berhasil diubah!");
        setEditPassword(false);
        setPwForm({ current: "", newPw: "", confirm: "" });
      },
      onError: (err: any) => {
        toast.error(err as string || "Gagal mengubah password");
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen pb-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </Layout>
    );
  }

  if (!profile) return null;

  // Fallback visual mocks for quota stats not reliably provided by backend yet
  const quotaLimit = profile.quotaLimit || 10;
  const quotaUsed = profile.quotaUsed || 0;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaExhausted = quotaRemaining === 0;
  const dailyLimit = profile.dailyLimit || 2;
  const dailyScrapedToday = profile.dailyScrapedToday || 0;

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto relative pb-32 md:pb-8">

        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">Profile</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Manage your account and subscription
            </p>
          </div>
        </div>

        {/* 1. HERO CARD (Identity) */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden transition-colors">
          {/* Background Glow */}
          <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none ${profile.role === 'admin' ? 'bg-red-500' : profile.role === 'premium' ? 'bg-violet-500' : 'bg-indigo-500'}`} />
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative">
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold shadow-lg ${
                profile.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-pink-600' : 
                profile.role === 'premium' ? 'bg-gradient-to-br from-violet-500 to-indigo-600' : 
                'bg-gradient-to-br from-indigo-500 to-blue-600'
              }`}>
                {profile.username?.charAt(0).toUpperCase() || "U"}
              </div>
              {profile.isEmailVerified && (
                <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-[#111727] flex items-center justify-center transition-colors">
                  <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate">{profile.username}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  profile.role === 'admin' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' : 
                  profile.role === 'premium' ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/20' : 
                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  {profile.role === 'admin' ? '⚡ Admin' : profile.role === 'premium' ? '✦ Premium' : 'Free'}
                </span>
              </div>
              {profile.email && <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/>{profile.email}</p>}
              {profile.createdAt && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Bergabung {new Date(profile.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            </div>
          </div>

          {!profile.isEmailVerified && profile.email && (
            <div className="mt-6 flex items-start md:items-center justify-between flex-col md:flex-row gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-500 dark:text-amber-400">Email belum diverifikasi</p>
                  <p className="text-[11px] text-amber-500/70 mt-0.5">Cek inbox atau folder spam kamu untuk memverifikasi.</p>
                </div>
              </div>
              <button className="text-xs font-bold text-amber-950 bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded-xl transition-all w-full md:w-auto shrink-0">
                Kirim Ulang
              </button>
            </div>
          )}
        </motion.div>

        {/* 2. QUOTA & PREMIUM SECTION */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Quota Card (Free Only) */}
          {profile.role === 'user' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> Quota Usage</h3>
                  {quotaExhausted && <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Habis</span>}
                </div>

                  <div className="space-y-5">
                    {/* Lifetime */}
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Total Lifetime</span>
                        <span className="font-bold text-slate-900 dark:text-white">{quotaUsed} / {quotaLimit}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-[#0d111f] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/50">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(quotaUsed / quotaLimit) * 100}%` }} className={`h-full rounded-full ${quotaExhausted ? 'bg-red-500' : quotaUsed >= quotaLimit * 0.7 ? 'bg-amber-500' : 'bg-indigo-500'}`} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">{quotaExhausted ? 'Quota habis. Upgrade untuk lanjut scraping.' : `Sisa ${quotaRemaining} jurnal tersedia.`}</p>
                    </div>

                    {/* Daily */}
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Limit Hari Ini</span>
                        <span className="font-bold text-slate-900 dark:text-white">{dailyScrapedToday} / {dailyLimit}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-[#0d111f] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/50">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(dailyScrapedToday / dailyLimit) * 100}%` }} className="h-full rounded-full bg-emerald-500" />
                      </div>
                    </div>
                  </div>
              </div>
            </motion.div>
          )}

          {/* Premium Status (Premium/Admin Only) && Light/Dark Contrast Fix */}
          {(profile.role === 'premium' || profile.role === 'admin') && (
             <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(139,92,246,0.1)] flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{profile.role === 'admin' ? '⚡ Admin — Full Access' : '✦ Premium — Lifetime Access'}</h3>
                  <p className="text-sm text-slate-600 dark:text-indigo-200/80">Scraping unlimited · AI Summary · Export Excel & BibTeX unlocked.</p>
                </div>
             </motion.div>
          )}

          {/* Activation Box (Free Only) */}
          {profile.role === 'user' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-colors">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2"><Crown className="w-4 h-4 text-amber-500 dark:text-amber-400"/> Aktivasi Premium</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Punya token aktivasi? Masukkan di bawah untuk langsung membuka semua fitur tanpa batas.</p>
                
                <div className="flex flex-col gap-3">
                  <Input 
                    placeholder="XXXX-XXXX-XXXX" 
                    value={tokenInput} 
                    onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                    className="h-12 bg-slate-50 dark:bg-[#0d111f] border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500 text-slate-900 dark:text-white font-mono tracking-[0.2em] text-center rounded-xl"
                  />
                  <button onClick={handleActivatePremium} disabled={!tokenInput || isActivating} className="h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center">
                    {isActivating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aktifkan Token'}
                  </button>
                </div>
              </div>

              <button onClick={() => setShowUpgradeModal(true)} className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-wider">
                <CreditCard className="w-4 h-4" /> Cara Upgrade
              </button>
            </motion.div>
          )}
        </div>

        {/* 3. ACCOUNT SETTINGS */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 shadow-xl transition-colors">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6"><Shield className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> Security & Settings</h3>

          <div className="space-y-6">
            {/* Username Section */}
            <div className="border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0d111f]/50 rounded-2xl overflow-hidden transition-all">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors" onClick={() => { setEditUsername(!editUsername); setNewUsername(profile.username); }}>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Username</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile.username}</p>
                </div>
                <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors">
                  {editUsername ? 'Batal' : 'Ubah'}
                </button>
              </div>
              <AnimatePresence>
                {editUsername && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-200 dark:border-slate-800/60 flex flex-col">
                    <div className="p-4 flex flex-col sm:flex-row gap-3">
                      <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="h-10 bg-white dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                      <button onClick={handleSaveUsername} disabled={updateProfileMutation.isPending || !newUsername || newUsername === profile.username} className="h-10 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shrink-0 flex items-center justify-center">
                        {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Password Section */}
            <div className="border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-[#0d111f]/50 rounded-2xl overflow-hidden transition-all">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors" onClick={() => setEditPassword(!editPassword)}>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Password</p>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">••••••••</p>
                </div>
                <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 bg-indigo-500/10 rounded-lg transition-colors">
                  {editPassword ? 'Batal' : 'Ubah'}
                </button>
              </div>
              <AnimatePresence>
                {editPassword && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-200 dark:border-slate-800/60">
                    <div className="p-4 space-y-3">
                      <Input type="password" placeholder="Password saat ini" value={pwForm.current} onChange={(e) => setPwForm({...pwForm, current: e.target.value})} className="h-10 bg-white dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                      <Input type="password" placeholder="Password baru (min. 6 karakter)" value={pwForm.newPw} onChange={(e) => setPwForm({...pwForm, newPw: e.target.value})} className="h-10 bg-white dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                      <Input type="password" placeholder="Konfirmasi password baru" value={pwForm.confirm} onChange={(e) => setPwForm({...pwForm, confirm: e.target.value})} className="h-10 bg-white dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                      <button onClick={handleSavePassword} disabled={updateProfileMutation.isPending || !pwForm.current || !pwForm.newPw || !pwForm.confirm} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center">
                        {updateProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Password Baru'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

      </div>

      {/* MODAL UPGRADE PREMIUM */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-slate-900/50 dark:bg-[#0a0f1e]/80 backdrop-blur-sm transition-colors" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white/95 dark:bg-[#111727]/95 backdrop-blur-2xl border border-slate-200 dark:border-indigo-500/30 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.15)] overflow-hidden transition-colors">
              <div className="px-6 pt-6 pb-5 border-b border-slate-200 dark:border-slate-800/60 flex justify-between items-center transition-colors">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-lg transition-colors">Upgrade ke Premium</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 transition-colors">Lifetime access · Bayar sekali</p>
                </div>
                <button onClick={() => setShowUpgradeModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-700 dark:text-white transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="px-6 py-6 space-y-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-500/30">1</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 transition-colors">Transfer ke rekening berikut</p>
                    <div className="p-3.5 bg-slate-50 dark:bg-[#0d111f] rounded-xl border border-slate-200 dark:border-slate-800/60 transition-colors">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bank BRI</p>
                      <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mb-0.5 tracking-wider">305101043353531</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">a/n Muhammad Ridha Alfarizi</p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-500/30">2</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1.5 transition-colors">Kirim bukti transfer via WhatsApp</p>
                    <a href="https://wa.me/6285932955397" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Chat Admin (+6285932955397)
                    </a>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-500/30">3</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-0.5 transition-colors">Terima Token</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Token aktivasi akan diberikan melalui WhatsApp setelah verifikasi.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <button onClick={() => setShowUpgradeModal(false)} className="w-full h-12 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-indigo-950 font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                  Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </Layout>
  );
}