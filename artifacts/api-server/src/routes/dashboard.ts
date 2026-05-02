import { Router } from "express";
import { db, transactionsTable, rentalsTable, unitsTable, productsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [todayIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(gte(transactionsTable.createdAt, startOfToday), lte(transactionsTable.createdAt, endOfToday)));

  const [todayTxCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(and(gte(transactionsTable.createdAt, startOfToday), lte(transactionsTable.createdAt, endOfToday)));

  const [activeRentalsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rentalsTable)
    .where(eq(rentalsTable.status, "active"));

  const allUnits = await db.select().from(unitsTable);
  const availableUnits = allUnits.filter((u) => u.status === "available").length;

  const [productCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable);

  // Rental income is 100% profit
  const [rentalIncomeResult] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.type, "rental"),
      gte(transactionsTable.createdAt, startOfToday),
      lte(transactionsTable.createdAt, endOfToday)
    ));

  // Product profit = (price - costPrice) * quantity, joined via productId
  const [productProfitResult] = await db
    .select({
      profit: sql<number>`coalesce(sum(${transactionsTable.amount} - ${productsTable.costPrice} * ${transactionsTable.quantity}), 0)`,
    })
    .from(transactionsTable)
    .leftJoin(productsTable, eq(transactionsTable.productId, productsTable.id))
    .where(and(
      eq(transactionsTable.type, "product"),
      gte(transactionsTable.createdAt, startOfToday),
      lte(transactionsTable.createdAt, endOfToday)
    ));

  const todayProfit = Number(rentalIncomeResult?.total ?? 0) + Number(productProfitResult?.profit ?? 0);

  const weeklyIncome = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const [result] = await db
      .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(gte(transactionsTable.createdAt, startOfDay), lte(transactionsTable.createdAt, endOfDay)));

    weeklyIncome.push({
      date: day.toISOString().split("T")[0],
      income: Number(result?.total ?? 0),
    });
  }

  res.json({
    todayIncome: Number(todayIncomeResult?.total ?? 0),
    todayProfit,
    activeRentals: Number(activeRentalsCount?.count ?? 0),
    availableUnits,
    totalUnits: allUnits.length,
    totalProducts: Number(productCount?.count ?? 0),
    todayTransactions: Number(todayTxCount?.count ?? 0),
    weeklyIncome,
  });
});

export default router;
