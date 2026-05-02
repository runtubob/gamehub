import { useEffect, useState, useRef } from "react";
import {
  useListActiveRentals, useStopRental, usePayRental, useExtendRental, useListRentalPackages,
  getListActiveRentalsQueryKey, getListUnitsQueryKey, getGetDashboardQueryKey, getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Square, Clock, Gamepad2, CreditCard, Banknote, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

function CountdownTimer({ endTime, totalCost, paymentStatus }: { endTime: string | Date; totalCost: number; paymentStatus: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000)));
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endTime]);
  const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
  const isExpired = remaining === 0, isUrgent = remaining > 0 && remaining <= 300;
  return (
    <div className="space-y-1">
      <div className={`font-mono text-3xl font-bold tabular-nums ${isExpired ? "text-destructive animate-pulse" : isUrgent ? "text-orange-400" : "text-yellow-400"}`}>
        {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        {isExpired ? <span className="text-destructive font-semibold">WAKTU HABIS</span>
          : isUrgent ? <span className="text-orange-400">Hampir selesai • {formatRp(totalCost)}</span>
          : <span>Biaya paket: <span className="text-chart-3 font-semibold">{formatRp(totalCost)}</span></span>}
        {paymentStatus === "unpaid" && (
          <span className="inline-flex items-center gap-0.5 text-orange-400 font-medium"><AlertCircle size={10}/> BELUM BAYAR</span>
        )}
        {paymentStatus === "paid" && (
          <span className="inline-flex items-center gap-0.5 text-chart-3 font-medium"><CheckCircle size={10}/> LUNAS</span>
        )}
      </div>
    </div>
  );
}

type ModalMode = "stop" | "pay" | "extend";

