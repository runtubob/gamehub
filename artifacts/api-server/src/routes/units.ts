import { Router } from "express";
import { db, unitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateUnitBody,
  UpdateUnitBody,
  UpdateUnitParams,
  DeleteUnitParams,
  GetUnitParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/units", async (req, res) => {
  const units = await db.select().from(unitsTable).orderBy(unitsTable.id);
  res.json(units);
});

router.post("/units", async (req, res) => {
  const parsed = CreateUnitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [unit] = await db.insert(unitsTable).values(parsed.data).returning();
  res.status(201).json(unit);
});

router.get("/units/:id", async (req, res) => {
  const parsed = GetUnitParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, parsed.data.id));
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  res.json(unit);
});

router.put("/units/:id", async (req, res) => {
  const paramsParsed = UpdateUnitParams.safeParse({ id: req.params.id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: paramsParsed.error.message });
    return;
  }
  const bodyParsed = UpdateUnitBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [unit] = await db
    .update(unitsTable)
    .set(bodyParsed.data)
    .where(eq(unitsTable.id, paramsParsed.data.id))
    .returning();
  if (!unit) {
    res.status(404).json({ error: "Unit not found" });
    return;
  }
  res.json(unit);
});

router.delete("/units/:id", async (req, res) => {
  const parsed = DeleteUnitParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(unitsTable).where(eq(unitsTable.id, parsed.data.id));
  res.json({ success: true, message: "Unit deleted" });
});

export default router;
