import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import {
  Search,
  Zap,
  X,
  ChevronDown,
  ExternalLink,
  Plus,
  CheckCircle2,
  Trash2,
  Quote,
  AlertTriangle,
  BookmarkPlus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";



import { socket } from "@/lib/socket";
import { 
  useJournals, 
  useDeleteJournals, 
  useStartScrape, 
  useSaveJournal 
} from "@/hooks/queries";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useScrapeStore } from "@/stores/scrapeStore";

const formatCitation = (journal: any, style: string) => {
  const author = journal.author_info || "Unknown Author";
  const year = journal.tahun || "n.d.";
  const title = journal.judul || "Untitled";
  const source = journal.source || "Unknown Source";
  const link = journal.link || "";

  switch (style) {
    case 'APA': return `${author} (${year}). ${title}. ${source}. ${link}`;
    case 'IEEE': return `[1] ${author}, "${title}," ${source}, ${year}. [Online]. Available: ${link}`;
    case 'CHICAGO': return `${author}. "${title}." ${source} (${year}). ${link}.`;
    default: return `${author} (${year}). ${title}. ${source}. ${link}`;
  }
};

export function Dashboard() {
  const { data: journals = [] } = useJournals();
  const deleteJournalsMutation = useDeleteJournals();
  const saveJournalMutation = useSaveJournal();
  const startScrapeMutation = useStartScrape();
  
  // States Modal Scraper
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [scrapeTopic, setScrapeTopic] = useState("");
  const [selectedSource, setSelectedSource] = useState("SCHOLAR");
  const [apiKey, setApiKey] = useState("");
  const [yearRange, setYearRange] = useState("2020+");
  const [yearFrom, setYearFrom] = useState("2020");
  const [yearTo, setYearTo] = useState("2026");
  const [targetCount, setTargetCount] = useState("10");
  const [clearExisting, setClearExisting] = useState(false);

  // Global Scraping State from Store
  const { 
    isScraping, 
    setIsScraping, 
    scrapeProgress, 
    setScrapeProgress, 
    captchaUrl, 
    setCaptchaUrl, 
    currentJobId, 
    setCurrentJobId 
  } = useScrapeStore();

  // States Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");

  // States List & Interaction
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [citationStyles, setCitationStyles] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localSavedIds, setLocalSavedIds] = useState<string[]>([]); // Optimistic UI track saved status
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle URL action parameter for global scraper button
  useEffect(() => {
    if (searchParams.get('action') === 'scrape') {
      setIsScraperOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Lock body scroll when scraper modal is open
  useEffect(() => {
    if (isScraperOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isScraperOpen]);

  useEffect(() => {
    const handleOpenModal = () => setIsScraperOpen(true);
    window.addEventListener('openScraperModal', handleOpenModal);
    return () => window.removeEventListener('openScraperModal', handleOpenModal);
  }, []);


  const uniqueYears = Array.from(new Set(journals.map(j => j.tahun))).filter(Boolean).sort((a,b) => Number(b)-Number(a));
  const uniqueSources = Array.from(new Set(journals.map(j => j.source))).filter(Boolean);

  let filteredJournals = journals.filter(j => 
    (j.judul?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (j.author_info?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );
  if (filterYear !== "ALL") filteredJournals = filteredJournals.filter(j => j.tahun === filterYear);
  if (filterSource !== "ALL") filteredJournals = filteredJournals.filter(j => j.source === filterSource);

  const isAllSelected = filteredJournals.length > 0 && selectedIds.length === filteredJournals.length;

  const toggleSelectAll = () => isAllSelected ? setSelectedIds([]) : setSelectedIds(filteredJournals.map(j => j._id));
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const confirm = useConfirm();

  const deleteSelected = async () => {
    const ok = await confirm({
      title: `Delete ${selectedIds.length} selected journal(s)?`,
      description: "This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) {
      deleteJournalsMutation.mutate(selectedIds, {
        onSuccess: () => setSelectedIds([])
      });
    }
  };

  const clearAllData = async () => {
    const ok = await confirm({
      title: "Delete ALL scraped journals?",
      description: "All scraped data will be permanently removed. This cannot be undone.",
      confirmText: "Delete All",
      variant: "danger",
    });
    if (ok) {
      deleteJournalsMutation.mutate(undefined, {
        onSuccess: () => setSelectedIds([])
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    if (!citationStyles[id]) setCitationStyles(prev => ({ ...prev, [id]: 'APA' }));
  };

  const handleSaveToLibrary = (journal: any) => {
    setLocalSavedIds(prev => [...prev, journal._id]);
    saveJournalMutation.mutate(journal, {
      onSuccess: () => toast.success("Saved to Library"),
      onError: () => {
        toast.error("Failed to save to Library");
        setLocalSavedIds(prev => prev.filter(id => id !== journal._id));
      }
    });
  };

  const startScrape = () => {
    if (!scrapeTopic) {
      toast.error("Please enter a topic or keyword.");
      return;
    }
    
    startScrapeMutation.mutate({
      keyword: scrapeTopic,
      source: selectedSource.toLowerCase() as any,
      yearFrom: yearFrom || undefined,
      yearTo: yearTo || undefined,
      target: targetCount ? Number(targetCount) : undefined,
      clearData: clearExisting,
      apiKey: selectedSource === "SCOPUS" ? apiKey : undefined
    }, {
      onSuccess: (data) => {
        if (data.jobId) {
          setCurrentJobId(data.jobId);
          setIsScraping(true);
          setScrapeProgress({ message: "Connecting to worker...", percentage: 0 });
          // Join the socket room for this job
          socket.emit("join-job", data.jobId);
          toast.success("Scrape job queued!");
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to start scraping.");
      }
    });
  };

  const handleCaptchaResume = () => {
    if (currentJobId) {
      socket.emit("captcha-resume", { jobId: currentJobId });
      setCaptchaUrl(null);
      toast.info("Resuming scrape...");
    }
  };

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-6xl mx-auto relative pb-32 md:pb-8">

        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 dark:from-white to-slate-500 dark:to-slate-400 tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              Latest Scraped Journals
            </p>
          </motion.div>
          
          {/* Start Scraping (Desktop Only) */}
          <button 
            onClick={() => setIsScraperOpen(true)}
            className="hidden md:flex h-11 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold text-sm transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Start Scraping
          </button>
        </div>

        {/* Command Bar (Filters & Search) - Compact Version */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 p-1.5 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-2xl backdrop-blur-md shadow-sm transition-colors duration-300 overflow-hidden w-full max-w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input 
              placeholder="Search results..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="h-9 w-full pl-9 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-500 text-sm focus-visible:ring-0 shadow-none font-medium" 
            />
          </div>
          
          <div className="w-full md:w-px h-px md:h-5 bg-slate-200 dark:bg-slate-700/60 my-0.5 md:my-0 flex-shrink-0" />
          
          <div className="flex items-center justify-between md:justify-end gap-2 px-1 md:px-0 w-full md:w-auto overflow-hidden">
            <div className="flex gap-2">
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="h-8 px-3 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg outline-none cursor-pointer transition-all">
                <option value="ALL">All Years</option>
                {uniqueYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="h-8 px-3 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg outline-none cursor-pointer transition-all">
                <option value="ALL">All Sources</option>
                {uniqueSources.map(src => <option key={src} value={src}>{src}</option>)}
              </select>
            </div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/30 px-2 py-1 rounded-md whitespace-nowrap border border-slate-200/50 dark:border-slate-700/30">{filteredJournals.length} results</span>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {journals.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all ${isAllSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 hover:border-indigo-400'}`}>
                {isAllSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <span className="text-xs font-medium text-slate-400">Select All</span>

              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: -10 }}
                    onClick={deleteSelected}
                    className="ml-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <button onClick={clearAllData} className="px-3 py-1.5 bg-white dark:bg-[#161d2f] hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/30 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear All Data
            </button>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid gap-2.5">
          {filteredJournals.length === 0 && journals.length > 0 && (
            <div className="text-center py-16 text-slate-500 text-sm">No results match your filters.</div>
          )}

          {journals.length === 0 && (
            <div className="text-center py-24 bg-slate-100/50 dark:bg-[#161d2f]/30 border border-slate-200 dark:border-slate-800/50 rounded-3xl border-dashed">
               <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
               <h3 className="text-base font-semibold text-slate-300 mb-1">No journals scraped yet</h3>
               <p className="text-xs text-slate-500">Hit Start Scraping to command AI to find papers.</p>
            </div>
          )}

          {filteredJournals.map((journal, index) => {
            const isSelected = selectedIds.includes(journal._id);
            const isExpanded = expandedId === journal._id;
            const isSaved = localSavedIds.includes(journal._id);

            return (
              <motion.div
                key={journal._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}
                className={`relative bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border rounded-xl transition-all duration-300 overflow-hidden w-full max-w-full ${isSelected ? 'border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.15)]' : 'border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                {/* Minimalist Top Meta */}
                <div className="flex justify-between items-center px-4 py-2.5 cursor-pointer" onClick={() => toggleExpand(journal._id)}>
                   <div className="flex items-center gap-2.5">
                      <div className="shrink-0" onClick={(e) => toggleSelect(journal._id, e)}>
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 hover:border-indigo-400'}`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 items-center max-w-full overflow-hidden">
                        {/* Source badge — color-coded */}
                        <span className={`text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded border ${
                          journal.source === 'Scopus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : journal.source === 'Semantic Scholar' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}>{journal.source || 'Google Scholar'}</span>
                        {/* Year badge — color-coded by era */}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          journal.tahun && parseInt(journal.tahun) >= 2020
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>{journal.tahun || 'N/A'}</span>
                        {/* Keyword badge */}
                        {journal.keyword && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">🔍 {journal.keyword}</span>}
                        {/* Citation count */}
                        {journal.citationCount > 0 && <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">📚 {journal.citationCount}</span>}
                        {/* Open Access badge */}
                        {journal.Akses && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          journal.Akses.includes('Open') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : journal.Akses.includes('Likely') ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>{journal.Akses}</span>}
                      </div>
                   </div>
                   <div className="text-slate-500 group-hover:text-white transition-colors shrink-0">
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDown className="w-4 h-4" /></motion.div>
                   </div>
                </div>

                {/* Main Card Body */}
                <div className="px-4 pb-3 cursor-pointer" onClick={() => toggleExpand(journal._id)}>
                  <h3 className="text-sm md:text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug pr-6 mb-1 break-words">{journal.judul}</h3>
                  <p className="text-[11px] text-slate-400 truncate">{journal.author_info}</p>
                  
                  {/* Relevance Metric — color-coded */}
                  {journal.Relevansi !== undefined && journal.Relevansi > 0 && (
                    <div className="flex items-center gap-2 mt-2 w-full max-w-[200px]">
                      <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          journal.Relevansi >= 70 ? 'bg-emerald-500' : journal.Relevansi >= 40 ? 'bg-amber-400' : 'bg-slate-400'
                        }`} style={{ width: `${journal.Relevansi}%` }} />
                      </div>
                      <span className={`text-[9px] font-bold ${
                        journal.Relevansi >= 70 ? 'text-emerald-500' : journal.Relevansi >= 40 ? 'text-amber-400' : 'text-slate-500'
                      }`}>{journal.Relevansi}% Match</span>
                    </div>
                  )}
                </div>

                {/* Sleek Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20 w-full">
                      <div className="p-3 sm:p-5 space-y-4 max-w-full overflow-hidden">

                        {/* Duplicate Warning */}
                        {/* Duplicate Warning */}
                        {journal.isDuplicateSuspect && (
                          <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 md:p-4 items-start">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-500 mb-0.5">{journal.isDuplicateSuspect}</p>
                              {journal.duplicateOf && <p className="text-[11px] text-amber-500/70 italic">Similar to: {journal.duplicateOf}</p>}
                            </div>
                          </div>
                        )}

                        {/* Category tags */}
                        {journal.Kategori && (
                          <div className="flex flex-wrap gap-1.5">
                            {journal.Kategori.split('|').map((cat, i) => (
                              <span key={i} className="text-[10px] font-semibold bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md text-slate-500">{cat.trim()}</span>
                            ))}
                          </div>
                        )}
                        
                        {/* Abstract */}
                        <div className="bg-white dark:bg-[#0d111f] rounded-xl border border-slate-200 dark:border-slate-800/60 p-4 md:p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Quote className="w-4 h-4 text-indigo-400" />
                              <span className="text-[10px] font-bold text-slate-400 tracking-wider">ABSTRACT</span>
                            </div>
                            {journal.link && (
                              <a href={journal.link} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors uppercase">
                                Source <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] md:text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal break-all sm:break-words overflow-hidden w-full">{journal.abstrak_lengkap || "No abstract provided."}</p>
                        </div>

                        {/* Citation & Save Action Row */}
                        <div className="grid md:grid-cols-2 gap-4">
                          
                          {/* Citation Generator */}
                          <div className="bg-white dark:bg-[#0d111f] rounded-xl border border-slate-200 dark:border-slate-800/60 p-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-slate-400 tracking-wider">CITATION</span>
                              <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                                {['APA', 'IEEE', 'CHICAGO'].map((style) => (
                                  <button key={style} onClick={() => setCitationStyles(p => ({...p, [journal._id]: style}))} className={`px-2.5 py-1 text-[9px] font-bold rounded-md transition-all uppercase ${citationStyles[journal._id] === style ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                                    {style}
                                  </button>
                                ))}
                              </div>
                            </div>
                             <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal mb-3 break-all sm:break-words overflow-hidden w-full">
                              {formatCitation(journal, citationStyles[journal._id] || 'APA')}
                            </p>
                            <button className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-[11px] font-semibold rounded-lg transition-colors">
                              Copy Citation
                            </button>
                          </div>

                          {/* Save to Library CTA */}
                          <div className="flex flex-col justify-end">
                            <button 
                              onClick={() => !isSaved && handleSaveToLibrary(journal)}
                              className={`w-full py-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border transition-all ${isSaved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default' : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
                            >
                              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                              {isSaved ? 'Saved to Library' : 'Save to Library'}
                            </button>
                          </div>

                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* PREMIUM SCRAPER MODAL (GLOW UP) */}
      <AnimatePresence>
        {isScraperOpen && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsScraperOpen(false)} className="absolute inset-0 bg-slate-900/50 dark:bg-[#0a0f1e]/80 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className={`relative w-full ${captchaUrl ? 'max-w-5xl' : 'max-w-lg'} bg-white/95 dark:bg-[#111727]/95 backdrop-blur-2xl border border-slate-200 dark:border-indigo-500/30 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.15)] p-6 md:p-8 overflow-hidden max-h-[90vh] overflow-y-auto scrollbar-hide transition-all duration-500 ease-in-out`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Search className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">AI Scraper</h2>
                    <p className="text-[10px] font-bold text-indigo-400/60 tracking-widest uppercase mt-0.5">Configure & Launch</p>
                  </div>
                </div>
                <button onClick={() => setIsScraperOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white flex items-center justify-center transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-6">
                
                {/* Topic / Keyword */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Topic / Keyword</label>
                  <Input placeholder="e.g. transformer models in NLP..." value={scrapeTopic} onChange={(e) => setScrapeTopic(e.target.value)} className="h-12 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:border-indigo-500 text-slate-900 dark:text-white rounded-xl placeholder:text-slate-400 dark:placeholder:text-slate-600 font-normal text-sm shadow-inner" />
                </div>
                
                {/* Source Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Data Source</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["SCHOLAR", "SEMANTIC", "SCOPUS"].map(src => (
                      <button key={src} onClick={() => setSelectedSource(src)} className={`h-11 rounded-xl text-xs font-bold tracking-wide transition-all ${selectedSource === src ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'}`}>{src}</button>
                    ))}
                  </div>
                </div>

                {/* API Key Input (Hanya untuk SCOPUS) */}
                <AnimatePresence>
                  {selectedSource === "SCOPUS" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                      <label className="text-[10px] font-bold text-amber-500 tracking-widest uppercase flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Scopus API Key Required</label>
                      <Input placeholder="Enter your valid API Key..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="h-12 bg-amber-950/20 border-amber-500/30 focus:border-amber-500 text-amber-100 rounded-xl placeholder:text-amber-500/50 font-mono text-xs shadow-inner" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Year Range */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Year Range</label><span className="text-[10px] font-bold text-indigo-400">{yearRange === 'ALL' ? 'All Years' : `${yearFrom} - ${yearTo}`}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {["3YR", "2020+", "ALL"].map(yr => (
                      <button key={yr} onClick={() => { setYearRange(yr); if(yr === '3YR'){ setYearFrom('2024'); setYearTo('2026'); } else if(yr === '2020+'){ setYearFrom('2020'); setYearTo('2026'); } else { setYearFrom(''); setYearTo(''); } }} className={`h-10 rounded-xl text-xs font-bold transition-all ${yearRange === yr ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'}`}>{yr}</button>
                    ))}
                  </div>
                  
                  {/* Custom Year Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">From</label>
                      <select value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} className="w-full h-11 px-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 text-slate-900 dark:text-white rounded-xl text-sm font-medium outline-none cursor-pointer appearance-none">
                        <option value="">Select Year</option>
                        {Array.from({ length: 17 }, (_, i) => 2010 + i).map(year => (
                          <option key={`from-${year}`} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">To</label>
                      <select value={yearTo} onChange={(e) => setYearTo(e.target.value)} className="w-full h-11 px-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 text-slate-900 dark:text-white rounded-xl text-sm font-medium outline-none cursor-pointer appearance-none">
                        <option value="">Select Year</option>
                        {Array.from({ length: 17 }, (_, i) => 2010 + i).map(year => (
                          <option key={`to-${year}`} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Target Limit & Toggle */}
                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Target Limit</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["10", "25", "50"].map(limit => (
                          <button key={limit} onClick={() => setTargetCount(limit)} className={`h-10 rounded-xl text-xs font-bold transition-all ${targetCount === limit ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'}`}>
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center pt-1">
                    <label className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.preventDefault(); setClearExisting(!clearExisting); }}>
                      <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-all ${clearExisting ? 'bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-white dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 group-hover:border-red-400'}`}>
                        {clearExisting && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase transition-colors ${clearExisting ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'}`}>Clear Old Data</span>
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                {!isScraping ? (
                  <button onClick={startScrape} disabled={startScrapeMutation.isPending} className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-indigo-950 rounded-2xl font-bold text-base transition-all shadow-md dark:shadow-[0_0_30px_rgba(255,255,255,0.15)] dark:hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] mt-6 tracking-wide">
                    {startScrapeMutation.isPending ? "Starting..." : "Start Scraping"}
                  </button>
                ) : (
                  <div className="mt-6 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Scraping in progress...</span>
                       <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{scrapeProgress.percentage}%</span>
                    </div>
                    
                    <div className="h-2 w-full bg-indigo-200 dark:bg-indigo-950/50 rounded-full overflow-hidden mb-2">
                       <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${scrapeProgress.percentage}%` }} />
                    </div>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 text-center">{scrapeProgress.message}</p>
                    
                    {captchaUrl && (
                      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">CAPTCHA Terdeteksi — Selesaikan untuk Lanjut</p>
                        </div>
                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
                          Anda sedang melihat <strong>Live Browser</strong> di server. Silakan klik kotak centang atau selesaikan puzzle gambar di bawah ini secara langsung. Setelah berhasil (browser mulai memuat ulang atau mencari otomatis), klik tombol <strong>Sudah Selesai</strong>.
                        </p>
                        {/* noVNC Interactive Iframe - Larger Scaling */}
                        <div className="rounded-lg overflow-hidden border border-amber-300 dark:border-amber-500/30 bg-[#282828] relative shadow-2xl" style={{ paddingTop: '42.85%' /* 21:9 Aspect Ratio for better focus */ }}>
                          <iframe 
                            src="/novnc/vnc.html?autoconnect=true&resize=scale&path=novnc-ws"
                            title="Live Browser - Captcha Resolution"
                            className="absolute top-0 left-0 w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                          />
                        </div>

                        {/* Static Screenshot Fallback */}
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-bold text-amber-600/60 dark:text-amber-400/50 uppercase tracking-tighter">Backup Screenshot (Static)</p>
                          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-black/20">
                            <img 
                              src={captchaUrl.startsWith('data:') ? captchaUrl : `data:image/jpeg;base64,${captchaUrl}`}
                              alt="Captcha Screenshot"
                              className="w-full h-auto object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <button onClick={handleCaptchaResume} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-center rounded-lg text-xs font-bold transition-colors shadow-sm">
                            Saya Sudah Selesaikan Captcha
                          </button>
                          <button onClick={() => { setCaptchaUrl(null); }} className="flex-1 py-2.5 bg-transparent text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-center rounded-lg text-xs font-bold transition-colors border border-amber-300 dark:border-amber-500/30">
                            Sembunyikan Panel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}