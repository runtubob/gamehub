import { Router } from "express";
import { db, rentalsTable, unitsTable, transactionsTable, rentalPackagesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { StartRentalBody, StopRentalBody, ListRentalsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/rentals/active", async (req, res) => {
  const activeRentals = await db.select().from(rentalsTable).where(eq(rentalsTable.status, "active"));
  const now = new Date();
  const result = activeRentals.map((rental) => {
    const endTimeMs = rental.endTime ? new Date(rental.endTime).getTime() : now.getTime();
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now.getTime()) / 1000));
    return {
      id: rental.id, unitId: rental.unitId, unitName: rental.unitName,
      customerName: rental.customerName,
      packageLabel: rental.packageLabel ?? "",
      startTime: rental.startTime, endTime: rental.endTime ?? rental.startTime,
      remainingSeconds, totalCost: rental.totalCost ?? 0,
    };
  });
  res.json(result);
});

router.get("/rentals", async (req, res) => {
  const parsed = ListRentalsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let query = db.select().from(rentalsTable).$dynamic();
  const conditions = [];
  if (parsed.data.status) conditions.push(eq(rentalsTable.status, parsed.data.status));
  if (parsed.data.date) {
    const date = new Date(parsed.data.date);
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(rentalsTable.createdAt, startOfDay));
    conditions.push(lte(rentalsTable.createdAt, endOfDay));
  }
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rentals = await query.orderBy(sql`${rentalsTable.createdAt} desc`);
  res.json(rentals);
});

router.post("/rentals", async (req, res) => {
  const parsed = StartRentalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, parsed.data.unitId));
  if (!unit) { res.status(404).json({ error: "Unit tidak ditemukan." }); return; }
  if (unit.status === "occupied") { res.status(400).json({ error: "Unit sedang dipakai." }); return; }

  const [pkg] = await db.select().from(rentalPackagesTable).where(eq(rentalPackagesTable.id, parsed.data.packageId));
  if (!pkg) { res.status(400).json({ error: "Paket tidak ditemukan." }); return; }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + pkg.durationMinutes * 60 * 1000);

  const [rental] = await db.insert(rentalsTable).values({
    unitId: parsed.data.unitId,
    unitName: unit.name,
    customerName: "—",
    packageId: pkg.id,
    packageLabel: pkg.label,
    startTime, endTime,
    durationMinutes: pkg.durationMinutes,
    totalCost: pkg.price,
    status: "active",
  }).returning();

  await db.update(unitsTable).set({ status: "occupied" }).where(eq(unitsTable.id, parsed.data.unitId));
  res.status(201).json(rental);
});

router.post("/rentals/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const bodyParsed = StopRentalBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, id));
  if (!rental) { res.status(404).json({ error: "Rental tidak ditemukan." }); return; }
  if (rental.status !== "active") { res.status(400).json({ error: "Rental tidak aktif." }); return; }

  const now = new Date();
  const totalCost = rental.totalCost ?? 0;
  const durationMinutes = rental.durationMinutes ?? 0;

  const [updated] = await db.update(rentalsTable)
    .set({ endTime: now, durationMinutes, totalCost, status: "completed" })
    .where(eq(rentalsTable.id, id)).returning();

  await db.update(unitsTable).set({ status: "available" }).where(eq(unitsTable.id, rental.unitId));

  await db.insert(transactionsTable).values({
    type: "rental",
    description: `Rental ${rental.unitName} (${rental.packageLabel ?? durationMinutes + " menit"})`,
    amount: totalCost,
    paymentMethod: bodyParsed.data.paymentMethod,
    rentalId: rental.id,
  });

  res.json(updated);
});

export default router;
