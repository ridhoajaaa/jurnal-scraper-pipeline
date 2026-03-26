import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Sun,
  Moon,
  Check,
  Minus
} from "lucide-react";
import { motion } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";

const featuresData = [
  {
    num: "01",
    title: "Auto Scraping",
    desc: "Enter a keyword, pick source and page count — LitAssist does the rest. No manual browsing. Results arrive with full metadata: title, authors, year, citation count.",
    pro: false
  },
  {
    num: "02",
    title: "Personal Library",
    desc: "Save relevant journals to your private library. Filter by year, source, or relevance. Add notes to each entry. Accessible anytime from your account.",
    pro: false
  },
  {
    num: "03",
    title: "AI Literature Review",
    desc: "Select journals from your library, click generate. The AI writes an academic literature review ready to use — in English or Indonesian.",
    pro: true
  },
  {
    num: "04",
    title: "Export Excel & BibTeX",
    desc: "Export your library to Excel for reporting, or BibTeX for LaTeX and Mendeley. One click, file downloads instantly.",
    pro: true
  },
  {
    num: "05",
    title: "Stats & Analytics",
    desc: "Visualize your library by year, source, and topic category. Great for showing your advisor your references are diverse and current.",
    pro: false
  },
  {
    num: "06",
    title: "Private & Secure",
    desc: "Email verification, encrypted sessions, rate limiting enabled. Your library is 100% private — nobody else can access it.",
    pro: false
  }
];

const stepsData = [
  { num: "01", title: "Sign Up & Verify", desc: "Create a free account, verify email. No setup — you're in right away." },
  { num: "02", title: "Enter Your Topic", desc: "Type your thesis topic, pick source and pages. Hit start." },
  { num: "03", title: "Curate Your Library", desc: "Save relevant journals, add notes, filter what matters." },
  { num: "04", title: "Generate & Export", desc: "AI literature review or export to Excel/BibTeX. Done.", accent: true }
];

