import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  HelpCircle,
  BookOpen,
  Sparkles,
  Database,
  Shield,
  Zap,
  ChevronDown,
  CheckCircle2,
  Crown,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Tab Types ---
type TabId = "scraping" | "badges" | "captcha" | "library" | "ai" | "freemium";

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: "scraping", label: "Scraping", icon: Database },
  { id: "badges", label: "Badge & Warna", icon: Sparkles },
  { id: "captcha", label: "CAPTCHA", icon: Shield },
  { id: "library", label: "Library & Sitasi", icon: BookOpen },
  { id: "ai", label: "AI Summary", icon: Zap },
  { id: "freemium", label: "Premium", icon: Crown },
];

// --- Reusable Components ---

const StepCard = ({ num, title, desc, numBgClass, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="group bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 hover:border-violet-300 dark:hover:border-violet-500/50 rounded-xl p-4 md:p-5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] flex gap-3 md:gap-4"
  >
    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center font-black text-sm md:text-base shrink-0 border ${numBgClass}`}>
      {num}
    </div>
    <div>
      <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">{title}</h3>
      <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
  </motion.div>
);

const BadgeInfoCard = ({ title, items, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 md:p-6 text-sm transition-colors duration-300"
  >
    <p className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-4">{title}</p>
    <div className="space-y-4">
      {items.map((item: any, idx: number) => (
        <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="shrink-0 w-[140px] flex items-center">{item.badge}</div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">{item.desc}</p>
        </div>
      ))}
    </div>
  </motion.div>
);

const FaqItem = ({ id, question, answer, expandedFaq, toggleFaq }: any) => {
  const isExpanded = expandedFaq === id;
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'bg-slate-50 dark:bg-slate-900/40 border-violet-300 dark:border-violet-500/30' : 'bg-white/50 dark:bg-[#111727]/50 border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'}`}>
      <button onClick={() => toggleFaq(id)} className="w-full flex items-center justify-between p-5 text-left">
        <span className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">{question}</span>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-slate-500">
          <ChevronDown className="w-5 h-5 cursor-pointer" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="p-5 pt-0 text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Tab Views ---

const ScrapingTab = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
    <div className="mb-6">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Cara Scraping Jurnal</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">LitAssist mengambil jurnal otomatis dari Google Scholar, Scopus, dan Semantic Scholar.</p>
    </div>
    <div className="grid gap-3">
      <StepCard num="1" numBgClass="bg-violet-500/10 text-violet-400 border-violet-500/20" title="Buka Scraper" desc="Tap tombol Scraper yang ada di bagian atas dashboard. Panel konfigurasi akan muncul." delay={0.05} />
      <StepCard num="2" numBgClass="bg-violet-500/20 text-violet-300 border-violet-500/30" title="Isi Topic / Keyword" desc={<>Ketik topik penelitianmu. Gunakan keyword spesifik untuk hasil lebih relevan. Contoh: <code className="bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded text-xs ml-1">machine learning healthcare</code></>} delay={0.1} />
      <StepCard num="3" numBgClass="bg-violet-500/30 text-violet-200 border-violet-500/40" title="Pilih Source" desc="Google Scholar (sumber luas), Semantic Scholar (berbasis AI), atau Scopus (kualitas tinggi Q1/Q2)." delay={0.15} />
      <StepCard num="4" numBgClass="bg-violet-500/40 text-violet-100 border-violet-500/50" title="Pilih Year Range & Target" desc="Atur rentang tahun (misal: 3YR atau 2020+) dan target jumlah (10, 25, atau 50 khusus premium)." delay={0.2} />
      <StepCard num="5" numBgClass="bg-indigo-500/20 text-indigo-400 border-indigo-500/30" title="Klik Start Scraping" desc="Progress bar akan muncul real-time. Proses berlangsung 1–5 menit tergantung pada target dan jaringan." delay={0.25} />
      <StepCard num={<CheckCircle2 className="w-5 h-5" />} numBgClass="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" title="Selesai — lihat hasil" desc="Dashboard otomatis me-refresh menampilkan jurnal yang sudah terfilter & klasifikasi oleh AI." delay={0.3} />
    </div>
    
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-8 p-5 md:p-6 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20">
      <p className="text-sm md:text-base font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">💡 Tips untuk hasil terbaik</p>
      <ul className="text-xs md:text-sm text-amber-700 dark:text-amber-100/70 space-y-2 list-disc list-inside">
        <li>Gunakan keyword bahasa Inggris — lebih banyak jurnal internasional terindeks.</li>
        <li>Centang <strong>Clear Old Data</strong> jika ingin scrape topik baru dari awal.</li>
        <li>Jika mendapat 0 hasil, coba perluas year range atau ganti source ke Semantic Scholar.</li>
      </ul>
    </motion.div>
  </motion.div>
);

