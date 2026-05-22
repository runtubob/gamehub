import { Router } from "express";
import { db, transactionsTable, expensesTable, shiftsTable } from "@workspace/db";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// ── Timezone helpers (WIB = UTC+7) ──────────────────────────────────────────
const WIB = "Asia/Jakarta";

/** Returns today's date as "YYYY-MM-DD" in WIB timezone */
function wibTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: WIB });
}

/** Parse "YYYY-MM-DD" as start-of-day in WIB, returns a proper UTC Date */
function wibDayStart(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00+07:00");
}

/** Parse "YYYY-MM-DD" as end-of-day in WIB, returns a proper UTC Date */
function wibDayEnd(dateStr: string): Date {
  return new Date(dateStr + "T23:59:59.999+07:00");
}

/** Return "YYYY-MM-DD" for a date shifted by `days` from a YYYY-MM-DD string */
function shiftDay(dateStr: string, days: number): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, mo - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** First day of month as "YYYY-MM-DD" given year + 0-based month index */
function firstOfMonth(year: number, month0: number): string {
  const dt = new Date(year, month0, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Last day of month as "YYYY-MM-DD" given year + 0-based month index */
function lastOfMonth(year: number, month0: number): string {
  const dt = new Date(year, month0 + 1, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
// ─────────────────────────────────────────────────────────────────────────────

function getDateRange(
  period: string,
  opts?: { customDate?: string; startDate?: string; endDate?: string }
): { start: Date; end: Date; groupBy: "hour" | "day" | "month" } {
  const { customDate, startDate, endDate } = opts ?? {};

  // Custom date range from frontend (always preferred) — parse as WIB dates
  if (startDate && endDate) {
    const start = wibDayStart(startDate);
    const end = wibDayEnd(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    const groupBy: "hour" | "day" | "month" = diffDays <= 1 ? "hour" : diffDays <= 62 ? "day" : "month";
    return { start, end, groupBy };
  }

  // Legacy: single custom date for daily period
  if (customDate) {
    return { start: wibDayStart(customDate), end: wibDayEnd(customDate), groupBy: "hour" };
  }

  // Fallback: derive from period (uses WIB today)
  const todayStr = wibTodayStr();
  const [y, mo] = todayStr.split("-").map(Number);
  const m0 = mo - 1; // 0-based month
  const now = new Date();
  const todayStart = wibDayStart(todayStr);

  switch (period) {
    case "daily":
      return { start: todayStart, end: now, groupBy: "hour" };
    case "weekly":
      return { start: wibDayStart(shiftDay(todayStr, -6)), end: now, groupBy: "day" };
    case "monthly":
      return { start: wibDayStart(firstOfMonth(y, m0)), end: now, groupBy: "day" };
    case "3month":
      return { start: wibDayStart(firstOfMonth(y, m0 - 2)), end: now, groupBy: "month" };
    case "6month":
      return { start: wibDayStart(firstOfMonth(y, m0 - 5)), end: now, groupBy: "month" };
    case "yearly":
      return { start: wibDayStart(`${y}-01-01`), end: now, groupBy: "month" };
    default:
      return { start: todayStart, end: now, groupBy: "hour" };
  }
}

function getPeriodKey(date: Date, groupBy: "hour" | "day" | "month"): string {
  if (groupBy === "hour") {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB, hour12: false }).substring(0, 5).replace(".", ":").substring(0, 2) + ":00";
  }
  if (groupBy === "day") {
    return date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: WIB });
  }
  return date.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: WIB });
}

