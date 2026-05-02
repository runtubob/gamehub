import { Router } from "express";
import { db, transactionsTable, expensesTable } from "@workspace/db";
import { and, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

function getDateRange(period: string): { start: Date; end: Date; groupBy: "hour" | "day" | "month" } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (period) {
    case "daily":
      return { start: todayStart, end: now, groupBy: "hour" };
    case "weekly": {
      const s = new Date(todayStart); s.setDate(s.getDate() - 6);
      return { start: s, end: now, groupBy: "day" };
    }
    case "monthly": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end: now, groupBy: "day" };
    }
    case "3month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start: s, end: now, groupBy: "month" };
    }
    case "6month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { start: s, end: now, groupBy: "month" };
    }
    case "yearly": {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s, end: now, groupBy: "month" };
    }
    default:
      return { start: todayStart, end: now, groupBy: "hour" };
  }
}

function getPeriodKey(date: Date, groupBy: "hour" | "day" | "month"): string {
  if (groupBy === "hour") return `${date.getHours().toString().padStart(2, "0")}:00`;
  if (groupBy === "day") {
    return date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function buildPeriodLabels(start: Date, end: Date, groupBy: "hour" | "day" | "month"): string[] {
  const labels: string[] = [];
  const cur = new Date(start);
  if (groupBy === "hour") {
    for (let h = 0; h <= 23; h++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h);
      if (d <= end) labels.push(getPeriodKey(d, "hour"));
    }
  } else if (groupBy === "day") {
    while (cur <= end) {
      labels.push(getPeriodKey(cur, "day"));
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    cur.setDate(1);
    while (cur <= end) {
      labels.push(getPeriodKey(cur, "month"));
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return labels;
}

router.get("/reports/financial", requireAuth, requireRole("admin", "owner"), async (req, res) => {
  const period = (req.query.period as string) || "monthly";
  const { start, end, groupBy } = getDateRange(period);

  const [transactions, expenses] = await Promise.all([
    db.select().from(transactionsTable).where(and(gte(transactionsTable.createdAt, start), lte(transactionsTable.createdAt, end))),
    db.select().from(expensesTable).where(and(gte(expensesTable.createdAt, start), lte(expensesTable.createdAt, end))),
  ]);

  // Build period map
  const labels = buildPeriodLabels(start, end, groupBy);
  const periodMap = new Map<string, { income: number; rentalIncome: number; productIncome: number; cashIncome: number; qrisIncome: number; expenses: number; cashExpenses: number; qrisExpenses: number; profit: number }>();
  labels.forEach((l) => periodMap.set(l, { income: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 }));

  for (const tx of transactions) {
    const key = getPeriodKey(new Date(tx.createdAt), groupBy);
    const entry = periodMap.get(key) ?? { income: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 };
    entry.income += tx.amount;
    if (tx.type === "rental") entry.rentalIncome += tx.amount;
    else entry.productIncome += tx.amount;
    if (tx.paymentMethod === "cash") entry.cashIncome += tx.amount;
    else entry.qrisIncome += tx.amount;
    periodMap.set(key, entry);
  }

  for (const exp of expenses) {
    const key = getPeriodKey(new Date(exp.createdAt), groupBy);
    const entry = periodMap.get(key) ?? { income: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 };
    entry.expenses += exp.amount;
    if (exp.paymentMethod === "cash") entry.cashExpenses += exp.amount;
    else entry.qrisExpenses += exp.amount;
    periodMap.set(key, entry);
  }

  // Finalize profit per period
  const periods = labels.map((label) => {
    const e = periodMap.get(label)!;
    return { label, ...e, profit: e.income - e.expenses };
  });

  // Summary totals
  const totalIncome = transactions.reduce((s, t) => s + t.amount, 0);
  const rentalIncome = transactions.filter((t) => t.type === "rental").reduce((s, t) => s + t.amount, 0);
  const productIncome = transactions.filter((t) => t.type === "product").reduce((s, t) => s + t.amount, 0);
  const cashIncome = transactions.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + t.amount, 0);
  const qrisIncome = transactions.filter((t) => t.paymentMethod === "qris").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const cashExpenses = expenses.filter((e) => e.paymentMethod === "cash").reduce((s, e) => s + e.amount, 0);
  const qrisExpenses = expenses.filter((e) => e.paymentMethod === "qris").reduce((s, e) => s + e.amount, 0);

  res.json({
    summary: {
      totalIncome, rentalIncome, productIncome, cashIncome, qrisIncome,
      totalExpenses, cashExpenses, qrisExpenses,
      netProfit: totalIncome - totalExpenses,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    },
    periods,
    transactions: transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    expenses: expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
});

export default router;
