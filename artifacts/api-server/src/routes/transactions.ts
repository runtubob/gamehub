import { Router } from "express";
import { db, transactionsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { CreateTransactionBody, CreateTransactionBatchBody, ListTransactionsQueryParams, ListRecentTransactionsQueryParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/transactions/recent", requireAuth, async (req, res) => {
  const parsed = ListRecentTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;
  const transactions = await db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).limit(limit);
  res.json(transactions);
});

router.get("/transactions", requireAuth, async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let query = db.select().from(transactionsTable).$dynamic();
  const conditions = [];
  if (parsed.data.type) conditions.push(eq(transactionsTable.type, parsed.data.type));
  if (parsed.data.date) {
    const date = new Date(parsed.data.date);
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(transactionsTable.createdAt, startOfDay));
    conditions.push(lte(transactionsTable.createdAt, endOfDay));
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  const transactions = await query.orderBy(desc(transactionsTable.createdAt));
  res.json(transactions);
});

// Superadmin only: delete transaction
router.delete("/transactions/:id", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
  res.json({ success: true });
});

router.post("/transactions/batch", requireAuth, async (req, res) => {
  const parsed = CreateTransactionBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { paymentMethod, items } = parsed.data;
  const results = [];

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) continue;
    const qty = item.quantity ?? 1;
    const isPack = (item as { isPack?: boolean }).isPack === true;

    if (isPack) {
      if (!product.packPrice || !product.packSize) {
        res.status(400).json({ error: `Produk ${product.name} tidak memiliki harga pack` }); return;
      }
      const stockDeducted = product.packSize * qty;
      if (product.stock < stockDeducted) {
        res.status(400).json({ error: `Stok ${product.name} tidak cukup (butuh ${stockDeducted} ${product.unitLabel})` }); return;
      }
      const amount = product.packPrice * qty;
      // FIX: pack profit = packPrice - packCostPrice (not per-unit costPrice)
      const costAmount = (product.packCostPrice ?? 0) * qty;
      const [tx] = await db.insert(transactionsTable).values({
        type: "product",
        description: `${product.name} x${qty} ${product.packLabel ?? "pack"}`,
        amount, costAmount, paymentMethod, productId: product.id, quantity: qty,
      }).returning();
      await db.update(productsTable).set({ stock: product.stock - stockDeducted }).where(eq(productsTable.id, product.id));
      results.push(tx);
    } else {
      if (product.stock < qty) {
        res.status(400).json({ error: `Stok ${product.name} tidak cukup` }); return;
      }
      const amount = product.price * qty;
      const costAmount = product.costPrice * qty;
      const [tx] = await db.insert(transactionsTable).values({
        type: "product",
        description: `${product.name} x${qty} ${product.unitLabel ?? "pcs"}`,
        amount, costAmount, paymentMethod, productId: product.id, quantity: qty,
      }).returning();
      await db.update(productsTable).set({ stock: product.stock - qty }).where(eq(productsTable.id, product.id));
      results.push(tx);
    }
  }
  res.status(201).json(results);
});

router.post("/transactions", requireAuth, async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const quantity = parsed.data.quantity ?? 1;
  const isPack = (parsed.data as { isPack?: boolean }).isPack === true;
  let amount: number, costAmount: number, description: string, stockDeducted: number;

  if (isPack && product.packPrice && product.packSize) {
    stockDeducted = product.packSize * quantity;
    amount = product.packPrice * quantity;
    costAmount = (product.packCostPrice ?? 0) * quantity;
    description = `${product.name} x${quantity} ${product.packLabel ?? "pack"}`;
  } else {
    stockDeducted = quantity;
    amount = product.price * quantity;
    costAmount = product.costPrice * quantity;
    description = `${product.name} x${quantity} ${product.unitLabel ?? "pcs"}`;
  }

  if (product.stock < stockDeducted) { res.status(400).json({ error: "Stok tidak cukup" }); return; }
  const [transaction] = await db.insert(transactionsTable).values({
    type: "product", description, amount, costAmount,
    paymentMethod: parsed.data.paymentMethod ?? "cash", productId: product.id, quantity,
  }).returning();
  await db.update(productsTable).set({ stock: product.stock - stockDeducted }).where(eq(productsTable.id, product.id));
  res.status(201).json(transaction);
});

export default router;
