import { useState, useEffect } from "react";
import {
  useGetTodayAttendance, useCheckIn, useCheckOut, useListAttendance,
  getGetTodayAttendanceQueryKey, getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserCheck, LogIn, LogOut, Clock, CalendarDays, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function calcDuration(checkIn: string | Date | null | undefined, checkOut: string | Date | null | undefined) {
  if (!checkIn || !checkOut) return null;
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return `${h}j ${m}m`;
}

const todayStr = () => new Date().toISOString().split("T")[0];

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [date, setDate] = useState(todayStr());
  const { data: todayRecord, isLoading: todayLoading } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey(), refetchInterval: 30000 },
  });
  const { data: allRecords } = useListAttendance(
    { date },
    { query: { queryKey: getListAttendanceQueryKey({ date }), enabled: isAdmin } }
  );

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ date }) });
  };

  const handleCheckIn = () => {
    checkIn.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "Check-in berhasil!", description: `Selamat bekerja, ${user?.name}!` }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const handleCheckOut = () => {
    checkOut.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "Check-out berhasil!", description: "Selamat istirahat!" }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const [clock, setClock] = useState(timeStr);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  const hasCheckedIn = !!todayRecord?.checkInTime;
  const hasCheckedOut = !!todayRecord?.checkOutTime;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Absensi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(todayStr())}</p>
      </div>

      {/* Clock + Personal card */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        <div className="text-center">
          <div className="font-mono text-4xl font-bold text-primary tabular-nums">{clock}</div>
          <p className="text-xs text-muted-foreground mt-1">{fmtDate(todayStr())}</p>
        </div>

        {todayLoading ? (
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-muted-foreground"><LogIn size={12} /> Check-in</div>
              <p className={`font-mono text-xl font-bold ${hasCheckedIn ? "text-chart-3" : "text-muted-foreground"}`}>
                {hasCheckedIn ? fmtTime(todayRecord.checkInTime) : "--:--"}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-muted-foreground"><LogOut size={12} /> Check-out</div>
              <p className={`font-mono text-xl font-bold ${hasCheckedOut ? "text-destructive" : "text-muted-foreground"}`}>
                {hasCheckedOut ? fmtTime(todayRecord.checkOutTime) : "--:--"}
              </p>
            </div>
          </div>
        )}

        {hasCheckedIn && hasCheckedOut ? (
          <div className="text-center py-3 bg-chart-3/10 rounded-xl border border-chart-3/20">
            <Clock size={18} className="text-chart-3 mx-auto mb-1" />
            <p className="text-sm font-semibold text-chart-3">Shift Selesai</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total: {calcDuration(todayRecord?.checkInTime, todayRecord?.checkOutTime)}
            </p>
          </div>
        ) : hasCheckedIn ? (
          <button onClick={handleCheckOut} disabled={checkOut.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-destructive text-destructive-foreground rounded-xl font-semibold hover:bg-destructive/90 disabled:opacity-50">
            <LogOut size={18} /> {checkOut.isPending ? "Memproses..." : "Check-Out Sekarang"}
          </button>
        ) : (
          <button onClick={handleCheckIn} disabled={checkIn.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-chart-3 text-white rounded-xl font-semibold hover:bg-chart-3/90 disabled:opacity-50">
            <LogIn size={18} /> {checkIn.isPending ? "Memproses..." : "Check-In Sekarang"}
          </button>
        )}
      </div>

      {/* Admin: all attendance */}
      {isAdmin && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <h3 className="font-semibold text-sm">Data Absensi Karyawan</h3>
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="text-xs px-2 py-1.5 bg-input border border-border rounded-lg text-foreground focus:outline-none" />
          </div>
          <div className="p-4">
            {!allRecords?.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">Tidak ada data absensi untuk tanggal ini.</p>
            ) : (
              <div className="space-y-2">
                {allRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <UserCheck size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{r.userName}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(r.date)}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Masuk</p>
                        <p className={`text-sm font-mono font-bold ${r.checkInTime ? "text-chart-3" : "text-muted-foreground"}`}>{fmtTime(r.checkInTime)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Pulang</p>
                        <p className={`text-sm font-mono font-bold ${r.checkOutTime ? "text-destructive" : "text-muted-foreground"}`}>{fmtTime(r.checkOutTime)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Durasi</p>
                        <p className="text-sm font-semibold text-foreground">{calcDuration(r.checkInTime, r.checkOutTime) ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
