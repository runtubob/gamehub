import { useState } from "react";
import {
  useListUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useStartRental,
  useListRentalPackages, useGetDashboard,
  getListUnitsQueryKey, getListActiveRentalsQueryKey, getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Plus, Play, Settings, Trash2, Check, X, AlertTriangle, Banknote, CreditCard, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function Units() {
  const { data: units, isLoading } = useListUnits();
  const { data: packages } = useListRentalPackages();
  const { data: dashboard } = useGetDashboard();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const startRental = useStartRental();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [rentalUnitId, setRentalUnitId] = useState<number | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    createUnit.mutate(
      { data: { name: newName.trim(), hourlyRate: 5000 } },
      { onSuccess: () => { invalidate(); setShowAdd(false); setNewName(""); toast({ title: "Unit berhasil ditambahkan" }); } }
    );
  };

  const handleUpdate = (id: number) => {
    updateUnit.mutate(
      { id, data: { name: editName } },
      { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Unit berhasil diperbarui" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteUnit.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); setDeleteConfirmId(null); toast({ title: "Unit berhasil dihapus" }); },
        onError: (e: Error) => toast({ title: "Gagal menghapus unit", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleStartRental = () => {
    if (!rentalUnitId || !selectedPkgId) return;
    startRental.mutate(
      { data: { unitId: rentalUnitId, packageId: selectedPkgId } },
      {
        onSuccess: () => {
          invalidate();
          setRentalUnitId(null);
          setSelectedPkgId(null);
          toast({ title: "Rental dimulai" });
        },
        onError: (e: Error) => toast({ title: "Gagal memulai rental", description: e.message, variant: "destructive" }),
      }
    );
  };

  const deleteTarget = units?.find((u) => u.id === deleteConfirmId);
  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Unit PlayStation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola unit dan mulai rental</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus size={16} /> <span className="hidden sm:inline">Tambah Unit</span>
        </button>
      </div>

      {/* Ringkasan Pendapatan Hari Ini */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-chart-3" />
              <p className="text-xs text-muted-foreground">Pendapatan Hari Ini</p>
            </div>
            <p className="text-lg font-bold text-chart-3">{formatRp(dashboard.todayIncome ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{dashboard.todayTransactions ?? 0} transaksi</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote size={14} className="text-chart-3" />
              <p className="text-xs text-muted-foreground">Cash</p>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRp(dashboard.cashIncome ?? 0)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground">QRIS</p>
            </div>
            <p className="text-lg font-bold text-foreground">{formatRp(dashboard.qrisIncome ?? 0)}</p>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Unit Baru</h3>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="cth. PS3 Unit 7" className={inputClass} />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createUnit.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">Simpan</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Hapus Unit?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{deleteTarget?.name}</span> akan dihapus permanen dan tidak bisa dikembalikan.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteUnit.isPending}
                className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteUnit.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Rental Modal */}
      {rentalUnitId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-5 w-full max-w-md space-y-5">
            <h3 className="font-bold text-foreground text-lg">Mulai Rental</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Pilih Paket</label>
              <div className="grid grid-cols-3 gap-2">
                {packages?.map((pkg) => (
                  <button key={pkg.id} onClick={() => setSelectedPkgId(pkg.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${selectedPkgId === pkg.id ? "border-primary bg-primary/20 text-foreground" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                    <div className="font-bold text-sm">{pkg.label}</div>
                    <div className={`text-xs mt-0.5 ${selectedPkgId === pkg.id ? "text-primary" : "text-muted-foreground"}`}>{formatRp(pkg.price)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleStartRental} disabled={startRental.isPending || !selectedPkgId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <Play size={14} /> {startRental.isPending ? "Memulai..." : "Mulai Rental"}
              </button>
              <button onClick={() => { setRentalUnitId(null); setSelectedPkgId(null); }}
                className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-32 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {units?.map((unit) => {
            const isOccupied = unit.status === "occupied";
            const isEditing = editId === unit.id;
            return (
              <div key={unit.id} className={`bg-card border rounded-xl p-3 md:p-4 space-y-3 transition-colors ${isOccupied ? "border-yellow-500/50 bg-yellow-500/5" : "border-card-border"}`}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Gamepad2 size={16} className={`shrink-0 ${isOccupied ? "text-yellow-400" : "text-chart-1"}`} />
                    {isEditing ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm font-semibold bg-input border border-border rounded px-2 py-0.5 text-foreground w-24 focus:outline-none" />
                    ) : (
                      <span className="font-semibold text-sm text-foreground truncate">{unit.name}</span>
                    )}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleUpdate(unit.id)} className="p-1 text-chart-3 hover:bg-chart-3/10 rounded"><Check size={13} /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X size={13} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(unit.id); setEditName(unit.name); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={12} /></button>
                        <button onClick={() => setDeleteConfirmId(unit.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isOccupied ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>
                      {isOccupied ? "Dipakai" : "Tersedia"}
                    </span>
                    {!isOccupied && (
                      <button onClick={() => setRentalUnitId(unit.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90">
                        <Play size={11} /> Mulai Rental
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
