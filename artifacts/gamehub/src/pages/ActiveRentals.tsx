import { useEffect, useState, useRef } from "react";
import {
  useListActiveRentals, useStopRental, usePayRental, useExtendRental, useListRentalPackages,
  getListActiveRentalsQueryKey, getListUnitsQueryKey, getGetDashboardQueryKey, getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Zap, Square, Clock, Gamepad2, CreditCard, Banknote, Plus,
  AlertCircle, CheckCircle, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

function CountdownTimer({
  endTime, totalCost, pendingAmount, paymentStatus,
}: {
  endTime: string | Date; totalCost: number; pendingAmount: number; paymentStatus: string;
}) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000)));
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
  const isExpired = remaining === 0, isUrgent = remaining > 0 && remaining <= 300;
  const hasPending = pendingAmount > 0;

  return (
    <div className="space-y-1.5">
      <div className={`font-mono text-3xl font-bold tabular-nums ${isExpired ? "text-destructive animate-pulse" : isUrgent ? "text-orange-400" : "text-yellow-400"}`}>
        {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {isExpired
          ? <span className="text-destructive font-semibold">WAKTU HABIS</span>
          : isUrgent
          ? <span className="text-orange-400">Hampir selesai</span>
          : null}
        {paymentStatus === "unpaid" && (
          <span className="inline-flex items-center gap-0.5 text-orange-400 font-medium">
            <AlertCircle size={10}/> Belum bayar: <span className="font-bold">{formatRp(totalCost - pendingAmount)}</span>
          </span>
        )}
        {paymentStatus === "paid" && !hasPending && (
          <span className="inline-flex items-center gap-0.5 text-chart-3 font-medium">
            <CheckCircle size={10}/> Lunas
          </span>
        )}
        {hasPending && (
          <span className="inline-flex items-center gap-0.5 text-amber-400 font-medium">
            <AlertTriangle size={10}/> Tambah waktu belum bayar: <span className="font-bold">{formatRp(pendingAmount)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

type ModalMode = "stop" | "pay" | "extend" | "pay-extension";

interface ModalState {
  id: number;
  unitName: string;
  label: string;
  baseCost: number;       // amount paid already (base rental)
  pendingAmount: number;  // unpaid extension cost
  totalCost: number;      // total (base + extension)
  mode: ModalMode;
}

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

  const [modal, setModal] = useState<ModalState | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "qris">("cash");
  const [extPkgId, setExtPkgId] = useState<number | null>(null);
  const [extPayNow, setExtPayNow] = useState(true);

  const expiredUnpaidShown = useRef<Set<number>>(new Set());
  const expiredPaidAuto = useRef<Set<number>>(new Set());

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
  };

  useEffect(() => {
    if (!activeRentals) return;
    for (const r of activeRentals) {
      if (r.remainingSeconds !== 0) continue;
      const pending = (r as { pendingAmount?: number }).pendingAmount ?? 0;
      const isFullyPaid = r.paymentStatus === "paid" && pending === 0;
      const needsPayment = r.paymentStatus === "unpaid" || pending > 0;

      if (needsPayment && !expiredUnpaidShown.current.has(r.id)) {
        expiredUnpaidShown.current.add(r.id);
        setPayMethod("cash");
        setModal({
          id: r.id, unitName: r.unitName, label: r.packageLabel,
          baseCost: r.totalCost - pending, pendingAmount: pending,
          totalCost: r.totalCost, mode: "stop",
        });
      }

      if (isFullyPaid && !expiredPaidAuto.current.has(r.id)) {
        expiredPaidAuto.current.add(r.id);
        stopRental.mutate({ id: r.id, data: {} }, {
          onSuccess: () => {
            invalidateAll();
            toast({ title: "Sesi selesai", description: `${r.unitName} — unit kini tersedia kembali.` });
          },
          onError: () => {},
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRentals]);

  const handleConfirm = () => {
    if (!modal) return;

    if (modal.mode === "stop") {
      stopRental.mutate({ id: modal.id, data: { paymentMethod: payMethod } }, {
        onSuccess: () => {
          invalidateAll();
          setModal(null);
          const desc = modal.pendingAmount > 0
            ? `${formatRp(modal.totalCost)} (termasuk tambah waktu ${formatRp(modal.pendingAmount)}) via ${payMethod.toUpperCase()}`
            : `${formatRp(modal.totalCost)} via ${payMethod.toUpperCase()}`;
          toast({ title: "Rental selesai", description: desc });
        },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });

    } else if (modal.mode === "pay") {
      payRental.mutate({ id: modal.id, data: { paymentMethod: payMethod } }, {
        onSuccess: () => {
          invalidateAll();
          setModal(null);
          toast({ title: "Pembayaran dikonfirmasi", description: `${formatRp(modal.baseCost)} via ${payMethod.toUpperCase()}` });
        },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });

    } else if (modal.mode === "pay-extension") {
      // Paying only the pending extension while rental is still running
      stopRental.mutate({ id: modal.id, data: { paymentMethod: payMethod } }, {
        onSuccess: () => {
          invalidateAll();
          setModal(null);
          toast({ title: "Rental selesai", description: `Tambah waktu ${formatRp(modal.pendingAmount)} via ${payMethod.toUpperCase()} telah dibayar.` });
        },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });

    } else if (modal.mode === "extend") {
      if (!extPkgId) return;
      const pkg = packages?.find(p => p.id === extPkgId);
      extendRental.mutate({ id: modal.id, data: { packageId: extPkgId, payNow: extPayNow, paymentMethod: extPayNow ? payMethod : undefined } }, {
        onSuccess: () => {
          invalidateAll();
          setModal(null);
          const payDesc = extPayNow ? `dibayar ${formatRp(pkg?.price ?? 0)} via ${payMethod.toUpperCase()}` : `belum dibayar — akan ditagih saat selesai`;
          toast({ title: `+${pkg?.label} ditambahkan`, description: payDesc });
        },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      });
    }
  };

  const handleFinishPaidNoExtension = (rentalId: number, unitName: string) => {
    stopRental.mutate({ id: rentalId, data: {} }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Sesi selesai", description: `${unitName} — unit kini tersedia kembali.` }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const isPending = stopRental.isPending || payRental.isPending || extendRental.isPending;

  const renderPaymentButtons = () => (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => setPayMethod("cash")}
        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === "cash" ? "border-chart-3 bg-chart-3/10" : "border-border hover:border-chart-3/50"}`}>
        <Banknote size={24} className={payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"} />
        <span className={`text-sm font-semibold ${payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"}`}>Cash</span>
      </button>
      <button onClick={() => setPayMethod("qris")}
        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${payMethod === "qris" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
        <CreditCard size={24} className={payMethod === "qris" ? "text-primary" : "text-muted-foreground"} />
        <span className={`text-sm font-semibold ${payMethod === "qris" ? "text-primary" : "text-muted-foreground"}`}>QRIS</span>
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Rental Aktif</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "Memuat..." : `${activeRentals?.length ?? 0} sesi aktif`}
        </p>
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
            const pendingAmount = (rental as { pendingAmount?: number }).pendingAmount ?? 0;
            const isExpired = rental.remainingSeconds === 0;
            const isUnpaid = rental.paymentStatus === "unpaid";
            const isPaid = rental.paymentStatus === "paid";
            const hasPendingExtension = pendingAmount > 0;
            const isFullySettled = isPaid && !hasPendingExtension;

            // Border color based on state
            const borderClass = isExpired
              ? "border-destructive/60 bg-destructive/5"
              : hasPendingExtension
              ? "border-amber-500/40 bg-amber-500/5"
              : isUnpaid
              ? "border-orange-500/40 bg-orange-500/5"
              : "border-yellow-500/40 bg-yellow-500/5";

            return (
              <div key={rental.id} className={`bg-card border rounded-xl p-4 md:p-5 space-y-4 ${borderClass}`}>
                {/* Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Gamepad2 size={16} className={isExpired ? "text-destructive" : "text-yellow-400"} />
                    <span className="font-bold text-foreground">{rental.unitName}</span>
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${isExpired ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-300"}`}>
                      {isExpired ? "Waktu Habis" : "Aktif"}
                    </span>
                    {isUnpaid && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300 font-medium">
                        <AlertCircle size={10} /> Belum Bayar
                      </span>
                    )}
                    {isFullySettled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-chart-3/15 text-chart-3 font-medium">
                        <CheckCircle size={10} /> Lunas
                      </span>
                    )}
                    {hasPendingExtension && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 font-medium">
                        <AlertTriangle size={10} /> Ada tagihan tambahan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>Paket: <span className="text-foreground font-medium">{rental.packageLabel}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mulai: {new Date(rental.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {/* Timer */}
                <CountdownTimer
                  endTime={rental.endTime}
                  totalCost={rental.totalCost}
                  pendingAmount={pendingAmount}
                  paymentStatus={rental.paymentStatus}
                />

                {/* Cost breakdown if has pending */}
                {hasPendingExtension && isPaid && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-amber-400">Rincian Tagihan</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Paket awal (sudah lunas)</span>
                      <span className="text-chart-3 font-medium">{formatRp(rental.totalCost - pendingAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground border-t border-amber-500/20 pt-1">
                      <span>Tambah waktu (belum dibayar)</span>
                      <span className="text-amber-400 font-bold">{formatRp(pendingAmount)}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {/* Pay base rental mid-session (unpaid only, not expired) */}
                  {isUnpaid && !isExpired && (
                    <button
                      onClick={() => {
                        setPayMethod("cash");
                        setModal({ id: rental.id, unitName: rental.unitName, label: rental.packageLabel, baseCost: rental.totalCost - pendingAmount, pendingAmount, totalCost: rental.totalCost, mode: "pay" });
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600">
                      <CheckCircle size={13} /> Bayar Sekarang
                    </button>
                  )}

                  {/* Extend time */}
                  <button
                    onClick={() => {
                      setExtPkgId(packages?.[0]?.id ?? null);
                      setExtPayNow(true);
                      setPayMethod("cash");
                      setModal({ id: rental.id, unitName: rental.unitName, label: rental.packageLabel, baseCost: rental.totalCost - pendingAmount, pendingAmount, totalCost: rental.totalCost, mode: "extend" });
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-medium hover:bg-primary/30">
                    <Plus size={13} /> Tambah Waktu
                  </button>

                  {/* Stop & Pay for unpaid base rental */}
                  {isUnpaid && (
                    <button
                      onClick={() => {
                        setPayMethod("cash");
                        setModal({ id: rental.id, unitName: rental.unitName, label: rental.packageLabel, baseCost: rental.totalCost - pendingAmount, pendingAmount, totalCost: rental.totalCost, mode: "stop" });
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isExpired ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse" : "bg-destructive/80 text-destructive-foreground hover:bg-destructive"}`}>
                      <Square size={13} /> Stop & Bayar
                    </button>
                  )}

                  {/* Paid + has unpaid extension: must pay extension to finish */}
                  {isPaid && hasPendingExtension && (
                    <button
                      onClick={() => {
                        setPayMethod("cash");
                        setModal({ id: rental.id, unitName: rental.unitName, label: rental.packageLabel, baseCost: rental.totalCost - pendingAmount, pendingAmount, totalCost: rental.totalCost, mode: "pay-extension" });
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isExpired ? "bg-amber-500 text-white hover:bg-amber-600 animate-pulse" : "bg-amber-500/80 text-white hover:bg-amber-500"}`}>
                      <Square size={13} /> Selesai & Bayar Tambahan
                    </button>
                  )}

                  {/* Paid, no pending: clean finish, no modal needed */}
                  {isFullySettled && (
                    <button
                      onClick={() => handleFinishPaidNoExtension(rental.id, rental.unitName)}
                      disabled={stopRental.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-chart-3/20 text-chart-3 border border-chart-3/30 rounded-lg text-xs font-medium hover:bg-chart-3/30 disabled:opacity-50">
                      <CheckCircle2 size={13} /> Selesaikan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-5 w-full max-w-sm space-y-4">

            {modal.mode === "extend" ? (
              <>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Plus size={16} className="text-primary" /> Tambah Waktu — {modal.unitName}
                </h3>
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
                  <label className="text-xs text-muted-foreground mb-2 block">Bayar biaya tambahan sekarang?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setExtPayNow(true)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${extPayNow ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground"}`}>
                      Ya, bayar sekarang
                    </button>
                    <button onClick={() => setExtPayNow(false)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${!extPayNow ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground"}`}>
                      Bayar saat selesai
                    </button>
                  </div>
                  {!extPayNow && (
                    <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Biaya tambahan akan ditagih otomatis saat klik Selesai nanti.
                    </p>
                  )}
                </div>
                {extPayNow && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Metode Pembayaran</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setPayMethod("cash")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${payMethod === "cash" ? "border-chart-3 bg-chart-3/10" : "border-border"}`}>
                        <Banknote size={20} className={payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"} />
                        <span className={`text-xs font-semibold ${payMethod === "cash" ? "text-chart-3" : "text-muted-foreground"}`}>Cash</span>
                      </button>
                      <button onClick={() => setPayMethod("qris")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${payMethod === "qris" ? "border-primary bg-primary/10" : "border-border"}`}>
                        <CreditCard size={20} className={payMethod === "qris" ? "text-primary" : "text-muted-foreground"} />
                        <span className={`text-xs font-semibold ${payMethod === "qris" ? "text-primary" : "text-muted-foreground"}`}>QRIS</span>
                      </button>
                    </div>
                  </div>
                )}
              </>

            ) : modal.mode === "pay-extension" ? (
              <>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" /> Bayar Tagihan Tambahan Waktu
                </h3>
                <div className="bg-muted/20 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Paket awal (sudah lunas)</span>
                    <span className="text-chart-3 font-semibold">{formatRp(modal.baseCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                    <span className="text-amber-400">Tambah waktu (belum dibayar)</span>
                    <span className="text-amber-400">{formatRp(modal.pendingAmount)}</span>
                  </div>
                </div>
                <div className="text-center py-1">
                  <p className="text-xs text-muted-foreground">Total yang harus dibayar sekarang</p>
                  <p className="text-3xl font-bold text-amber-400 mt-1">{formatRp(modal.pendingAmount)}</p>
                </div>
                {renderPaymentButtons()}
              </>

            ) : (
              <>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  {modal.mode === "pay"
                    ? <><CheckCircle size={16} className="text-chart-3" /> Konfirmasi Pembayaran</>
                    : <><Square size={16} className="text-destructive" /> Selesaikan Rental — {modal.unitName}</>}
                </h3>

                {/* Stop mode: show breakdown if has pending extension */}
                {modal.mode === "stop" && modal.pendingAmount > 0 ? (
                  <div className="bg-muted/20 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Paket awal (belum bayar)</span>
                      <span className="font-medium">{formatRp(modal.baseCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tambah waktu (belum bayar)</span>
                      <span className="font-medium text-amber-400">{formatRp(modal.pendingAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                      <span>Total Tagihan</span>
                      <span className="text-chart-3">{formatRp(modal.totalCost)}</span>
                    </div>
                  </div>
                ) : modal.mode === "stop" && modal.pendingAmount === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">Total tagihan</p>
                    <p className="text-3xl font-bold text-chart-3 mt-1">{formatRp(modal.totalCost)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{modal.label}</p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">Konfirmasi pembayaran paket</p>
                    <p className="text-3xl font-bold text-chart-3 mt-1">{formatRp(modal.baseCost)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{modal.label}</p>
                  </div>
                )}

                {renderPaymentButtons()}
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isPending || (modal.mode === "extend" && !extPkgId)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                  modal.mode === "extend" ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : modal.mode === "pay-extension" ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                }`}>
                {isPending ? "Memproses..." :
                  modal.mode === "extend" ? "Tambah Waktu" :
                  modal.mode === "pay" ? "Konfirmasi Bayar" :
                  modal.mode === "pay-extension" ? `Bayar ${formatRp(modal.pendingAmount)}` :
                  `Selesai & Bayar ${formatRp(modal.totalCost)}`}
              </button>
              <button onClick={() => setModal(null)}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
