import { useState, useEffect } from "react";
import {
  useGetTodayAttendance, useCheckIn, useCheckOut, useListAttendance,
  getGetTodayAttendanceQueryKey, getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserCheck, LogIn, LogOut, Clock, CalendarDays, Users,
  CheckCircle2, AlertCircle, Pencil, Plus, Trash2, X, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, isAdminOrAbove } from "@/context/AuthContext";

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function calcDuration(checkIn: string | Date | null | undefined, checkOut: string | Date | null | undefined) {
  if (!checkIn || !checkOut) return null;
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  return `${h}j ${m}m`;
}

function getStatus(checkInTime: string | Date | null | undefined, lateHour = 9) {
  if (!checkInTime) return null;
  const h = new Date(checkInTime).getHours();
  return h >= lateHour ? "late" : "ontime";
}

const todayStr = () => new Date().toISOString().split("T")[0];

const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

type EditModal = { id: number; userName: string; checkIn: string; checkOut: string; notes: string } | null;
type AddModal = { userName: string; userId: string; date: string; checkIn: string; checkOut: string; notes: string } | null;

export default function Attendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = isAdminOrAbove(user?.role);

  const [date, setDate] = useState(todayStr());
  const [editModal, setEditModal] = useState<EditModal>(null);
  const [addModal, setAddModal] = useState<AddModal>(null);
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  const { data: todayRecord, isLoading: todayLoading } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey(), refetchInterval: 30000 },
  });
  const { data: allRecords, isLoading: listLoading } = useListAttendance(
    { date },
    { query: { queryKey: getListAttendanceQueryKey({ date }), enabled: isAdmin } }
  );

  const checkInMut = useCheckIn();
  const checkOutMut = useCheckOut();

  const [clock, setClock] = useState(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ date }) });
  };

  const handleCheckIn = () => {
    checkInMut.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "Check-in berhasil!", description: `Selamat bekerja, ${user?.name}!` }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const handleCheckOut = () => {
    checkOutMut.mutate(undefined, {
      onSuccess: () => { invalidate(); toast({ title: "Check-out berhasil!", description: "Selamat istirahat!" }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/${editModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
        body: JSON.stringify({
          checkInTime: editModal.checkIn ? `${date}T${editModal.checkIn}:00` : null,
          checkOutTime: editModal.checkOut ? `${date}T${editModal.checkOut}:00` : null,
          notes: editModal.notes || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Gagal"); }
      invalidate();
      setEditModal(null);
      toast({ title: "Data absensi diperbarui" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!addModal) return;
    if (!addModal.userName.trim() || !addModal.userId || !addModal.date) {
      toast({ title: "Nama, ID karyawan, dan tanggal wajib diisi", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
        body: JSON.stringify({
          userId: parseInt(addModal.userId),
          userName: addModal.userName.trim(),
          date: addModal.date,
          checkInTime: addModal.checkIn ? `${addModal.date}T${addModal.checkIn}:00` : undefined,
          checkOutTime: addModal.checkOut ? `${addModal.date}T${addModal.checkOut}:00` : undefined,
          notes: addModal.notes || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Gagal"); }
      invalidate();
      setAddModal(null);
      toast({ title: "Data absensi ditambahkan" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("gamehub_token")}` },
      });
      if (!res.ok) throw new Error("Gagal menghapus");
      invalidate();
      setDelConfirm(null);
      toast({ title: "Data dihapus" });
    } catch (e) {
      toast({ title: "Gagal", description: (e as Error).message, variant: "destructive" });
    }
  };

  const hasCheckedIn = !!todayRecord?.checkInTime;
  const hasCheckedOut = !!todayRecord?.checkOutTime;
  const myStatus = getStatus(todayRecord?.checkInTime);

  // Admin stats
  const totalRecords = allRecords?.length ?? 0;
  const onTimeCount = allRecords?.filter(r => getStatus(r.checkInTime) === "ontime").length ?? 0;
  const lateCount = allRecords?.filter(r => getStatus(r.checkInTime) === "late").length ?? 0;
  const notOutCount = allRecords?.filter(r => r.checkInTime && !r.checkOutTime).length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Absensi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(todayStr())}</p>
      </div>

      {/* My Attendance Card */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
        {/* Clock */}
        <div className="text-center space-y-1">
          <div className="font-mono text-4xl font-bold text-primary tabular-nums">{clock}</div>
          <p className="text-xs text-muted-foreground">{fmtDate(todayStr())}</p>
        </div>

        {/* Status badges */}
        {!todayLoading && hasCheckedIn && (
          <div className="flex items-center justify-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${myStatus === "ontime" ? "bg-chart-3/15 text-chart-3" : "bg-orange-500/15 text-orange-400"}`}>
              {myStatus === "ontime"
                ? <><CheckCircle2 size={11} /> Tepat Waktu</>
                : <><AlertCircle size={11} /> Terlambat</>}
            </span>
            {hasCheckedOut && calcDuration(todayRecord?.checkInTime, todayRecord?.checkOutTime) && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground">
                <Clock size={10} /> {calcDuration(todayRecord?.checkInTime, todayRecord?.checkOutTime)}
              </span>
            )}
          </div>
        )}

        {/* Check-in / Check-out times */}
        {todayLoading ? (
          <div className="h-20 bg-muted animate-pulse rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-muted-foreground">
                <LogIn size={12} /> Check-in
              </div>
              <p className={`font-mono text-xl font-bold ${hasCheckedIn ? "text-chart-3" : "text-muted-foreground"}`}>
                {hasCheckedIn ? fmtTime(todayRecord.checkInTime) : "--:--"}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1 text-xs text-muted-foreground">
                <LogOut size={12} /> Check-out
              </div>
              <p className={`font-mono text-xl font-bold ${hasCheckedOut ? "text-destructive" : "text-muted-foreground"}`}>
                {hasCheckedOut ? fmtTime(todayRecord.checkOutTime) : "--:--"}
              </p>
            </div>
          </div>
        )}

        {/* Action button */}
        {hasCheckedIn && hasCheckedOut ? (
          <div className="text-center py-2.5 bg-chart-3/10 rounded-xl border border-chart-3/20">
            <CheckCircle2 size={18} className="text-chart-3 mx-auto mb-1" />
            <p className="text-sm font-semibold text-chart-3">Shift Selesai</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total kerja: <span className="font-medium text-foreground">{calcDuration(todayRecord?.checkInTime, todayRecord?.checkOutTime) ?? "—"}</span>
            </p>
          </div>
        ) : hasCheckedIn ? (
          <button onClick={handleCheckOut} disabled={checkOutMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-destructive text-destructive-foreground rounded-xl font-semibold hover:bg-destructive/90 disabled:opacity-50">
            <LogOut size={18} /> {checkOutMut.isPending ? "Memproses..." : "Check-Out Sekarang"}
          </button>
        ) : (
          <button onClick={handleCheckIn} disabled={checkInMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-chart-3 text-white rounded-xl font-semibold hover:bg-chart-3/90 disabled:opacity-50">
            <LogIn size={18} /> {checkInMut.isPending ? "Memproses..." : "Check-In Sekarang"}
          </button>
        )}
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="space-y-3">
          {/* Header + controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <h3 className="font-semibold text-sm">Data Absensi Karyawan</h3>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="text-xs px-2 py-1.5 bg-input border border-border rounded-lg text-foreground focus:outline-none" />
              <button onClick={() => setAddModal({ userName: "", userId: "", date, checkIn: "", checkOut: "", notes: "" })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90">
                <Plus size={12} /> Tambah
              </button>
            </div>
          </div>

          {/* Summary stats */}
          {totalRecords > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-card border border-card-border rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-foreground">{totalRecords}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total Hadir</p>
              </div>
              <div className="bg-chart-3/10 border border-chart-3/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-chart-3">{onTimeCount}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tepat Waktu</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-orange-400">{lateCount}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Terlambat</p>
              </div>
              <div className="bg-muted/20 border border-border rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-muted-foreground">{notOutCount}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Belum Pulang</p>
              </div>
            </div>
          )}

          {/* Records table */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            {listLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}
              </div>
            ) : !allRecords?.length ? (
              <div className="py-10 text-center">
                <CalendarDays size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Tidak ada data absensi untuk {fmtDateShort(date)}</p>
                <button onClick={() => setAddModal({ userName: "", userId: "", date, checkIn: "", checkOut: "", notes: "" })}
                  className="mt-3 text-xs text-primary hover:underline">+ Tambah data manual</button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allRecords.map((r) => {
                  const status = getStatus(r.checkInTime);
                  const dur = calcDuration(r.checkInTime, r.checkOutTime);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${status === "ontime" ? "bg-chart-3/20" : status === "late" ? "bg-orange-500/20" : "bg-muted/30"}`}>
                          <UserCheck size={15} className={status === "ontime" ? "text-chart-3" : status === "late" ? "text-orange-400" : "text-muted-foreground"} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{r.userName}</p>
                            {status === "ontime" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-chart-3/15 text-chart-3 font-medium">Tepat Waktu</span>}
                            {status === "late" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-medium">Terlambat</span>}
                            {r.checkInTime && !r.checkOutTime && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Masih Kerja</span>}
                          </div>
                          {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{r.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex gap-3 text-right">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Masuk</p>
                            <p className={`text-sm font-mono font-bold ${r.checkInTime ? "text-chart-3" : "text-muted-foreground"}`}>{fmtTime(r.checkInTime)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Pulang</p>
                            <p className={`text-sm font-mono font-bold ${r.checkOutTime ? "text-destructive" : "text-muted-foreground"}`}>{fmtTime(r.checkOutTime)}</p>
                          </div>
                          {dur && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Durasi</p>
                              <p className="text-sm font-semibold text-foreground">{dur}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditModal({
                            id: r.id, userName: r.userName,
                            checkIn: r.checkInTime ? fmtTime(r.checkInTime).replace(".", ":") : "",
                            checkOut: r.checkOutTime ? fmtTime(r.checkOutTime).replace(".", ":") : "",
                            notes: r.notes ?? "",
                          })} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDelConfirm(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Edit Absensi</h3>
              <button onClick={() => setEditModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-sm font-medium text-foreground">{editModal.userName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jam Masuk</label>
                <input type="time" value={editModal.checkIn}
                  onChange={(e) => setEditModal({ ...editModal, checkIn: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jam Pulang</label>
                <input type="time" value={editModal.checkOut}
                  onChange={(e) => setEditModal({ ...editModal, checkOut: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <input value={editModal.notes} onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })}
                placeholder="cth. Izin, Sakit..." className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Tambah Absensi Manual</h3>
              <button onClick={() => setAddModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ID Karyawan</label>
                <input type="number" value={addModal.userId}
                  onChange={(e) => setAddModal({ ...addModal, userId: e.target.value })}
                  placeholder="cth. 2" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nama Karyawan</label>
                <input value={addModal.userName}
                  onChange={(e) => setAddModal({ ...addModal, userName: e.target.value })}
                  placeholder="cth. Budi" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tanggal</label>
              <input type="date" value={addModal.date}
                onChange={(e) => setAddModal({ ...addModal, date: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jam Masuk</label>
                <input type="time" value={addModal.checkIn}
                  onChange={(e) => setAddModal({ ...addModal, checkIn: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jam Pulang</label>
                <input type="time" value={addModal.checkOut}
                  onChange={(e) => setAddModal({ ...addModal, checkOut: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catatan (opsional)</label>
              <input value={addModal.notes} onChange={(e) => setAddModal({ ...addModal, notes: e.target.value })}
                placeholder="cth. Izin, Sakit..." className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Plus size={14} /> {saving ? "Menyimpan..." : "Tambah"}
              </button>
              <button onClick={() => setAddModal(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <p className="font-bold text-foreground">Hapus data absensi ini?</p>
            <p className="text-sm text-muted-foreground">Data ini tidak dapat dikembalikan.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(delConfirm)}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90">
                Ya, Hapus
              </button>
              <button onClick={() => setDelConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
