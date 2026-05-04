import { useState } from "react";
import { useGetDashboard, useListRecentTransactions, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  BarChart3, Gamepad2, Package, Receipt, Monitor, Zap, TrendingUp, TrendingDown,
  Banknote, CreditCard, Trophy, Star, RotateCcw, AlertTriangle, Settings2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, isAdminOrAbove } from "@/context/AuthContext";

function formatRp(amount: number) { return "Rp " + amount.toLocaleString("id-ID"); }
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(dateStr: string | Date) {
  return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

type ProductPeriod = "daily" | "weekly" | "monthly" | "yearly" | "all";
const PRODUCT_PERIODS: { key: ProductPeriod; label: string }[] = [
  { key: "daily", label: "Hari Ini" },
  { key: "weekly", label: "Minggu Ini" },
  { key: "monthly", label: "Bulan Ini" },
  { key: "yearly", label: "Tahun Ini" },
  { key: "all", label: "Semua" },
];

interface TopProduct { productId: number; productName: string; totalQty: number; totalRevenue: number; }

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboard();
  const { data: recent, isLoading: recentLoading } = useListRecentTransactions({ limit: 8 });
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showResetUnits, setShowResetUnits] = useState(false);
  const [resettingUnits, setResettingUnits] = useState(false);
  const [productPeriod, setProductPeriod] = useState<ProductPeriod>("daily");
  const [showKasAwal, setShowKasAwal] = useState(false);
  const [editInitialCash, setEditInitialCash] = useState("");
  const [editInitialQris, setEditInitialQris] = useState("");
  const [savingKasAwal, setSavingKasAwal] = useState(false);

  const canReset = isAdminOrAbove(user?.role);
  const isSuperAdmin = user?.role === "superadmin";

  const { data: topProducts, isLoading: topProdLoading } = useQuery<TopProduct[]>({
    queryKey: ["top-products", productPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/top-products?period=${productPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
      });
      return res.json();
    },
    staleTime: 30000,
  });

  const netCash = (stats?.cashIncome ?? 0) - (stats?.cashExpenses ?? 0);
  const netQris = (stats?.qrisIncome ?? 0) - (stats?.qrisExpenses ?? 0);
  const initialCash = (stats as { initialCash?: number })?.initialCash ?? 0;
  const initialQris = (stats as { initialQris?: number })?.initialQris ?? 0;

  const handleResetTopUnits = async () => {
    setResettingUnits(true);
    try {
      const res = await fetch("/api/rentals/reset-stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Gagal"); }
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setShowResetUnits(false);
      toast({ title: "Statistik unit berhasil direset" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResettingUnits(false);
    }
  };

  const openKasAwal = () => {
    setEditInitialCash(String(initialCash));
    setEditInitialQris(String(initialQris));
    setShowKasAwal(true);
  };

  const saveKasAwal = async () => {
    setSavingKasAwal(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
        body: JSON.stringify({
          initialCash: parseInt(editInitialCash) || 0,
          initialQris: parseInt(editInitialQris) || 0,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setShowKasAwal(false);
      toast({ title: "Kas awal berhasil disimpan" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingKasAwal(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ringkasan operasional hari ini</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openKasAwal}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground hover:text-foreground border border-border rounded-lg text-xs font-medium">
            <Settings2 size={13} /> Kas Awal
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<BarChart3 size={18} className="text-chart-1" />} label="Pendapatan Hari Ini" value={statsLoading ? "..." : formatRp(stats?.todayIncome ?? 0)} accent="text-chart-1" />
        <StatCard icon={<TrendingUp size={18} className="text-emerald-400" />} label="Profit Hari Ini" value={statsLoading ? "..." : formatRp(stats?.todayProfit ?? 0)} accent="text-emerald-400" />
        <StatCard icon={<TrendingDown size={18} className="text-destructive" />} label="Pengeluaran" value={statsLoading ? "..." : formatRp(stats?.todayExpenses ?? 0)} accent="text-destructive" />
        <StatCard icon={<Receipt size={18} className="text-chart-4" />} label="Transaksi" value={statsLoading ? "..." : String(stats?.todayTransactions ?? 0)} accent="text-chart-4" />
      </div>

      {/* Kas cards — includes modal awal if set */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Banknote size={16} className="text-chart-3" /><span className="text-xs text-muted-foreground">Kas Cash Hari Ini</span></div>
          <p className={`text-xl font-bold ${netCash >= 0 ? "text-chart-3" : "text-destructive"}`}>{statsLoading ? "..." : formatRp(netCash)}</p>
          <p className="text-xs text-muted-foreground mt-1">Masuk {formatRp(stats?.cashIncome ?? 0)} · Keluar {formatRp(stats?.cashExpenses ?? 0)}</p>
          {initialCash > 0 && <p className="text-xs text-primary mt-1">Modal awal: {formatRp(initialCash)}</p>}
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><CreditCard size={16} className="text-primary" /><span className="text-xs text-muted-foreground">Kas QRIS Hari Ini</span></div>
          <p className={`text-xl font-bold ${netQris >= 0 ? "text-primary" : "text-destructive"}`}>{statsLoading ? "..." : formatRp(netQris)}</p>
          <p className="text-xs text-muted-foreground mt-1">Masuk {formatRp(stats?.qrisIncome ?? 0)} · Keluar {formatRp(stats?.qrisExpenses ?? 0)}</p>
          {initialQris > 0 && <p className="text-xs text-primary mt-1">Modal awal: {formatRp(initialQris)}</p>}
        </div>
        <StatCard icon={<Zap size={18} className="text-yellow-400" />} label="Rental Aktif" value={statsLoading ? "..." : String(stats?.activeRentals ?? 0)} accent="text-yellow-400" />
        <StatCard icon={<Monitor size={18} className="text-chart-3" />} label="Unit Tersedia" value={statsLoading ? "..." : `${stats?.availableUnits ?? 0} / ${stats?.totalUnits ?? 0}`} accent="text-chart-3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Pendapatan 7 Hari Terakhir</h2>
          {statsLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Memuat...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats?.weeklyIncome ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", fontSize: 12 }}
                  formatter={(v: number) => [formatRp(v), "Pendapatan"]} labelFormatter={(l) => formatDate(l as string)} />
                <Bar dataKey="income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Info Cepat</h2>
          <div className="space-y-2">
            <InfoRow icon={<Gamepad2 size={14} />} label="Total Unit PS" value={String(stats?.totalUnits ?? 0)} />
            <InfoRow icon={<Package size={14} />} label="Jenis Produk" value={String(stats?.totalProducts ?? 0)} />
            <InfoRow icon={<Monitor size={14} />} label="Unit Dipakai" value={String((stats?.totalUnits ?? 0) - (stats?.availableUnits ?? 0))} valueClass="text-yellow-400" />
            <InfoRow icon={<Monitor size={14} />} label="Unit Tersedia" value={String(stats?.availableUnits ?? 0)} valueClass="text-chart-3" />
            <InfoRow icon={<Banknote size={14} />} label="Total Cash" value={statsLoading ? "..." : formatRp(stats?.cashIncome ?? 0)} valueClass="text-chart-3" />
            <InfoRow icon={<CreditCard size={14} />} label="Total QRIS" value={statsLoading ? "..." : formatRp(stats?.qrisIncome ?? 0)} valueClass="text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products with period filter */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-yellow-400" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Produk Terlaku</h2>
          </div>
          <div className="flex gap-1 flex-wrap mb-3">
            {PRODUCT_PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setProductPeriod(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${productPeriod === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          {topProdLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : !topProducts?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">Belum ada penjualan produk di periode ini</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-gray-400/20 text-gray-400" : i === 2 ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.productName}</p>
                    <p className="text-xs text-muted-foreground">{formatRp(p.totalRevenue)} pendapatan</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-chart-3">{p.totalQty}</p>
                    <p className="text-xs text-muted-foreground">terjual</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Units */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Unit PS Terfavorit</h2>
            <span className="text-xs text-muted-foreground">berdasarkan sesi</span>
            {canReset && (
              <button onClick={() => setShowResetUnits(true)}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
          {statsLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : !stats?.topUnits?.length ? (
            <p className="text-xs text-muted-foreground text-center py-4">Belum ada data rental</p>
          ) : (
            <div className="space-y-2">
              {stats.topUnits.map((u, i) => (
                <div key={u.unitId} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-gray-400/20 text-gray-400" : i === 2 ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Gamepad2 size={13} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.unitName}</p>
                      <p className="text-xs text-muted-foreground">{formatRp(u.totalRevenue)} pendapatan</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{u.totalSessions}</p>
                    <p className="text-xs text-muted-foreground">sesi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Transaksi Terbaru</h2>
        {recentLoading ? (
          <div className="text-muted-foreground text-sm py-4 text-center">Memuat...</div>
        ) : !recent?.length ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Belum ada transaksi hari ini</div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tx.type === "rental" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"}`}>
                    {tx.type === "rental" ? <Gamepad2 size={13} /> : <Package size={13} />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">{tx.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(tx.createdAt)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tx.paymentMethod === "cash" ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"}`}>
                        {tx.paymentMethod?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-chart-3">{formatRp(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kas Awal Modal */}
      {showKasAwal && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground">Pengaturan Kas Awal / Modal Usaha</h3>
            <p className="text-xs text-muted-foreground">Masukkan saldo awal usaha sebelum menggunakan aplikasi ini. Nilai ini ditampilkan sebagai referensi modal awal di kartu kas.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Modal Awal Cash (Rp)</label>
              <input
                type="number"
                value={editInitialCash}
                onChange={(e) => setEditInitialCash(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Modal Awal QRIS (Rp)</label>
              <input
                type="number"
                value={editInitialQris}
                onChange={(e) => setEditInitialQris(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveKasAwal} disabled={savingKasAwal}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {savingKasAwal ? "Menyimpan..." : "Simpan Kas Awal"}
              </button>
              <button onClick={() => setShowKasAwal(false)}
                className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Units Modal */}
      {showResetUnits && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/30 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Reset Statistik Unit?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Semua data sesi rental yang sudah selesai akan dihapus, sehingga data Unit Terfavorit akan menjadi <span className="font-medium text-foreground">0 sesi dan Rp 0</span>.</p>
            <div className="flex gap-2">
              <button onClick={handleResetTopUnits} disabled={resettingUnits}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {resettingUnits ? "Mereset..." : "Ya, Reset Sekarang"}
              </button>
              <button onClick={() => setShowResetUnits(false)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl md:text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value, valueClass = "text-foreground" }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
