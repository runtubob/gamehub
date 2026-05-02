import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Settings, Check, X, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", owner: "Owner", karyawan: "Karyawan" };
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  owner: "bg-primary/15 text-primary border-primary/30",
  karyawan: "bg-muted text-muted-foreground border-border",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ username: "", password: "", name: "", role: "karyawan" });
  const [showNewPass, setShowNewPass] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", password: "", active: true });
  const [showEditPass, setShowEditPass] = useState(false);

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  const handleAdd = () => {
    if (!newForm.username || !newForm.password || !newForm.name) return;
    createUser.mutate({ data: { username: newForm.username, password: newForm.password, name: newForm.name, role: newForm.role as "admin"|"owner"|"karyawan" } }, {
      onSuccess: () => { invalidate(); setShowAdd(false); setNewForm({ username: "", password: "", name: "", role: "karyawan" }); toast({ title: "Pengguna berhasil ditambahkan" }); },
      onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    const data: Record<string, unknown> = { name: editForm.name, role: editForm.role, active: editForm.active };
    if (editForm.password) data.password = editForm.password;
    updateUser.mutate({ id, data: data as Parameters<typeof updateUser.mutate>[0]["data"] }, {
      onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Pengguna diperbarui" }); },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pengguna</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola akun dan hak akses pengguna</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus size={16} /> Tambah Pengguna
        </button>
      </div>

      {/* Role info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { role: "Admin", desc: "Akses penuh termasuk reset saldo dan manajemen pengguna", color: "border-chart-1/30 bg-chart-1/5" },
          { role: "Owner", desc: "Akses penuh ke laporan keuangan, pengeluaran, dan pengaturan", color: "border-primary/30 bg-primary/5" },
          { role: "Karyawan", desc: "Hanya bisa: Unit PS, Rental Aktif, dan Penjualan Produk", color: "border-border bg-muted/20" },
        ].map((r) => (
          <div key={r.role} className={`border rounded-xl p-3 ${r.color}`}>
            <div className="flex items-center gap-2 mb-1"><Shield size={13} /><span className="text-sm font-semibold">{r.role}</span></div>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Pengguna Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Nama Lengkap</label><input value={newForm.name} onChange={(e) => setNewForm({...newForm, name: e.target.value})} placeholder="cth. Budi Santoso" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Username</label><input value={newForm.username} onChange={(e) => setNewForm({...newForm, username: e.target.value})} placeholder="cth. budi" className={inputClass} /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <input type={showNewPass ? "text" : "password"} value={newForm.password} onChange={(e) => setNewForm({...newForm, password: e.target.value})} placeholder="Password" className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><EyeOff size={14} /></button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <select value={newForm.role} onChange={(e) => setNewForm({...newForm, role: e.target.value})} className={inputClass}>
                {currentUser?.role === "admin" && <option value="admin">Admin</option>}
                <option value="owner">Owner</option>
                <option value="karyawan">Karyawan</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createUser.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">Simpan</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-card border border-card-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pengguna</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Username</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => editId === u.id ? (
                <tr key={u.id} className="bg-muted/20">
                  <td colSpan={5} className="px-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div><label className="text-xs text-muted-foreground mb-1 block">Nama</label><input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className={inputClass} /></div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Password baru (kosongkan jika tidak diubah)</label>
                        <div className="relative">
                          <input type={showEditPass ? "text" : "password"} value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} placeholder="••••••••" className={`${inputClass} pr-10`} />
                          <button type="button" onClick={() => setShowEditPass(!showEditPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Eye size={14} /></button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Role</label>
                        <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className={inputClass}>
                          {currentUser?.role === "admin" && <option value="admin">Admin</option>}
                          <option value="owner">Owner</option>
                          <option value="karyawan">Karyawan</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                        <select value={editForm.active ? "active" : "inactive"} onChange={(e) => setEditForm({...editForm, active: e.target.value === "active"})} className={inputClass}>
                          <option value="active">Aktif</option>
                          <option value="inactive">Nonaktif</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(u.id)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium"><Check size={13} className="inline mr-1" />Simpan</button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded text-sm font-medium">Batal</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3"><div className="font-medium text-sm text-foreground">{u.name}</div>{u.id === currentUser?.id && <span className="text-xs text-primary">Saya</span>}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">@{u.username}</td>
                  <td className="px-4 py-3"><span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.karyawan}`}>{ROLE_LABELS[u.role] ?? u.role}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground"}`}>{u.active ? "Aktif" : "Nonaktif"}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditId(u.id); setEditForm({ name: u.name, role: u.role, password: "", active: u.active }); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                      {u.id !== currentUser?.id && currentUser?.role === "admin" && (
                        <button onClick={() => deleteUser.mutate({ id: u.id }, { onSuccess: () => { invalidate(); toast({ title: "Pengguna dihapus" }); } })} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
