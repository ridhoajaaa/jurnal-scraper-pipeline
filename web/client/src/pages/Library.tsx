import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import {
  Search, ExternalLink, ChevronDown, Download,
  Trash2, CheckCircle2, FileSpreadsheet, FileText, Quote
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useSavedJournals, 
  useDeleteSavedJournal, 
  useUpdateSavedNote 
} from "@/hooks/queries";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmDialog";

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

export function Library() {
  const { data: journals = [] } = useSavedJournals();
  const deleteMutation = useDeleteSavedJournal();
  const updateNoteMutation = useUpdateSavedNote();

  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("savedAt");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [citationStyles, setCitationStyles] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState("");

  const uniqueYears = Array.from(new Set(journals.map(j => j.tahun))).filter(Boolean).sort((a,b) => Number(b)-Number(a));
  const uniqueSources = Array.from(new Set(journals.map(j => j.source))).filter(Boolean);

  let filteredJournals = journals.filter(j => 
    (j.judul?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (j.author_info?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );
  if (yearFilter !== "ALL") filteredJournals = filteredJournals.filter(j => j.tahun === yearFilter);
  if (sourceFilter !== "ALL") filteredJournals = filteredJournals.filter(j => j.source === sourceFilter);
  
  filteredJournals.sort((a, b) => {
    if (sortBy === "savedAt") return new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime();
    if (sortBy === "matchScore") return (b.Relevansi || 0) - (a.Relevansi || 0);
    if (sortBy === "citations") return (b.citationCount || 0) - (a.citationCount || 0);
    if (sortBy === "tahun_desc") return Number(b.tahun || 0) - Number(a.tahun || 0);
    if (sortBy === "tahun_asc") return Number(a.tahun || 0) - Number(b.tahun || 0);
    return 0;
  });

  const isAllSelected = filteredJournals.length > 0 && selectedIds.length === filteredJournals.length;

  const toggleSelectAll = () => isAllSelected ? setSelectedIds([]) : setSelectedIds(filteredJournals.map(j => j._id));
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    if (!citationStyles[id]) setCitationStyles(prev => ({ ...prev, [id]: 'APA' }));
    setEditingNoteId(null);
  };

  const startEditingNote = (id: string, currentNote?: string) => {
    setEditingNoteId(id);
    setTempNoteText(currentNote || "");
  };

  const saveNote = (id: string) => {
    updateNoteMutation.mutate({ id, note: tempNoteText }, {
      onSuccess: () => {
        toast.success("Note updated");
        setEditingNoteId(null);
      },
      onError: () => toast.error("Failed to update note")
    });
  };

  const confirm = useConfirm();

  const deleteSingle = async (id: string) => {
    const ok = await confirm({
      title: "Remove from library?",
      description: "This journal will be removed from your saved collection.",
      confirmText: "Remove",
      variant: "danger",
    });
    if (ok) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Journal removed");
          setSelectedIds(prev => prev.filter(i => i !== id));
        }
      });
    }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: `Delete ${selectedIds.length} selected journals?`,
      description: "They will be removed from your library permanently.",
      confirmText: "Delete All",
      variant: "danger",
    });
    if (ok) {
      selectedIds.forEach(id => deleteMutation.mutate(id));
      setSelectedIds([]);
      toast.success(`Removed journals`);
    }
  };

  // --- Export functions (match static library.html) ---
  const getExportData = () => {
    if (selectedIds.length > 0) return filteredJournals.filter(j => selectedIds.includes(j._id));
    return filteredJournals;
  };

  const exportXLSX = () => {
    const data = getExportData();
    if (!data.length) return;
    const cols = ['Title','Authors','Year','Source','Category','Relevance (%)','Citations','Access','Keyword','Abstract','Link','Duplicate Suspect','Saved At','Note'];
    const rows = data.map(j => [
      j.judul || '',
      (j.author_info || '').replace(/,/g, ';'),
      j.tahun || '',
      j.source || '',
      j.Kategori || '',
      j.Relevansi != null ? j.Relevansi.toFixed(1) : '',
      j.citationCount || 0,
      j.Akses || '',
      j.keyword || '',
      (j.abstrak_lengkap || '').replace(/\n/g, ' ').replace(/,/g, ';').substring(0, 500),
      j.link || '',
      j.isDuplicateSuspect ? 'Yes' : 'No',
      j.savedAt ? new Date(j.savedAt).toLocaleDateString('id-ID') : '',
      (j.note || '').replace(/,/g, ';'),
    ]);
    const escape = (v: any) => String(v).replace(/"/g, '""');
    const csv = '\uFEFF' + [cols, ...rows].map(r => r.map(v => '"' + escape(v) + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'litassist-library-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} journals as Excel CSV`);
    setIsExportOpen(false);
  };

  const exportBibTeX = () => {
    const data = getExportData();
    if (!data.length) return;
    const slugify = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const entries = data.map((j, i) => {
      const firstAuthor = (j.author_info || 'Unknown').split(/[,-]/)[0].trim().split(' ').pop() || 'Unknown';
      const year = j.tahun || new Date().getFullYear().toString();
      const key = slugify(firstAuthor) + year + '_' + (i+1);
      const type = j.isBook ? 'book' : 'article';
      const lines = [
        '@' + type + '{' + key + ',',
        '  title     = {' + (j.judul || '').replace(/[{}]/g, '') + '},',
        '  author    = {' + (j.author_info || 'Unknown').replace(/&/g, 'and') + '},',
        '  year      = {' + year + '},',
      ];
      if (!j.isBook) lines.push('  journal   = {' + (j.journal || j.source || 'Unknown') + '},');
      else lines.push('  publisher = {' + (j.journal || j.source || 'Unknown') + '},');
      if (j.link) lines.push('  url       = {' + j.link + '},');
      if (j.abstrak_lengkap) lines.push('  abstract  = {' + j.abstrak_lengkap.replace(/[{}]/g, '').substring(0, 400) + '},');
      if (j.keyword) lines.push('  keywords  = {' + j.keyword + '},');
      lines.push('  note      = {Relevance: ' + (j.Relevansi != null ? j.Relevansi.toFixed(1) : 'N/A') + '%}');
      lines.push('}');
      return lines.join('\n');
    });
    const date = new Date().toLocaleDateString('id-ID');
    const bibtex = '% LitAssist Library Export — ' + date + '\n% Total: ' + data.length + ' entries\n\n' + entries.join('\n\n');
    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'litassist-library-' + new Date().toISOString().slice(0,10) + '.bib';
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} entries as BibTeX`);
    setIsExportOpen(false);
  };

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-6xl mx-auto relative pb-32 md:pb-8">

        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 dark:from-white to-slate-500 dark:to-slate-400 tracking-tight">Library</h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              {journals.length} curated journals
            </p>
          </motion.div>
        </div>

        {/* Modern Command Bar (Filters) */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 p-1 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl backdrop-blur-md transition-colors duration-300">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input placeholder="Search authors, titles, tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-full pl-9 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-500 text-xs focus-visible:ring-0 shadow-none" />
          </div>
          <div className="w-px bg-slate-800/60 hidden md:block my-1.5" />
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide px-1.5 items-center">
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="h-7 px-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border-none text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-md outline-none cursor-pointer transition-colors">
              <option value="ALL">All Years</option>
              {uniqueYears.map(yr => <option key={yr as string} value={yr as string}>{yr}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-7 px-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border-none text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-md outline-none cursor-pointer transition-colors">
              <option value="ALL">All Sources</option>
              {uniqueSources.map(src => <option key={src as string} value={src as string}>{src}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-7 px-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border-none text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-md outline-none cursor-pointer transition-colors">
              <option value="savedAt">Latest Saved</option>
              <option value="matchScore">Top Quality</option>
              <option value="citations">Most Cited</option>
              <option value="tahun_desc">Year ↓</option>
              <option value="tahun_asc">Year ↑</option>
            </select>
          </div>
        </div>

        {/* Clean Header Row for Selection */}
        {filteredJournals.length > 0 && (
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all ${isAllSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 hover:border-indigo-400'}`}>
                {isAllSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <span className="text-xs font-medium text-slate-400">Select All</span>
            </div>
            
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full text-xs font-semibold flex items-center gap-2 border border-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                  </motion.button>
                )}
              </AnimatePresence>

              <div className="relative">
                <button onClick={() => setIsExportOpen(!isExportOpen)} disabled={filteredJournals.length === 0} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-full transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50">
                  <Download className="w-4 h-4" /> Export
                </button>
                <AnimatePresence>
                  {isExportOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-11 w-48 bg-white/95 dark:bg-[#161d2f]/95 backdrop-blur-xl border border-slate-200 dark:border-indigo-500/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <button onClick={exportXLSX} className="w-full flex items-center gap-3 px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-white transition-all text-left border-b border-slate-100 dark:border-slate-800/50">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> <div><p className="font-semibold">Excel (.xlsx)</p><p className="text-[10px] text-slate-400">Tabel data jurnal</p></div>
                        </button>
                        <button onClick={exportBibTeX} className="w-full flex items-center gap-3 px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-white transition-all text-left">
                          <FileText className="w-4 h-4 text-blue-400" /> <div><p className="font-semibold">BibTeX (.bib)</p><p className="text-[10px] text-slate-400">Untuk Mendeley / Zotero</p></div>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid gap-2.5">
          {filteredJournals.length === 0 && journals.length > 0 && (
            <div className="text-center py-16 text-slate-500 text-sm">No results match your filters.</div>
          )}

          {journals.length === 0 && (
            <div className="text-center py-24 bg-slate-100/50 dark:bg-[#161d2f]/30 border border-slate-200 dark:border-slate-800/50 rounded-3xl border-dashed">
               <h3 className="text-base font-semibold text-slate-300 mb-1">Your library is empty</h3>
               <p className="text-xs text-slate-500">Go to Dashboard to scrape and save journals to your library.</p>
            </div>
          )}

          {filteredJournals.map((journal, index) => {
            const isSelected = selectedIds.includes(journal._id);
            const isExpanded = expandedId === journal._id;
            const isEditingNote = editingNoteId === journal._id;

            return (
              <motion.div
                key={journal._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}
                className={`relative bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border rounded-xl transition-all duration-300 ${isSelected ? 'border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.15)]' : 'border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                {/* Minimalist Top Meta */}
                <div className="flex justify-between items-center px-4 py-2.5 cursor-pointer" onClick={() => toggleExpand(journal._id)}>
                   <div className="flex items-center gap-2.5">
                      <div className="shrink-0" onClick={(e) => toggleSelect(journal._id, e)}>
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 hover:border-indigo-400'}`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {/* Source badge — color-coded */}
                        <span className={`text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded border ${
                          journal.source === 'Scopus' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : journal.source === 'Semantic Scholar' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}>{journal.source || 'Google Scholar'}</span>
                        {/* Year badge — color-coded by era */}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          journal.tahun && parseInt(journal.tahun as string) >= 2020
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>{journal.tahun || 'N/A'}</span>
                        {/* Citation count */}
                        {journal.citationCount > 0 && <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">📚 {journal.citationCount}</span>}
                        {/* Relevance % badge */}
                        {journal.Relevansi > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">⭐ {journal.Relevansi}%</span>}
                      </div>
                   </div>
                   <div className="text-slate-500 group-hover:text-white transition-colors">
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}><ChevronDown className="w-4 h-4" /></motion.div>
                   </div>
                </div>

                {/* Main Card Body */}
                <div className="px-4 pb-3 cursor-pointer" onClick={() => toggleExpand(journal._id)}>
                  <h3 className="text-sm md:text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug pr-6 mb-1">{journal.judul}</h3>
                  <p className="text-[11px] text-slate-400 truncate">{journal.author_info}</p>
                  
                  {/* Badges Flow */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5 mb-1.5">
                    {journal.note && <span className="px-1.5 py-0.5 rounded text-amber-400 text-[9px] font-bold border border-amber-500/20 bg-amber-500/10">📝 Note</span>}
                    {/* Open Access badge */}
                    {journal.Akses && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      journal.Akses.includes('Open') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : journal.Akses.includes('Likely') ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>{journal.Akses}</span>}
                  </div>
                  </div>

                {/* Sleek Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20">
                      <div className="p-5 space-y-5">
                        
                        <div className="grid md:grid-cols-2 gap-5">
                          {/* Left Col: Abstract & Citation */}
                          <div className="space-y-5">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Quote className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-bold text-slate-400 tracking-wider">ABSTRACT</span>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-[#0d111f] p-4 rounded-xl border border-slate-200 dark:border-slate-800/60">{journal.abstrak_lengkap || "No abstract provided."}</p>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-bold text-slate-400 tracking-wider">CITATION</span>
                                <div className="flex bg-slate-100 dark:bg-[#0d111f] p-1 rounded-lg border border-slate-200 dark:border-slate-800/60">
                                  {['APA', 'IEEE', 'CHICAGO'].map((style) => (
                                    <button key={style} onClick={() => setCitationStyles(p => ({...p, [journal._id]: style}))} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${citationStyles[journal._id] === style ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                                      {style}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-white dark:bg-[#0d111f] p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 leading-relaxed break-words break-all">
                                {formatCitation(journal, citationStyles[journal._id] || 'APA')}
                              </div>
                            </div>
                          </div>

                          {/* Right Col: Notes & Actions */}
                          <div className="space-y-5 flex flex-col">
                            <div className="flex-1 bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex flex-col">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-amber-500/80 tracking-wider">MY NOTE</span>
                                <button onClick={() => isEditingNote ? saveNote(journal._id) : startEditingNote(journal._id, journal.note)} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase px-2 py-1 bg-amber-500/10 rounded-md transition-colors">
                                  {isEditingNote ? 'Save' : 'Edit'}
                                </button>
                              </div>
                              {!isEditingNote ? (
                                <p className={`text-xs flex-1 ${journal.note ? 'text-amber-700 dark:text-amber-100/80' : 'text-amber-500/60 dark:text-amber-500/30 italic'}`}>{journal.note || 'No thoughts recorded yet...'}</p>
                              ) : (
                                <textarea value={tempNoteText} onChange={(e) => setTempNoteText(e.target.value)} className="w-full flex-1 bg-white dark:bg-black/20 border border-amber-500/20 text-slate-900 dark:text-white text-xs rounded-lg p-3 outline-none focus:border-amber-500/50 resize-none shadow-inner" autoFocus placeholder="Type your notes..." />
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-auto">
                              {journal.link ? (
                                <a href={journal.link} target="_blank" rel="noreferrer" className="py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl flex justify-center items-center gap-2 border border-indigo-500/20 transition-all">
                                  <ExternalLink className="w-4 h-4" /> Source
                                </a>
                              ) : (
                                <button disabled className="py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-bold rounded-xl flex justify-center items-center gap-2 border border-slate-200 dark:border-slate-800 transition-all cursor-not-allowed">
                                  <ExternalLink className="w-4 h-4" /> Source
                                </button>
                              )}
                              <button onClick={() => deleteSingle(journal._id)} className="py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 text-xs font-bold rounded-xl flex justify-center items-center gap-2 border border-red-500/10 transition-all">
                                <Trash2 className="w-4 h-4" /> Remove
                              </button>
                            </div>
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
    </Layout>
  );
}