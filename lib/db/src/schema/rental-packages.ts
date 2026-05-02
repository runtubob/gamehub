import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalPackagesTable = pgTable("rental_packages", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  price: integer("price").notNull(),
  costPrice: integer("cost_price").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRentalPackageSchema = createInsertSchema(rentalPackagesTable).omit({ id: true, createdAt: true });
export type InsertRentalPackage = z.infer<typeof insertRentalPackageSchema>;
export type RentalPackage = typeof rentalPackagesTable.$inferSelect;
