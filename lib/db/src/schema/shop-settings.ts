import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const shopSettingsTable = pgTable("shop_settings", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull().default("GameHub"),
  tagline: text("tagline").notNull().default("PS Rental Manager"),
  logoUrl: text("logo_url"),
  workSchedule: text("work_schedule"),
  initialCash: integer("initial_cash").notNull().default(0),
  initialQris: integer("initial_qris").notNull().default(0),
});

export type ShopSettings = typeof shopSettingsTable.$inferSelect;
