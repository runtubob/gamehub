import { Router } from "express";
import { db, rentalPackagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRentalPackageBody, UpdateRentalPackageBody } from "@workspace/api-zod";

const router = Router();

router.get("/rental-packages", async (req, res) => {
  const packages = await db.select().from(rentalPackagesTable).orderBy(rentalPackagesTable.sortOrder);
  res.json(packages);
});

router.post("/rental-packages", async (req, res) => {
  const parsed = CreateRentalPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [pkg] = await db.insert(rentalPackagesTable).values(parsed.data).returning();
  res.status(201).json(pkg);
});

router.put("/rental-packages/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateRentalPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [pkg] = await db.update(rentalPackagesTable).set(parsed.data).where(eq(rentalPackagesTable.id, id)).returning();
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
  res.json(pkg);
});

router.delete("/rental-packages/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(rentalPackagesTable).where(eq(rentalPackagesTable.id, id));
  res.json({ success: true, message: "Package deleted" });
});

export default router;
