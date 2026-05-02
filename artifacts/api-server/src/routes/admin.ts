import { Router } from "express";
import { db, transactionsTable, expensesTable, rentalsTable, unitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.post("/admin/reset-balance", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  await db.delete(transactionsTable);
  await db.delete(expensesTable);
  await db.update(rentalsTable).set({ status: "completed" }).where(eq(rentalsTable.status, "active"));
  await db.update(unitsTable).set({ status: "available" }).where(eq(unitsTable.status, "occupied"));
  res.json({ success: true, message: "Semua data transaksi dan pengeluaran berhasil direset." });
});

export default router;
