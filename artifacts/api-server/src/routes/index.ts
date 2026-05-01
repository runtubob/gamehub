import { Router, type IRouter } from "express";
import healthRouter from "./health";
import unitsRouter from "./units";
import productsRouter from "./products";
import rentalsRouter from "./rentals";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(unitsRouter);
router.use(productsRouter);
router.use(rentalsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);

export default router;
