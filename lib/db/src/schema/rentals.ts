import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rentalsTable = pgTable("rentals", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").notNull(),
  unitName: text("unit_name").notNull(),
  customerName: text("customer_name").notNull(),
  packageId: integer("package_id"),
  packageLabel: text("package_label"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  totalCost: integer("total_cost"),
  pendingAmount: integer("pending_amount").notNull().default(0),
  status: text("status").notNull().default("active"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRentalSchema = createInsertSchema(rentalsTable).omit({ id: true, createdAt: true });
export type InsertRental = z.infer<typeof insertRentalSchema>;
export type Rental = typeof rentalsTable.$inferSelect;
