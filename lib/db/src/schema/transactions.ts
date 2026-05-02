import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  costAmount: integer("cost_amount").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("cash"),
  rentalId: integer("rental_id"),
  productId: integer("product_id"),
  quantity: integer("quantity"),
  discountAmount: integer("discount_amount").default(0).notNull(),
  userName: text("user_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