function buildPeriodLabels(start: Date, end: Date, groupBy: "hour" | "day" | "month"): string[] {
  const labels: string[] = [];
  if (groupBy === "hour") {
    for (let h = 0; h <= 23; h++) {
      const label = `${String(h).padStart(2, "0")}:00`;
      const slotStart = new Date(start);
      // slot in WIB: build a Date at h:00 WIB on start day
      const startWIBStr = start.toLocaleDateString("en-CA", { timeZone: WIB });
      const slotDate = new Date(`${startWIBStr}T${String(h).padStart(2, "0")}:00:00+07:00`);
      if (slotDate <= end) labels.push(label);
    }
  } else if (groupBy === "day") {
    // Walk day by day in WIB
    const startWIBStr = start.toLocaleDateString("en-CA", { timeZone: WIB });
    const endWIBStr = end.toLocaleDateString("en-CA", { timeZone: WIB });
    let cur = startWIBStr;
    while (cur <= endWIBStr) {
      labels.push(wibDayStart(cur).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: WIB }));
      cur = shiftDay(cur, 1);
    }
  } else {
    // Walk month by month in WIB
    const startWIBStr = start.toLocaleDateString("en-CA", { timeZone: WIB });
    const endWIBStr = end.toLocaleDateString("en-CA", { timeZone: WIB });
    const [sy, sm] = startWIBStr.split("-").map(Number);
    const [ey, em] = endWIBStr.split("-").map(Number);
    let cy = sy, cm = sm;
    while (cy < ey || (cy === ey && cm <= em)) {
      const d = new Date(cy, cm - 1, 1);
      labels.push(d.toLocaleDateString("id-ID", { month: "short", year: "numeric" }));
      cm++;
      if (cm > 12) { cm = 1; cy++; }
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
  const periodMap = new Map<string, { income: number; costAmount: number; rentalIncome: number; productIncome: number; cashIncome: number; qrisIncome: number; expenses: number; cashExpenses: number; qrisExpenses: number; profit: number }>();
  labels.forEach((l) => periodMap.set(l, { income: 0, costAmount: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 }));

  for (const tx of transactions) {
    const key = getPeriodKey(new Date(tx.createdAt), groupBy);
    const entry = periodMap.get(key) ?? { income: 0, costAmount: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 };
    entry.income += tx.amount;
    entry.costAmount += tx.costAmount ?? 0;
    if (tx.type === "rental") entry.rentalIncome += tx.amount;
    else entry.productIncome += tx.amount;
    if (tx.paymentMethod === "cash") entry.cashIncome += tx.amount;
    else entry.qrisIncome += tx.amount;
    periodMap.set(key, entry);
  }

  for (const exp of expenses) {
    const key = getPeriodKey(new Date(exp.createdAt), groupBy);
    const entry = periodMap.get(key) ?? { income: 0, costAmount: 0, rentalIncome: 0, productIncome: 0, cashIncome: 0, qrisIncome: 0, expenses: 0, cashExpenses: 0, qrisExpenses: 0, profit: 0 };
    entry.expenses += exp.amount;
    if (exp.paymentMethod === "cash") entry.cashExpenses += exp.amount;
    else entry.qrisExpenses += exp.amount;
    periodMap.set(key, entry);
  }

  const periods = labels.map((label) => {
    const e = periodMap.get(label)!;
    const grossMargin = e.income - e.costAmount;
    return { label, ...e, profit: grossMargin - e.expenses };
  });

  const totalIncome = transactions.reduce((s, t) => s + t.amount, 0);
  const totalCostAmount = transactions.reduce((s, t) => s + (t.costAmount ?? 0), 0);
  const rentalIncome = transactions.filter((t) => t.type === "rental").reduce((s, t) => s + t.amount, 0);
  const productIncome = transactions.filter((t) => t.type === "product").reduce((s, t) => s + t.amount, 0);
  const cashIncome = transactions.filter((t) => t.paymentMethod === "cash").reduce((s, t) => s + t.amount, 0);
  const qrisIncome = transactions.filter((t) => t.paymentMethod === "qris").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const cashExpenses = expenses.filter((e) => e.paymentMethod === "cash").reduce((s, e) => s + e.amount, 0);
  const qrisExpenses = expenses.filter((e) => e.paymentMethod === "qris").reduce((s, e) => s + e.amount, 0);
  const grossMargin = totalIncome - totalCostAmount;
  const netProfit = grossMargin - totalExpenses;

  res.json({
    summary: {
      totalIncome, rentalIncome, productIncome, cashIncome, qrisIncome,
      totalExpenses, cashExpenses, qrisExpenses,
      totalCostAmount,
      grossMargin,
      netProfit,
      startDate: start.toLocaleDateString("en-CA", { timeZone: WIB }),
      endDate: end.toLocaleDateString("en-CA", { timeZone: WIB }),
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
  const todayWIB = wibTodayStr();
  const [ty, tm] = todayWIB.split("-").map(Number);
  const start = startDate ? wibDayStart(startDate) : wibDayStart(`${ty}-${String(tm).padStart(2,"0")}-01`);
  const end = endDate ? wibDayEnd(endDate) : now;

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
