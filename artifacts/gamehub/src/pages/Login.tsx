import { useState, useEffect } from "react";
import { Gamepad2, Eye, EyeOff, LogIn, UserPlus, Crown, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const TOKEN_KEY = "gamehub_token";
const USER_KEY = "gamehub_user";

type Mode = "checking" | "setup" | "login";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("checking");

  // Login state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Setup state
  const [setupName, setSetupName] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPassConfirm, setSetupPassConfirm] = useState("");
  const [showSetupPass, setShowSetupPass] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup-status")
      .then((r) => r.json())
      .then((data: { needsSetup: boolean }) => {
        setMode(data.needsSetup ? "setup" : "login");
      })
      .catch(() => setMode("login"));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      toast({ title: "Login Gagal", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupUsername.trim() || !setupPassword) return;
    if (setupPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" }); return;
    }
    if (setupPassword !== setupPassConfirm) {
      toast({ title: "Konfirmasi password tidak cocok", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: setupName.trim(), username: setupUsername.trim(), password: setupPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat akun");
      // Store session and reload — AuthContext picks it up
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      window.location.reload();
    } catch (err) {
      toast({ title: "Gagal", description: (err as Error).message, variant: "destructive" });
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (mode === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Memeriksa sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Gamepad2 size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GameHub</h1>
          <p className="text-sm text-muted-foreground">PS Rental Management System</p>
        </div>

        {mode === "setup" ? (
          /* ── SETUP MODE: Buat Akun Super Admin Pertama ── */
          <form onSubmit={handleSetup} className="bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="text-center space-y-1.5 pb-1">
              <div className="flex items-center justify-center gap-2">
                <div className="w-7 h-7 rounded-full bg-chart-1/20 flex items-center justify-center">
                  <Crown size={14} className="text-chart-1" />
                </div>
                <h2 className="font-bold text-foreground">Buat Akun Super Admin</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Belum ada akun di sistem ini. Akun pertama akan otomatis menjadi <span className="text-chart-1 font-medium">Super Admin</span>.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nama Lengkap</label>
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="cth. Budi Santoso"
                autoFocus
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Username</label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="cth. budi123"
                autoComplete="username"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Password <span className="text-muted-foreground/60">(min. 6 karakter)</span></label>
              <div className="relative">
                <input
                  type={showSetupPass ? "text" : "password"}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowSetupPass(!showSetupPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSetupPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Konfirmasi Password</label>
              <input
                type="password"
                value={setupPassConfirm}
                onChange={(e) => setSetupPassConfirm(e.target.value)}
                placeholder="Ulangi password"
                autoComplete="new-password"
                className={inputClass}
              />
              {setupPassConfirm && setupPassword !== setupPassConfirm && (
                <p className="text-xs text-destructive">Password tidak cocok</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !setupName.trim() || !setupUsername.trim() || !setupPassword || setupPassword !== setupPassConfirm}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? "Membuat akun..." : "Buat Akun & Masuk"}
            </button>

            <div className="bg-chart-1/10 border border-chart-1/20 rounded-lg px-3 py-2.5">
              <p className="text-xs text-chart-1 font-medium">Akun ini akan menjadi Super Admin</p>
              <p className="text-xs text-muted-foreground mt-0.5">Super Admin memiliki akses penuh dan bisa menambahkan akun untuk karyawan.</p>
            </div>
          </form>
        ) : (
          /* ── LOGIN MODE: Normal ── */
          <form onSubmit={handleLogin} className="bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="font-bold text-foreground text-center">Masuk ke Aplikasi</h2>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoFocus
                autoComplete="username"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">GameHub v2.0 &copy; 2026</p>
      </div>
    </div>
  );
}
