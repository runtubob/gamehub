import { Router } from "express";
import { db, transactionsTable, rentalsTable, unitsTable, productsTable, expensesTable, shopSettingsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

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

  // FIX: rentals now store costAmount properly — use amount - costAmount for profit (same as products)
  const [todayProfitResult] = await db
    .select({
      profit: sql<number>`coalesce(sum(${transactionsTable.amount} - ${transactionsTable.costAmount}), 0)`,
    })
    .from(transactionsTable)
    .where(todayRange);

  const todayProfit = Number(todayProfitResult?.profit ?? 0);

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

  // Top units (all time)
  const rawTopUnits = await db
    .select({
      unitId: rentalsTable.unitId,
      unitName: rentalsTable.unitName,
      totalSessions: sql<number>`count(*)`,
      totalRevenue: sql<number>`coalesce(sum(${rentalsTable.totalCost}), 0)`,
    })
    .from(rentalsTable)
    .groupBy(rentalsTable.unitId, rentalsTable.unitName)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const topUnits = rawTopUnits.map(u => ({
    unitId: u.unitId,
    unitName: u.unitName,
    totalSessions: Number(u.totalSessions),
    totalRevenue: Number(u.totalRevenue),
  }));

  // Top products (today by default)
  const rawTopProducts = await db
    .select({
      productId: transactionsTable.productId,
      totalQty: sql<number>`coalesce(sum(${transactionsTable.quantity}), 0)`,
      totalRevenue: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "product"), sql`${transactionsTable.productId} is not null`, todayRange))
    .groupBy(transactionsTable.productId)
    .orderBy(desc(sql`coalesce(sum(${transactionsTable.quantity}), 0)`))
    .limit(5);

  const allProds = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable);
  const prodNameMap: Record<number, string> = {};
  for (const p of allProds) prodNameMap[p.id] = p.name;

  const topProducts = rawTopProducts.map(p => ({
    productId: p.productId ?? 0,
    productName: prodNameMap[p.productId ?? 0] ?? "Produk",
    totalQty: Number(p.totalQty),
    totalRevenue: Number(p.totalRevenue),
  }));

  // Fetch initial cash/qris from settings
  const [shopSettings] = await db.select().from(shopSettingsTable).where(eq(shopSettingsTable.id, 1));
  const initialCash = shopSettings?.initialCash ?? 0;
  const initialQris = shopSettings?.initialQris ?? 0;

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
    topProducts,
    topUnits,
    initialCash,
    initialQris,
  });
});

// Separate endpoint for top products with period filter
router.get("/dashboard/top-products", async (req, res) => {
  const period = (req.query.period as string) || "daily";
  const dateParam = req.query.date as string | undefined;
  const now = new Date();

  // Support a specific date param (for prev/next day navigation)
  let startDate: Date;
  let endDate: Date;
  if (dateParam) {
    startDate = new Date(dateParam + "T00:00:00");
    endDate = new Date(dateParam + "T23:59:59.999");
  } else {
    endDate = now;
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    switch (period) {
      case "weekly": {
        startDate = new Date(todayStart); startDate.setDate(startDate.getDate() - 6);
        break;
      }
      case "monthly": {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case "yearly": {
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      }
      case "all":
        startDate = new Date(2000, 0, 1);
        break;
      default:
        startDate = todayStart;
    }
  }

  const rawTopProducts = await db
    .select({
      productId: transactionsTable.productId,
      totalQty: sql<number>`coalesce(sum(${transactionsTable.quantity}), 0)`,
      totalRevenue: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.type, "product"),
      sql`${transactionsTable.productId} is not null`,
      gte(transactionsTable.createdAt, startDate),
      lte(transactionsTable.createdAt, endDate),
    ))
    .groupBy(transactionsTable.productId)
    .orderBy(desc(sql`coalesce(sum(${transactionsTable.quantity}), 0)`))
    .limit(10);

  const allProds = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable);
  const prodNameMap: Record<number, string> = {};
  for (const p of allProds) prodNameMap[p.id] = p.name;

  const topProducts = rawTopProducts.map(p => ({
    productId: p.productId ?? 0,
    productName: prodNameMap[p.productId ?? 0] ?? "Produk",
    totalQty: Number(p.totalQty),
    totalRevenue: Number(p.totalRevenue),
  }));

  res.json(topProducts);
});

export default router;
