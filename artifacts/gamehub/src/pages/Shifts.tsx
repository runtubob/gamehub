import { useState, useEffect } from "react";
import {
  useGetActiveShift, useStartShift, useEndShift, useListShifts, useGetShiftTransactions,
  getGetActiveShiftQueryKey, getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Clock, Play, StopCircle, TrendingUp, CheckCircle2,
  ChevronDown, ChevronUp, Banknote, CreditCard, ShoppingBag, Receipt, Trash2, AlertTriangle, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

function formatDuration(start: string, end?: string | null) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function ElapsedTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - new Date(startTime).getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span className="font-mono text-2xl font-bold text-primary">{elapsed}</span>;
}

function ShiftExpandedDetail({ shiftId }: { shiftId: number }) {
  const { data: transactions, isLoading } = useGetShiftTransactions(shiftId);

  const cashTotal = transactions?.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + t.amount, 0) ?? 0;
  const qrisTotal = transactions?.filter((t) => t.paymentMethod === "qris").reduce((s, t) => s + t.amount, 0) ?? 0;
  const totalDiscount = transactions?.reduce((s, t) => s + (t.discountAmount ?? 0), 0) ?? 0;

  if (isLoading) return <div className="col-span-2 md:col-span-4 h-8 bg-muted/20 rounded animate-pulse" />;
  if (!transactions?.length) return (
    <div className="col-span-2 md:col-span-4 text-center py-3 text-sm text-muted-foreground">Belum ada transaksi di shift ini</div>
  );

  return (
    <div className="col-span-2 md:col-span-4 space-y-3 pt-1">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-chart-3/10 border border-chart-3/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-0.5"><Banknote size={11} className="text-chart-3" /><p className="text-xs text-muted-foreground">Cash</p></div>
          <p className="font-semibold text-sm text-chart-3">{formatRp(cashTotal)}</p>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-0.5"><CreditCard size={11} className="text-primary" /><p className="text-xs text-muted-foreground">QRIS</p></div>
          <p className="font-semibold text-sm text-primary">{formatRp(qrisTotal)}</p>
        </div>
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-0.5"><ShoppingBag size={11} className="text-muted-foreground" /><p className="text-xs text-muted-foreground">Transaksi</p></div>
          <p className="font-semibold text-sm text-foreground">{transactions.length} item</p>
        </div>
        {totalDiscount > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Total Diskon</p>
            <p className="font-semibold text-sm text-destructive">-{formatRp(totalDiscount)}</p>
          </div>
        )}
      </div>

      <div className="bg-muted/10 rounded-lg overflow-hidden border border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
          <Receipt size={12} className="text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daftar Transaksi Shift</p>
        </div>
        <div className="max-h-52 overflow-y-auto divide-y divide-border">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                {tx.paymentMethod === "cash" ? <Banknote size={13} className="text-chart-3 shrink-0" /> : <CreditCard size={13} className="text-primary shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{tx.description}</p>
                  <p className="text-[10px] text-muted-foreground">{formatTime(tx.createdAt)}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs font-semibold text-foreground">{formatRp(tx.amount)}</p>
                {tx.discountAmount > 0 && <p className="text-[10px] text-destructive">-{formatRp(tx.discountAmount)} diskon</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface OrphanShift {
  id: number; userId: number; userName: string; role: string;
  startTime: string; status: string; notes?: string | null;
}

export default function Shifts() {
  const { data: activeShift, isLoading: loadingActive } = useGetActiveShift();
  const { data: allShifts, isLoading: loadingList } = useListShifts({});
  const startShift = useStartShift();
  const endShift = useEndShift();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const isSuperAdmin = user?.role === "superadmin";

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<null | { totalIncome: number; cashTransactions: number; qrisTransactions: number; cashExpenses: number }>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [orphanShifts, setOrphanShifts] = useState<OrphanShift[]>([]);
  const [forceEndId, setForceEndId] = useState<number | null>(null);
  const [forcingEnd, setForcingEnd] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetActiveShiftQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey({}) });
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/shifts/active-all", { headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` } })
      .then(r => r.json())
      .then(data => {
        const myId = user?.id;
        const orphans = (data as OrphanShift[]).filter(s => s.userId !== myId);
        setOrphanShifts(orphans);
      })
      .catch(() => {});
  }, [isSuperAdmin, user?.id, allShifts]);

  const handleStart = () => {
    startShift.mutate(
      { data: { openingCash: 0, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setShowStart(false);
          setNotes("");
          toast({ title: "Shift dimulai!" });
        },
        onError: (e: Error) => toast({ title: "Gagal memulai shift", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleEnd = () => {
    if (!activeShift) return;
    endShift.mutate(
      { id: activeShift.id, data: { closingCash: 0, notes: notes.trim() || undefined } },
      {
        onSuccess: (data) => {
          invalidate();
          setShowEnd(false);
          setNotes("");
          const d = data as { totalIncome: number; cashTransactions: number; qrisTransactions: number; cashExpenses: number };
          setSummary({ totalIncome: d.totalIncome, cashTransactions: d.cashTransactions, qrisTransactions: d.qrisTransactions, cashExpenses: d.cashExpenses });
        },
        onError: (e: Error) => toast({ title: "Gagal menutup shift", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteShift = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/shifts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Gagal menghapus"); }
      invalidate();
      setDeleteConfirm(null);
      toast({ title: "Riwayat shift dihapus" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const handleForceEnd = async (id: number) => {
    setForcingEnd(true);
    try {
      const res = await fetch(`/api/shifts/${id}/force-end`, { method: "PUT", headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Gagal"); }
      invalidate();
      setForceEndId(null);
      setOrphanShifts(prev => prev.filter(s => s.id !== id));
      toast({ title: "Shift berhasil ditutup paksa" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally { setForcingEnd(false); }
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Shift Kerja</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola waktu kerja dan pantau transaksi per shift</p>
      </div>

      {/* Summary Modal */}
      {summary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle2 size={22} className="text-green-400" /></div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Shift Selesai</h3>
                <p className="text-xs text-muted-foreground">Ringkasan transaksi shift ini</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 col-span-2">
                <p className="text-xs text-muted-foreground">Total Pendapatan Shift</p>
                <p className="font-bold text-xl text-chart-3 mt-0.5">{formatRp(summary.totalIncome)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><Banknote size={11} className="text-chart-3" /><p className="text-xs text-muted-foreground">Pendapatan Cash</p></div>
                <p className="font-semibold text-sm text-foreground">{formatRp(summary.cashTransactions)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1"><CreditCard size={11} className="text-primary" /><p className="text-xs text-muted-foreground">Pendapatan QRIS</p></div>
                <p className="font-semibold text-sm text-foreground">{formatRp(summary.qrisTransactions)}</p>
              </div>
              {summary.cashExpenses > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pengeluaran Cash</p>
                  <p className="font-semibold text-sm text-destructive mt-0.5">−{formatRp(summary.cashExpenses)}</p>
                </div>
              )}
            </div>
            <button onClick={() => setSummary(null)} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Tutup</button>
          </div>
        </div>
      )}

      {/* Start Shift Modal */}
      {showStart && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground text-lg">Mulai Shift</h3>
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">Shift akan dimulai sekarang. Semua transaksi dalam periode ini akan tercatat.</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="cth. Shift pagi, Shift malam..." className={inputClass} autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={handleStart} disabled={startShift.isPending} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Play size={14} /> {startShift.isPending ? "Memulai..." : "Mulai Shift"}
              </button>
              <button onClick={() => { setShowStart(false); setNotes(""); }} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Modal */}
      {showEnd && activeShift && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground text-lg">Tutup Shift</h3>
            <div className="bg-muted/20 rounded-lg p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Shift dimulai: <span className="text-foreground font-medium">{formatTime(activeShift.startTime)}</span></p>
              <p className="text-muted-foreground">Durasi: <span className="text-foreground font-medium">{formatDuration(activeShift.startTime)}</span></p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan Serah Terima (opsional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan untuk shift berikutnya..." className={inputClass} autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEnd} disabled={endShift.isPending} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                <StopCircle size={14} /> {endShift.isPending ? "Menutup..." : "Tutup Shift"}
              </button>
              <button onClick={() => { setShowEnd(false); setNotes(""); }} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-destructive/30 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-destructive" /></div>
              <div><h3 className="font-bold text-foreground">Hapus Riwayat Shift?</h3><p className="text-xs text-muted-foreground">Aksi ini tidak dapat dibatalkan</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Data shift ini akan dihapus permanen dari riwayat. Transaksi yang terkait tidak akan terhapus.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDeleteShift(deleteConfirm)} disabled={deleting}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Force End Confirm Modal */}
      {forceEndId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-orange-500/30 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/15 rounded-full flex items-center justify-center"><AlertCircle size={20} className="text-orange-400" /></div>
              <div><h3 className="font-bold text-foreground">Paksa Tutup Shift?</h3><p className="text-xs text-muted-foreground">Shift dari akun yang tidak dapat mengakhirinya sendiri</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Shift ini akan ditutup paksa. Aksi ini hanya dilakukan jika karyawan terkait tidak dapat menutup shift sendiri (misalnya akun sudah dihapus).</p>
            <div className="flex gap-2">
              <button onClick={() => handleForceEnd(forceEndId)} disabled={forcingEnd}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {forcingEnd ? "Menutup..." : "Ya, Tutup Paksa"}
              </button>
              <button onClick={() => setForceEndId(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Shift Card */}
      {loadingActive ? (
        <div className="bg-card border border-card-border rounded-xl p-5 h-36 animate-pulse" />
      ) : activeShift ? (
        <div className="bg-card border border-primary/40 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-foreground">Shift Sedang Berjalan</span>
            </div>
            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">{activeShift.role}</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Durasi</p>
              <ElapsedTimer startTime={activeShift.startTime} />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Mulai</p>
              <p className="text-sm font-medium text-foreground">{formatTime(activeShift.startTime)}</p>
            </div>
          </div>
          {activeShift.notes && (
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Catatan</p>
              <p className="text-sm text-foreground">{activeShift.notes}</p>
            </div>
          )}
          <button onClick={() => { setShowEnd(true); setNotes(""); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">
            <StopCircle size={14} /> Tutup Shift
          </button>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
            <Clock size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Belum Ada Shift Aktif</p>
            <p className="text-sm text-muted-foreground mt-1">Mulai shift untuk mencatat waktu kerja dan transaksimu</p>
          </div>
          <button onClick={() => { setShowStart(true); setNotes(""); }}
            className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Play size={14} /> Mulai Shift
          </button>
        </div>
      )}

      {/* Superadmin: Orphaned Shifts */}
      {isSuperAdmin && orphanShifts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-orange-400" />
            <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wide">Shift Tidak Aktif (Akun Dihapus)</h2>
          </div>
          <p className="text-xs text-muted-foreground">Shift berikut tidak dapat ditutup oleh penggunanya. Tutup paksa jika diperlukan.</p>
          {orphanShifts.map((s) => (
            <div key={s.id} className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{s.userName} <span className="text-xs text-muted-foreground font-normal">({s.role})</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">Dimulai {formatDateTime(s.startTime)} · Durasi {formatDuration(s.startTime)}</p>
                {s.notes && <p className="text-xs text-muted-foreground mt-0.5">Catatan: {s.notes}</p>}
              </div>
              <button onClick={() => setForceEndId(s.id)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-medium hover:bg-orange-500/25">
                <StopCircle size={12} /> Tutup Paksa
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Shift History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Riwayat Shift</h2>
          {isSuperAdmin && <p className="text-xs text-muted-foreground">Superadmin dapat menghapus riwayat</p>}
        </div>
        {loadingList ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-16 animate-pulse" />)}</div>
        ) : !allShifts?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Belum ada riwayat shift</div>
        ) : (
          <div className="space-y-2">
            {allShifts.map((shift) => {
              const isExpanded = expandedId === shift.id;
              return (
                <div key={shift.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                  <div className="flex items-center">
                    <button
                      className="flex-1 flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${shift.status === "open" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{shift.userName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(shift.startTime)}
                            {shift.endTime && ` — ${formatTime(shift.endTime)}`}
                            {" · "}{formatDuration(shift.startTime, shift.endTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${shift.status === "open" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {shift.status === "open" ? "Berjalan" : "Selesai"}
                        </span>
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                      </div>
                    </button>
                    {isSuperAdmin && shift.status === "closed" && (
                      <button
                        onClick={() => setDeleteConfirm(shift.id)}
                        className="px-3 py-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border-l border-border"
                        title="Hapus riwayat shift"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-border bg-muted/5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                        {shift.notes && (
                          <div className="bg-muted/20 rounded-lg p-2.5 col-span-2">
                            <p className="text-[10px] text-muted-foreground">Catatan Serah Terima</p>
                            <p className="text-sm text-foreground mt-0.5">{shift.notes}</p>
                          </div>
                        )}
                        <ShiftExpandedDetail shiftId={shift.id} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