export default function ActiveRentals() {
  const { data: activeRentals, isLoading } = useListActiveRentals({
    query: { refetchInterval: 5000, queryKey: getListActiveRentalsQueryKey() },
  });
  const { data: packages } = useListRentalPackages();
  const stopRental = useStopRental();
  const payRental = usePayRental();
  const extendRental = useExtendRental();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modal, setModal] = useState<{ id: number; label: string; cost: number; mode: ModalMode } | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "qris">("cash");
  const [extPkgId, setExtPkgId] = useState<number | null>(null);
  const [extPayNow, setExtPayNow] = useState(true);
  const expiredShown = useRef<Set<number>>(new Set());

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  };

  useEffect(() => {
    if (!activeRentals) return;
    for (const r of activeRentals) {
      if (r.remainingSeconds === 0 && r.paymentStatus === "unpaid" && !expiredShown.current.has(r.id)) {
        expiredShown.current.add(r.id);
        setPayMethod("cash");
        setModal({ id: r.id, label: r.packageLabel, cost: r.totalCost, mode: "stop" });
      }
    }
  }, [activeRentals]);

  const handleConfirm = () => {
    if (!modal) return;
    if (modal.mode === "stop") {
      stopRental.mutate({ id: modal.id, data: { paymentMethod: payMethod } }, {
        onSuccess: () => { invalidateAll(); setModal(null); toast({ title: "Rental selesai", description: `${formatRp(modal.cost)} via ${payMethod.toUpperCase()}` }); },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });
    } else if (modal.mode === "pay") {
      payRental.mutate({ id: modal.id, data: { paymentMethod: payMethod } }, {
        onSuccess: () => { invalidateAll(); setModal(null); toast({ title: "Pembayaran dikonfirmasi", description: `${formatRp(modal.cost)} via ${payMethod.toUpperCase()}` }); },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });
    } else if (modal.mode === "extend") {
      if (!extPkgId) return;
      const pkg = packages?.find(p => p.id === extPkgId);
      extendRental.mutate({ id: modal.id, data: { packageId: extPkgId, payNow: extPayNow, paymentMethod: extPayNow ? payMethod : undefined } }, {
        onSuccess: () => { invalidateAll(); setModal(null); toast({ title: "Waktu ditambahkan", description: `+${pkg?.label} (${formatRp(pkg?.price ?? 0)})` }); },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });
    }
  };

  const isPending = stopRental.isPending || payRental.isPending || extendRental.isPending;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Rental Aktif</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{isLoading ? "Memuat..." : `${activeRentals?.length ?? 0} sesi aktif`}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-48 animate-pulse" />)}
        </div>
      ) : !activeRentals?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Zap size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Tidak ada rental aktif</p>
          <p className="text-xs text-muted-foreground mt-1">Mulai rental dari halaman Unit PlayStation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeRentals.map((rental) => {
            const isExpired = rental.remainingSeconds === 0;
            const isUnpaid = rental.paymentStatus === "unpaid";
            return (
              <div key={rental.id} className={`bg-card border rounded-xl p-4 md:p-5 space-y-4 ${isExpired ? "border-destructive/60 bg-destructive/5" : isUnpaid ? "border-orange-500/40 bg-orange-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Gamepad2 size={16} className={isExpired ? "text-destructive" : "text-yellow-400"} />
                    <span className="font-bold text-foreground">{rental.unitName}</span>
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${isExpired ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-300"}`}>
                      {isExpired ? "Waktu Habis" : "Aktif"}
                    </span>
                    {isUnpaid && !isExpired && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300 font-medium">
                        <AlertCircle size={10} /> Belum Bayar
                      </span>
                    )}
                    {!isUnpaid && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-chart-3/15 text-chart-3 font-medium">
                        <CheckCircle size={10} /> Lunas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} /><span>Paket: <span className="text-foreground font-medium">{rental.packageLabel}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mulai: {new Date(rental.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <CountdownTimer endTime={rental.endTime} totalCost={rental.totalCost} paymentStatus={rental.paymentStatus} />

                <div className="flex gap-2 flex-wrap">
                  {isUnpaid && !isExpired && (
                    <button onClick={() => { setPayMethod("cash"); setModal({ id: rental.id, label: rental.packageLabel, cost: rental.totalCost, mode: "pay" }); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600">
                      <CheckCircle size={13} /> Bayar Sekarang
                    </button>
                  )}
                  <button onClick={() => { setExtPkgId(packages?.[0]?.id ?? null); setExtPayNow(true); setPayMethod("cash"); setModal({ id: rental.id, label: rental.packageLabel, cost: rental.totalCost, mode: "extend" }); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-medium hover:bg-primary/30">
                    <Plus size={13} /> Tambah Waktu
                  </button>
                  <button onClick={() => { setPayMethod("cash"); setModal({ id: rental.id, label: rental.packageLabel, cost: rental.totalCost, mode: "stop" }); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isExpired ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse" : "bg-destructive/80 text-destructive-foreground hover:bg-destructive"}`}>
                    <Square size={13} /> Stop & Bayar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-5 w-full max-w-sm space-y-4">
            {modal.mode === "extend" ? (
              <>
                <h3 className="font-bold text-foreground flex items-center gap-2"><Plus size={16} className="text-primary" /> Tambah Waktu Rental</h3>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Pilih Paket Tambahan</label>
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {packages?.map((pkg) => (
                      <button key={pkg.id} onClick={() => setExtPkgId(pkg.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${extPkgId === pkg.id ? "border-primary bg-primary/20" : "border-border bg-muted/30 hover:border-primary/50"}`}>
                        <div className="font-bold text-sm text-foreground">{pkg.label}</div>
                        <div className={`text-xs mt-0.5 ${extPkgId === pkg.id ? "text-primary" : "text-muted-foreground"}`}>{formatRp(pkg.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Bayar tambahan sekarang?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setExtPayNow(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${extPayNow ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground"}`}>Ya, bayar</button>
                    <button onClick={() => setExtPayNow(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${!extPayNow ? "border-orange-500 bg-orange-500/10 text-orange-400" : "border-border text-muted-foreground"}`}>Bayar nanti</button>
                  </div>
                </div>
                {extPayNow && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPayMethod("cash")} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${payMethod === "cash" ? "border-chart-3 bg-chart-3/10" : "border-border"}`}>
                      <Banknote size={20} className={payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"} />
                      <span className={`text-xs font-semibold ${payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"}`}>Cash</span>
                    </button>
                    <button onClick={() => setPayMethod("qris")} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${payMethod === "qris" ? "border-primary bg-primary/10" : "border-border"}`}>
                      <CreditCard size={20} className={payMethod === "qris" ? "text-primary" : "text-muted-foreground"} />
                      <span className={`text-xs font-semibold ${payMethod === "qris" ? "text-primary" : "text-muted-foreground"}`}>QRIS</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  {modal.mode === "pay" ? <><CheckCircle size={16} className="text-chart-3" /> Konfirmasi Pembayaran</> : <><Square size={16} className="text-destructive" /> Selesaikan Rental</>}
                </h3>
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">Total tagihan</p>
                  <p className="text-3xl font-bold text-chart-3 mt-1">{formatRp(modal.cost)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{modal.label}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPayMethod("cash")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === "cash" ? "border-chart-3 bg-chart-3/10" : "border-border hover:border-chart-3/50"}`}>
                    <Banknote size={24} className={payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"} />
                    <span className={`text-sm font-semibold ${payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"}`}>Cash</span>
                  </button>
                  <button onClick={() => setPayMethod("qris")} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === "qris" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                    <CreditCard size={24} className={payMethod === "qris" ? "text-primary" : "text-muted-foreground"} />
                    <span className={`text-sm font-semibold ${payMethod === "qris" ? "text-primary" : "text-muted-foreground"}`}>QRIS</span>
                  </button>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={handleConfirm} disabled={isPending || (modal.mode === "extend" && !extPkgId)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${modal.mode === "extend" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}>
                {isPending ? "Memproses..." : modal.mode === "extend" ? "Tambah Waktu" : modal.mode === "pay" ? "Konfirmasi Bayar" : "Selesaikan"}
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
