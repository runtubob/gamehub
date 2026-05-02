import { useState } from "react";
import { useListExpenses, useCreateExpense, useDeleteExpense, getListExpensesQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TrendingDown, Plus, Trash2, Banknote, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const todayStr = () => new Date().toISOString().split("T")[0];

export default function Expenses() {
  const [date, setDate] = useState(todayStr());
  const { data: expenses, isLoading } = useListExpenses({ date }, { query: { queryKey: getListExpensesQueryKey({ date }) } });
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey({ date }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleAdd = () => {
    if (!desc.trim() || !amount) return;
    createExpense.mutate(
      { data: { description: desc.trim(), amount: parseInt(amount), paymentMethod } },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setDesc(""); setAmount(""); setPaymentMethod("cash");
          toast({ title: "Pengeluaran berhasil dicatat" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteExpense.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Pengeluaran dihapus" }); },
    });
  };

  const totalCash = expenses?.filter((e) => e.paymentMethod === "cash").reduce((s, e) => s + e.amount, 0) ?? 0;
  const totalQris = expenses?.filter((e) => e.paymentMethod === "qris").reduce((s, e) => s + e.amount, 0) ?? 0;
  const totalAll = totalCash + totalQris;

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pengeluaran</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Catat uang yang keluar</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90">
            <Plus size={16} /> Catat Pengeluaran
          </button>
        </div>
      </div>

      {/* Summary */}
      {expenses && expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Pengeluaran</p>
            <p className="text-xl font-bold text-destructive">{formatRp(totalAll)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Banknote size={12} /> Cash</div>
            <p className="text-xl font-bold text-foreground">{formatRp(totalCash)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><CreditCard size={12} /> QRIS</div>
            <p className="text-xl font-bold text-foreground">{formatRp(totalQris)}</p>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Pengeluaran Baru</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 lg:col-span-1">
              <label className="text-xs text-muted-foreground mb-1 block">Keterangan</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="cth. Beli pulsa listrik" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Jumlah (Rp)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Sumber Uang</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "cash" ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground hover:border-chart-3/50"}`}
              >
                <Banknote size={15} /> Cash
              </button>
              <button
                onClick={() => setPaymentMethod("qris")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <CreditCard size={15} /> QRIS
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createExpense.isPending} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
              {createExpense.isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-16 animate-pulse" />)}</div>
      ) : !expenses?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <TrendingDown size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Belum ada pengeluaran hari ini</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Keterangan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Waktu</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sumber</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Jumlah</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-destructive" />
                      <span className="text-sm text-foreground">{exp.description}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{formatTime(exp.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${exp.paymentMethod === "cash" ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary"}`}>
                      {exp.paymentMethod === "cash" ? <Banknote size={10} /> : <CreditCard size={10} />}
                      {exp.paymentMethod.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-destructive">{formatRp(exp.amount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => handleDelete(exp.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
