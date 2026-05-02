import { useState } from "react";
import {
  useListUnits, useCreateUnit, useUpdateUnit, useDeleteUnit, useStartRental,
  useListRentalPackages,
  getListUnitsQueryKey, getListActiveRentalsQueryKey, getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Plus, Play, Settings, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function Units() {
  const { data: units, isLoading } = useListUnits();
  const { data: packages } = useListRentalPackages();
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

  const [rentalUnitId, setRentalUnitId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
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
      {
        onSuccess: () => { invalidate(); setShowAdd(false); setNewName(""); toast({ title: "Unit berhasil ditambahkan" }); },
      }
    );
  };

  const handleUpdate = (id: number) => {
    updateUnit.mutate(
      { id, data: { name: editName } },
      { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Unit berhasil diperbarui" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteUnit.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Unit berhasil dihapus" }); } });
  };

  const handleStartRental = () => {
    if (!rentalUnitId || !customerName.trim() || !selectedPkgId) return;
    startRental.mutate(
      { data: { unitId: rentalUnitId, customerName: customerName.trim(), packageId: selectedPkgId } },
      {
        onSuccess: () => {
          invalidate();
          setRentalUnitId(null);
          setCustomerName("");
          setSelectedPkgId(null);
          toast({ title: "Rental dimulai" });
        },
        onError: () => toast({ title: "Gagal memulai rental", variant: "destructive" }),
      }
    );
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Unit PlayStation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola unit dan mulai rental</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah Unit
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Unit Baru</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nama Unit</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="cth. PS3 Unit 7" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createUnit.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {createUnit.isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Rental Modal */}
      {rentalUnitId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md space-y-5">
            <h3 className="font-bold text-foreground text-lg">Mulai Rental</h3>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Pelanggan</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama pelanggan"
                autoFocus
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Pilih Paket</label>
              <div className="grid grid-cols-3 gap-2">
                {packages?.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkgId(pkg.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedPkgId === pkg.id
                        ? "border-primary bg-primary/20 text-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold text-sm">{pkg.label}</div>
                    <div className={`text-xs mt-0.5 ${selectedPkgId === pkg.id ? "text-primary" : "text-muted-foreground"}`}>
                      {formatRp(pkg.price)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleStartRental}
                disabled={startRental.isPending || !customerName.trim() || !selectedPkgId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                <Play size={14} />
                {startRental.isPending ? "Memulai..." : "Mulai Rental"}
              </button>
              <button
                onClick={() => { setRentalUnitId(null); setCustomerName(""); setSelectedPkgId(null); }}
                className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-36 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {units?.map((unit) => {
            const isOccupied = unit.status === "occupied";
            const isEditing = editId === unit.id;
            return (
              <div
                key={unit.id}
                className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${isOccupied ? "border-yellow-500/50 bg-yellow-500/5" : "border-card-border"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 size={18} className={isOccupied ? "text-yellow-400" : "text-chart-1"} />
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm font-semibold bg-input border border-border rounded px-2 py-0.5 text-foreground w-28 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <span className="font-semibold text-sm text-foreground">{unit.name}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleUpdate(unit.id)} className="p-1 text-chart-3 hover:bg-chart-3/10 rounded"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(unit.id); setEditName(unit.name); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                        <button onClick={() => handleDelete(unit.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
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
                      <button
                        onClick={() => setRentalUnitId(unit.id)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
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
