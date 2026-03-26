import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  FileText,
  Copy,
  BookMarked,
  Wand2,
  AlertTriangle,
  Check,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSavedJournals, useGenerateSummary, useProfile } from "@/hooks/queries";
import { toast } from "sonner";

export function AISummary() {
  const { data: profile } = useProfile();
  const { data: savedData = [], isLoading: savedLoading } = useSavedJournals();
  const generateMutation = useGenerateSummary();

  const isPremium = profile?.role === "premium" || profile?.role === "admin";

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summaryLang, setSummaryLang] = useState<"id" | "en">("id");
  const [summaryResult, setSummaryResult] = useState<{ summary: string; journalCount: number; fetchedCount: number } | null>(null);
  const [summaryError, setSummaryError] = useState("");
  
  // Action Feedback States
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // --- Handlers ---
  const handleToggleSelectAll = () => {
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(savedData.slice(0, 15).map((j: any) => j._id));
    }
  };

  const handleToggleJournal = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      if (selectedIds.length < 15) {
        setSelectedIds(prev => [...prev, id]);
      } else {
        toast.warning("Max 15 journals for AI summary generation!");
      }
    }
  };

  const handleGenerate = () => {
    if (selectedIds.length === 0) return;
    setSummaryResult(null);
    setSummaryError("");
    setIsSaved(false);
    setIsCopied(false);

    generateMutation.mutate(
      { journalIds: selectedIds, language: summaryLang },
      {
        onSuccess: (data: any) => {
          setSummaryResult({
            journalCount: data.journalCount || selectedIds.length,
            fetchedCount: data.fetchedCount || selectedIds.length,
            summary: data.summary || "No summary generated.",
          });
        },
        onError: (err: any) => {
          setSummaryError(err?.message || "Failed to generate summary.");
        },
      }
    );
  };

  const copyToClipboard = () => {
    if (summaryResult?.summary) {
      navigator.clipboard.writeText(summaryResult.summary);
      setIsCopied(true);
      toast.success("Summary copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const saveToLibraryAsNote = () => {
    // TODO: implement actual save-as-note endpoint if available
    setIsSaved(true);
    toast.success("Summary saved!");
  };

  // --- Render Functions ---

  if (!isPremium) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center p-6 h-[calc(100vh-80px)]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">Premium Feature</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">AI Summary is only available for Premium users. Upgrade to unlock unlimited AI-powered literature summaries directly reading full textual abstracts.</p>
            <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/30">
              Upgrade to Premium
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-4xl mx-auto pb-32 md:pb-8 min-h-[calc(100vh-80px)]">
        
        {/* Modern Premium Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 transition-colors">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 mb-1.5">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">AI Summary</h1>
              <span className="px-2 py-0.5 text-[9px] uppercase font-black tracking-widest bg-violet-500/10 text-violet-400 rounded-full border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">Premium</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Generate literature review instan dari perpustakaan jurnal Anda.</p>
          </motion.div>
        </div>

        {/* Step 1: Journal Selection */}
        <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Pilih Jurnal dari Library
            </h2>
            <div className="flex items-center gap-4">
              <span className={`text-[10px] font-bold ${selectedIds.length > 0 ? "text-violet-400" : "text-slate-500"}`}>
                {selectedIds.length} / 15 Terpilih
              </span>
              {savedData.length > 0 && (
                <button
                  onClick={handleToggleSelectAll}
                  className="text-[10px] font-bold text-slate-400 hover:text-violet-400 transition-colors bg-slate-100 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/30"
                >
                  {selectedIds.length > 0 ? "Clear All" : "Select First 15"}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-2.5 overflow-hidden shadow-sm shadow-black/5 dark:shadow-black/20 transition-colors duration-300">
            {savedLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : savedData.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <BookMarked className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Library kosong. Simpan beberapa jurnal terlebih dahulu.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {savedData.map((item: any) => {
                  const isChecked = selectedIds.includes(item._id);
                  return (
                    <div
                      key={item._id}
                      onClick={() => handleToggleJournal(item._id)}
                      className={`flex gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-all duration-200 group ${
                        isChecked
                          ? "bg-violet-500/10 border-violet-500/40"
                          : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      {/* Custom Checkbox */}
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
                        isChecked ? "bg-violet-500 border-violet-500" : "border-slate-600"
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate transition-colors ${isChecked ? "text-violet-600 dark:text-violet-100" : "text-slate-700 dark:text-slate-300"}`}>
                          {item.judul}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate flex gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-400">{item.author_info}</span>
                          <span>·</span>
                          <span>{item.tahun || "n.d."}</span>
                        </p>
                      </div>

                      {item.Relevansi > 0 && (
                        <div className="shrink-0 pt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                            item.Relevansi >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                          }`}>
                            {item.Relevansi}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>

        <div className="grid md:grid-cols-[1fr_2fr] gap-4">
          {/* Step 2: Language Selection */}
          <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-2.5">
             <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 px-1">
                Bahasa Sintesis
             </h2>
             <div className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-2 flex gap-1.5 shadow-sm shadow-black/5 dark:shadow-black/20 transition-colors">
               <button 
                 onClick={() => setSummaryLang("id")}
                 className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                   summaryLang === "id" 
                     ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                     : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                 }`}
               >
                 Indonesia
               </button>
               <button 
                 onClick={() => setSummaryLang("en")}
                 className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all border ${
                   summaryLang === "en" 
                     ? "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                     : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                 }`}
               >
                 English
               </button>
             </div>
          </motion.section>

          {/* Step 3: Trigger Generate */}
          <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2.5">
             <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 px-1">
                Eksekusi Gemini AI
             </h2>
             <button
               onClick={handleGenerate}
               disabled={generateMutation.isPending || selectedIds.length === 0}
               className={`relative w-full overflow-hidden h-11 md:h-[50px] rounded-xl text-[11px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${
                 generateMutation.isPending || selectedIds.length === 0
                   ? "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed"
                   : "bg-indigo-600 dark:bg-white text-white dark:text-indigo-950 border border-indigo-600 dark:border-white hover:bg-indigo-700 dark:hover:bg-indigo-50 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] shadow-[0_0_15px_rgba(79,70,229,0.3)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] cursor-pointer"
               }`}
             >
               {/* Background sweep animation when active */}
               {!generateMutation.isPending && selectedIds.length > 0 && (
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-[200%] animate-[shimmer_2s_infinite]"></div>
               )}

               <AnimatePresence mode="wait">
                 {generateMutation.isPending ? (
                   <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-indigo-400">
                     <div className="w-4 h-4 border-2 border-indigo-400 border-t-white rounded-full animate-spin" /> Sedang Mengolah...
                   </motion.div>
                 ) : selectedIds.length === 0 ? (
                   <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                     Silakan Pilih Jurnal Dahulu
                   </motion.div>
                 ) : (
                   <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 z-10">
                     <Wand2 className="w-5 h-5 text-indigo-600 drop-shadow-md" /> Generate Summary
                   </motion.div>
                 )}
               </AnimatePresence>
             </button>
          </motion.section>
        </div>

        {/* --- ERROR STATE --- */}
        <AnimatePresence>
          {summaryError && !generateMutation.isPending && (
             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
               <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-4">
                 <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                 <div>
                   <h4 className="text-sm font-bold text-red-400 mb-1">Gagal Generate</h4>
                   <p className="text-xs text-red-300/80 leading-relaxed">{summaryError}</p>
                 </div>
               </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* --- LOADING SHIMMER SKELETON --- */}
        <AnimatePresence>
          {generateMutation.isPending && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mt-8 bg-white/50 dark:bg-[#111727]/50 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-6 md:p-8 backdrop-blur-md transition-colors">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                   <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                 </div>
                 <div>
                   <h3 className="text-sm md:text-base font-bold text-violet-300">Menyusun Tinjauan Pustaka...</h3>
                   <p className="text-xs text-slate-500">Membaca dan menganalisis {selectedIds.length} abstrak jurnal.</p>
                 </div>
              </div>

              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div 
                    key={i} 
                    className="h-3 md:h-4 bg-slate-200 dark:bg-slate-800/80 rounded animate-pulse"
                    style={{ 
                      width: i % 3 === 0 ? "80%" : i % 5 === 0 ? "60%" : "100%",
                      animationDelay: `${i * 0.15}s`
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- RESULT AREA --- */}
        <AnimatePresence>
           {summaryResult && !generateMutation.isPending && (
             <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="pt-2">
                <div className="bg-white/90 dark:bg-[#111727]/90 backdrop-blur-xl border border-violet-500/20 rounded-3xl overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.3)] relative transition-colors">
                  
                  {/* Decorative glowing orb */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>

                  <div className="px-6 py-6 md:px-8 md:py-8">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                           <FileText className="w-5 h-5 text-violet-400" />
                         </div>
                         <div>
                           <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">AI Synthesis Result</h2>
                           <p className="text-[11px] text-slate-400 mt-0.5">Berhasil membaca {summaryResult.fetchedCount} dari {summaryResult.journalCount} dokumen.</p>
                         </div>
                       </div>
                       
                       {/* Premium Action Buttons */}
                       <div className="flex gap-2 min-w-max">
                          <button 
                            onClick={saveToLibraryAsNote}
                            disabled={isSaved}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                              isSaved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                            }`}
                          >
                            {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <BookMarked className="w-4 h-4" />}
                            {isSaved ? "Tersimpan" : "Save to Library"}
                          </button>
                          
                          <button 
                            onClick={copyToClipboard}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all border ${
                              isCopied ? "bg-emerald-500 text-white border-emerald-500" : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                            }`}
                          >
                            {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {isCopied ? "Disalin!" : "Copy Summary"}
                          </button>
                       </div>
                     </div>

                     {/* The Markdown Text */}
                     <div className="prose prose-invert prose-violet max-w-none text-slate-700 dark:text-slate-300 font-sans text-[13px] md:text-sm leading-8 whitespace-pre-wrap">
                       {summaryResult.summary.split('\n').map((line, idx) => {
                         if (line.startsWith('### ')) return <h3 key={idx} className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">{line.replace('### ', '')}</h3>;
                         if (line.startsWith('**') && line.endsWith('**')) return <p key={idx} className="text-base font-bold text-violet-700 dark:text-violet-200 mt-6 mb-2">{line.replace(/\*\*/g, '')}</p>;
                         if (line.startsWith('---')) return <hr key={idx} className="border-slate-200 dark:border-slate-800 my-8" />;
                         const processed = line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((chunk, cidx) => {
                            if (chunk.startsWith('**')) return <strong key={cidx} className="text-slate-900 dark:text-white">{chunk.replace(/\*\*/g, '')}</strong>;
                            if (chunk.startsWith('*')) return <em key={cidx} className="text-violet-300 font-medium not-italic">{chunk.replace(/\*/g, '')}</em>;
                            return chunk;
                         });
                         return <p key={idx} className="mb-4">{processed}</p>;
                       })}
                     </div>
                  </div>
                </div>
             </motion.div>
           )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
