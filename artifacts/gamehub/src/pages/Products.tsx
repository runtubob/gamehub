import { useState } from "react";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListProductCategories, useCreateProductCategory, useDeleteProductCategory,
  useCreateStockAdjustment, useListStockAdjustments,
  useCreateTransactionBatch,
  getListProductsQueryKey, getGetDashboardQueryKey, getListProductCategoriesQueryKey,
  getListStockAdjustmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, ShoppingCart, Settings, Trash2, Check, X,
  TrendingUp, Banknote, CreditCard, Minus, PackagePlus, PackageMinus,
  History, ChevronDown, ChevronUp, Cigarette, AlertTriangle, ShoppingBag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, canDelete, isAdminOrAbove } from "@/context/AuthContext";

function formatRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

interface CartItem {
  productId: number;
  name: string;
  unitLabel: string;
  price: number;
  stock: number;
  quantity: number;
  isPack: boolean;
  packSize?: number;
  packLabel?: string;
}

type StockModalState = { productId: number; productName: string; stock: number; unitLabel: string; mode: "add" | "reduce" } | null;
type HistoryModalState = { productId: number; productName: string } | null;

const COMMON_UNIT_LABELS = ["pcs", "batang", "botol", "bungkus", "kaleng", "sachet"];

const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const btnPrimary = "px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50";
const btnSecondary = "px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80";

