import { Router } from "express";
import { db, rentalsTable, unitsTable, transactionsTable, rentalPackagesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, like } from "drizzle-orm";
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
      remainingSeconds,
      totalCost: rental.totalCost ?? 0,
      pendingAmount: rental.pendingAmount ?? 0,
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
    totalCost: pkg.price, pendingAmount: 0, status: "active",
    paymentStatus: isPaid ? "paid" : "unpaid",
    paymentMethod: isPaid ? paymentMethod : null,
  }).returning();

  await db.update(unitsTable).set({ status: "occupied" }).where(eq(unitsTable.id, unitId));

  // Transaction is created at /stop with correct costAmount and createdAt=startTime
  // so we don't insert here even if paid upfront

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

  // Just mark as paid — transaction will be created at /stop with correct costAmount & createdAt=startTime
  const [updated] = await db.update(rentalsTable)
    .set({ paymentStatus: "paid", paymentMethod })
    .where(eq(rentalsTable.id, id)).returning();

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
  const newTotalCost = (rental.totalCost ?? 0) + pkg.price;
  const newLabel = rental.packageLabel ? `${rental.packageLabel} + ${pkg.label}` : pkg.label;
  const isPaying = payNow === true && !!paymentMethod;

  const newPendingAmount = isPaying
    ? (rental.pendingAmount ?? 0)
    : (rental.pendingAmount ?? 0) + pkg.price;

  const [updated] = await db.update(rentalsTable)
    .set({ endTime: newEndTime, durationMinutes: newDuration, totalCost: newTotalCost, pendingAmount: newPendingAmount, packageLabel: newLabel })
    .where(eq(rentalsTable.id, id)).returning();

  if (isPaying) {
    await db.insert(transactionsTable).values({
      type: "rental",
      description: `Tambah Waktu ${rental.unitName} (+${pkg.label})`,
      amount: pkg.price,
      costAmount: pkg.costPrice ?? 0,
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
  const { paymentMethod } = req.body as { paymentMethod?: string };

  const [rental] = await db.select().from(rentalsTable).where(eq(rentalsTable.id, id));
  if (!rental) { res.status(404).json({ error: "Rental tidak ditemukan." }); return; }
  if (rental.status !== "active") { res.status(400).json({ error: "Rental tidak aktif." }); return; }

  const wasUnpaid = rental.paymentStatus === "unpaid";
  const pendingAmount = rental.pendingAmount ?? 0;
  const hasPendingExtension = pendingAmount > 0;

  if ((wasUnpaid || hasPendingExtension) && !paymentMethod) {
    res.status(400).json({ error: "paymentMethod wajib.", pendingAmount, wasUnpaid });
    return;
  }

  const now = new Date();
  const totalCost = rental.totalCost ?? 0;
  const durationMinutes = rental.durationMinutes ?? 60;
  const finalPaymentMethod = paymentMethod ?? rental.paymentMethod ?? "cash";

  // Calculate actual time played (capped at package duration)
  const actualMs = now.getTime() - new Date(rental.startTime).getTime();
  const cappedMinutes = Math.min(actualMs / 60000, durationMinutes);

  // Look up package for costPrice
  const [pkg] = rental.packageId
    ? await db.select().from(rentalPackagesTable).where(eq(rentalPackagesTable.id, rental.packageId))
    : [null];
  const costPrice = pkg?.costPrice ?? 0;
  const costAmount = durationMinutes > 0
    ? Math.round(costPrice * cappedMinutes / durationMinutes)
    : 0;

  const [updated] = await db.update(rentalsTable)
    .set({ endTime: now, durationMinutes, totalCost, pendingAmount: 0, status: "completed", paymentStatus: "paid", paymentMethod: finalPaymentMethod })
    .where(eq(rentalsTable.id, id)).returning();

  await db.update(unitsTable).set({ status: "available" }).where(eq(unitsTable.id, rental.unitId));

  const basePaidAmount = totalCost - pendingAmount;

  // Always create ONE transaction for the base rental with proper profit data.
  // createdAt is set to rental.startTime so reports show income in the correct period
  // (e.g. rental started 23:00, paid at 01:00 next day → counts as 23:00 revenue).
  if (basePaidAmount > 0 || wasUnpaid) {
    const baseAmount = basePaidAmount > 0 ? basePaidAmount : totalCost;
    if (baseAmount > 0) {
      await db.insert(transactionsTable).values({
        type: "rental",
        description: `Rental ${rental.unitName} (${rental.packageLabel ?? durationMinutes + " menit"})`,
        amount: baseAmount,
        costAmount,
        paymentMethod: finalPaymentMethod as "cash" | "qris",
        rentalId: rental.id,
        userName: req.user?.name ?? null,
        createdAt: rental.startTime,
      });
    }
  }

  // Create separate transaction for unpaid extension
  if (hasPendingExtension) {
    await db.insert(transactionsTable).values({
      type: "rental",
      description: `Tambah Waktu ${rental.unitName} (tagihan tertunda)`,
      amount: pendingAmount,
      costAmount: 0,
      paymentMethod: finalPaymentMethod as "cash" | "qris",
      rentalId: rental.id,
      userName: req.user?.name ?? null,
      createdAt: rental.startTime,
    });
  }

  res.json(updated);
});

router.post("/rentals/reset-stats", async (req, res) => {
  await db.delete(rentalsTable).where(eq(rentalsTable.status, "completed"));
  res.json({ success: true, message: "Statistik rental berhasil direset." });
});

export default router;
