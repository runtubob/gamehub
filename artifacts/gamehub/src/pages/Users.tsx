import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Trash2, Settings, Check, Eye, EyeOff, Shield, Crown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, canDelete } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  owner: "Admin",
  karyawan: "Karyawan",
};
const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  admin: "bg-primary/15 text-primary border-primary/30",
  owner: "bg-primary/15 text-primary border-primary/30",
  karyawan: "bg-muted text-muted-foreground border-border",
};

const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = canDelete(currentUser?.role);
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ username: "", password: "", name: "", role: "admin" });
  const [showNewPass, setShowNewPass] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", password: "", active: true });
  const [showEditPass, setShowEditPass] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleAdd = () => {
    if (!newForm.username || !newForm.password || !newForm.name) return;
    createUser.mutate(
      { data: { username: newForm.username, password: newForm.password, name: newForm.name, role: newForm.role as "superadmin" | "admin" | "owner" | "karyawan" } },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setNewForm({ username: "", password: "", name: "", role: "admin" });
          toast({ title: "Pengguna berhasil ditambahkan" });
        },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleUpdate = (id: number) => {
    const data: Record<string, unknown> = { name: editForm.name, role: editForm.role, active: editForm.active };
    if (editForm.password) data.password = editForm.password;
    updateUser.mutate(
      { id, data: data as Parameters<typeof updateUser.mutate>[0]["data"] },
      {
        onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Pengguna diperbarui" }); },
        onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteUser.mutate(
      { id: deleteConfirm.id },
      {
        onSuccess: () => { invalidate(); setDeleteConfirm(null); toast({ title: "Pengguna dihapus" }); },
        onError: (e: Error) => toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
      }
    );
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-chart-1/30 bg-chart-1/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5"><Crown size={14} className="text-chart-1" /><span className="text-sm font-bold text-chart-1">Super Admin</span></div>
          <p className="text-xs text-muted-foreground">Akses penuh termasuk hapus transaksi, hapus produk, kelola semua pengguna, dan semua fitur Admin.</p>
        </div>
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5"><Shield size={14} className="text-primary" /><span className="text-sm font-bold text-primary">Admin</span></div>
          <p className="text-xs text-muted-foreground">Bisa input transaksi, billing, pengeluaran, paket rental, dan lihat laporan keuangan. Tidak bisa hapus data sensitif.</p>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold">Pengguna Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Nama Lengkap</label><input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="cth. Budi Santoso" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Username</label><input value={newForm.username} onChange={(e) => setNewForm({ ...newForm, username: e.target.value })} placeholder="cth. budi" className={inputClass} /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <input type={showNewPass ? "text" : "password"} value={newForm.password} onChange={(e) => setNewForm({ ...newForm, password: e.target.value })} placeholder="Minimal 6 karakter" className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <select value={newForm.role} onChange={(e) => setNewForm({ ...newForm, role: e.target.value })} className={inputClass}>
                {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                <option value="admin">Admin</option>
                <option value="karyawan">Karyawan</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createUser.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {createUser.isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-card border border-card-border rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pengguna</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => editId === u.id ? (
                <tr key={u.id} className="bg-muted/20">
                  <td colSpan={5} className="px-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div><label className="text-xs text-muted-foreground mb-1 block">Nama</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} /></div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Password baru (kosongkan jika tidak diubah)</label>
                        <div className="relative">
                          <input type={showEditPass ? "text" : "password"} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" className={`${inputClass} pr-10`} />
                          <button type="button" onClick={() => setShowEditPass(!showEditPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showEditPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Role</label>
                        <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputClass}>
                          {isSuperAdmin && <option value="superadmin">Super Admin</option>}
                          <option value="admin">Admin</option>
                          <option value="karyawan">Karyawan</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                        <select value={editForm.active ? "active" : "inactive"} onChange={(e) => setEditForm({ ...editForm, active: e.target.value === "active" })} className={inputClass}>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        {u.role === "superadmin" ? <Crown size={12} className="text-chart-1" /> : <Shield size={12} className="text-primary" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">{u.name}</div>
                        {u.id === currentUser?.id && <span className="text-xs text-primary">Saya</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">@{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.karyawan}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${u.active ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground"}`}>
                      {u.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditId(u.id); setEditForm({ name: u.name, role: u.role, password: "", active: u.active }); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                      {u.id !== currentUser?.id && isSuperAdmin && (
                        <button onClick={() => setDeleteConfirm({ id: u.id, name: u.name })}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Hapus Pengguna?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">{deleteConfirm.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmDelete} disabled={deleteUser.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {deleteUser.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
