import { Router } from "express";
import { db, productCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateProductCategoryBody } from "@workspace/api-zod";

const router = Router();

router.get("/product-categories", async (req, res) => {
  const categories = await db.select().from(productCategoriesTable).orderBy(productCategoriesTable.id);
  res.json(categories);
});

router.post("/product-categories", async (req, res) => {
  const parsed = CreateProductCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [cat] = await db.insert(productCategoriesTable).values(parsed.data).returning();
  res.status(201).json(cat);
});

router.delete("/product-categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productCategoriesTable).where(eq(productCategoriesTable.id, id));
  res.json({ success: true, message: "Category deleted" });
});

export default router;
