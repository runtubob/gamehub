import { Router } from "express";
import { db, attendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

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

// Admin: create attendance manually for any user
router.post("/attendance", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const { userId, userName, date, checkInTime, checkOutTime, notes } = req.body as {
    userId: number; userName: string; date: string;
    checkInTime?: string; checkOutTime?: string; notes?: string;
  };
  if (!userId || !userName || !date) {
    res.status(400).json({ error: "userId, userName, dan date wajib diisi." });
    return;
  }
  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.userId, userId), eq(attendanceTable.date, date))
  );
  if (existing) {
    res.status(400).json({ error: "Data absensi untuk karyawan ini sudah ada di tanggal tersebut." });
    return;
  }
  const [record] = await db.insert(attendanceTable).values({
    userId,
    userName,
    date,
    checkInTime: checkInTime ? new Date(checkInTime) : undefined,
    checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
    notes: notes ?? null,
  }).returning();
  res.status(201).json(record);
});

// Admin: edit attendance record
router.put("/attendance/:id", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { checkInTime, checkOutTime, notes } = req.body as {
    checkInTime?: string | null; checkOutTime?: string | null; notes?: string | null;
  };
  const updateData: Record<string, unknown> = {};
  if (checkInTime !== undefined) updateData.checkInTime = checkInTime ? new Date(checkInTime) : null;
  if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime ? new Date(checkOutTime) : null;
  if (notes !== undefined) updateData.notes = notes;
  const [record] = await db.update(attendanceTable).set(updateData).where(eq(attendanceTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Data tidak ditemukan." }); return; }
  res.json(record);
});

// Admin: delete attendance record
router.delete("/attendance/:id", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.json({ success: true });
});

export default router;
