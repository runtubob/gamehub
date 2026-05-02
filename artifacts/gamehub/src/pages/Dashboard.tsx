import { useGetDashboard, useListRecentTransactions } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, Gamepad2, Package, Receipt, Monitor, Zap, TrendingUp } from "lucide-react";

function formatRp(amount: number) {
  return "Rp " + amount.toLocaleString("id-ID");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string | Date) {
  return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboard();
  const { data: recent, isLoading: recentLoading } = useListRecentTransactions({ limit: 8 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan operasional hari ini</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<BarChart3 size={18} className="text-chart-1" />}
          label="Pendapatan Hari Ini"
          value={statsLoading ? "..." : formatRp(stats?.todayIncome ?? 0)}
          accent="text-chart-1"
          data-testid="stat-today-income"
        />
        <StatCard
          icon={<Zap size={18} className="text-yellow-400" />}
          label="Rental Aktif"
          value={statsLoading ? "..." : String(stats?.activeRentals ?? 0)}
          accent="text-yellow-400"
          data-testid="stat-active-rentals"
        />
        <StatCard
          icon={<Monitor size={18} className="text-chart-3" />}
          label="Unit Tersedia"
          value={statsLoading ? "..." : `${stats?.availableUnits ?? 0} / ${stats?.totalUnits ?? 0}`}
          accent="text-chart-3"
          data-testid="stat-available-units"
        />
        <StatCard
          icon={<Receipt size={18} className="text-chart-4" />}
          label="Transaksi Hari Ini"
          value={statsLoading ? "..." : String(stats?.todayTransactions ?? 0)}
          accent="text-chart-4"
          data-testid="stat-today-transactions"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          label="Profit Hari Ini"
          value={statsLoading ? "..." : formatRp(stats?.todayProfit ?? 0)}
          accent="text-emerald-400"
          data-testid="stat-today-profit"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Income Chart */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Pendapatan 7 Hari Terakhir
          </h2>
          {statsLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Memuat...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats?.weeklyIncome ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatRp(v), "Pendapatan"]}
                  labelFormatter={(l) => formatDate(l as string)}
                />
                <Bar dataKey="income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Info Cepat</h2>
          <div className="space-y-2">
            <InfoRow icon={<Gamepad2 size={15} />} label="Total Unit PS" value={String(stats?.totalUnits ?? 0)} />
            <InfoRow icon={<Package size={15} />} label="Jenis Produk" value={String(stats?.totalProducts ?? 0)} />
            <InfoRow
              icon={<Monitor size={15} />}
              label="Unit Dipakai"
              value={String((stats?.totalUnits ?? 0) - (stats?.availableUnits ?? 0))}
              valueClass="text-yellow-400"
            />
            <InfoRow
              icon={<Monitor size={15} />}
              label="Unit Tersedia"
              value={String(stats?.availableUnits ?? 0)}
              valueClass="text-chart-3"
            />
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Transaksi Terbaru</h2>
        {recentLoading ? (
          <div className="text-muted-foreground text-sm py-4 text-center">Memuat...</div>
        ) : !recent?.length ? (
          <div className="text-muted-foreground text-sm py-8 text-center">Belum ada transaksi hari ini</div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <div
                key={tx.id}
                data-testid={`tx-row-${tx.id}`}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs ${tx.type === "rental" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"}`}>
                    {tx.type === "rental" ? <Gamepad2 size={13} /> : <Package size={13} />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</p>
                  </div>
                </div>
                <span data-testid={`tx-amount-${tx.id}`} className="text-sm font-semibold text-chart-3">
                  {formatRp(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, accent, "data-testid": testId
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  "data-testid"?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4" data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function InfoRow({
  icon, label, value, valueClass = "text-foreground"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