export default function Products() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const superAdmin = canDelete(user?.role);
  const isAdmin = isAdminOrAbove(user?.role);

  const { data: categories } = useListProductCategories();
  const createCategory = useCreateProductCategory();
  const deleteCategory = useDeleteProductCategory();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const { data: products, isLoading } = useListProducts(
    selectedCategoryId ? { categoryId: selectedCategoryId } : {},
    { query: { queryKey: getListProductsQueryKey(selectedCategoryId ? { categoryId: selectedCategoryId } : {}) } }
  );

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createBatch = useCreateTransactionBatch();
  const createStockAdj = useCreateStockAdjustment();

  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "", categoryId: "", price: "", costPrice: "", stock: "0",
    unitLabel: "pcs", hasPack: false,
    packSize: "", packLabel: "bungkus", packPrice: "", packCostPrice: "",
  });

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", categoryId: "", price: "", costPrice: "", stock: "",
    unitLabel: "pcs", hasPack: false,
    packSize: "", packLabel: "", packPrice: "", packCostPrice: "",
  });

  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [stockModal, setStockModal] = useState<StockModalState>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");

  const [historyModal, setHistoryModal] = useState<HistoryModalState>(null);
  const stockAdjParams = historyModal ? { productId: historyModal.productId, limit: 30 } : { limit: 30 };
  const { data: stockHistory } = useListStockAdjustments(stockAdjParams, {
    query: { queryKey: getListStockAdjustmentsQueryKey(stockAdjParams), enabled: !!historyModal },
  });

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [discount, setDiscount] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<{ id: number; name: string } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(selectedCategoryId ? { categoryId: selectedCategoryId } : {}) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["listTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
  };

  const addToCart = (product: NonNullable<typeof products>[0], isPack: boolean) => {
    const price = isPack ? (product.packPrice ?? 0) : product.price;
    const packSize = product.packSize ?? 1;
    setCart((prev) => {
      const stockUsed = prev.reduce((s, c) => c.productId === product.id ? s + (c.isPack ? (c.packSize ?? 1) * c.quantity : c.quantity) : s, 0);
      const stockLeft = product.stock - stockUsed;
      const canAdd = isPack ? stockLeft >= packSize : stockLeft >= 1;
      if (!canAdd) return prev;
      const existing = prev.find((c) => c.productId === product.id && c.isPack === isPack);
      if (existing) return prev.map((c) => c.productId === product.id && c.isPack === isPack ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        productId: product.id, name: product.name, unitLabel: product.unitLabel ?? "pcs",
        price, stock: product.stock, quantity: 1, isPack,
        packSize: product.packSize ?? undefined, packLabel: product.packLabel ?? undefined,
      }];
    });
  };

  const updateCartQty = (productId: number, isPack: boolean, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => !(c.productId === productId && c.isPack === isPack))); return; }
    setCart((prev) => prev.map((c) => c.productId === productId && c.isPack === isPack ? { ...c, quantity: qty } : c));
  };

  const removeFromCart = (productId: number, isPack: boolean) => {
    setCart((prev) => prev.filter((c) => !(c.productId === productId && c.isPack === isPack)));
  };

  const cartRawTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const discountAmount = Math.min(parseInt(discount) || 0, cartRawTotal);
  const cartTotal = cartRawTotal - discountAmount;

  const handleCheckout = () => {
    if (!cart.length) return;
    createBatch.mutate(
      { data: { paymentMethod, discountAmount: discountAmount || undefined, items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, isPack: c.isPack })) } },
      {
        onSuccess: () => {
          invalidate(); setCart([]); setDiscount("");
          toast({ title: `Checkout berhasil — ${formatRp(cartTotal)} via ${paymentMethod.toUpperCase()}${discountAmount > 0 ? ` (diskon ${formatRp(discountAmount)})` : ""}` });
        },
        onError: (err: Error) => toast({ title: "Checkout gagal", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleAdd = () => {
    if (!newForm.name.trim() || !newForm.price) return;
    createProduct.mutate({
      data: {
        name: newForm.name.trim(),
        categoryId: newForm.categoryId ? parseInt(newForm.categoryId) : undefined,
        price: parseInt(newForm.price), costPrice: parseInt(newForm.costPrice) || 0,
        stock: parseInt(newForm.stock) || 0, unitLabel: newForm.unitLabel || "pcs",
        packSize: newForm.hasPack && newForm.packSize ? parseInt(newForm.packSize) : undefined,
        packLabel: newForm.hasPack && newForm.packLabel ? newForm.packLabel : undefined,
        packPrice: newForm.hasPack && newForm.packPrice ? parseInt(newForm.packPrice) : undefined,
        packCostPrice: newForm.hasPack && newForm.packCostPrice ? parseInt(newForm.packCostPrice) : undefined,
      },
    }, {
      onSuccess: () => {
        invalidate(); setShowAdd(false);
        setNewForm({ name: "", categoryId: "", price: "", costPrice: "", stock: "0", unitLabel: "pcs", hasPack: false, packSize: "", packLabel: "bungkus", packPrice: "", packCostPrice: "" });
        toast({ title: "Produk ditambahkan" });
      },
    });
  };

  const handleUpdate = (id: number) => {
    updateProduct.mutate({
      id,
      data: {
        name: editForm.name, categoryId: editForm.categoryId ? parseInt(editForm.categoryId) : undefined,
        price: parseInt(editForm.price), costPrice: parseInt(editForm.costPrice) || 0,
        stock: parseInt(editForm.stock) || 0, unitLabel: editForm.unitLabel,
        packSize: editForm.hasPack && editForm.packSize ? parseInt(editForm.packSize) : undefined,
        packLabel: editForm.hasPack && editForm.packLabel ? editForm.packLabel : undefined,
        packPrice: editForm.hasPack && editForm.packPrice ? parseInt(editForm.packPrice) : undefined,
        packCostPrice: editForm.hasPack && editForm.packCostPrice ? parseInt(editForm.packCostPrice) : undefined,
      },
    }, { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Produk diperbarui" }); } });
  };

  const handleStockAdj = () => {
    if (!stockModal || !stockQty) return;
    if (stockModal.mode === "reduce" && !stockReason.trim()) {
      toast({ title: "Keterangan wajib diisi untuk pengurangan stok", variant: "destructive" }); return;
    }
    createStockAdj.mutate({
      data: {
        productId: stockModal.productId, type: stockModal.mode,
        quantity: parseInt(stockQty), reason: stockReason || undefined,
      },
    }, {
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: getListStockAdjustmentsQueryKey(stockAdjParams) });
        setStockModal(null); setStockQty(""); setStockReason("");
        toast({ title: `Stok ${stockModal.mode === "add" ? "ditambahkan" : "dikurangi"}` });
      },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola stok dan penjualan produk</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCatMgr(!showCatMgr)}
            className="px-3 py-2 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 font-medium">
            Kategori
          </button>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={15} /> Produk Baru
          </button>
        </div>
      </div>

      {/* Category Manager */}
      {showCatMgr && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Manajemen Kategori</h3>
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nama kategori baru..." className={inputClass + " flex-1"} />
            <button onClick={() => {
              if (!newCatName.trim()) return;
              createCategory.mutate({ data: { name: newCatName.trim() } }, {
                onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() }); setNewCatName(""); toast({ title: "Kategori ditambahkan" }); },
              });
            }} className={btnPrimary}>Tambah</button>
          </div>
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 rounded-lg text-xs font-medium">
                  <span>{c.name}</span>
                  {isAdmin && (
                    <button onClick={() => setDeleteCatConfirm({ id: c.id, name: c.name })}
                      className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setSelectedCategoryId(null)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap ${!selectedCategoryId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          Semua
        </button>
        {categories?.map((c) => (
          <button key={c.id} onClick={() => setSelectedCategoryId(c.id)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap ${selectedCategoryId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Add Product Form */}
      {showAdd && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Produk Baru</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nama Produk</label><input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="cth. Marlboro Filter Black" className={inputClass} /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kategori</label>
              <select value={newForm.categoryId} onChange={(e) => setNewForm({ ...newForm, categoryId: e.target.value })} className={inputClass}>
                <option value="">-- Pilih Kategori --</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Harga Jual / Satuan</label><input type="number" value={newForm.price} onChange={(e) => setNewForm({ ...newForm, price: e.target.value })} placeholder="2500" className={inputClass} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Modal / Satuan</label><input type="number" value={newForm.costPrice} onChange={(e) => setNewForm({ ...newForm, costPrice: e.target.value })} placeholder="1900" className={inputClass} /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Label Satuan</label>
              <select value={newForm.unitLabel} onChange={(e) => setNewForm({ ...newForm, unitLabel: e.target.value })} className={inputClass}>
                {COMMON_UNIT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Stok Awal</label><input type="number" value={newForm.stock} onChange={(e) => setNewForm({ ...newForm, stock: e.target.value })} className={inputClass} /></div>
          </div>
          <div className="border border-border rounded-xl p-4 space-y-3">
            <button onClick={() => setNewForm({ ...newForm, hasPack: !newForm.hasPack })} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Cigarette size={16} className="text-chart-1" /> Aktifkan Harga per Bungkus / Pack
              {newForm.hasPack ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              <span className="text-xs text-muted-foreground ml-1">(untuk rokok atau produk yang dijual per pack)</span>
            </button>
            {newForm.hasPack && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div><label className="text-xs text-muted-foreground mb-1 block">Isi per Pack (batang/pcs)</label><input type="number" value={newForm.packSize} onChange={(e) => setNewForm({ ...newForm, packSize: e.target.value })} placeholder="20" className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Label Pack</label><input value={newForm.packLabel} onChange={(e) => setNewForm({ ...newForm, packLabel: e.target.value })} placeholder="bungkus" className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Harga per Pack</label><input type="number" value={newForm.packPrice} onChange={(e) => setNewForm({ ...newForm, packPrice: e.target.value })} placeholder="41000" className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Modal per Pack</label><input type="number" value={newForm.packCostPrice} onChange={(e) => setNewForm({ ...newForm, packCostPrice: e.target.value })} placeholder="38000" className={inputClass} /></div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createProduct.isPending} className={btnPrimary}>{createProduct.isPending ? "Menyimpan..." : "Simpan"}</button>
            <button onClick={() => setShowAdd(false)} className={btnSecondary}>Batal</button>
          </div>
        </div>
      )}

      {/* Product List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-16 animate-pulse" />)}</div>
      ) : !products?.length ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <Package size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Belum ada produk{selectedCategoryId ? " di kategori ini" : ""}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nama / Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga Satuan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga Pack</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Margin</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Stok</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Kelola Stok</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Tambah ke Keranjang</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const isEditing = editId === product.id;
                  const margin = product.costPrice > 0 ? Math.round(((product.price - product.costPrice) / product.price) * 100) : null;
                  const hasPack = !!product.packSize && !!product.packPrice;
                  const cartUnit = cart.find((c) => c.productId === product.id && !c.isPack);
                  const cartPack = cart.find((c) => c.productId === product.id && c.isPack);
                  const stockInCart = (cartUnit?.quantity ?? 0) + (cartPack ? (cartPack.quantity * (product.packSize ?? 1)) : 0);
                  const stockAvail = product.stock - stockInCart;

                  if (isEditing) {
                    return (
                      <tr key={product.id} className="bg-muted/20">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                              <div><label className="text-xs text-muted-foreground mb-1 block">Nama</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} /></div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Kategori</label>
                                <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })} className={inputClass}>
                                  <option value="">-- Tidak ada --</option>
                                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                              <div><label className="text-xs text-muted-foreground mb-1 block">Harga / Satuan</label><input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={inputClass} /></div>
                              <div><label className="text-xs text-muted-foreground mb-1 block">Modal / Satuan</label><input type="number" value={editForm.costPrice} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} className={inputClass} /></div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Label Satuan</label>
                                <select value={editForm.unitLabel} onChange={(e) => setEditForm({ ...editForm, unitLabel: e.target.value })} className={inputClass}>
                                  {COMMON_UNIT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                              </div>
                              <div><label className="text-xs text-muted-foreground mb-1 block">Stok</label><input type="number" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className={inputClass} /></div>
                            </div>
                            <div className="border border-border rounded-xl p-3 space-y-2">
                              <button onClick={() => setEditForm({ ...editForm, hasPack: !editForm.hasPack })} className="flex items-center gap-2 text-sm font-medium">
                                <Cigarette size={14} className="text-chart-1" /> Harga Pack {editForm.hasPack ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                              {editForm.hasPack && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div><label className="text-xs text-muted-foreground mb-1 block">Isi per Pack</label><input type="number" value={editForm.packSize} onChange={(e) => setEditForm({ ...editForm, packSize: e.target.value })} className={inputClass} /></div>
                                  <div><label className="text-xs text-muted-foreground mb-1 block">Label Pack</label><input value={editForm.packLabel} onChange={(e) => setEditForm({ ...editForm, packLabel: e.target.value })} className={inputClass} /></div>
                                  <div><label className="text-xs text-muted-foreground mb-1 block">Harga per Pack</label><input type="number" value={editForm.packPrice} onChange={(e) => setEditForm({ ...editForm, packPrice: e.target.value })} className={inputClass} /></div>
                                  <div><label className="text-xs text-muted-foreground mb-1 block">Modal per Pack</label><input type="number" value={editForm.packCostPrice} onChange={(e) => setEditForm({ ...editForm, packCostPrice: e.target.value })} className={inputClass} /></div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdate(product.id)} className={btnPrimary}><Check size={14} className="inline mr-1" />Simpan</button>
                              <button onClick={() => setEditId(null)} className={btnSecondary}>Batal</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Package size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-foreground">{product.name}</span>
                            {product.categoryName && (
                              <div className="mt-0.5"><span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{product.categoryName}</span></div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-sm text-chart-3 font-medium">{formatRp(product.price)}</span>
                          <span className="text-xs text-muted-foreground ml-1">/{product.unitLabel ?? "pcs"}</span>
                        </div>
                        {product.costPrice > 0 && <div className="text-xs text-muted-foreground">modal: {formatRp(product.costPrice)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {hasPack ? (
                          <div>
                            <span className="text-sm text-primary font-medium">{formatRp(product.packPrice!)}</span>
                            <span className="text-xs text-muted-foreground ml-1">/{product.packLabel}</span>
                            <div className="text-xs text-muted-foreground">isi {product.packSize} {product.unitLabel ?? "pcs"}</div>
                            {product.packCostPrice && product.packCostPrice > 0 && (
                              <div className="text-xs text-muted-foreground">modal: {formatRp(product.packCostPrice)}</div>
                            )}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {margin !== null ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${margin >= 30 ? "bg-chart-3/15 text-chart-3" : margin >= 15 ? "bg-yellow-500/15 text-yellow-400" : "bg-destructive/15 text-destructive"}`}>
                            <TrendingUp size={9} />{margin}%
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div>
                          <span className={`text-sm font-bold ${product.stock === 0 ? "text-destructive" : product.stock <= 10 ? "text-yellow-400" : "text-foreground"}`}>{product.stock}</span>
                          <div className="text-xs text-muted-foreground">{product.unitLabel ?? "pcs"}</div>
                          {stockInCart > 0 && <div className="text-xs text-orange-400">{stockInCart} di keranjang</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button title="Tambah Stok" onClick={() => { setStockModal({ productId: product.id, productName: product.name, stock: product.stock, unitLabel: product.unitLabel ?? "pcs", mode: "add" }); setStockQty(""); setStockReason(""); }} className="p-1.5 text-chart-3 hover:bg-chart-3/10 rounded-lg border border-chart-3/20"><PackagePlus size={14} /></button>
                          <button title="Kurangi Stok" onClick={() => { setStockModal({ productId: product.id, productName: product.name, stock: product.stock, unitLabel: product.unitLabel ?? "pcs", mode: "reduce" }); setStockQty(""); setStockReason(""); }} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg border border-destructive/20"><PackageMinus size={14} /></button>
                          <button title="Riwayat Stok" onClick={() => setHistoryModal({ productId: product.id, productName: product.name })} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg border border-border"><History size={14} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-center">
                          {cartUnit ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateCartQty(product.id, false, cartUnit.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80"><Minus size={11} /></button>
                              <span className="text-xs font-bold w-6 text-center">{cartUnit.quantity}</span>
                              <button onClick={() => updateCartQty(product.id, false, cartUnit.quantity + 1)} disabled={stockAvail < 1} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 disabled:opacity-40"><Plus size={11} /></button>
                              <span className="text-xs text-muted-foreground ml-1">{product.unitLabel ?? "pcs"}</span>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product, false)} disabled={stockAvail < 1}
                              className="flex items-center gap-1 px-2 py-1 bg-chart-3/15 text-chart-3 border border-chart-3/30 rounded text-xs font-medium hover:bg-chart-3/25 disabled:opacity-40 whitespace-nowrap">
                              <ShoppingCart size={10} /> per {product.unitLabel ?? "pcs"}
                            </button>
                          )}
                          {hasPack && (cartPack ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateCartQty(product.id, true, cartPack.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80"><Minus size={11} /></button>
                              <span className="text-xs font-bold w-6 text-center">{cartPack.quantity}</span>
                              <button onClick={() => updateCartQty(product.id, true, cartPack.quantity + 1)} disabled={stockAvail < (product.packSize ?? 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 disabled:opacity-40"><Plus size={11} /></button>
                              <span className="text-xs text-muted-foreground ml-1">{product.packLabel}</span>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product, true)} disabled={stockAvail < (product.packSize ?? 1)}
                              className="flex items-center gap-1 px-2 py-1 bg-primary/15 text-primary border border-primary/30 rounded text-xs font-medium hover:bg-primary/25 disabled:opacity-40 whitespace-nowrap">
                              <ShoppingCart size={10} /> per {product.packLabel ?? "pack"}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => {
                            setEditId(product.id);
                            setEditForm({
                              name: product.name, categoryId: product.categoryId ? String(product.categoryId) : "",
                              price: String(product.price), costPrice: String(product.costPrice), stock: String(product.stock),
                              unitLabel: product.unitLabel ?? "pcs", hasPack: !!product.packSize,
                              packSize: product.packSize ? String(product.packSize) : "",
                              packLabel: product.packLabel ?? "bungkus",
                              packPrice: product.packPrice ? String(product.packPrice) : "",
                              packCostPrice: product.packCostPrice ? String(product.packCostPrice) : "",
                            });
                          }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                          {isAdmin ? (
                            <button onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KERANJANG BELANJA ── */}
      {cart.length > 0 && (
        <div className="bg-card border border-primary/30 rounded-xl overflow-hidden shadow-lg">
          {/* Cart Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/20">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">Keranjang Belanja</h3>
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">{cartCount} item</span>
            </div>
            <button onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg border border-destructive/30 font-medium transition-colors">
              <X size={12} /> Batalkan Transaksi
            </button>
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-border">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-muted/10">
              <span className="text-xs font-medium text-muted-foreground uppercase">Produk</span>
              <span className="text-xs font-medium text-muted-foreground uppercase text-center">Harga Satuan</span>
              <span className="text-xs font-medium text-muted-foreground uppercase text-center">Qty</span>
              <span className="text-xs font-medium text-muted-foreground uppercase text-right">Subtotal</span>
              <span className="w-8" />
            </div>

            {cart.map((item) => (
              <div key={`${item.productId}-${item.isPack}`} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 px-4 py-3 items-center hover:bg-muted/10 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.isPack ? `per ${item.packLabel ?? "pack"}${item.packSize ? ` (${item.packSize} ${item.unitLabel})` : ""}` : `per ${item.unitLabel}`}
                  </p>
                </div>
                <div className="text-center md:text-center">
                  <span className="text-sm font-medium text-chart-3">{formatRp(item.price)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => updateCartQty(item.productId, item.isPack, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center bg-muted rounded-lg hover:bg-muted/80 border border-border">
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                  <button onClick={() => updateCartQty(item.productId, item.isPack, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-muted rounded-lg hover:bg-muted/80 border border-border">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-chart-3">{formatRp(item.price * item.quantity)}</span>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => removeFromCart(item.productId, item.isPack)}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Cart Footer */}
          <div className="px-4 py-4 border-t border-border bg-muted/5">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Payment method + Diskon */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Metode Pembayaran</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPaymentMethod("cash")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "cash" ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground hover:border-chart-3/50"}`}>
                      <Banknote size={16} /> Cash
                    </button>
                    <button onClick={() => setPaymentMethod("qris")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${paymentMethod === "qris" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      <CreditCard size={16} /> QRIS
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Diskon (Opsional)</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rp</span>
                    <input
                      type="number"
                      min={0}
                      max={cartRawTotal}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-32 px-3 py-1.5 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {discountAmount > 0 && (
                      <button onClick={() => setDiscount("")} className="text-xs text-muted-foreground hover:text-destructive">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Total + Checkout */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  {discountAmount > 0 && (
                    <p className="text-sm text-muted-foreground line-through">{formatRp(cartRawTotal)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Belanja</p>
                  <p className="text-2xl font-bold text-chart-3">{formatRp(cartTotal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {cartCount} item • via {paymentMethod.toUpperCase()}
                    {discountAmount > 0 && <span className="text-destructive ml-1">• diskon {formatRp(discountAmount)}</span>}
                  </p>
                </div>
                <button onClick={handleCheckout} disabled={createBatch.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-chart-3 text-white rounded-xl text-sm font-bold hover:bg-chart-3/90 disabled:opacity-50 shadow-lg transition-all">
                  <Check size={16} /> {createBatch.isPending ? "Memproses..." : "Bayar Sekarang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setStockModal({ ...stockModal, mode: "add" })} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${stockModal.mode === "add" ? "bg-chart-3 text-white" : "bg-muted text-muted-foreground"}`}><PackagePlus size={15} /> Tambah Stok</button>
              <button onClick={() => setStockModal({ ...stockModal, mode: "reduce" })} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${stockModal.mode === "reduce" ? "bg-destructive text-white" : "bg-muted text-muted-foreground"}`}><PackageMinus size={15} /> Kurangi Stok</button>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{stockModal.productName}</p>
              <p className="text-xs text-muted-foreground">Stok saat ini: <span className="font-bold text-foreground">{stockModal.stock} {stockModal.unitLabel}</span></p>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Jumlah ({stockModal.unitLabel})</label><input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="Masukkan jumlah..." min={1} autoFocus className={inputClass} /></div>
            {stockModal.mode === "reduce" && (
              <div><label className="text-xs text-muted-foreground mb-1 block">Keterangan <span className="text-destructive">*wajib</span></label><input value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder="cth. 5 botol pecah, kadaluarsa..." className={inputClass} /></div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleStockAdj} disabled={createStockAdj.isPending || !stockQty} className={`flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${stockModal.mode === "add" ? "bg-chart-3 text-white hover:bg-chart-3/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}>
                {createStockAdj.isPending ? "Menyimpan..." : stockModal.mode === "add" ? "Tambah Stok" : "Kurangi Stok"}
              </button>
              <button onClick={() => setStockModal(null)} className={btnSecondary}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-bold text-foreground">Riwayat Stok</h3><p className="text-xs text-muted-foreground">{historyModal.productName}</p></div>
              <button onClick={() => setHistoryModal(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {!stockHistory?.length ? (
                <p className="text-center text-muted-foreground text-sm py-6">Belum ada riwayat penyesuaian stok</p>
              ) : stockHistory.map((adj) => (
                <div key={adj.id} className={`flex items-start gap-3 p-3 rounded-lg border ${adj.type === "add" ? "border-chart-3/20 bg-chart-3/5" : "border-destructive/20 bg-destructive/5"}`}>
                  <div className={`mt-0.5 ${adj.type === "add" ? "text-chart-3" : "text-destructive"}`}>{adj.type === "add" ? <PackagePlus size={16} /> : <PackageMinus size={16} />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${adj.type === "add" ? "text-chart-3" : "text-destructive"}`}>{adj.type === "add" ? "+" : "-"}{adj.quantity}</span>
                      <span className="text-xs text-muted-foreground">{new Date(adj.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {adj.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{adj.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Transaction Confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Batalkan Transaksi?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Semua item di keranjang akan dihapus.</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-sm text-muted-foreground">{cartCount} item senilai <span className="font-bold text-foreground">{formatRp(cartTotal)}</span> akan dibatalkan.</p>
              <p className="text-xs text-muted-foreground mt-1">Stok tidak akan berubah karena belum checkout.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCart([]); setShowCancelConfirm(false); toast({ title: "Transaksi dibatalkan", description: "Keranjang dikosongkan." }); }}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90">
                Ya, Batalkan
              </button>
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Tetap Lanjut</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {deleteCatConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Hapus Kategori?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Produk yang terhubung tidak akan ikut terhapus.</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">{deleteCatConfirm.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => deleteCategory.mutate({ id: deleteCatConfirm.id }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() });
                  setDeleteCatConfirm(null);
                  toast({ title: "Kategori dihapus" });
                },
                onError: () => toast({ title: "Gagal menghapus kategori", variant: "destructive" }),
              })} disabled={deleteCategory.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {deleteCategory.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setDeleteCatConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Hapus Produk?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Data produk dan riwayat stok akan terhapus permanen.</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-foreground">{deleteConfirm.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => deleteProduct.mutate({ id: deleteConfirm.id }, {
                onSuccess: () => { invalidate(); setDeleteConfirm(null); toast({ title: "Produk dihapus" }); },
                onError: () => toast({ title: "Gagal menghapus produk", variant: "destructive" }),
              })} disabled={deleteProduct.isPending}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50">
                {deleteProduct.isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
