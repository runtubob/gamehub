import { useEffect, useState } from "react";
import {
  useListActiveRentals, useStopRental,
  getListActiveRentalsQueryKey, getListUnitsQueryKey, getGetDashboardQueryKey, getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Square, Clock, User, Gamepad2, CreditCard, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function CountdownTimer({ endTime, totalCost }: { endTime: string | Date; totalCost: number }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const isExpired = remaining === 0;
  const isUrgent = remaining > 0 && remaining <= 300;

  return (
    <div className="space-y-1">
      <div className={`font-mono text-3xl font-bold tabular-nums ${isExpired ? "text-destructive animate-pulse" : isUrgent ? "text-orange-400" : "text-yellow-400"}`}>
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
      <div className="text-xs text-muted-foreground">
        {isExpired ? (
          <span className="text-destructive font-semibold">WAKTU HABIS - Segera selesaikan</span>
        ) : isUrgent ? (
          <span className="text-orange-400">Hampir selesai • Biaya: <span className="font-semibold">{formatRp(totalCost)}</span></span>
        ) : (
          <span>Biaya paket: <span className="text-chart-3 font-semibold">{formatRp(totalCost)}</span></span>
        )}
      </div>
    </div>
  );
}

export default function ActiveRentals() {
  const { data: activeRentals, isLoading } = useListActiveRentals({
    query: { refetchInterval: 5000, queryKey: getListActiveRentalsQueryKey() },
  });
  const stopRental = useStopRental();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stoppingId, setStoppingId] = useState<number | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: number; label: string; cost: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
  };

  const confirmStop = () => {
    if (!paymentModal) return;
    setStoppingId(paymentModal.id);
    stopRental.mutate(
      { id: paymentModal.id, data: { paymentMethod } },
      {
        onSuccess: (rental) => {
          invalidateAll();
          setStoppingId(null);
          setPaymentModal(null);
          toast({
            title: "Rental selesai",
            description: `${rental.unitName} - ${rental.customerName}: ${formatRp(rental.totalCost ?? 0)} via ${paymentMethod.toUpperCase()}`,
          });
        },
        onError: () => { setStoppingId(null); toast({ title: "Gagal menghentikan rental", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rental Aktif</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? "Memuat..." : `${activeRentals?.length ?? 0} sesi aktif sedang berjalan`}
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
            const isExpired = rental.remainingSeconds === 0;
            return (
              <div
                key={rental.id}
                className={`bg-card border rounded-xl p-5 space-y-4 ${isExpired ? "border-destructive/60 bg-destructive/5" : "border-yellow-500/40 bg-yellow-500/5"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Gamepad2 size={16} className={isExpired ? "text-destructive" : "text-yellow-400"} />
                      <span className="font-bold text-foreground">{rental.unitName}</span>
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${isExpired ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {isExpired ? "Waktu Habis" : "Aktif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User size={13} /><span>{rental.customerName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>Paket: <span className="text-foreground font-medium">{rental.packageLabel}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>Mulai: {new Date(rental.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>

                <CountdownTimer endTime={rental.endTime} totalCost={rental.totalCost} />

                <button
                  onClick={() => {
                    setPaymentMethod("cash");
                    setPaymentModal({ id: rental.id, label: rental.packageLabel, cost: rental.totalCost });
                  }}
                  disabled={stoppingId === rental.id}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    isExpired
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 animate-pulse"
                      : "bg-destructive/80 text-destructive-foreground hover:bg-destructive"
                  }`}
                >
                  <Square size={14} />
                  {stoppingId === rental.id ? "Menghentikan..." : "Stop & Bayar"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Method Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-xs space-y-5">
            <h3 className="font-bold text-foreground">Metode Pembayaran</h3>
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">Total tagihan</p>
              <p className="text-3xl font-bold text-chart-3 mt-1">{formatRp(paymentModal.cost)}</p>
              <p className="text-xs text-muted-foreground mt-1">{paymentModal.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === "cash" ? "border-chart-3 bg-chart-3/10" : "border-border hover:border-chart-3/50"}`}
              >
                <Banknote size={24} className={paymentMethod === "cash" ? "text-chart-3" : "text-muted-foreground"} />
                <span className={`text-sm font-semibold ${paymentMethod === "cash" ? "text-chart-3" : "text-muted-foreground"}`}>Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod("qris")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
              >
                <CreditCard size={24} className={paymentMethod === "qris" ? "text-primary" : "text-muted-foreground"} />
                <span className={`text-sm font-semibold ${paymentMethod === "qris" ? "text-primary" : "text-muted-foreground"}`}>QRIS</span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmStop}
                disabled={stopRental.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {stopRental.isPending ? "Memproses..." : "Konfirmasi Selesai"}
              </button>
              <button
                onClick={() => setPaymentModal(null)}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80"
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
