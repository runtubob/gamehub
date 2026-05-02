import { Router } from "express";
import { db, productsTable, productCategoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody, UpdateProductParams, DeleteProductParams, GetProductParams } from "@workspace/api-zod";

const router = Router();

function buildProductSelect() {
  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      categoryId: productsTable.categoryId,
      categoryName: productCategoriesTable.name,
      price: productsTable.price,
      costPrice: productsTable.costPrice,
      stock: productsTable.stock,
      unitLabel: productsTable.unitLabel,
      packSize: productsTable.packSize,
      packLabel: productsTable.packLabel,
      packPrice: productsTable.packPrice,
      packCostPrice: productsTable.packCostPrice,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(productCategoriesTable, eq(productsTable.categoryId, productCategoriesTable.id));
}

router.get("/products", async (req, res) => {
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
  let query = buildProductSelect().$dynamic();
  if (categoryId && !isNaN(categoryId)) {
    query = query.where(eq(productsTable.categoryId, categoryId));
  }
  const products = await query.orderBy(asc(productsTable.name));
  res.json(products);
});

router.post("/products", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(productsTable).values({
    ...parsed.data,
    unitLabel: parsed.data.unitLabel ?? "pcs",
  });
  const [product] = await buildProductSelect().where(eq(productsTable.name, parsed.data.name)).orderBy(productsTable.id);
  res.status(201).json(product);
});

router.get("/products/:id", async (req, res) => {
  const parsed = GetProductParams.safeParse({ id: req.params.id });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [product] = await buildProductSelect().where(eq(productsTable.id, parsed.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.put("/products/:id", async (req, res) => {
  const paramsParsed = UpdateProductParams.safeParse({ id: req.params.id });
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateProductBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  await db.update(productsTable).set(bodyParsed.data).where(eq(productsTable.id, paramsParsed.data.id));
  const [product] = await buildProductSelect().where(eq(productsTable.id, paramsParsed.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.delete("/products/:id", async (req, res) => {
  const parsed = DeleteProductParams.safeParse({ id: req.params.id });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, parsed.data.id));
  res.json({ success: true, message: "Product deleted" });
});

export default router;
