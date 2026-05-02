import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";

export async function seedAdminUser() {
  const existing = await db.select().from(usersTable).limit(1);
  if (existing.length > 0) return;

  const hashed = await bcrypt.hash("admin123", 10);
  await db.insert(usersTable).values({
    username: "admin",
    password: hashed,
    name: "Super Administrator",
    role: "superadmin",
    active: true,
  });
  console.log("[seed] Super Admin user created: username=admin password=admin123");
}
