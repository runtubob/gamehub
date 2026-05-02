import { useState } from "react";
import {
  useListRentalPackages, useCreateRentalPackage, useUpdateRentalPackage, useDeleteRentalPackage,
  getListRentalPackagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Plus, Check, X, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

export default function Packages() {
  const { data: packages, isLoading } = useListRentalPackages();
  const createPkg = useCreateRentalPackage();
  const updatePkg = useUpdateRentalPackage();
  const deletePkg = useDeleteRentalPackage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCost, setNewCost] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCost, setEditCost] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRentalPackagesQueryKey() });

  const handleAdd = () => {
    if (!newLabel.trim() || !newDuration || !newPrice) return;
    createPkg.mutate(
      { data: { label: newLabel.trim(), durationMinutes: parseInt(newDuration), price: parseInt(newPrice), costPrice: parseInt(newCost) || 0, sortOrder: packages?.length ?? 0 } },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setNewLabel(""); setNewDuration(""); setNewPrice(""); setNewCost("");
          toast({ title: "Paket ditambahkan" });
        },
      }
    );
  };

  const handleUpdate = (id: number) => {
    updatePkg.mutate(
      { id, data: { label: editLabel, durationMinutes: parseInt(editDuration), price: parseInt(editPrice), costPrice: parseInt(editCost) || 0 } },
      { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Paket diperbarui" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deletePkg.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Paket dihapus" }); } });
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const inlineInput = "px-2 py-1 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paket Rental</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola paket harga rental PlayStation</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus size={16} /> Tambah Paket
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Paket Baru</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Label</label><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="cth. 1 Jam" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Durasi (menit)</label><input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="60" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Harga (Rp)</label><input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="5000" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Harga Modal (Rp)</label><input type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="2500" className={inputClass} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createPkg.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{createPkg.isPending ? "Menyimpan..." : "Simpan"}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-16 animate-pulse" />)}</div>
      ) : !packages?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Box size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Belum ada paket rental</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Label</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Durasi</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Modal</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Profit</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {packages.map((pkg) => {
                const isEditing = editId === pkg.id;
                const profit = pkg.price - pkg.costPrice;
                return (
                  <tr key={pkg.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3.5">
                      {isEditing ? <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={`${inlineInput} w-28`} /> : (
                        <div className="flex items-center gap-2"><Box size={14} className="text-chart-1" /><span className="text-sm font-semibold text-foreground">{pkg.label}</span></div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? <input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className={`${inlineInput} w-20`} /> : (
                        <span className="text-sm text-muted-foreground">{formatDuration(pkg.durationMinutes)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={`${inlineInput} w-24`} /> : (
                        <span className="text-sm text-chart-3 font-medium">{formatRp(pkg.price)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? <input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} className={`${inlineInput} w-24`} /> : (
                        <span className="text-sm text-muted-foreground">{pkg.costPrice > 0 ? formatRp(pkg.costPrice) : "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {!isEditing && <span className="text-sm font-medium text-emerald-400">{formatRp(profit)}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleUpdate(pkg.id)} className="p-1.5 text-chart-3 hover:bg-chart-3/10 rounded"><Check size={13} /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded"><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(pkg.id); setEditLabel(pkg.label); setEditDuration(String(pkg.durationMinutes)); setEditPrice(String(pkg.price)); setEditCost(String(pkg.costPrice)); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                            <button onClick={() => handleDelete(pkg.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
