import { Router } from "express";
import { db, shiftsTable, transactionsTable, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sum } from "drizzle-orm";
import { StartShiftBody, EndShiftBody } from "@workspace/api-zod";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/shifts", async (req, res) => {
  const date = req.query.date as string | undefined;
  let query = db.select().from(shiftsTable).$dynamic();
  if (date) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    query = query.where(and(gte(shiftsTable.startTime, start), lte(shiftsTable.startTime, end)));
  }
  const shifts = await query.orderBy(desc(shiftsTable.startTime));
  res.json(shifts);
});

router.get("/shifts/active", async (req, res) => {
  const userId = req.user!.id;
  const [shift] = await db
    .select()
    .from(shiftsTable)
    .where(and(eq(shiftsTable.userId, userId), eq(shiftsTable.status, "open")))
    .orderBy(desc(shiftsTable.startTime))
    .limit(1);
  res.json(shift ?? null);
});

router.get("/shifts/:id/transactions", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!shift) { res.status(404).json({ error: "Shift tidak ditemukan" }); return; }
  const endTime = shift.endTime ?? new Date();
  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(and(
      gte(transactionsTable.createdAt, shift.startTime),
      lte(transactionsTable.createdAt, endTime),
    ))
    .orderBy(desc(transactionsTable.createdAt));
  res.json(transactions);
});

router.post("/shifts/start", async (req, res) => {
  const parsed = StartShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db
    .select()
    .from(shiftsTable)
    .where(and(eq(shiftsTable.userId, req.user!.id), eq(shiftsTable.status, "open")))
    .limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Kamu sudah memiliki shift yang sedang berjalan." });
    return;
  }
  const [shift] = await db.insert(shiftsTable).values({
    userId: req.user!.id,
    userName: req.user!.name,
    role: req.user!.role,
    openingCash: parsed.data.openingCash,
    notes: parsed.data.notes ?? null,
    status: "open",
  }).returning();
  res.status(201).json(shift);
});

router.put("/shifts/:id/end", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = EndShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Shift tidak ditemukan" }); return; }
  if (existing.status === "closed") { res.status(400).json({ error: "Shift sudah ditutup" }); return; }

  const endTime = new Date();
  const [shift] = await db
    .update(shiftsTable)
    .set({ endTime, closingCash: parsed.data.closingCash, notes: parsed.data.notes ?? existing.notes, status: "closed" })
    .where(eq(shiftsTable.id, id))
    .returning();

  const [cashRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.paymentMethod, "cash"),
      gte(transactionsTable.createdAt, existing.startTime),
      lte(transactionsTable.createdAt, endTime),
    ));
  const [qrisRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.paymentMethod, "qris"),
      gte(transactionsTable.createdAt, existing.startTime),
      lte(transactionsTable.createdAt, endTime),
    ));
  const [cashExpRow] = await db
    .select({ total: sum(expensesTable.amount) })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.paymentMethod, "cash"),
      gte(expensesTable.createdAt, existing.startTime),
      lte(expensesTable.createdAt, endTime),
    ));

  const cashTransactions = Number(cashRow?.total ?? 0);
  const qrisTransactions = Number(qrisRow?.total ?? 0);
  const cashExpenses = Number(cashExpRow?.total ?? 0);
  const totalIncome = cashTransactions + qrisTransactions;
  const expectedCash = existing.openingCash + cashTransactions - cashExpenses;
  const variance = parsed.data.closingCash - expectedCash;

  res.json({ shift, cashTransactions, qrisTransactions, cashExpenses, totalIncome, expectedCash, variance });
});

// Superadmin only: delete a shift record
router.delete("/shifts/:id", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Shift tidak ditemukan" }); return; }
  if (existing.status === "open") {
    res.status(400).json({ error: "Tidak bisa menghapus shift yang masih aktif." }); return;
  }
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.json({ success: true });
});

export default router;
