import { Router } from "express";
import { db, rentalsTable, unitsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
  StartRentalBody,
  StopRentalParams,
  ListRentalsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/rentals/active", async (req, res) => {
  const activeRentals = await db
    .select()
    .from(rentalsTable)
    .where(eq(rentalsTable.status, "active"));

  const unitIds = [...new Set(activeRentals.map((r) => r.unitId))];
  const units = unitIds.length > 0
    ? await db.select().from(unitsTable).where(inArray(unitsTable.id, unitIds))
    : [];
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const now = new Date();
  const result = activeRentals.map((rental) => {
    const unit = unitMap.get(rental.unitId);
    const hourlyRate = unit?.hourlyRate ?? 6000;
    const elapsedMs = now.getTime() - new Date(rental.startTime).getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return {
      id: rental.id,
      unitId: rental.unitId,
      unitName: rental.unitName,
      customerName: rental.customerName,
      startTime: rental.startTime,
      elapsedMinutes,
      estimatedCost: Math.ceil((elapsedMinutes / 60) * hourlyRate),
      hourlyRate,
    };
  });

  res.json(result);
});

router.get("/rentals", async (req, res) => {
  const parsed = ListRentalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(rentalsTable).$dynamic();

  const conditions = [];
  if (parsed.data.status) {
    conditions.push(eq(rentalsTable.status, parsed.data.status));
  }
  if (parsed.data.date) {
    const date = new Date(parsed.data.date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(rentalsTable.createdAt, startOfDay));
    conditions.push(lte(rentalsTable.createdAt, endOfDay));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rentals = await query.orderBy(sql`${rentalsTable.createdAt} desc`);
  res.json(rentals);
});

router.post("/rentals", async (req, res) => {
  const parsed = StartRentalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, parsed.data.unitId));
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  if (unit.status === "occupied") {
    res.status(400).json({ error: "Unit is already occupied" });
    return;
  }

  const [rental] = await db
    .insert(rentalsTable)
    .values({
      unitId: parsed.data.unitId,
      unitName: unit.name,
      customerName: parsed.data.customerName,
      status: "active",
    })
    .returning();

  await db
    .update(unitsTable)
    .set({ status: "occupied" })
    .where(eq(unitsTable.id, parsed.data.unitId));

  res.status(201).json(rental);
});

router.post("/rentals/:id/stop", async (req, res) => {
  const parsed = StopRentalParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, parsed.data.id));
  if (!rental) {
    res.status(404).json({ error: "Rental not found" });
    return;
  }
  if (rental.status !== "active") {
    res.status(400).json({ error: "Rental is not active" });
    return;
  }

  const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, rental.unitId));
  const hourlyRate = unit?.hourlyRate ?? 6000;

  const now = new Date();
  const elapsedMs = now.getTime() - new Date(rental.startTime).getTime();
  const durationMinutes = Math.max(1, Math.ceil(elapsedMs / 60000));
  const totalCost = Math.ceil((durationMinutes / 60) * hourlyRate);

  const [updated] = await db
    .update(rentalsTable)
    .set({
      endTime: now,
      durationMinutes,
      totalCost,
      status: "completed",
    })
    .where(eq(rentalsTable.id, parsed.data.id))
    .returning();

  await db
    .update(unitsTable)
    .set({ status: "available" })
    .where(eq(unitsTable.id, rental.unitId));

  await db.insert(transactionsTable).values({
    type: "rental",
    description: `Rental ${rental.unitName} - ${rental.customerName} (${durationMinutes} menit)`,
    amount: totalCost,
    rentalId: rental.id,
  });

  res.json(updated);
});

export default router;
