import { Router } from "express";
import { db, transactionsTable, expensesTable, shiftsTable } from "@workspace/db";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

function getDateRange(
  period: string,
  opts?: { customDate?: string; startDate?: string; endDate?: string }
): { start: Date; end: Date; groupBy: "hour" | "day" | "month" } {
  const now = new Date();
  const { customDate, startDate, endDate } = opts ?? {};

  // Custom date range (for period navigation — prev/next buttons)
  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T23:59:59.999");
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const groupBy: "hour" | "day" | "month" = diffDays <= 1 ? "hour" : diffDays <= 62 ? "day" : "month";
    return { start, end, groupBy };
  }

  // Legacy: single custom date for daily period
  if (customDate) {
    const d = new Date(customDate);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { start, end, groupBy: "hour" };
  }

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

router.get("/reports/financial", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const period = (req.query.period as string) || "monthly";
  const customDate = req.query.customDate as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const { start, end, groupBy } = getDateRange(period, { customDate, startDate, endDate });

  const [transactions, expenses] = await Promise.all([
    db.select().from(transactionsTable).where(and(gte(transactionsTable.createdAt, start), lte(transactionsTable.createdAt, end))),
    db.select().from(expensesTable).where(and(gte(expensesTable.createdAt, start), lte(expensesTable.createdAt, end))),
  ]);

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

  const periods = labels.map((label) => {
    const e = periodMap.get(label)!;
    return { label, ...e, profit: e.income - e.expenses };
  });

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

// Laporan per-karyawan
router.get("/reports/employees", requireAuth, requireRole("admin", "superadmin"), async (req, res) => {
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const now = new Date();
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate + "T23:59:59.999") : now;

  const [txRows, shiftRows] = await Promise.all([
    db.select({
      userName: transactionsTable.userName,
      totalTransactions: sql<number>`cast(count(*) as int)`,
      totalRevenue: sql<number>`cast(coalesce(sum(${transactionsTable.amount}), 0) as int)`,
      rentalRevenue: sql<number>`cast(coalesce(sum(case when ${transactionsTable.type} = 'rental' then ${transactionsTable.amount} else 0 end), 0) as int)`,
      productRevenue: sql<number>`cast(coalesce(sum(case when ${transactionsTable.type} = 'product' then ${transactionsTable.amount} else 0 end), 0) as int)`,
    })
      .from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, start), lte(transactionsTable.createdAt, end)))
      .groupBy(transactionsTable.userName),

    db.select({
      userName: shiftsTable.userName,
      totalShifts: sql<number>`cast(count(*) as int)`,
      totalMinutes: sql<number>`cast(coalesce(sum(extract(epoch from (coalesce(${shiftsTable.endTime}, now()) - ${shiftsTable.startTime})) / 60), 0) as int)`,
    })
      .from(shiftsTable)
      .where(and(
        eq(shiftsTable.status, "closed"),
        gte(shiftsTable.startTime, start),
        lte(shiftsTable.startTime, end),
      ))
      .groupBy(shiftsTable.userName),
  ]);

  const allUsers = new Set<string>([
    ...txRows.map((r) => r.userName ?? "(sistem)"),
    ...shiftRows.map((r) => r.userName),
  ]);

  const result = Array.from(allUsers)
    .filter(Boolean)
    .map((name) => {
      const tx = txRows.find((r) => (r.userName ?? "(sistem)") === name);
      const sh = shiftRows.find((r) => r.userName === name);
      return {
        userName: name,
        totalTransactions: Number(tx?.totalTransactions ?? 0),
        totalRevenue: Number(tx?.totalRevenue ?? 0),
        rentalRevenue: Number(tx?.rentalRevenue ?? 0),
        productRevenue: Number(tx?.productRevenue ?? 0),
        totalShifts: Number(sh?.totalShifts ?? 0),
        totalHours: Math.floor(Number(sh?.totalMinutes ?? 0) / 60),
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  res.json(result);
});

export default router;
