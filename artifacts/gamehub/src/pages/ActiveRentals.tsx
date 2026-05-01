import { useEffect, useState } from "react";
import {
  useListActiveRentals,
  useStopRental,
  getListActiveRentalsQueryKey,
  getListUnitsQueryKey,
  getGetDashboardQueryKey,
  getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Square, Clock, User, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  return `${h} jam ${m} menit`;
}

function LiveTimer({ startTime, hourlyRate }: { startTime: string | Date; hourlyRate: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      setElapsed(diff);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const cost = Math.ceil((minutes / 60) * hourlyRate);

  return (
    <div className="space-y-1">
      <div className="font-mono text-2xl font-bold text-yellow-400 tabular-nums">
        {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
        {String(minutes % 60).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </div>
      <div className="text-xs text-muted-foreground">
        Estimasi biaya: <span className="text-chart-3 font-semibold">{formatRp(cost)}</span>
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

  const handleStop = (id: number) => {
    setStoppingId(id);
    stopRental.mutate(
      { id },
      {
        onSuccess: (rental) => {
          queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
          setStoppingId(null);
          toast({
            title: "Rental selesai",
            description: `${rental.unitName} - ${rental.customerName}: ${formatRp(rental.totalCost ?? 0)} (${formatDuration(rental.durationMinutes ?? 0)})`,
          });
        },
        onError: () => {
          setStoppingId(null);
          toast({ title: "Gagal menghentikan rental", variant: "destructive" });
        },
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : !activeRentals?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Zap size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground font-medium">Tidak ada rental aktif</p>
          <p className="text-xs text-muted-foreground mt-1">Mulai rental dari halaman Unit PlayStation</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeRentals.map((rental) => (
            <div
              key={rental.id}
              data-testid={`card-active-rental-${rental.id}`}
              className="bg-card border border-yellow-500/40 bg-yellow-500/5 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Gamepad2 size={16} className="text-yellow-400" />
                    <span data-testid={`text-unit-name-${rental.id}`} className="font-bold text-foreground">
                      {rental.unitName}
                    </span>
                    <span className="inline-flex px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full font-medium">
                      Aktif
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User size={13} />
                    <span data-testid={`text-customer-${rental.id}`}>{rental.customerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>
                      Mulai: {new Date(rental.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRp(rental.hourlyRate)}/jam
                </div>
              </div>

              <LiveTimer startTime={rental.startTime} hourlyRate={rental.hourlyRate} />

              <button
                data-testid={`button-stop-rental-${rental.id}`}
                onClick={() => handleStop(rental.id)}
                disabled={stoppingId === rental.id}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                <Square size={14} />
                {stoppingId === rental.id ? "Menghentikan..." : "Stop Rental"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

