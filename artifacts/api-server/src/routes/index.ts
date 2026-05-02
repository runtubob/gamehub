import { Router, type IRouter } from "express";
import healthRouter from "./health";
import unitsRouter from "./units";
import productsRouter from "./products";
import rentalsRouter from "./rentals";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import rentalPackagesRouter from "./rental-packages";
import expensesRouter from "./expenses";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(unitsRouter);
router.use(productsRouter);
router.use(rentalsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(rentalPackagesRouter);
router.use(expensesRouter);
router.use(settingsRouter);

export default router;
