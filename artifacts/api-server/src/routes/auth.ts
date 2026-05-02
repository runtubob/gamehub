import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { JWT_SECRET, requireAuth } from "../middleware/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Username dan password wajib diisi." }); return; }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user || !user.active) {
    res.status(401).json({ error: "Username atau password salah." });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) { res.status(401).json({ error: "Username atau password salah." }); return; }

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) { res.status(404).json({ error: "User tidak ditemukan." }); return; }
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt });
});

export default router;
