import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Eye, EyeOff, ArrowLeft, Sun, Moon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { useLogin, useRegister } from "@/hooks/queries";
import { toast } from "sonner";

export function Login() {
  const navigate = useNavigate();
  const { isDark, toggle } = useThemeStore();
  
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email: loginEmail, password: loginPassword, rememberMe },
      {
        onSuccess: (data) => {
          if (data.success) {
            toast.success(`Welcome back, ${data.username}!`);
            navigate("/dashboard");
          } else {
            toast.error(data.message || "Login failed");
          }
        },
        onError: (err: any) => toast.error(err?.message || String(err))
      }
    );
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { username: registerUsername, email: registerEmail, password: registerPassword },
      {
        onSuccess: (data) => {
          if (data.success) {
            toast.success("Registration successful! Please sign in.");
            setActiveTab("login");
            setLoginEmail(registerEmail);
            setLoginPassword(""); // Force user to type password again
          } else {
            toast.error(data.message || "Registration failed");
          }
        },
        onError: (err: any) => toast.error(err as string)
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1e] flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar (Back & Theme Toggle) */}
      <div className="fixed top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-10 w-full max-w-7xl mx-auto">
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-colors bg-white/50 dark:bg-[#161d2f]/50 px-3 py-2 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-800/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back to home</span>
        </Link>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white bg-white/50 dark:bg-[#161d2f]/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800/60"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.35)] group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">LitAssist</span>
          </Link>
        </div>

        <Card className="bg-white/80 dark:bg-[#161d2f]/80 backdrop-blur-xl border-slate-200 dark:border-[#1f2937] shadow-xl shadow-indigo-500/5 dark:shadow-none transition-colors">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Welcome back</CardTitle>
            <CardDescription className="text-slate-500 dark:text-gray-400 font-medium mt-1.5">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-[#0d111f] mb-8 p-1 border border-slate-200 dark:border-transparent rounded-lg">
                <TabsTrigger
                  value="login"
                  className="rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 dark:data-[state=active]:bg-indigo-600 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-400 font-bold transition-all data-[state=active]:shadow-sm"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 dark:data-[state=active]:bg-indigo-600 dark:data-[state=active]:text-white text-slate-500 dark:text-slate-400 font-bold transition-all data-[state=active]:shadow-sm"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0 outline-none">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="login-email" className="text-slate-700 dark:text-gray-300 font-bold text-[13px]">
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20 shadow-sm h-11"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="login-password" className="text-slate-700 dark:text-gray-300 font-bold text-[13px]">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20 pr-10 shadow-sm h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer appearance-none w-4 h-4 rounded-[4px] border border-slate-300 dark:border-[#1f2937] bg-white dark:bg-[#0d111f] checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500/20 transition-colors cursor-pointer"
                        />
                        <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1.5 6 4.5 9 12.5 1"></polyline>
                        </svg>
                      </div>
                      <span className="text-[13px] font-medium text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotSent(false); setForgotEmail(""); }}
                      className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11 font-bold text-[14px] rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all transform hover:-translate-y-[1px]"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0 outline-none">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-2.5">
                    <Label htmlFor="register-username" className="text-slate-700 dark:text-gray-300 font-bold text-[13px]">
                      Username
                    </Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      placeholder="johndoe"
                      required
                      className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20 shadow-sm h-11"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="register-email" className="text-slate-700 dark:text-gray-300 font-bold text-[13px]">
                      Email
                    </Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20 shadow-sm h-11"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="register-password" className="text-slate-700 dark:text-gray-300 font-bold text-[13px]">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                        className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20 pr-10 shadow-sm h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2 pb-2">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        required
                        className="peer appearance-none w-4 h-4 rounded-[4px] border border-slate-300 dark:border-[#1f2937] bg-white dark:bg-[#0d111f] checked:bg-indigo-600 checked:border-indigo-600 focus:ring-indigo-500/20 transition-colors cursor-pointer"
                      />
                      <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5 6 4.5 9 12.5 1"></polyline>
                      </svg>
                    </div>
                    <span className="text-[13px] font-medium text-slate-600 dark:text-gray-400 leading-relaxed">
                      I agree to the{" "}
                      <Link to="#" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="#" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                        Privacy Policy
                      </Link>
                    </span>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11 font-bold text-[14px] rounded-xl shadow-[0_4px_16px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.4)] transition-all transform hover:-translate-y-[1px]"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#161d2f] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Reset Password</h3>
            {!forgotSent ? (
              <>
                <p className="text-[13px] text-slate-500 dark:text-gray-400 mb-4">Masukkan email kamu untuk menerima link reset password.</p>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-white dark:bg-[#0d111f] border-slate-200 dark:border-[#1f2937] text-slate-900 dark:text-white mb-3 h-11"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowForgot(false)}>Batal</Button>
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                    disabled={forgotLoading || !forgotEmail}
                    onClick={async () => {
                      setForgotLoading(true);
                      try {
                        await fetch('/api/auth/forgot-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: forgotEmail })
                        });
                        setForgotSent(true);
                      } catch (_) {
                        toast.error("Gagal mengirim. Coba lagi.");
                      } finally {
                        setForgotLoading(false);
                      }
                    }}
                  >
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-slate-500 dark:text-gray-400 mb-4">
                  Kalau email terdaftar, link reset sudah dikirim. Cek inbox atau spam.<br/><br/>
                  <span className="text-amber-500 font-medium">Catatan: Email belum aktif. Reset link bisa dilihat di Docker logs.</span>
                </p>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => setShowForgot(false)}>Tutup</Button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
