import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import unitsRouter from "./units";
import productsRouter from "./products";
import productCategoriesRouter from "./product-categories";
import stockAdjustmentsRouter from "./stock-adjustments";
import rentalsRouter from "./rentals";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import rentalPackagesRouter from "./rental-packages";
import expensesRouter from "./expenses";
import settingsRouter from "./settings";
import reportsRouter from "./reports";
import adminRouter from "./admin";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/auth/login") return next();
  return requireAuth(req, res, next);
});

router.use(unitsRouter);
router.use(productsRouter);
router.use(productCategoriesRouter);
router.use(stockAdjustmentsRouter);
router.use(rentalsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(rentalPackagesRouter);
router.use(expensesRouter);
router.use(settingsRouter);
router.use(reportsRouter);
router.use(adminRouter);
router.use(usersRouter);
router.use(attendanceRouter);

export default router;
