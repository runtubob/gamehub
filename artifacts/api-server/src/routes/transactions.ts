import { Router } from "express";
import { db, transactionsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  CreateTransactionBody,
  ListTransactionsQueryParams,
  ListRecentTransactionsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/transactions/recent", async (req, res) => {
  const parsed = ListRecentTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const transactions = await db
    .select()
    .from(transactionsTable)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  res.json(transactions);
});

router.get("/transactions", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(transactionsTable).$dynamic();

  const conditions = [];
  if (parsed.data.type) {
    conditions.push(eq(transactionsTable.type, parsed.data.type));
  }
  if (parsed.data.date) {
    const date = new Date(parsed.data.date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(transactionsTable.createdAt, startOfDay));
    conditions.push(lte(transactionsTable.createdAt, endOfDay));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const transactions = await query.orderBy(desc(transactionsTable.createdAt));
  res.json(transactions);
});

router.post("/transactions", async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const quantity = parsed.data.quantity ?? 1;
  if (product.stock < quantity) {
    res.status(400).json({ error: "Stok tidak cukup" });
    return;
  }

  const amount = product.price * quantity;

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      type: "product",
      description: `${product.name} x${quantity}`,
      amount,
      productId: product.id,
      quantity,
    })
    .returning();

  await db
    .update(productsTable)
    .set({ stock: product.stock - quantity })
    .where(eq(productsTable.id, product.id));

  res.status(201).json(transaction);
});

export default router;
