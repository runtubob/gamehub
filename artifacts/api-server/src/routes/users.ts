import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/users", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const users = await db.select({
    id: usersTable.id, username: usersTable.username, name: usersTable.name,
    role: usersTable.role, active: usersTable.active, createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.id);
  res.json(users);
});

router.post("/users", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.role === "superadmin" && req.user!.role !== "superadmin") {
    res.status(403).json({ error: "Hanya Super Admin yang bisa membuat akun Super Admin." }); return;
  }
  const hashed = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.insert(usersTable).values({
    username: parsed.data.username, password: hashed, name: parsed.data.name, role: parsed.data.role,
  }).returning();
  res.status(201).json({ id: user.id, username: user.username, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt });
});

router.put("/users/:id", requireAuth, requireRole("superadmin", "admin", "owner"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.role === "superadmin" && req.user!.role !== "superadmin") {
    res.status(403).json({ error: "Hanya Super Admin yang bisa mengubah role ke Super Admin." }); return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.password) updateData.password = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User tidak ditemukan." }); return; }
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt });
});

router.delete("/users/:id", requireAuth, requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (id === req.user!.id) { res.status(400).json({ error: "Tidak bisa menghapus akun sendiri." }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true, message: "User dihapus." });
});

export default router;
