# GameHub — PS Rental Shop Management System

## Overview
Full-stack PlayStation rental shop management system in Bahasa Indonesia with dark gaming aesthetic.

## Stack
- **Frontend**: React + Vite (port via `PORT` env), wouter router, TanStack Query, Recharts, Tailwind CSS, shadcn/ui components
- **Backend**: Express 5 API server (port via `PORT` env), Drizzle ORM, PostgreSQL
- **Code sharing**: pnpm monorepo — `lib/db` (schema + migrations), `lib/api-spec` (OpenAPI + orval codegen), `lib/api-client-react` (generated hooks), `lib/api-zod` (generated Zod schemas)

## Key Features
- **Unit management**: 6 PS3 units (PS3 Unit 1–6), add/edit/delete units
- **Rental packages**: 9 default packages (10min–5jam), fixed-price with countdown timer
- **Active rentals**: Countdown timer from endTime, urgent warning < 5 min, payment method on stop (Cash/QRIS)
- **Products**: Inventory management with cost price + margin tracking, shopping cart, batch checkout
- **Shopping cart**: Add items, adjust quantity, select Cash/QRIS payment, batch checkout
- **Expenses**: Record cash outflows by payment method, daily view
- **Transactions**: Full history with type (rental/product) and payment method
- **Dashboard**: Income, profit, expenses, Cash/QRIS breakdown, 7-day chart, recent transactions
- **Shop branding**: Editable shop name + tagline (stored in DB), logo upload (stored in localStorage as base64)

## Database Tables
- `units` — PlayStation units (id, name, status, hourlyRate)
- `rental_packages` — Pricing packages (id, label, durationMinutes, price, costPrice, sortOrder)
- `rentals` — Rental sessions (id, unitId, packageId, packageLabel, startTime, endTime, durationMinutes, totalCost, status)
- `transactions` — Sales records (id, type, description, amount, paymentMethod, rentalId, productId, quantity)
- `products` — Products/snacks (id, name, price, costPrice, stock)
- `expenses` — Expense records (id, description, amount, paymentMethod, createdAt)
- `shop_settings` — Single-row settings (id, shopName, tagline)

## API Endpoints
- `GET/POST /api/rental-packages` — List/create packages
- `PUT/DELETE /api/rental-packages/:id` — Update/delete package
- `GET/POST /api/expenses` — List/create expenses (with optional `?date=YYYY-MM-DD`)
- `DELETE /api/expenses/:id` — Delete expense
- `GET/PUT /api/settings` — Shop settings
- `GET /api/rentals/active` — Active rentals with countdown (remainingSeconds, endTime, totalCost)
- `POST /api/rentals` — Start rental (unitId, customerName, packageId required)
- `POST /api/rentals/:id/stop` — Stop rental (paymentMethod: cash|qris required in body)
- `POST /api/transactions/batch` — Cart checkout (paymentMethod, items array)
- `GET /api/dashboard` — Full stats (cashIncome, qrisIncome, todayExpenses, cashExpenses, qrisExpenses, weeklyIncome)

## Frontend Routes
- `/` — Dashboard
- `/units` — Unit management + start rental with package picker
- `/active-rentals` — Live countdown rentals with stop/pay modal
- `/products` — Product list + shopping cart sidebar
- `/transactions` — Transaction history
- `/expenses` — Expense tracking
- `/packages` — Rental package management

## Development Notes
- Logo is stored as base64 in `localStorage` with key `shopLogo`
- Shop name/tagline stored in `shop_settings` table (single row, id=1)
- Payment method on transactions defaults to `cash` for legacy data
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- DB push: `pnpm --filter @workspace/db run push`