const BadgesTab = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
    <div className="mb-2">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Penjelasan Badge & Warna</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Pahami arti setiap indikator dan warna yang ada pada kartu jurnal.</p>
    </div>
    
    <div className="grid gap-4">
      <BadgeInfoCard title="Tahun Publikasi" items={[
        { badge: <span className="px-3 py-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold font-mono">2024</span>, desc: <><span className="text-indigo-400 font-bold">Indigo / Ungu</span> — Terbitan 2020 ke atas (dianggap terkini).</>},
        { badge: <span className="px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-bold font-mono">2018</span>, desc: <><span className="text-amber-500 font-bold">Amber / Kuning</span> — Terbitan sebelum tahun 2020.</>},
      ]} delay={0.05} />

      <BadgeInfoCard title="Sumber Data" items={[
        { badge: <span className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider">SCHOLAR</span>, desc: "Jurnal diambil dari database publik Google Scholar." },
        { badge: <span className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">SEMANTIC</span>, desc: "Berasal dari Semantic Scholar (metadata diproses AI)." },
        { badge: <span className="px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">SCOPUS</span>, desc: "Jurnal bergengsi yang terindeks Scopus (Q1/Q2 dsb)." },
      ]} delay={0.1} />

      <BadgeInfoCard title="Status Akses & Relevansi" items={[
        { badge: <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-bold w-full text-center">🔓 Open Access</span>, desc: "Dapat dibaca dan diunduh gratis tanpa langganan institusi." },
        { badge: <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center justify-center w-full gap-1.5"><Sparkles className="w-3.5 h-3.5"/> Match: 85%</span>, desc: "Skor relevansi hasil algoritma spesifik berdasarkan target keyword Anda." },
        { badge: <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold flex items-center justify-center w-full gap-1.5">📚 120 Citations</span>, desc: "Jumlah sitasi; indikator seberapa populer dan berpengaruh jurnal ini." },
      ]} delay={0.15} />
    </div>
  </motion.div>
);

const CaptchaTab = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
    <div className="mb-4">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Sistem Auto-CAPTCHA</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Penyelesaian sistem proteksi bot dari Google Scholar.</p>
    </div>

    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 md:p-5 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
      <p className="text-xs md:text-sm font-bold text-red-400 mb-2 flex items-center gap-2">⚠️ Mengapa CAPTCHA sering muncul?</p>
      <p className="text-[11px] md:text-xs text-red-300 w-full md:w-[90%] leading-relaxed">Saat mesin melakukan automasi scraping, Google mendeteksi traffic cepat yang bukan seperti manusia. Ini aman dan wajar—Anda hanya perlu menyelesaikan verifikasi melalui iframe Live Browser agar scraping berlanjut.</p>
    </motion.div>

    <div className="grid gap-3">
      <StepCard num="1" numBgClass="bg-amber-500/10 text-amber-400 border-amber-500/20" title="Panel CAPTCHA Aktif" desc="Saat Scholar menghentikan akses, scraper dijeda otomatis dan Pop-up Iframe muncul." delay={0.1} />
      <StepCard num="2" numBgClass="bg-amber-500/20 text-amber-300 border-amber-500/30" title="Akses Live Browser" desc="Anda akan melihat live view dari Chrome di server via noVNC. Bisa diklik dan scroll layaknya browser Anda." delay={0.15} />
      <StepCard num="3" numBgClass="bg-amber-500/30 text-amber-200 border-amber-500/40" title="Selesaikan Tantangan" desc="Centang 'I'm not a robot' atau selesaikan puzzle gambar yang diberikan." delay={0.2} />
      <StepCard num={<CheckCircle2 className="w-5 h-5"/>} numBgClass="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" title="Klik Done — Resume" desc="Setelah berhasil (misal: halaman hasil Scholar termuat), klik tombol Resume di panel atas untuk melanjutkan antrian." delay={0.25} />
    </div>
  </motion.div>
);

const LibraryTab = ({ toggleFaq, expandedFaq }: any) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
    <div className="mb-2">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Library & Export Sitasi</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Kelola dan bentuk daftar pustaka otomatis dari koleksi Anda.</p>
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 p-5 md:p-6 rounded-2xl flex flex-col gap-5 transition-colors">
        <p className="text-[10px] md:text-xs font-bold text-slate-500 tracking-widest uppercase">Mengelola Library</p>
        
        <div className="flex gap-4 items-start">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30"><BookOpen className="w-4 h-4" /></div>
          <div><h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">Simpan Permanen</h4><p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Klik tombol <strong>Save to Library</strong> di kartu jurnal Dashboard. Jurnal tidak akan hilang meskipun Anda Clear Data.</p></div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">📝</div>
          <div><h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">Catatan Personal</h4><p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Di menu Library, buka detail jurnal untuk mengisi pandangan personal/resume penting pada bagian kolom komentar.</p></div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60 p-5 md:p-6 rounded-2xl transition-colors">
         <p className="text-[10px] md:text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">Export Sitasi</p>
         <div className="space-y-3">
           <div className="bg-slate-50 dark:bg-[#0a0f1e] rounded-xl p-3 border border-slate-200 dark:border-slate-800 transition-colors hover:border-violet-300 dark:hover:border-violet-500/50">
             <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">APA 7th</span>
             <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 font-mono leading-relaxed">Smith, J., & Jones, M. (2024). Title of the paper. Journal Name, 12(3), 45-67. https://doi.org/10.1234/abc</p>
           </div>
           <div className="bg-slate-50 dark:bg-[#0a0f1e] rounded-xl p-3 border border-slate-200 dark:border-slate-800 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50">
             <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">IEEE</span>
             <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 font-mono leading-relaxed">[1] J. Smith and M. Jones, "Title of the paper," Journal Name, vol. 12, no. 3, pp. 45-67, 2024.</p>
           </div>
         </div>
      </motion.div>
    </div>

    <div className="pt-6">
      <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-200 mb-3 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" /> FAQ Terkait Library</h3>
      <div className="space-y-3">
        <FaqItem id="exp1" question="Apakah jurnal di Library ikut terhapus jika klik 'Clear All Data' di Dashboard?" answer="Tidak. Jurnal yang ada di Library sudah disalin permanen ke database akunmu. Fitur Clear All Data di Dashboard hanya menghapus antrian & log scraping sementara." toggleFaq={toggleFaq} expandedFaq={expandedFaq} />
        <FaqItem id="exp2" question="Gimana cara koneksi ke Mendeley / Zotero?" answer="Gunakan tombol 'Export' di bagian atas halaman Library, pilih opsi BibTeX (.bib) atau Excel (.xlsx), kemudian import file tersebut di Mendeley Desktop Anda." toggleFaq={toggleFaq} expandedFaq={expandedFaq} />
      </div>
    </div>
  </motion.div>
);

const AITab = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
    <div className="mb-4">
      <h2 className="flex items-center gap-3 text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">
        AI Summary
        <span className="px-2.5 py-1 text-[9px] md:text-[10px] font-black tracking-widest rounded-full bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 uppercase shadow-[0_0_15px_rgba(139,92,246,0.3)]">Premium Exclusive</span>
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Ringkasan gahar abstrak jurnal dikendalikan mesin Gemini 2.5 Flash.</p>
    </div>

    <div className="grid gap-3">
      <StepCard num="1" numBgClass="bg-violet-500/10 text-violet-400 border-violet-500/20" title="Akses AI Summary" desc="Masuk menu AI Summary via sidebar (Pastikan status akun Anda aktif Premium)." delay={0.05} />
      <StepCard num="2" numBgClass="bg-violet-500/20 text-violet-300 border-violet-500/30" title="Validasi Jurnal Abstrak" desc="Pilih daftar jurnal Anda yang memuat paragraf abstrak teks murni (bukan abstrak paywalled)." delay={0.1} />
      <StepCard num="3" numBgClass="bg-violet-500/30 text-violet-200 border-violet-500/40" title="Generate Insight & Summary" desc="Pencet Generate Summary. Gemini akan membongkar Tujuan, Metodologi Praktis, dan Implikasi/Kesimpulan dengan Bahasa Indonesia efisien." delay={0.15} />
      <StepCard num={<CheckCircle2 className="w-5 h-5"/>} numBgClass="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" title="Integrasi ke Library" desc="Hasil bedah abstrak otomatis tersimpan sebagai rekaman Catatan Personal di jurnal tersebut." delay={0.2} />
    </div>
  </motion.div>
);

const FreemiumTab = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
    <div className="mb-4">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2">Benefit Premium & Upgrade</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Dapatkan askes tidak terbatas menggunakan plan Premium LitAssist.</p>
    </div>

    {/* Table */}
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-[#111727]/80 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 transition-colors duration-300">
      <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-900/80">
        <div className="p-3 md:p-5 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 border-r dark:border-slate-800/50">Fitur</div>
        <div className="p-3 md:p-5 text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center border-b border-slate-200 dark:border-slate-800 border-r dark:border-slate-800/50">Free</div>
        <div className="p-3 md:p-5 text-[10px] md:text-xs font-black text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/20 uppercase tracking-widest text-center border-b border-slate-200 dark:border-slate-800 shadow-[inset_0_0_20px_rgba(139,92,246,0.1)]">Premium ✨</div>
      </div>
      
      {[
        ['Maks. Scraping per Sesi', '25 Jurnal', '50 Jurnal'],
        ['Limit History Jurnal', '10 History Saja', 'Unlimited (Tanpa Batas)'],
        ['Limit Batas Scan Harian', 'Hanya 2x Request / Hari', 'Unlimited Requests'],
        ['Library & Export Citation', 'Termasuk (✓)', 'Termasuk (✓)'],
        ['AI Core (Gemini 2.5 Summary)', 'Tidak Bisa (✗)', 'Termasuk (✓)'],
        ['Prioritas Server / Web Queue', 'Antrian Standar', 'Prioritas Render Pertama'],
      ].map((row, idx) => (
        <div key={idx} className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <div className="p-3 md:p-4 text-[11px] md:text-sm text-slate-700 dark:text-slate-300 flex items-center border-r border-slate-200 dark:border-slate-800/50 font-medium">{row[0]}</div>
          <div className={`p-3 md:p-4 text-[11px] md:text-sm text-center border-r border-slate-200 dark:border-slate-800/50 flex items-center justify-center font-semibold ${row[1].includes('✗') || row[1].includes('Saja') ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>{row[1]}</div>
          <div className="p-3 md:p-4 text-[11px] md:text-sm text-center bg-violet-50 dark:bg-violet-900/5 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shadow-[inset_0_0_20px_rgba(139,92,246,0.02)]">{row[2]}</div>
        </div>
      ))}
    </motion.div>

    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-white dark:from-[#111727] to-violet-50 dark:to-violet-900/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-5 md:p-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 transform translate-x-1/4 -translate-y-1/4">
        <Crown className="w-32 h-32 text-violet-500/5 group-hover:text-violet-500/10 transition-colors duration-500 -rotate-12" />
      </div>
      <div className="relative z-10">
        <h3 className="text-base md:text-xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">Klaim Premium LitAssist</h3>
        <div className="space-y-5">
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">1</div>
            <div><p className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">Hubungi Tim Author</p><p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Ajukan pemesanan atau uji coba dengan menembak request via administrator.</p></div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">2</div>
            <div><p className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">Terima Token</p><p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Administrator akan memberikan unik token Premium untuk diredeem.</p></div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">3</div>
            <div><p className="text-sm font-bold text-slate-900 dark:text-slate-200 mb-1">Aktivasi Melalui Form Profile</p><p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Masuk halaman Profile, temukan box <em>Premium Activation</em>, Copy-Paste Token kemudian Save!</p></div>
          </div>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

export function Help() {
  const [activeTab, setActiveTab] = useState<TabId>("scraping");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "scraping": return <ScrapingTab key="scraping" />;
      case "badges": return <BadgesTab key="badges" />;
      case "captcha": return <CaptchaTab key="captcha" />;
      case "library": return <LibraryTab key="library" toggleFaq={toggleFaq} expandedFaq={expandedFaq} />;
      case "ai": return <AITab key="ai" />;
      case "freemium": return <FreemiumTab key="freemium" />;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="p-3 md:p-6 space-y-4 max-w-4xl mx-auto relative pb-32 md:pb-8 min-h-[calc(100vh-80px)]">
        {/* Modern Header */}
        <div className="flex justify-between items-start md:items-end">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 dark:from-white to-slate-500 dark:to-slate-400 tracking-tight">How to Use LitAssist</h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
              Panduan interaktif & eksplorasi semua modul utama
            </p>
          </motion.div>
          <motion.a 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            href="https://github.com/ridhoajaaa" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-700/50"
          >
            Developer Contact <ExternalLink className="w-4 h-4" />
          </motion.a>
        </div>

        {/* Tab Navigation Glow Up */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex flex-wrap md:flex-nowrap gap-2 p-1 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl backdrop-blur-md overflow-x-auto scrollbar-hide shadow-sm shadow-black/5 dark:shadow-black/10 transition-colors duration-300">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setExpandedFaq(null); // Reset faq on switch
                }}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wide transition-all shrink-0 ${
                  isActive
                    ? "text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] bg-violet-600 border border-violet-500/50"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* Viewport for Content */}
        <div className="relative pt-2">
          <AnimatePresence mode="wait">
            {renderTabContent()}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}