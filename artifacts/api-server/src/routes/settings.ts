import { Router } from "express";
import { db, shopSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

async function getOrCreateSettings() {
  const [settings] = await db.select().from(shopSettingsTable).where(eq(shopSettingsTable.id, 1));
  if (!settings) {
    const [created] = await db.insert(shopSettingsTable).values({ id: 1, shopName: "GameHub", tagline: "PS Rental Manager" }).returning();
    return created;
  }
  return settings;
}

router.get("/settings", async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/settings", async (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await getOrCreateSettings();
  const [updated] = await db.update(shopSettingsTable).set(parsed.data).where(eq(shopSettingsTable.id, 1)).returning();
  res.json(updated);
});

export default router;
