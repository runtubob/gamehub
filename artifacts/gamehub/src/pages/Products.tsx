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
  Tag, History, ChevronDown, ChevronUp, Cigarette
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

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

type StockModalState = {
  productId: number;
  productName: string;
  stock: number;
  unitLabel: string;
  mode: "add" | "reduce";
} | null;

type HistoryModalState = { productId: number; productName: string } | null;

const COMMON_UNIT_LABELS = ["pcs", "batang", "botol", "bungkus", "kaleng", "sachet"];

export default function Products() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // ── Add Product Form ──────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "", categoryId: "", price: "", costPrice: "", stock: "0",
    unitLabel: "pcs", hasPack: false,
    packSize: "", packLabel: "bungkus", packPrice: "", packCostPrice: "",
  });

  // ── Edit Product ──────────────────────────────────────────────────
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", categoryId: "", price: "", costPrice: "", stock: "",
    unitLabel: "pcs", hasPack: false,
    packSize: "", packLabel: "", packPrice: "", packCostPrice: "",
  });

  // ── Category Management ───────────────────────────────────────────
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // ── Stock Adjustment Modal ────────────────────────────────────────
  const [stockModal, setStockModal] = useState<StockModalState>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");

  // ── Stock History Modal ───────────────────────────────────────────
  const [historyModal, setHistoryModal] = useState<HistoryModalState>(null);
  const stockAdjParams = historyModal ? { productId: historyModal.productId, limit: 30 } : { limit: 30 };
  const { data: stockHistory } = useListStockAdjustments(stockAdjParams, {
    query: {
      queryKey: getListStockAdjustmentsQueryKey(stockAdjParams),
      enabled: !!historyModal,
    },
  });

  // ── Cart ──────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(selectedCategoryId ? { categoryId: selectedCategoryId } : {}) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["listTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["listRecentTransactions"] });
  };

  // ── Add to cart ───────────────────────────────────────────────────
  const addToCart = (product: NonNullable<typeof products>[0], isPack: boolean) => {
    const price = isPack ? (product.packPrice ?? 0) : product.price;
    const packSize = product.packSize ?? 1;
    const key = `${product.id}-${isPack ? "pack" : "unit"}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id && c.isPack === isPack);
      const stockLeft = product.stock - prev.reduce((s, c) => c.productId === product.id ? s + (c.isPack ? (c.packSize ?? 1) * c.quantity : c.quantity) : s, 0);
      const canAdd = isPack ? stockLeft >= packSize : stockLeft >= 1;
      if (!canAdd) return prev;
      if (existing) return prev.map((c) => c.productId === product.id && c.isPack === isPack ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitLabel: product.unitLabel ?? "pcs",
        price,
        stock: product.stock,
        quantity: 1,
        isPack,
        packSize: product.packSize ?? undefined,
        packLabel: product.packLabel ?? undefined,
      }];
    });
    setShowCart(true);
    void key;
  };

  const updateCartQty = (productId: number, isPack: boolean, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => !(c.productId === productId && c.isPack === isPack))); return; }
    setCart((prev) => prev.map((c) => c.productId === productId && c.isPack === isPack ? { ...c, quantity: qty } : c));
  };

  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const handleCheckout = () => {
    if (!cart.length) return;
    createBatch.mutate(
      {
        data: {
          paymentMethod,
          items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, isPack: c.isPack })),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setCart([]);
          setShowCart(false);
          toast({ title: `Checkout berhasil — ${formatRp(cartTotal)} via ${paymentMethod.toUpperCase()}` });
        },
        onError: (err: Error) => toast({ title: "Checkout gagal", description: err.message, variant: "destructive" }),
      }
    );
  };

  // ── Add Product ───────────────────────────────────────────────────
  const handleAdd = () => {
    if (!newForm.name.trim() || !newForm.price) return;
    createProduct.mutate({
      data: {
        name: newForm.name.trim(),
        categoryId: newForm.categoryId ? parseInt(newForm.categoryId) : undefined,
        price: parseInt(newForm.price),
        costPrice: parseInt(newForm.costPrice) || 0,
        stock: parseInt(newForm.stock) || 0,
        unitLabel: newForm.unitLabel || "pcs",
        packSize: newForm.hasPack && newForm.packSize ? parseInt(newForm.packSize) : undefined,
        packLabel: newForm.hasPack && newForm.packLabel ? newForm.packLabel : undefined,
        packPrice: newForm.hasPack && newForm.packPrice ? parseInt(newForm.packPrice) : undefined,
        packCostPrice: newForm.hasPack && newForm.packCostPrice ? parseInt(newForm.packCostPrice) : undefined,
      },
    }, {
      onSuccess: () => {
        invalidate();
        setShowAdd(false);
        setNewForm({ name: "", categoryId: "", price: "", costPrice: "", stock: "0", unitLabel: "pcs", hasPack: false, packSize: "", packLabel: "bungkus", packPrice: "", packCostPrice: "" });
        toast({ title: "Produk ditambahkan" });
      },
    });
  };

  // ── Update Product ────────────────────────────────────────────────
  const handleUpdate = (id: number) => {
    updateProduct.mutate({
      id,
      data: {
        name: editForm.name,
        categoryId: editForm.categoryId ? parseInt(editForm.categoryId) : undefined,
        price: parseInt(editForm.price),
        costPrice: parseInt(editForm.costPrice) || 0,
        stock: parseInt(editForm.stock),
        unitLabel: editForm.unitLabel || "pcs",
        packSize: editForm.hasPack && editForm.packSize ? parseInt(editForm.packSize) : undefined,
        packLabel: editForm.hasPack && editForm.packLabel ? editForm.packLabel : undefined,
        packPrice: editForm.hasPack && editForm.packPrice ? parseInt(editForm.packPrice) : undefined,
        packCostPrice: editForm.hasPack && editForm.packCostPrice ? parseInt(editForm.packCostPrice) : undefined,
      },
    }, { onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Produk diperbarui" }); } });
  };

  // ── Stock Adjustment ──────────────────────────────────────────────
  const handleStockAdj = () => {
    if (!stockModal || !stockQty) return;
    if (stockModal.mode === "reduce" && !stockReason.trim()) {
      toast({ title: "Keterangan wajib diisi untuk pengurangan stok", variant: "destructive" });
      return;
    }
    createStockAdj.mutate({
      data: { productId: stockModal.productId, type: stockModal.mode, quantity: parseInt(stockQty), reason: stockReason.trim() || undefined },
    }, {
      onSuccess: () => {
        invalidate();
        setStockModal(null);
        setStockQty("");
        setStockReason("");
        toast({ title: stockModal.mode === "add" ? "Stok berhasil ditambahkan" : "Stok berhasil dikurangi" });
      },
      onError: (err: Error) => toast({ title: "Gagal menyesuaikan stok", description: err.message, variant: "destructive" }),
    });
  };

  // ── Add Category ──────────────────────────────────────────────────
  const handleAddCat = () => {
    if (!newCatName.trim()) return;
    createCategory.mutate({ data: { name: newCatName.trim() } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() }); setNewCatName(""); toast({ title: "Kategori ditambahkan" }); },
    });
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const inlineInput = "px-2 py-1 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const btnPrimary = "px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50";
  const btnSecondary = "px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola produk, stok, dan penjualan</p>
        </div>
        <div className="flex items-center gap-2">
          {cartCount > 0 && (
            <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 px-4 py-2 bg-chart-3/20 text-chart-3 border border-chart-3/30 rounded-lg text-sm font-medium hover:bg-chart-3/30">
              <ShoppingCart size={16} /> Keranjang
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-chart-3 text-white text-xs rounded-full flex items-center justify-center font-bold">{cartCount}</span>
            </button>
          )}
          <button onClick={() => setShowCatMgr(!showCatMgr)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${showCatMgr ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}>
            <Tag size={15} /> Kategori
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Category Manager */}
      {showCatMgr && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Kelola Kategori</h3>
          <div className="flex flex-wrap gap-2">
            {categories?.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm border border-border">
                <span>{cat.name}</span>
                <button onClick={() => { deleteCategory.mutate({ id: cat.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() }); if (selectedCategoryId === cat.id) setSelectedCategoryId(null); } }); }} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nama kategori baru..." onKeyDown={(e) => e.key === "Enter" && handleAddCat()} className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={handleAddCat} disabled={createCategory.isPending} className={btnPrimary}><Plus size={14} /></button>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedCategoryId(null)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategoryId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          Semua
        </button>
        {categories?.map((cat) => (
          <button key={cat.id} onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategoryId === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {cat.name}
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

          {/* Pack pricing toggle */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <button onClick={() => setNewForm({ ...newForm, hasPack: !newForm.hasPack })} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Cigarette size={16} className="text-chart-1" />
              Aktifkan Harga per Bungkus / Pack
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nama / Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga Satuan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Harga Pack</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Margin</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Stok</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Kelola Stok</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Jual</th>
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
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{product.categoryName}</span>
                            </div>
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
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Tambah Stok"
                          onClick={() => { setStockModal({ productId: product.id, productName: product.name, stock: product.stock, unitLabel: product.unitLabel ?? "pcs", mode: "add" }); setStockQty(""); setStockReason(""); }}
                          className="p-1.5 text-chart-3 hover:bg-chart-3/10 rounded-lg border border-chart-3/20 hover:border-chart-3/50"
                        >
                          <PackagePlus size={14} />
                        </button>
                        <button
                          title="Kurangi Stok"
                          onClick={() => { setStockModal({ productId: product.id, productName: product.name, stock: product.stock, unitLabel: product.unitLabel ?? "pcs", mode: "reduce" }); setStockQty(""); setStockReason(""); }}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg border border-destructive/20 hover:border-destructive/50"
                        >
                          <PackageMinus size={14} />
                        </button>
                        <button
                          title="Riwayat Stok"
                          onClick={() => setHistoryModal({ productId: product.id, productName: product.name })}
                          className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg border border-border"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {/* Per unit */}
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
                        {/* Per pack */}
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
                            name: product.name,
                            categoryId: product.categoryId ? String(product.categoryId) : "",
                            price: String(product.price),
                            costPrice: String(product.costPrice),
                            stock: String(product.stock),
                            unitLabel: product.unitLabel ?? "pcs",
                            hasPack: !!product.packSize,
                            packSize: product.packSize ? String(product.packSize) : "",
                            packLabel: product.packLabel ?? "bungkus",
                            packPrice: product.packPrice ? String(product.packPrice) : "",
                            packCostPrice: product.packCostPrice ? String(product.packCostPrice) : "",
                          });
                        }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Settings size={13} /></button>
                        <button onClick={() => deleteProduct.mutate({ id: product.id }, { onSuccess: () => { invalidate(); toast({ title: "Produk dihapus" }); } })} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm space-y-4">
            {/* Mode tabs */}
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setStockModal({ ...stockModal, mode: "add" })} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${stockModal.mode === "add" ? "bg-chart-3 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                <PackagePlus size={15} /> Tambah Stok
              </button>
              <button onClick={() => setStockModal({ ...stockModal, mode: "reduce" })} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${stockModal.mode === "reduce" ? "bg-destructive text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                <PackageMinus size={15} /> Kurangi Stok
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">{stockModal.productName}</p>
              <p className="text-xs text-muted-foreground">Stok saat ini: <span className="font-bold text-foreground">{stockModal.stock} {stockModal.unitLabel}</span></p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Jumlah ({stockModal.unitLabel})</label>
              <input
                type="number"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="Masukkan jumlah..."
                min={1}
                autoFocus
                className={inputClass}
              />
            </div>

            {stockModal.mode === "reduce" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Keterangan <span className="text-destructive">*wajib</span>
                </label>
                <input
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="cth. 5 botol pecah, kadaluarsa..."
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleStockAdj}
                disabled={createStockAdj.isPending || !stockQty}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${stockModal.mode === "add" ? "bg-chart-3 text-white hover:bg-chart-3/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}
              >
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
              <div>
                <h3 className="font-bold text-foreground">Riwayat Stok</h3>
                <p className="text-xs text-muted-foreground">{historyModal.productName}</p>
              </div>
              <button onClick={() => setHistoryModal(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {!stockHistory?.length ? (
                <p className="text-center text-muted-foreground text-sm py-6">Belum ada riwayat penyesuaian stok</p>
              ) : stockHistory.map((adj) => (
                <div key={adj.id} className={`flex items-start gap-3 p-3 rounded-lg border ${adj.type === "add" ? "border-chart-3/20 bg-chart-3/5" : "border-destructive/20 bg-destructive/5"}`}>
                  <div className={`mt-0.5 ${adj.type === "add" ? "text-chart-3" : "text-destructive"}`}>
                    {adj.type === "add" ? <PackagePlus size={16} /> : <PackageMinus size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${adj.type === "add" ? "text-chart-3" : "text-destructive"}`}>
                        {adj.type === "add" ? "+" : "-"}{adj.quantity}
                      </span>
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

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowCart(false)} />
          <div className="w-80 bg-card border-l border-border flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2"><ShoppingCart size={18} className="text-chart-3" /><h3 className="font-bold">Keranjang</h3><span className="text-xs text-muted-foreground">({cartCount} item)</span></div>
              <button onClick={() => setShowCart(false)} className="p-1 text-muted-foreground hover:text-foreground rounded"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Keranjang kosong</p>
              ) : cart.map((item) => (
                <div key={`${item.productId}-${item.isPack}`} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatRp(item.price)} / {item.isPack ? (item.packLabel ?? "pack") : (item.unitLabel ?? "pcs")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateCartQty(item.productId, item.isPack, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded"><Minus size={11} /></button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.productId, item.isPack, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-muted rounded"><Plus size={11} /></button>
                  </div>
                  <div className="text-sm font-semibold w-20 text-right shrink-0">{formatRp(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-border space-y-4">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total</span><span className="text-lg font-bold text-chart-3">{formatRp(cartTotal)}</span></div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Metode Pembayaran</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPaymentMethod("cash")} className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium ${paymentMethod === "cash" ? "border-chart-3 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground"}`}><Banknote size={15} /> Cash</button>
                    <button onClick={() => setPaymentMethod("qris")} className={`flex items-center justify-center gap-2 py-2 rounded-lg border-2 text-sm font-medium ${paymentMethod === "qris" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><CreditCard size={15} /> QRIS</button>
                  </div>
                </div>
                <button onClick={handleCheckout} disabled={createBatch.isPending} className="w-full py-3 bg-chart-3 text-white rounded-lg text-sm font-bold hover:bg-chart-3/90 disabled:opacity-50">{createBatch.isPending ? "Memproses..." : `Bayar ${formatRp(cartTotal)}`}</button>
                <button onClick={() => setCart([])} className="w-full py-2 text-xs text-muted-foreground hover:text-destructive">Kosongkan keranjang</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
