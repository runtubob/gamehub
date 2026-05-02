import { Router } from "express";
import { db, attendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

const todayDate = () => new Date().toISOString().split("T")[0];

router.get("/attendance", requireAuth, async (req, res) => {
  const date = (req.query.date as string) || todayDate();
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  let query = db.select().from(attendanceTable).$dynamic();
  const conds = [eq(attendanceTable.date, date)];
  if (userId) conds.push(eq(attendanceTable.userId, userId));
  const records = await query.where(and(...conds));
  res.json(records);
});

router.get("/attendance/today", requireAuth, async (req, res) => {
  const today = todayDate();
  const [record] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.userId, req.user!.id), eq(attendanceTable.date, today))
  );
  res.json(record ?? null);
});

router.post("/attendance/checkin", requireAuth, async (req, res) => {
  const today = todayDate();
  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.userId, req.user!.id), eq(attendanceTable.date, today))
  );
  if (existing) {
    res.json(existing);
    return;
  }
  const [record] = await db.insert(attendanceTable).values({
    userId: req.user!.id,
    userName: req.user!.name,
    date: today,
    checkInTime: new Date(),
  }).returning();
  res.json(record);
});

router.post("/attendance/checkout", requireAuth, async (req, res) => {
  const today = todayDate();
  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.userId, req.user!.id), eq(attendanceTable.date, today))
  );
  if (!existing) {
    res.status(400).json({ error: "Belum check-in hari ini." });
    return;
  }
  if (existing.checkOutTime) {
    res.json(existing);
    return;
  }
  const [record] = await db.update(attendanceTable)
    .set({ checkOutTime: new Date() })
    .where(eq(attendanceTable.id, existing.id))
    .returning();
  res.json(record);
});

export default router;
