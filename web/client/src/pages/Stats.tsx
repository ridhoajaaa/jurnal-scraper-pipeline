import { Layout } from "@/components/layout/Layout";
import { 
  BarChart3, 
  BookMarked, 
  Database, 
  CalendarDays, 
  Tags,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { useStats } from "@/hooks/queries";

export function Stats() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen pb-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Loading Analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Layout>
        <div className="p-4 md:p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[70vh]">
          <div className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-3xl p-16 text-center shadow-xl w-full max-w-md transition-colors duration-300">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-500/20">
              <BarChart3 className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white mb-2">No data yet</p>
            <p className="text-sm text-slate-400">Save some journals to your library to see your research analytics.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Kalkulasi rentang tahun untuk Summary Card
  const yearRange = (stats.byYear && stats.byYear.length > 0) 
    ? `${stats.byYear[stats.byYear.length - 1].label} – ${stats.byYear[0].label}` 
    : "—";

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-6xl mx-auto relative pb-32 md:pb-8">

        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 dark:from-white to-slate-500 dark:to-slate-400 tracking-tight">Analytics</h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              Overview of your research data
            </p>
          </motion.div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 shadow-sm hover:border-indigo-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Saved</p>
              <BookMarked className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total || 0}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 shadow-sm hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sources</p>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">{(stats.bySource || []).length}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 shadow-sm hover:border-amber-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Year Range</p>
              <CalendarDays className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-lg font-black text-amber-400 mt-1">{yearRange}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 shadow-sm hover:border-violet-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Categories</p>
              <Tags className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-2xl font-black text-violet-400">{(stats.byCategory || []).length}</p>
          </motion.div>
        </div>

        {/* Charts Container */}
        <div className="space-y-4">
          
          {/* By Year Chart */}
          {stats.byYear && stats.byYear.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 md:p-5 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Journals by Year
              </h3>
              <div className="space-y-2.5">
                {stats.byYear.map((item: any, i: number) => {
                  const max = Math.max(...stats.byYear.map((x: any) => x.count));
                  const percentage = Math.max(5, (item.count / max) * 100);
                  
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 w-10 shrink-0 text-right">{item.label}</span>
                      <div className="flex-1 h-5 md:h-6 bg-slate-100 dark:bg-[#0d111f] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/50">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, delay: 0.5 + (i * 0.1), ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full flex items-center justify-end pr-2.5"
                        >
                          <span className="text-[9px] font-black text-white drop-shadow-md">{item.count}</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* By Source Chart */}
          {stats.bySource && stats.bySource.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 md:p-5 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Database className="w-3.5 h-3.5" /> Journals by Source
              </h3>
              <div className="space-y-2.5">
                {stats.bySource.map((item: any, i: number) => {
                  const max = Math.max(...stats.bySource.map((x: any) => x.count));
                  const percentage = Math.max(5, (item.count / max) * 100);
                  
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 w-24 shrink-0 truncate text-right pr-1.5">{item.label}</span>
                      <div className="flex-1 h-5 md:h-6 bg-slate-100 dark:bg-[#0d111f] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/50">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, delay: 0.6 + (i * 0.1), ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full flex items-center justify-end pr-2.5"
                        >
                          <span className="text-[9px] font-black text-white drop-shadow-md">{item.count}</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* By Category Chart */}
          {stats.byCategory && stats.byCategory.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-xl p-4 md:p-5 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <Tags className="w-3.5 h-3.5" /> Top Categories
              </h3>
              <div className="space-y-2.5">
                {stats.byCategory.map((item: any, i: number) => {
                  const max = Math.max(...stats.byCategory.map((x: any) => x.count));
                  const percentage = Math.max(5, (item.count / max) * 100);
                  
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 w-32 shrink-0 truncate text-right pr-1.5" title={item.label}>{item.label}</span>
                      <div className="flex-1 h-5 md:h-6 bg-slate-100 dark:bg-[#0d111f] rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/50">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, delay: 0.7 + (i * 0.1), ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full flex items-center justify-end pr-2.5"
                        >
                          <span className="text-[9px] font-black text-white drop-shadow-md">{item.count}</span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </Layout>
  );
}