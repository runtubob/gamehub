import { useState } from "react";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateTransactionBatch,
  getListProductsQueryKey, getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, ShoppingCart, Settings, Trash2, Check, X, TrendingUp, Banknote, CreditCard, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

interface CartItem {
  productId: number;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

export default function Products() {
  const { data: products, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createBatch = useCreateTransactionBatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newStock, setNewStock] = useState("10");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["listTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
  };

  const addToCart = (product: { id: number; name: string; price: number; stock: number }) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, stock: product.stock, quantity: 1 }];
    });
    setShowCart(true);
  };

  const updateCartQty = (productId: number, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => c.productId !== productId)); return; }
    setCart((prev) => prev.map((c) => c.productId === productId ? { ...c, quantity: qty } : c));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleCheckout = () => {
    if (!cart.length) return;
    createBatch.mutate(
      { data: { paymentMethod, items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })) } },
      {
        onSuccess: () => {
          invalidate();
          setCart([]);
          setShowCart(false);
          toast({ title: `Checkout berhasil — ${formatRp(cartTotal)} via ${paymentMethod.toUpperCase()}` });
        },
        onError: (err: Error) => {
          toast({ title: "Checkout gagal", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleAdd = () => {
    if (!newName.trim() || !newPrice) return;
    createProduct.mutate(
      { data: { name: newName.trim(), price: parseInt(newPrice), costPrice: parseInt(newCostPrice) || 0, stock: parseInt(newStock) || 10 } },
      {
        onSuccess: () => { invalidate(); setShowAdd(false); setNewName(""); setNewPrice(""); setNewCostPrice(""); setNewStock("10"); toast({ title: "Produk ditambahkan" }); },
      }
    );
  };

  const handleUpdate = (id: number) => {
    updateProduct.mutate(
      { id, data: { name: editName, price: parseInt(editPrice), costPrice: parseInt(editCostPrice) || 0, stock: parseInt(editStock) } },
      { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Produk diperbarui" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteProduct.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Produk dihapus" }); } });
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const inlineInput = "px-2 py-1 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola produk dan catat penjualan</p>
        </div>
        <div className="flex items-center gap-2">
          {cartCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-2 px-4 py-2 bg-chart-3/20 text-chart-3 border border-chart-3/30 rounded-lg text-sm font-medium hover:bg-chart-3/30 transition-colors"
            >
              <ShoppingCart size={16} />
              Keranjang
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-chart-3 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Produk Baru</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Nama</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Indomie Goreng" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Harga Jual</label><input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="5000" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Harga Modal</label><input type="number" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} placeholder="3000" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Stok</label><input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} className={inputClass} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createProduct.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{createProduct.isPending ? "Menyimpan..." : "Simpan"}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-16 animate-pulse" />)}</div>
      ) : !products?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Package size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Belum ada produk</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga Jual</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Modal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Margin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Stok</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Keranjang</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const isEditing = editId === product.id;
                const margin = product.costPrice > 0 ? Math.round(((product.price - product.costPrice) / product.price) * 100) : null;
                const inCart = cart.find((c) => c.productId === product.id);
                return (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {isEditing ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`${inlineInput} w-36`} /> : (
                        <div className="flex items-center gap-2"><Package size={14} className="text-muted-foreground shrink-0" /><span className="text-sm font-medium">{product.name}</span></div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={`${inlineInput} w-24`} /> : (
                        <span className="text-sm text-chart-3 font-medium">{formatRp(product.price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? <input type="number" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} className={`${inlineInput} w-24`} /> : (
                        <span className="text-sm text-muted-foreground">{product.costPrice > 0 ? formatRp(product.costPrice) : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isEditing && margin !== null ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${margin >= 30 ? "bg-chart-3/15 text-chart-3" : margin >= 15 ? "bg-yellow-500/15 text-yellow-400" : "bg-destructive/15 text-destructive"}`}>
                          <TrendingUp size={9} />{margin}%
                        </span>
                      ) : !isEditing ? "—" : null}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? <input type="number" value={editStock} onChange={(e) => setEditStock(e.target.value)} className={`${inlineInput} w-16`} /> : (
                        <span className={`text-sm font-medium ${product.stock <= 5 ? "text-destructive" : "text-foreground"}`}>{product.stock}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isEditing && (
                        inCart ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateCartQty(product.id, inCart.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80"><Minus size={11} /></button>
                            <span className="text-sm font-medium w-6 text-center">{inCart.quantity}</span>
                            <button onClick={() => updateCartQty(product.id, inCart.quantity + 1)} disabled={inCart.quantity >= product.stock} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 disabled:opacity-40"><Plus size={11} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            disabled={product.stock === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-chart-3/20 text-chart-3 border border-chart-3/30 rounded-lg text-xs font-medium hover:bg-chart-3/30 disabled:opacity-40"
                          >
                            <ShoppingCart size={11} /> Tambah
                          </button>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleUpdate(product.id)} className="p-1.5 text-chart-3 hover:bg-chart-3/10 rounded"><Check size={13} /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded"><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(product.id); setEditName(product.name); setEditPrice(String(product.price)); setEditCostPrice(String(product.costPrice)); setEditStock(String(product.stock)); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                            <button onClick={() => handleDelete(product.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
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

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="w-80 bg-card border-l border-border flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-chart-3" />
                <h3 className="font-bold text-foreground">Keranjang</h3>
                <span className="text-xs text-muted-foreground">({cartCount} item)</span>
              </div>
              <button onClick={() => setShowCart(false)} className="p-1 text-muted-foreground hover:text-foreground rounded"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Keranjang kosong</div>
              ) : cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-chart-3">{formatRp(item.price)} / item</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateCartQty(item.productId, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80"><Minus size={11} /></button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 disabled:opacity-40"><Plus size={11} /></button>
                  </div>
                  <div className="text-sm font-semibold text-foreground w-20 text-right shrink-0">{formatRp(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-border space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-chart-3">{formatRp(cartTotal)}</span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Metode Pembayaran</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "cash" ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground hover:border-chart-3/50"}`}
                    >
                      <Banknote size={15} /> Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod("qris")}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      <CreditCard size={15} /> QRIS
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={createBatch.isPending}
                  className="w-full py-3 bg-chart-3 text-white rounded-lg text-sm font-bold hover:bg-chart-3/90 disabled:opacity-50"
                >
                  {createBatch.isPending ? "Memproses..." : `Bayar ${formatRp(cartTotal)}`}
                </button>
                <button onClick={() => setCart([])} className="w-full py-2 text-xs text-muted-foreground hover:text-destructive transition-colors">Kosongkan keranjang</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
