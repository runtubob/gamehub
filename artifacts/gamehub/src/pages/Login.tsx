import { useState } from "react";
import { Gamepad2, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <Gamepad2 size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GameHub</h1>
          <p className="text-sm text-muted-foreground">PS Rental Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-card-border rounded-2xl p-6 space-y-4 shadow-xl">
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
              className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="w-full px-3 py-2.5 pr-10 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <LogIn size={16} />
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">GameHub v1.0 &copy; 2026</p>
      </div>
    </div>
  );
}
