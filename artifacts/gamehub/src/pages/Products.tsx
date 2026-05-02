import { useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCreateTransaction,
  getListProductsQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Plus, ShoppingCart, Settings, Trash2, Check, X, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function Products() {
  const { data: products, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createTransaction = useCreateTransaction();
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
  const [sellQty, setSellQty] = useState<Record<number, number>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["listTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
  };

  const handleAdd = () => {
    if (!newName.trim() || !newPrice) return;
    createProduct.mutate(
      {
        data: {
          name: newName.trim(),
          price: parseInt(newPrice),
          costPrice: parseInt(newCostPrice) || 0,
          stock: parseInt(newStock) || 10,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setNewName(""); setNewPrice(""); setNewCostPrice(""); setNewStock("10");
          toast({ title: "Produk berhasil ditambahkan" });
        },
      }
    );
  };

  const handleUpdate = (id: number) => {
    updateProduct.mutate(
      {
        id,
        data: {
          name: editName,
          price: parseInt(editPrice),
          costPrice: parseInt(editCostPrice) || 0,
          stock: parseInt(editStock),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setEditId(null);
          toast({ title: "Produk berhasil diperbarui" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteProduct.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Produk berhasil dihapus" });
      },
    });
  };

  const handleSell = (productId: number) => {
    const qty = sellQty[productId] ?? 1;
    createTransaction.mutate(
      { data: { productId, quantity: qty } },
      {
        onSuccess: () => {
          invalidate();
          setSellQty((prev) => ({ ...prev, [productId]: 1 }));
          toast({ title: "Penjualan berhasil dicatat" });
        },
        onError: () => {
          toast({ title: "Gagal mencatat penjualan", description: "Stok tidak cukup", variant: "destructive" });
        },
      }
    );
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const inlineInputClass = "px-2 py-1 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola produk dan catat penjualan</p>
        </div>
        <button
          data-testid="button-add-product"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Tambah Produk
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Produk Baru</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nama Produk</label>
              <input
                data-testid="input-product-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="cth. Indomie Goreng"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Harga Jual (Rp)</label>
              <input
                data-testid="input-product-price"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="5000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Harga Modal (Rp)</label>
              <input
                data-testid="input-product-cost"
                type="number"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
                placeholder="3000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stok</label>
              <input
                data-testid="input-product-stock"
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              data-testid="button-save-product"
              onClick={handleAdd}
              disabled={createProduct.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createProduct.isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              data-testid="button-cancel-add-product"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
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
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nama</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Jual</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Modal</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stok</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Jual</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const isEditing = editId === product.id;
                const qty = sellQty[product.id] ?? 1;
                const margin = product.costPrice > 0
                  ? Math.round(((product.price - product.costPrice) / product.price) * 100)
                  : null;
                return (
                  <tr key={product.id} data-testid={`row-product-${product.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input
                          data-testid={`input-edit-product-name-${product.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={`${inlineInputClass} w-40`}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Package size={15} className="text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{product.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input
                          data-testid={`input-edit-product-price-${product.id}`}
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className={`${inlineInputClass} w-28`}
                        />
                      ) : (
                        <span data-testid={`text-price-${product.id}`} className="text-sm text-chart-3 font-medium">{formatRp(product.price)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input
                          data-testid={`input-edit-product-cost-${product.id}`}
                          type="number"
                          value={editCostPrice}
                          onChange={(e) => setEditCostPrice(e.target.value)}
                          placeholder="0"
                          className={`${inlineInputClass} w-28`}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {product.costPrice > 0 ? formatRp(product.costPrice) : <span className="text-xs italic">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {!isEditing && margin !== null ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${margin >= 30 ? "bg-chart-3/15 text-chart-3" : margin >= 15 ? "bg-yellow-500/15 text-yellow-400" : "bg-destructive/15 text-destructive"}`}>
                          <TrendingUp size={10} />
                          {margin}%
                        </span>
                      ) : !isEditing ? (
                        <span className="text-xs text-muted-foreground italic">-</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input
                          data-testid={`input-edit-product-stock-${product.id}`}
                          type="number"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                          className={`${inlineInputClass} w-20`}
                        />
                      ) : (
                        <span
                          data-testid={`text-stock-${product.id}`}
                          className={`text-sm font-medium ${product.stock <= 5 ? "text-destructive" : "text-foreground"}`}
                        >
                          {product.stock}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <input
                            data-testid={`input-sell-qty-${product.id}`}
                            type="number"
                            min={1}
                            max={product.stock}
                            value={qty}
                            onChange={(e) => setSellQty((prev) => ({ ...prev, [product.id]: parseInt(e.target.value) || 1 }))}
                            className={`${inlineInputClass} w-16`}
                          />
                          <button
                            data-testid={`button-sell-${product.id}`}
                            onClick={() => handleSell(product.id)}
                            disabled={product.stock === 0 || createTransaction.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-chart-3/20 text-chart-3 border border-chart-3/30 rounded-lg text-xs font-medium hover:bg-chart-3/30 transition-colors disabled:opacity-40"
                          >
                            <ShoppingCart size={12} />
                            Jual
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              data-testid={`button-save-edit-product-${product.id}`}
                              onClick={() => handleUpdate(product.id)}
                              className="p-1.5 text-chart-3 hover:bg-chart-3/10 rounded"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              data-testid={`button-cancel-edit-product-${product.id}`}
                              onClick={() => setEditId(null)}
                              className="p-1.5 text-muted-foreground hover:bg-muted rounded"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              data-testid={`button-edit-product-${product.id}`}
                              onClick={() => {
                                setEditId(product.id);
                                setEditName(product.name);
                                setEditPrice(String(product.price));
                                setEditCostPrice(String(product.costPrice));
                                setEditStock(String(product.stock));
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                            >
                              <Settings size={14} />
                            </button>
                            <button
                              data-testid={`button-delete-product-${product.id}`}
                              onClick={() => handleDelete(product.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
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
