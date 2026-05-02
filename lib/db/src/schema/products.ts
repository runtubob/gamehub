import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id"),
  price: integer("price").notNull(),
  costPrice: integer("cost_price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  unitLabel: text("unit_label").notNull().default("pcs"),
  packSize: integer("pack_size"),
  packLabel: text("pack_label"),
  packPrice: integer("pack_price"),
  packCostPrice: integer("pack_cost_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
