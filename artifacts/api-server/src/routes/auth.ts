import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { JWT_SECRET, requireAuth } from "../middleware/auth";

const router = Router();

// Check if any users exist (public endpoint for first-time setup)
router.get("/auth/setup-status", async (_req, res) => {
  const [row] = await db.select({ total: count() }).from(usersTable);
  res.json({ needsSetup: (row?.total ?? 0) === 0 });
});

// Register first user as superadmin — only works when DB has zero users
router.post("/auth/setup", async (req, res) => {
  const [row] = await db.select({ total: count() }).from(usersTable);
  if ((row?.total ?? 0) > 0) {
    res.status(403).json({ error: "Sistem sudah memiliki akun. Gunakan halaman login." });
    return;
  }
  const { username, password, name } = req.body as { username?: string; password?: string; name?: string };
  if (!username?.trim() || !password || !name?.trim()) {
    res.status(400).json({ error: "Nama, username, dan password wajib diisi." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password minimal 6 karakter." });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username: username.trim(), password: hashed, name: name.trim(), role: "superadmin", active: true,
  }).returning();
  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, active: user.active, createdAt: user.createdAt },
  });
});

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
