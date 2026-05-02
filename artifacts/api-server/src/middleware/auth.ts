import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.SESSION_SECRET ?? "gamehub-default-secret-2026";

export interface JwtPayload {
  id: number;
  username: string;
  name: string;
  role: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Tidak terautentikasi. Silakan login terlebih dahulu." });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = { id: payload.id, username: payload.username, name: payload.name, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa." });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: "Tidak terautentikasi." }); return; }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Akses ditolak. Anda tidak memiliki izin untuk aksi ini." });
      return;
    }
    next();
  };
}