export function Landing() {
  const { isDark, toggle } = useThemeStore();
  
  const loggedIn = useAuthStore(state => state.isAuthenticated);

  // Animation variants
  const fadeUp: any = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: custom * 0.1, ease: "easeOut" }
    })
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1e] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center bg-white/80 dark:bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/60 transition-colors duration-300">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white group">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-indigo-600 flex items-center justify-center shadow-[0_4px_12px_rgba(99,102,241,0.35)] group-hover:scale-105 transition-transform">
              <BookOpen className="w-[15px] h-[15px] text-white" strokeWidth={2.5} />
            </div>
            LitAssist
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            <a href="#features" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Features</a>
            <a href="#how-it-works" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">How it Works</a>
            <a href="#pricing" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg w-8 h-8 hidden sm:flex">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {loggedIn ? (
              <Link to="/dashboard">
                <Button className="h-8 text-[13px] font-bold px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all transform hover:-translate-y-[1px]">
                  Open App →
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="outline" className="h-8 text-[13px] font-bold px-4 rounded-lg bg-transparent hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-800 transition-colors">
                    Log In
                  </Button>
                </Link>
                <Link to="/login">
                  <Button className="h-8 text-[13px] font-bold px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all transform hover:-translate-y-[1px]">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 lg:pt-36 pb-12 overflow-hidden border-b border-slate-200 dark:border-slate-800/60 relative">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-14 items-start pb-12 lg:pb-16 border-b border-slate-200 dark:border-slate-800/60">
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
              <div className="inline-flex items-center gap-2 mb-6 lg:mb-8 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tracking-[0.1em] uppercase">
                <span className="w-4 h-[2px] bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>
                For Thesis Students & Researchers
              </div>
              <h1 className="text-[clamp(44px,7.5vw,96px)] font-black leading-[0.95] tracking-[-0.04em] text-slate-900 dark:text-white">
                Stop hunting<br />
                journals<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">manually.</span>
              </h1>
            </motion.div>
            
            <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="hidden lg:block pt-4">
              <p className="text-[14.5px] leading-[1.8] text-slate-600 dark:text-slate-400 mb-7 font-medium">
                LitAssist auto-scrapes journals from Google Scholar & Scopus, saves them to your library, and writes AI literature reviews — all in one place.
              </p>
              <div className="flex flex-col gap-2.5 items-start">
                <Link to={loggedIn ? "/dashboard" : "/login"} className="w-full">
                  <Button size="lg" className="w-full justify-start h-12 text-[14px] font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all">
                    {loggedIn ? "Open App →" : "Get Started Free →"}
                  </Button>
                </Link>
                <a href={loggedIn ? "#features" : "#how-it-works"} className="w-full">
                  <Button variant="outline" size="lg" className="w-full justify-start h-12 text-[14px] font-bold rounded-xl bg-transparent border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    {loggedIn ? "See Features" : "How it Works"}
                  </Button>
                </a>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-4 tracking-[0.02em]">Free to start · No credit card</p>
            </motion.div>

            {/* Mobile Hero Text */}
            <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="lg:hidden block pt-4 pb-4">
              <p className="text-[15px] leading-[1.8] text-slate-600 dark:text-slate-400 mb-6 font-medium">
                Auto-scrape journals from Google Scholar & Scopus, save to library, and generate AI literature reviews.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="lg" className="h-12 text-[14px] font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)]">Get Started Free</Button>
                </Link>
                <Button variant="outline" size="lg" className="h-12 text-[14px] font-bold rounded-xl bg-transparent border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">How it Works</Button>
              </div>
            </motion.div>
          </div>

          {/* Stats Row */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={3} variants={fadeUp} className="flex flex-wrap pt-8 lg:pt-14 gap-y-8">
            <div className="flex-1 min-w-[140px] border-r border-slate-200 dark:border-slate-800/60 pr-4 mr-4 lg:pr-8 lg:mr-8">
              <div className="text-[40px] lg:text-[44px] font-black leading-none text-slate-900 dark:text-slate-100 tracking-[-0.05em]">2+</div>
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-[1.55]">Journal sources<br/>Scholar & Scopus</div>
            </div>
            <div className="flex-1 min-w-[140px] border-r border-slate-200 dark:border-slate-800/60 pr-4 mr-4 lg:pr-8 lg:mr-8">
              <div className="text-[40px] lg:text-[44px] font-black leading-none text-indigo-600 dark:text-indigo-500 tracking-[-0.05em]">AI</div>
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-[1.55]">Auto-generate<br/>literature reviews</div>
            </div>
            <div className="flex-1 min-w-[140px] border-r-0 sm:border-r border-slate-200 dark:border-slate-800/60 pr-4 mr-4 lg:pr-8 lg:mr-8">
              <div className="text-[40px] lg:text-[44px] font-black leading-none text-slate-900 dark:text-slate-100 tracking-[-0.05em]">.bib</div>
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-[1.55]">Export BibTeX<br/>& Excel</div>
            </div>
            <div className="flex-1 min-w-[140px] py-2">
              <div className="text-[40px] lg:text-[44px] font-black leading-none text-slate-900 dark:text-slate-100 tracking-[-0.05em]">∞</div>
              <div className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mt-2 leading-[1.55]">Unlimited scraping<br/>on Premium</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ticker Tape */}
      <div className="overflow-hidden border-b border-slate-200 dark:border-slate-800/60 py-3 bg-white dark:bg-[#161d2f]/50">
        <div className="flex whitespace-nowrap animate-[ticker_22s_linear_infinite] hover:[animation-play-state:paused] w-max">
          {[1, 2].map((i) => (
            <div key={i} className="flex shrink-0">
              {['Google Scholar', 'Scopus', 'Auto Scraping', 'AI Literature Review', 'BibTeX Export', 'Excel Export', 'Personal Library', 'Journal Statistics', 'Built for Skripsi'].map((txt, idx, arr) => (
                <span key={txt} className={`text-[11px] font-bold px-6 tracking-[0.05em] uppercase text-slate-400 dark:text-slate-500 ${idx !== arr.length - 1 ? 'border-r border-slate-200 dark:border-slate-800/60' : ''}`}>
                  {txt}
                </span>
              ))}
              {/* Extra border to connect to the next duplicate string */}
               <span className="border-r border-slate-200 dark:border-slate-800/60"></span>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12 lg:gap-20 items-start">
            <div className="lg:sticky lg:top-[120px]">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} custom={0} variants={fadeUp}>
                <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-[0.1em] uppercase mb-4">Features</div>
                <h2 className="text-[clamp(28px,3vw,38px)] font-black leading-[1.15] tracking-[-0.02em] text-slate-900 dark:text-white">
                  Everything you need for academic research.
                </h2>
                <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400 mt-4 leading-[1.75]">
                  No more tab-switching. No more manual copy-paste.
                </p>
              </motion.div>
            </div>
            
            <div className="pt-2">
              {featuresData.map((f, i) => (
                <motion.div 
                  key={f.num}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} custom={i * 0.5 + 1} variants={fadeUp}
                  className={cn(
                    "py-8 flex gap-5 border-t border-slate-200 dark:border-slate-800/60",
                    i === featuresData.length - 1 && "border-b"
                  )}
                >
                  <span className={cn(
                    "text-[12px] font-bold tracking-[0.05em] shrink-0 pt-1 w-7",
                    f.pro ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-600"
                  )}>{f.num}</span>
                  <div>
                    <h3 className="text-[16px] font-bold text-slate-900 dark:text-white mb-2.5 flex items-center flex-wrap gap-2">
                      {f.title}
                      {f.pro && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-[5px] border border-indigo-200 dark:border-indigo-500/20">PREMIUM</span>
                      )}
                    </h3>
                    <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-[1.75] font-medium">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 bg-white dark:bg-[#161d2f]/30 border-y border-slate-200 dark:border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp} className="mb-14">
            <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-[0.1em] uppercase mb-4">How it Works</div>
            <h2 className="text-[clamp(28px,3.5vw,42px)] font-black leading-[1.15] tracking-[-0.02em] text-slate-900 dark:text-white">
              From keyword to bibliography, <span className="italic font-medium text-slate-400 dark:text-slate-500">in minutes.</span>
            </h2>
          </motion.div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-slate-200 dark:bg-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800/60">
            {stepsData.map((step, i) => (
              <motion.div 
                key={step.num}
                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i + 1} variants={fadeUp}
                className="bg-slate-50 dark:bg-[#111827] p-8 sm:p-6 lg:p-8 relative group hover:bg-white dark:hover:bg-[#161d2f] transition-colors"
              >
                <div className={cn(
                  "text-[40px] font-black leading-none mb-4 tracking-[-0.05em] transition-colors",
                  step.accent ? "text-indigo-500/20 dark:text-indigo-500/10 group-hover:text-indigo-500/30" : "text-slate-200 dark:text-slate-800 group-hover:text-slate-300 dark:group-hover:text-slate-700"
                )}>
                  {step.num}
                </div>
                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-[1.7] font-medium">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp} className="mb-14">
            <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-[0.1em] uppercase mb-4">Pricing</div>
            <h2 className="text-[clamp(28px,3.5vw,42px)] font-black leading-[1.15] tracking-[-0.02em] text-slate-900 dark:text-white">
              Start free. Upgrade when you need more.
            </h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-slate-200 dark:bg-slate-800/80 rounded-3xl overflow-hidden shadow-xl shadow-indigo-500/5 dark:shadow-none border border-slate-200 dark:border-slate-800/60 max-w-[700px]">
            {/* Free Tier */}
            <div className="bg-white dark:bg-[#111827] p-8 sm:p-10 flex flex-col">
              <div className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 tracking-[0.12em] uppercase mb-3">Free</div>
              <div className="text-[44px] font-black text-slate-900 dark:text-white leading-none tracking-[-0.04em] mb-2">Free</div>
              <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-8">Forever, no card required</div>
              
              <div className="flex flex-col gap-3.5 mb-10 text-[13.5px] font-medium text-slate-600 dark:text-slate-400 flex-1">
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" /> 10 lifetime journal scrapes</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" /> 2 scrapes per day</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" /> Personal library</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" /> Journal statistics</div>
                <div className="flex gap-2.5 items-start text-slate-400 dark:text-slate-500 opacity-60"><Minus className="w-4 h-4 shrink-0 mt-0.5" /> AI Literature Review</div>
                <div className="flex gap-2.5 items-start text-slate-400 dark:text-slate-500 opacity-60"><Minus className="w-4 h-4 shrink-0 mt-0.5" /> Excel & BibTeX export</div>
              </div>
              
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full h-12 text-[14px] font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {loggedIn ? "Open App →" : "Sign Up Free"}
                </Button>
              </Link>
            </div>
            
            {/* Premium Tier */}
            <div className="bg-indigo-50/50 dark:bg-[#161d2f] p-8 sm:p-10 relative overflow-hidden flex flex-col border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800/60">
              <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/20 blur-[40px] rounded-full pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-[0.12em] uppercase">Premium</span>
                <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-[4px] shadow-sm">Popular</span>
              </div>
              <div className="text-[44px] font-black text-slate-900 dark:text-white leading-none tracking-[-0.04em] mb-2">One-time</div>
              <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-8">Lifetime access, no recurring fees</div>
              
              <div className="flex flex-col gap-3.5 mb-8 text-[13.5px] font-medium text-slate-600 dark:text-slate-400 flex-1">
                <div className="flex gap-2.5 items-start font-bold text-slate-900 dark:text-white"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> Unlimited scraping</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> Everything in Free</div>
                <div className="flex gap-2.5 items-start font-bold text-slate-900 dark:text-white"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> AI Literature Review (EN/ID)</div>
                <div className="flex gap-2.5 items-start font-bold text-slate-900 dark:text-white"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> Excel & BibTeX export</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> Token activation via WA/email</div>
                <div className="flex gap-2.5 items-start"><Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" /> Priority support</div>
              </div>
              
              <div className="flex flex-col gap-2.5">
                <Link to={loggedIn ? "/profile" : "/login"} className="w-full">
                  <Button className="w-full h-12 text-[14px] font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all">
                    {loggedIn ? "Upgrade to Premium →" : "Sign Up & Upgrade →"}
                  </Button>
                </Link>
                {!loggedIn && <p className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500">Sign up first, then upgrade from Profile</p>}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <div className="bg-white dark:bg-[#161d2f]/30 border-y border-slate-200 dark:border-slate-800/60 py-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={0} variants={fadeUp}>
            <h2 className="text-[clamp(32px,5vw,56px)] font-black leading-[1.05] tracking-[-0.03em] text-slate-900 dark:text-white mb-5">
              Your thesis won't write itself.
            </h2>
            <p className="text-[16px] md:text-[18px] text-slate-500 dark:text-slate-400 mb-10 leading-[1.7] font-medium">
              But the journal research part — you can leave that to LitAssist.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/login">
                <Button size="lg" className="h-12 text-[14px] px-8 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all transform hover:-translate-y-[1px]">
                  {loggedIn ? "Open App →" : "Get Started Free"}
                </Button>
              </Link>
              {!loggedIn && (
                 <Link to="/login">
                   <Button variant="outline" size="lg" className="h-12 px-8 text-[14px] font-bold rounded-xl bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                     Already have an account?
                   </Button>
                 </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <BookOpen className="w-[14px] h-[14px] text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white">LitAssist</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
             <p className="order-2 sm:order-1 opacity-70">Built for Indonesian students</p>
             <div className="flex items-center gap-6 order-1 sm:order-2">
                <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
                <Link to="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">Login</Link>
             </div>
          </div>
        </div>
      </footer>
      
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}