import { Router } from "express";
import { db, shopSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

async function getOrCreateSettings() {
  const [settings] = await db.select().from(shopSettingsTable).where(eq(shopSettingsTable.id, 1));
  if (!settings) {
    const [created] = await db.insert(shopSettingsTable).values({
      id: 1, shopName: "GameHub", tagline: "PS Rental Manager",
    }).returning();
    return created;
  }
  return settings;
}

router.get("/settings", async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/settings", requireAuth, requireRole("superadmin"), async (req, res) => {
  const { shopName, tagline, logoUrl, workSchedule, initialCash, initialQris } = req.body as {
    shopName?: string; tagline?: string; logoUrl?: string | null; workSchedule?: string | null;
    initialCash?: number; initialQris?: number;
  };
  await getOrCreateSettings();
  const updateData: Record<string, unknown> = {};
  if (shopName !== undefined) updateData.shopName = shopName;
  if (tagline !== undefined) updateData.tagline = tagline;
  if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
  if (workSchedule !== undefined) updateData.workSchedule = workSchedule;
  if (initialCash !== undefined) updateData.initialCash = initialCash;
  if (initialQris !== undefined) updateData.initialQris = initialQris;
  const [updated] = await db.update(shopSettingsTable).set(updateData).where(eq(shopSettingsTable.id, 1)).returning();
  res.json(updated);
});

export default router;
