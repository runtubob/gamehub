import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Gamepad2, Package, Receipt, Zap, TrendingDown, Box,
  Pencil, Upload, X, Check, BarChart3, Users, LogOut, Menu, Shield, Crown, CalendarClock
} from "lucide-react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, isAdminOrAbove } from "@/context/AuthContext";

const LOGO_KEY = "shopLogo";
const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  owner: "Admin",
  karyawan: "Karyawan",
};
const ROLE_COLORS: Record<string, string> = {
  superadmin: "text-chart-1",
  admin: "text-primary",
  owner: "text-primary",
  karyawan: "text-muted-foreground",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: settings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = isAdminOrAbove(user?.role);
  const isSuperAdmin = user?.role === "superadmin";

  useEffect(() => {
    const stored = localStorage.getItem(LOGO_KEY);
    if (stored) setLogo(stored);
  }, []);

  const openEdit = () => {
    if (!isAdmin) return;
    setEditName(settings?.shopName ?? "GameHub");
    setEditTagline(settings?.tagline ?? "PS Rental Manager");
    setPreviewLogo(logo);
    setShowEdit(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (previewLogo !== logo) {
      if (previewLogo) localStorage.setItem(LOGO_KEY, previewLogo);
      else localStorage.removeItem(LOGO_KEY);
      setLogo(previewLogo);
    }
    updateSettings.mutate(
      { data: { shopName: editName.trim() || "GameHub", tagline: editTagline.trim() || "PS Rental Manager" } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); setShowEdit(false); } }
    );
  };

  const navItems = [
    ...(isAdmin ? [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }] : []),
    { href: isAdmin ? "/units" : "/", icon: Gamepad2, label: "Unit PlayStation" },
    { href: "/active-rentals", icon: Zap, label: "Rental Aktif" },
    { href: "/products", icon: Package, label: "Produk" },
    { href: "/shifts", icon: CalendarClock, label: "Shift & Handover" },
    { href: "/expenses", icon: TrendingDown, label: "Pengeluaran" },
    ...(isAdmin ? [
      { href: "/transactions", icon: Receipt, label: "Transaksi" },
      { href: "/packages", icon: Box, label: "Paket Rental" },
      { href: "/laporan", icon: BarChart3, label: "Laporan Keuangan" },
      { href: "/users", icon: Users, label: "Pengguna" },
    ] : []),
  ];

  const shopName = settings?.shopName ?? "GameHub";
  const tagline = settings?.tagline ?? "PS Rental Manager";

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className={`flex items-center gap-2.5 ${isAdmin ? "group cursor-pointer" : ""}`} onClick={isAdmin ? openEdit : undefined}>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
            {logo ? <img src={logo} alt="logo" className="w-full h-full object-cover" /> : <Gamepad2 size={18} className="text-primary-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{shopName}</p>
            <p className="text-xs text-muted-foreground truncate">{tagline}</p>
          </div>
          {isAdmin && <Pencil size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? location === "/" || location === "/units" : location.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"}`}>
              <Icon size={16} />{label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/20">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {isSuperAdmin ? <Crown size={12} className="text-chart-1" /> : <Shield size={12} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <p className={`text-[10px] font-medium ${ROLE_COLORS[user?.role ?? ""] ?? "text-muted-foreground"}`}>
              {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </p>
          </div>
          <button onClick={logout} title="Keluar" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <LogOut size={14} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">GameHub v2.0</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
              {logo ? <img src={logo} alt="logo" className="w-full h-full object-cover" /> : <Gamepad2 size={14} className="text-primary-foreground" />}
            </div>
            <span className="font-bold text-sm text-foreground">{shopName}</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {showEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Pengaturan Toko</h3>
              <button onClick={() => setShowEdit(false)} className="p-1 text-muted-foreground hover:text-foreground rounded"><X size={16} /></button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors" onClick={() => fileRef.current?.click()}>
                {previewLogo ? <img src={previewLogo} alt="logo" className="w-full h-full object-cover" /> : <Upload size={24} className="text-muted-foreground" />}
              </div>
              <div className="flex gap-3">
                <button onClick={() => fileRef.current?.click()} className="text-xs text-primary hover:underline">Upload Logo</button>
                {previewLogo && <button onClick={() => setPreviewLogo(null)} className="text-xs text-destructive hover:underline">Hapus</button>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Nama Usaha</label><input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Tagline</label><input value={editTagline} onChange={(e) => setEditTagline(e.target.value)} className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={updateSettings.isPending} className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"><Check size={14} />{updateSettings.isPending ? "Menyimpan..." : "Simpan"}</button>
              <button onClick={() => setShowEdit(false)} className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
