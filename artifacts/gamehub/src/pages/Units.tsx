import { useState } from "react";
import {
  useListUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useStartRental,
  getListUnitsQueryKey,
  getListActiveRentalsQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Plus, Play, Settings, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function Units() {
  const { data: units, isLoading } = useListUnits();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();
  const startRental = useStartRental();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("6000");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [rentalUnitId, setRentalUnitId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActiveRentalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    createUnit.mutate(
      { data: { name: newName.trim(), hourlyRate: parseInt(newRate) || 6000 } },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setNewName("");
          setNewRate("6000");
          toast({ title: "Unit berhasil ditambahkan" });
        },
      }
    );
  };

  const handleUpdate = (id: number) => {
    updateUnit.mutate(
      { id, data: { name: editName, hourlyRate: parseInt(editRate) } },
      {
        onSuccess: () => {
          invalidate();
          setEditId(null);
          toast({ title: "Unit berhasil diperbarui" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteUnit.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Unit berhasil dihapus" });
        },
      }
    );
  };

  const handleStartRental = () => {
    if (!rentalUnitId || !customerName.trim()) return;
    startRental.mutate(
      { data: { unitId: rentalUnitId, customerName: customerName.trim() } },
      {
        onSuccess: () => {
          invalidate();
          setRentalUnitId(null);
          setCustomerName("");
          toast({ title: "Rental dimulai" });
        },
        onError: () => {
          toast({ title: "Gagal memulai rental", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Unit PlayStation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola unit dan mulai rental</p>
        </div>
        <button
          data-testid="button-add-unit"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Tambah Unit
        </button>
      </div>

      {/* Add Unit Form */}
      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Unit Baru</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Unit</label>
              <input
                data-testid="input-unit-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="cth. PS5 Unit 1"
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tarif/Jam (Rp)</label>
              <input
                data-testid="input-unit-rate"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              data-testid="button-save-unit"
              onClick={handleAdd}
              disabled={createUnit.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createUnit.isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              data-testid="button-cancel-add-unit"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Start Rental Modal */}
      {rentalUnitId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-foreground">Mulai Rental</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Pelanggan</label>
              <input
                data-testid="input-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama pelanggan"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="button-confirm-rental"
                onClick={handleStartRental}
                disabled={startRental.isPending || !customerName.trim()}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {startRental.isPending ? "Memulai..." : "Mulai Rental"}
              </button>
              <button
                data-testid="button-cancel-rental"
                onClick={() => { setRentalUnitId(null); setCustomerName(""); }}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Units Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {units?.map((unit) => {
            const isOccupied = unit.status === "occupied";
            const isEditing = editId === unit.id;

            return (
              <div
                key={unit.id}
                data-testid={`card-unit-${unit.id}`}
                className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${
                  isOccupied ? "border-yellow-500/50 bg-yellow-500/5" : "border-card-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 size={18} className={isOccupied ? "text-yellow-400" : "text-chart-1"} />
                    {isEditing ? (
                      <input
                        data-testid={`input-edit-name-${unit.id}`}
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
                        <button
                          data-testid={`button-save-edit-${unit.id}`}
                          onClick={() => handleUpdate(unit.id)}
                          className="p-1 text-chart-3 hover:bg-chart-3/10 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          data-testid={`button-cancel-edit-${unit.id}`}
                          onClick={() => setEditId(null)}
                          className="p-1 text-muted-foreground hover:bg-muted rounded"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          data-testid={`button-edit-unit-${unit.id}`}
                          onClick={() => { setEditId(unit.id); setEditName(unit.name); setEditRate(String(unit.hourlyRate)); }}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        >
                          <Settings size={13} />
                        </button>
                        <button
                          data-testid={`button-delete-unit-${unit.id}`}
                          onClick={() => handleDelete(unit.id)}
                          className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div>
                    <label className="text-xs text-muted-foreground">Tarif/Jam (Rp)</label>
                    <input
                      data-testid={`input-edit-rate-${unit.id}`}
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <span
                        data-testid={`status-unit-${unit.id}`}
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          isOccupied
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {isOccupied ? "Dipakai" : "Tersedia"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatRp(unit.hourlyRate)}/jam</span>
                      {!isOccupied && (
                        <button
                          data-testid={`button-start-rental-${unit.id}`}
                          onClick={() => setRentalUnitId(unit.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                        >
                          <Play size={11} />
                          Mulai Rental
                        </button>
                      )}
                    </div>
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

