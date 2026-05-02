import { Router } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { CreateExpenseBody } from "@workspace/api-zod";

const router = Router();

router.get("/expenses", async (req, res) => {
  const date = req.query.date as string | undefined;
  let query = db.select().from(expensesTable).$dynamic();
  if (date) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    query = query.where(and(gte(expensesTable.createdAt, start), lte(expensesTable.createdAt, end)));
  }
  const expenses = await query.orderBy(desc(expensesTable.createdAt));
  res.json(expenses);
});

router.post("/expenses", async (req, res) => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db.insert(expensesTable).values(parsed.data).returning();
  res.status(201).json(expense);
});

router.delete("/expenses/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.json({ success: true, message: "Expense deleted" });
});

export default router;
