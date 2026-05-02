import { Router } from "express";
import { db, stockAdjustmentsTable, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateStockAdjustmentBody } from "@workspace/api-zod";

const router = Router();

router.get("/stock-adjustments", async (req, res) => {
  const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

  let query = db.select().from(stockAdjustmentsTable).$dynamic();
  if (productId && !isNaN(productId)) {
    query = query.where(eq(stockAdjustmentsTable.productId, productId));
  }
  const adjustments = await query.orderBy(desc(stockAdjustmentsTable.createdAt)).limit(limit);
  res.json(adjustments);
});

router.post("/stock-adjustments", async (req, res) => {
  const parsed = CreateStockAdjustmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { productId, type, quantity, reason } = parsed.data;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  if (type === "reduce") {
    if (!reason || !reason.trim()) {
      res.status(400).json({ error: "Keterangan wajib diisi untuk pengurangan stok" });
      return;
    }
    if (product.stock < quantity) {
      res.status(400).json({ error: `Stok tidak cukup. Stok saat ini: ${product.stock}` });
      return;
    }
  }

  const newStock = type === "add" ? product.stock + quantity : product.stock - quantity;
  await db.update(productsTable).set({ stock: newStock }).where(eq(productsTable.id, productId));

  const [adjustment] = await db.insert(stockAdjustmentsTable).values({
    productId,
    productName: product.name,
    type,
    quantity,
    reason: reason ?? null,
  }).returning();

  res.status(201).json(adjustment);
});

export default router;
