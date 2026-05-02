import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const shopSettingsTable = pgTable("shop_settings", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull().default("GameHub"),
  tagline: text("tagline").notNull().default("PS Rental Manager"),
});

export type ShopSettings = typeof shopSettingsTable.$inferSelect;
