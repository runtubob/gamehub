import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Gamepad2, Package, Receipt, Zap, TrendingDown, Box, Pencil, Upload, X, Check } from "lucide-react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/units", icon: Gamepad2, label: "Unit PlayStation" },
  { href: "/active-rentals", icon: Zap, label: "Rental Aktif" },
  { href: "/products", icon: Package, label: "Produk" },
  { href: "/transactions", icon: Receipt, label: "Transaksi" },
  { href: "/expenses", icon: TrendingDown, label: "Pengeluaran" },
  { href: "/packages", icon: Box, label: "Paket Rental" },
];

const LOGO_KEY = "shopLogo";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LOGO_KEY);
    if (stored) setLogo(stored);
  }, []);

  const openEdit = () => {
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
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          setShowEdit(false);
        },
      }
    );
  };

  const shopName = settings?.shopName ?? "GameHub";
  const tagline = settings?.tagline ?? "PS Rental Manager";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 group cursor-pointer" onClick={openEdit}>
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center overflow-hidden shrink-0">
              {logo ? (
                <img src={logo} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Gamepad2 size={18} className="text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">{shopName}</p>
              <p className="text-xs text-muted-foreground truncate">{tagline}</p>
            </div>
            <Pencil size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground text-center">GameHub v1.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>

      {showEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Pengaturan Toko</h3>
              <button onClick={() => setShowEdit(false)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {previewLogo ? (
                  <img src={previewLogo} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <Upload size={24} className="text-muted-foreground" />
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs text-primary hover:underline"
              >
                Upload Logo
              </button>
              {previewLogo && (
                <button
                  onClick={() => setPreviewLogo(null)}
                  className="text-xs text-destructive hover:underline"
                >
                  Hapus Logo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Usaha</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="GameHub"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tagline</label>
              <input
                value={editTagline}
                onChange={(e) => setEditTagline(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="PS Rental Manager"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Check size={14} />
                {updateSettings.isPending ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
