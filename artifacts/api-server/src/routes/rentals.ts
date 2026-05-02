import { Router } from "express";
import { db, rentalsTable, unitsTable, transactionsTable, rentalPackagesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ListRentalsQueryParams } from "@workspace/api-zod";

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
      paymentStatus: rental.paymentStatus,
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
  const { unitId, packageId, payNow, paymentMethod } = req.body as {
    unitId: number; packageId: number; payNow?: boolean; paymentMethod?: string;
  };
  if (!unitId || !packageId) { res.status(400).json({ error: "unitId dan packageId wajib." }); return; }

  const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, unitId));
  if (!unit) { res.status(404).json({ error: "Unit tidak ditemukan." }); return; }
  if (unit.status === "occupied") { res.status(400).json({ error: "Unit sedang dipakai." }); return; }

  const [pkg] = await db.select().from(rentalPackagesTable).where(eq(rentalPackagesTable.id, packageId));
  if (!pkg) { res.status(400).json({ error: "Paket tidak ditemukan." }); return; }

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + pkg.durationMinutes * 60 * 1000);

  const isPaid = payNow === true && !!paymentMethod;

  const [rental] = await db.insert(rentalsTable).values({
    unitId, unitName: unit.name, customerName: "—",
    packageId: pkg.id, packageLabel: pkg.label,
    startTime, endTime, durationMinutes: pkg.durationMinutes,
    totalCost: pkg.price, status: "active",
    paymentStatus: isPaid ? "paid" : "unpaid",
    paymentMethod: isPaid ? paymentMethod : null,
  }).returning();

  await db.update(unitsTable).set({ status: "occupied" }).where(eq(unitsTable.id, unitId));

  if (isPaid) {
    await db.insert(transactionsTable).values({
      type: "rental",
      description: `Rental ${unit.name} (${pkg.label})`,
      amount: pkg.price,
      paymentMethod: paymentMethod as "cash" | "qris",
      rentalId: rental.id,
      userName: req.user?.name ?? null,
    });
  }

  res.status(201).json(rental);
});

router.post("/rentals/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { paymentMethod } = req.body as { paymentMethod: string };
  if (!paymentMethod) { res.status(400).json({ error: "paymentMethod wajib." }); return; }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, id));
  if (!rental) { res.status(404).json({ error: "Rental tidak ditemukan." }); return; }
  if (rental.paymentStatus === "paid") { res.status(400).json({ error: "Sudah dibayar." }); return; }

  const [updated] = await db.update(rentalsTable)
    .set({ paymentStatus: "paid", paymentMethod })
    .where(eq(rentalsTable.id, id)).returning();

  await db.insert(transactionsTable).values({
    type: "rental",
    description: `Rental ${rental.unitName} (${rental.packageLabel ?? ""})`,
    amount: rental.totalCost ?? 0,
    paymentMethod: paymentMethod as "cash" | "qris",
    rentalId: rental.id,
    userName: req.user?.name ?? null,
  });

  res.json(updated);
});

router.post("/rentals/:id/extend", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { packageId, payNow, paymentMethod } = req.body as { packageId: number; payNow?: boolean; paymentMethod?: string };
  if (!packageId) { res.status(400).json({ error: "packageId wajib." }); return; }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, id));
  if (!rental) { res.status(404).json({ error: "Rental tidak ditemukan." }); return; }
  if (rental.status !== "active") { res.status(400).json({ error: "Rental tidak aktif." }); return; }

  const [pkg] = await db.select().from(rentalPackagesTable).where(eq(rentalPackagesTable.id, packageId));
  if (!pkg) { res.status(400).json({ error: "Paket tidak ditemukan." }); return; }

  const now = new Date();
  const currentEnd = rental.endTime ? new Date(rental.endTime) : now;
  const baseTime = currentEnd < now ? now : currentEnd;
  const newEndTime = new Date(baseTime.getTime() + pkg.durationMinutes * 60 * 1000);
  const newDuration = (rental.durationMinutes ?? 0) + pkg.durationMinutes;
  const newCost = (rental.totalCost ?? 0) + pkg.price;
  const newLabel = rental.packageLabel ? `${rental.packageLabel} + ${pkg.label}` : pkg.label;

  const [updated] = await db.update(rentalsTable)
    .set({ endTime: newEndTime, durationMinutes: newDuration, totalCost: newCost, packageLabel: newLabel })
    .where(eq(rentalsTable.id, id)).returning();

  if (payNow && paymentMethod) {
    await db.insert(transactionsTable).values({
      type: "rental",
      description: `Tambah Waktu ${rental.unitName} (+${pkg.label})`,
      amount: pkg.price,
      paymentMethod: paymentMethod as "cash" | "qris",
      rentalId: rental.id,
      userName: req.user?.name ?? null,
    });
  }

  res.json(updated);
});

router.post("/rentals/:id/stop", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { paymentMethod } = req.body as { paymentMethod: string };
  if (!paymentMethod) { res.status(400).json({ error: "paymentMethod wajib." }); return; }

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, id));
  if (!rental) { res.status(404).json({ error: "Rental tidak ditemukan." }); return; }
  if (rental.status !== "active") { res.status(400).json({ error: "Rental tidak aktif." }); return; }

  const now = new Date();
  const totalCost = rental.totalCost ?? 0;
  const durationMinutes = rental.durationMinutes ?? 0;

  const wasUnpaid = rental.paymentStatus === "unpaid";

  const [updated] = await db.update(rentalsTable)
    .set({
      endTime: now, durationMinutes, totalCost, status: "completed",
      paymentStatus: "paid", paymentMethod,
    })
    .where(eq(rentalsTable.id, id)).returning();

  await db.update(unitsTable).set({ status: "available" }).where(eq(unitsTable.id, rental.unitId));

  if (wasUnpaid) {
    await db.insert(transactionsTable).values({
      type: "rental",
      description: `Rental ${rental.unitName} (${rental.packageLabel ?? durationMinutes + " menit"})`,
      amount: totalCost,
      paymentMethod: paymentMethod as "cash" | "qris",
      rentalId: rental.id,
      userName: req.user?.name ?? null,
    });
  }

  res.json(updated);
});

export default router;
