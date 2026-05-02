import { Router } from "express";
import { db, transactionsTable, rentalsTable, unitsTable, productsTable, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const todayRange = and(gte(transactionsTable.createdAt, startOfToday), lte(transactionsTable.createdAt, endOfToday));

  const [todayIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable).where(todayRange);

  const [todayTxCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable).where(todayRange);

  const [cashIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable).where(and(todayRange, eq(transactionsTable.paymentMethod, "cash")));

  const [qrisIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable).where(and(todayRange, eq(transactionsTable.paymentMethod, "qris")));

  const expenseTodayRange = and(gte(expensesTable.createdAt, startOfToday), lte(expensesTable.createdAt, endOfToday));
  const [todayExpensesResult] = await db
    .select({ total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable).where(expenseTodayRange);

  const [cashExpensesResult] = await db
    .select({ total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable).where(and(expenseTodayRange, eq(expensesTable.paymentMethod, "cash")));

  const [qrisExpensesResult] = await db
    .select({ total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)` })
    .from(expensesTable).where(and(expenseTodayRange, eq(expensesTable.paymentMethod, "qris")));

  const [activeRentalsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rentalsTable).where(eq(rentalsTable.status, "active"));

  const allUnits = await db.select().from(unitsTable);
  const availableUnits = allUnits.filter((u) => u.status === "available").length;

  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);

  // Rental profit (100% profit)
  const [rentalIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable).where(and(todayRange, eq(transactionsTable.type, "rental")));

  // Product profit = amount - costPrice * quantity
  const [productProfitResult] = await db
    .select({
      profit: sql<number>`coalesce(sum(${transactionsTable.amount} - ${productsTable.costPrice} * ${transactionsTable.quantity}), 0)`,
    })
    .from(transactionsTable)
    .leftJoin(productsTable, eq(transactionsTable.productId, productsTable.id))
    .where(and(todayRange, eq(transactionsTable.type, "product")));

  const todayProfit = Number(rentalIncomeResult?.total ?? 0) + Number(productProfitResult?.profit ?? 0);

  const weeklyIncome = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now); day.setDate(day.getDate() - i);
    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day); endOfDay.setHours(23, 59, 59, 999);
    const [result] = await db
      .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, startOfDay), lte(transactionsTable.createdAt, endOfDay)));
    weeklyIncome.push({ date: day.toISOString().split("T")[0], income: Number(result?.total ?? 0) });
  }

  res.json({
    todayIncome: Number(todayIncomeResult?.total ?? 0),
    todayProfit,
    cashIncome: Number(cashIncomeResult?.total ?? 0),
    qrisIncome: Number(qrisIncomeResult?.total ?? 0),
    todayExpenses: Number(todayExpensesResult?.total ?? 0),
    cashExpenses: Number(cashExpensesResult?.total ?? 0),
    qrisExpenses: Number(qrisExpensesResult?.total ?? 0),
    activeRentals: Number(activeRentalsCount?.count ?? 0),
    availableUnits,
    totalUnits: allUnits.length,
    totalProducts: Number(productCount?.count ?? 0),
    todayTransactions: Number(todayTxCount?.count ?? 0),
    weeklyIncome,
  });
});

export default router;
