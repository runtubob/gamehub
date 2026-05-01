import { useState } from "react";
import { useListTransactions, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Receipt, Gamepad2, Package, Filter } from "lucide-react";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDateTime(dateStr: string | Date) {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function Transactions() {
  const [dateFilter, setDateFilter] = useState(todayString());
  const [typeFilter, setTypeFilter] = useState<"" | "rental" | "product">("");

  const { data: transactions, isLoading } = useListTransactions(
    { date: dateFilter || undefined, type: typeFilter || undefined },
    { query: { queryKey: getListTransactionsQueryKey({ date: dateFilter || undefined, type: typeFilter || undefined }) } }
  );

  const total = transactions?.reduce((s, t) => s + t.amount, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Semua transaksi rental dan penjualan produk</p>
        </div>
        {transactions && transactions.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p data-testid="text-total-amount" className="text-xl font-bold text-chart-3">{formatRp(total)}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filter:</span>
        </div>
        <input
          data-testid="input-date-filter"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          data-testid="select-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "" | "rental" | "product")}
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Semua Tipe</option>
          <option value="rental">Rental</option>
          <option value="product">Produk</option>
        </select>
        {(dateFilter !== todayString() || typeFilter !== "") && (
          <button
            data-testid="button-clear-filters"
            onClick={() => { setDateFilter(todayString()); setTypeFilter(""); }}
            className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl h-14 animate-pulse" />
          ))}
        </div>
      ) : !transactions?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Receipt size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Tidak ada transaksi</p>
          <p className="text-xs text-muted-foreground mt-1">
            {dateFilter ? `pada tanggal ${new Date(dateFilter).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}` : ""}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipe</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Keterangan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Waktu</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((tx) => (
                <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      tx.type === "rental"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-green-500/15 text-green-400"
                    }`}>
                      {tx.type === "rental" ? <Gamepad2 size={11} /> : <Package size={11} />}
                      {tx.type === "rental" ? "Rental" : "Produk"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-foreground">{tx.description}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span data-testid={`text-amount-${tx.id}`} className="text-sm font-semibold text-chart-3">
                      {formatRp(tx.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={3} className="px-5 py-3 text-sm font-medium text-muted-foreground">
                  Total ({transactions.length} transaksi)
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-base font-bold text-chart-3">{formatRp(total)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
