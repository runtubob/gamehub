import { useState } from "react";
import {
  useListTransactions, useDeleteTransaction,
  getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Receipt, Gamepad2, Package, Filter, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, canDelete } from "@/context/AuthContext";

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
function formatDateTime(dateStr: string | Date) {
  return new Date(dateStr).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function todayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = canDelete(user?.role);

  const [dateFilter, setDateFilter] = useState(todayString());
  const [typeFilter, setTypeFilter] = useState<"" | "rental" | "product">("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; desc: string } | null>(null);

  const params = { date: dateFilter || undefined, type: typeFilter || undefined };
  const { data: transactions, isLoading } = useListTransactions(params, {
    query: { queryKey: getListTransactionsQueryKey(params) },
  });

  const deleteTransaction = useDeleteTransaction();
  const total = transactions?.reduce((s, t) => s + t.amount, 0) ?? 0;

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteTransaction.mutate({ id: deleteConfirm.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey(params) });
        setDeleteConfirm(null);
        toast({ title: "Transaksi dihapus" });
      },
      onError: (e: Error) => toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
    });
  };

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
            <p className="text-xl font-bold text-chart-3">{formatRp(total)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2"><Filter size={15} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Filter:</span></div>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | "rental" | "product")}
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">Semua Tipe</option>
          <option value="rental">Rental</option>
          <option value="product">Produk</option>
        </select>
        {(dateFilter !== todayString() || typeFilter !== "") && (
          <button onClick={() => { setDateFilter(todayString()); setTypeFilter(""); }}
            className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">Reset</button>
        )}
        {isSuperAdmin && <span className="text-xs text-chart-1 bg-chart-1/10 px-2 py-1 rounded-lg ml-auto">Mode Super Admin: dapat menghapus transaksi</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-14 animate-pulse" />)}</div>
      ) : !transactions?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Receipt size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Tidak ada transaksi</p>
          {dateFilter && <p className="text-xs text-muted-foreground mt-1">pada tanggal {new Date(dateFilter).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tipe</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Keterangan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Waktu</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Jumlah</th>
                {isSuperAdmin && <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Hapus</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tx.type === "rental" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"}`}>
                      {tx.type === "rental" ? <Gamepad2 size={11} /> : <Package size={11} />}
                      {tx.type === "rental" ? "Rental" : "Produk"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <span className="text-sm text-foreground">{tx.description}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.paymentMethod === "cash" ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"}`}>
                          {tx.paymentMethod?.toUpperCase()}
                        </span>
                        {tx.type === "product" && tx.costAmount > 0 && (
                          <span className="text-xs text-muted-foreground">Profit: {formatRp(tx.amount - tx.costAmount)}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span></td>
                  <td className="px-5 py-3.5 text-right"><span className="text-sm font-semibold text-chart-3">{formatRp(tx.amount)}</span></td>
                  {isSuperAdmin && (
                    <td className="px-3 py-3.5 text-center">
                      <button onClick={() => setDeleteConfirm({ id: tx.id, desc: tx.description })}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={isSuperAdmin ? 3 : 3} className="px-5 py-3 text-sm font-medium text-muted-foreground">Total ({transactions.length} transaksi)</td>
                <td className="px-5 py-3 text-right"><span className="text-base font-bold text-chart-3">{formatRp(total)}</span></td>
                {isSuperAdmin && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Hapus Transaksi?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-sm text-foreground font-medium">{deleteConfirm.desc}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleteTransaction.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {deleteTransaction.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
