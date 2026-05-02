import { useState, useEffect } from "react";
import {
  useGetActiveShift, useStartShift, useEndShift, useListShifts,
  getGetActiveShiftQueryKey, getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Play, StopCircle, Wallet, TrendingUp, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

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
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

export default function Shifts() {
  const { data: activeShift, isLoading: loadingActive } = useGetActiveShift();
  const { data: allShifts, isLoading: loadingList } = useListShifts({});
  const startShift = useStartShift();
  const endShift = useEndShift();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const lastClosedShift = allShifts?.find((s) => s.status === "closed");

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<null | {
    shift: NonNullable<typeof activeShift>;
    cashTransactions: number;
    qrisTransactions: number;
    totalIncome: number;
    expectedCash: number;
    variance: number;
  }>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetActiveShiftQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey({}) });
  };

  const handleStart = () => {
    const amount = parseInt(openingCash.replace(/\D/g, ""));
    if (isNaN(amount)) { toast({ title: "Masukkan jumlah uang kas awal", variant: "destructive" }); return; }
    startShift.mutate(
      { data: { openingCash: amount, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setShowStart(false);
          setOpeningCash("");
          setNotes("");
          toast({ title: "Shift dimulai!" });
        },
        onError: (e: Error) => toast({ title: "Gagal memulai shift", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleEnd = () => {
    if (!activeShift) return;
    const amount = parseInt(closingCash.replace(/\D/g, ""));
    if (isNaN(amount)) { toast({ title: "Masukkan jumlah uang kas akhir", variant: "destructive" }); return; }
    endShift.mutate(
      { id: activeShift.id, data: { closingCash: amount, notes: notes.trim() || undefined } },
      {
        onSuccess: (data) => {
          invalidate();
          setShowEnd(false);
          setClosingCash("");
          setNotes("");
          setSummary(data as typeof summary);
        },
        onError: (e: Error) => toast({ title: "Gagal menutup shift", description: e.message, variant: "destructive" }),
      }
    );
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Shift & Handover</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola shift kerja dan rekonsiliasi kas</p>
      </div>

      {/* Summary Modal setelah tutup shift */}
      {summary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">Shift Selesai</h3>
                <p className="text-xs text-muted-foreground">
                  {formatTime(summary.shift.startTime)} – {formatTime(summary.shift.endTime!)} · {formatDuration(summary.shift.startTime, summary.shift.endTime)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                  <p className="font-bold text-foreground mt-0.5">{formatRp(summary.totalIncome)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pendapatan Tunai</p>
                  <p className="font-bold text-foreground mt-0.5">{formatRp(summary.cashTransactions)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Kas Awal</p>
                  <p className="font-bold text-foreground mt-0.5">{formatRp(summary.shift.openingCash)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Kas Seharusnya</p>
                  <p className="font-bold text-foreground mt-0.5">{formatRp(summary.expectedCash)}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Kas Aktual</p>
                  <p className="font-bold text-foreground mt-0.5">{formatRp(summary.shift.closingCash!)}</p>
                </div>
                <div className={`rounded-lg p-3 ${summary.variance === 0 ? "bg-green-500/10" : summary.variance > 0 ? "bg-blue-500/10" : "bg-destructive/10"}`}>
                  <p className="text-xs text-muted-foreground">Selisih</p>
                  <p className={`font-bold mt-0.5 ${summary.variance === 0 ? "text-green-400" : summary.variance > 0 ? "text-blue-400" : "text-destructive"}`}>
                    {summary.variance > 0 ? "+" : ""}{formatRp(summary.variance)}
                  </p>
                </div>
              </div>
              {summary.variance !== 0 && (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${summary.variance > 0 ? "bg-blue-500/10 text-blue-300" : "bg-destructive/10 text-destructive"}`}>
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{summary.variance > 0 ? `Kas lebih ${formatRp(summary.variance)} dari yang diharapkan.` : `Kas kurang ${formatRp(Math.abs(summary.variance))} dari yang diharapkan.`}</span>
                </div>
              )}
            </div>
            <button onClick={() => setSummary(null)} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Start Shift Modal */}
      {showStart && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground text-lg">Mulai Shift</h3>

            {/* Info kas dari shift sebelumnya */}
            {lastClosedShift && lastClosedShift.closingCash !== null && lastClosedShift.closingCash !== undefined ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Wallet size={13} className="text-primary shrink-0" />
                  <p className="text-xs font-semibold text-primary">Kas dari shift sebelumnya</p>
                </div>
                <p className="text-lg font-bold text-foreground">{formatRp(lastClosedShift.closingCash)}</p>
                <p className="text-xs text-muted-foreground">
                  Ditutup oleh <span className="text-foreground font-medium">{lastClosedShift.userName}</span> pukul {formatTime(lastClosedShift.endTime!)}. Masukkan jumlah ini sebagai kas awal jika kas belum diambil.
                </p>
                <button
                  onClick={() => setOpeningCash(String(lastClosedShift.closingCash))}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Gunakan jumlah ini ({formatRp(lastClosedShift.closingCash)})
                </button>
              </div>
            ) : (
              <div className="bg-muted/20 border border-border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={13} className="text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">Belum ada riwayat shift. Hitung uang kas yang ada di laci kasir sekarang.</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kas Awal — Uang di Laci Kasir (Rp)</label>
              <input
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
                type="number"
                className={inputClass}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Hitung fisik uang tunai di laci kasir sebelum shift dimulai.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="cth. Shift pagi, Shift malam..." className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleStart} disabled={startShift.isPending} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Play size={14} /> {startShift.isPending ? "Memulai..." : "Mulai Shift"}
              </button>
              <button onClick={() => { setShowStart(false); setOpeningCash(""); setNotes(""); }} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Modal */}
      {showEnd && activeShift && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground text-lg">Tutup Shift</h3>
            <div className="bg-muted/20 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Shift dimulai: <span className="text-foreground font-medium">{formatTime(activeShift.startTime)}</span></p>
              <p className="text-muted-foreground mt-1">Kas awal: <span className="text-foreground font-medium">{formatRp(activeShift.openingCash)}</span></p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Hitung Kas Aktual (Rp)</label>
              <input
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                type="number"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan serah terima..." className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEnd} disabled={endShift.isPending} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                <StopCircle size={14} /> {endShift.isPending ? "Menutup..." : "Tutup Shift"}
              </button>
              <button onClick={() => { setShowEnd(false); setClosingCash(""); setNotes(""); }} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                Batal
              </button>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet size={12} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Kas Awal</span>
              </div>
              <p className="font-semibold text-sm text-foreground">{formatRp(activeShift.openingCash)}</p>
            </div>
            {activeShift.notes && (
              <div className="bg-muted/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Catatan</p>
                <p className="text-sm text-foreground truncate">{activeShift.notes}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowEnd(true); setNotes(""); setClosingCash(""); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            <StopCircle size={14} /> Tutup Shift & Hitung Kas
          </button>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
            <Clock size={28} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Belum Ada Shift Aktif</p>
            <p className="text-sm text-muted-foreground mt-1">Mulai shift untuk mencatat kas dan transaksi kamu</p>
          </div>
          <button
            onClick={() => { setShowStart(true); setOpeningCash(""); setNotes(""); }}
            className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Play size={14} /> Mulai Shift
          </button>
        </div>
      )}

      {/* Shift History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Riwayat Shift</h2>
        {loadingList ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-16 animate-pulse" />)}
          </div>
        ) : !allShifts?.length ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Belum ada riwayat shift</div>
        ) : (
          <div className="space-y-2">
            {allShifts.map((shift) => {
              const isExpanded = expandedId === shift.id;
              const variance = shift.closingCash !== null && shift.closingCash !== undefined
                ? shift.closingCash - shift.openingCash
                : null;
              return (
                <div key={shift.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${shift.status === "open" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{shift.userName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(shift.startTime)}{shift.endTime ? ` – ${formatTime(shift.endTime)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${shift.status === "open" ? "bg-green-500/20 text-green-300" : "bg-muted/40 text-muted-foreground"}`}>
                        {shift.status === "open" ? "Aktif" : "Selesai"}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-border">
                      <div className="bg-muted/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Kas Awal</p>
                        <p className="font-semibold text-sm text-foreground mt-0.5">{formatRp(shift.openingCash)}</p>
                      </div>
                      {shift.closingCash !== null && shift.closingCash !== undefined && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Kas Akhir</p>
                          <p className="font-semibold text-sm text-foreground mt-0.5">{formatRp(shift.closingCash)}</p>
                        </div>
                      )}
                      {shift.endTime && (
                        <div className="bg-muted/20 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Durasi</p>
                          <p className="font-semibold text-sm text-foreground mt-0.5">{formatDuration(shift.startTime, shift.endTime)}</p>
                        </div>
                      )}
                      {variance !== null && (
                        <div className={`rounded-lg p-3 ${variance === 0 ? "bg-green-500/10" : variance > 0 ? "bg-blue-500/10" : "bg-destructive/10"}`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp size={11} className="text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Selisih Kas</p>
                          </div>
                          <p className={`font-semibold text-sm mt-0.5 ${variance === 0 ? "text-green-400" : variance > 0 ? "text-blue-400" : "text-destructive"}`}>
                            {variance > 0 ? "+" : ""}{formatRp(variance)}
                          </p>
                        </div>
                      )}
                      {shift.notes && (
                        <div className="col-span-2 md:col-span-4 bg-muted/20 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground">Catatan</p>
                          <p className="text-sm text-foreground mt-0.5">{shift.notes}</p>
                        </div>
                      )}
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
