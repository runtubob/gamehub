# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: GameHub - PS Rental Management

A PlayStation rental shop management system in Indonesian.

### Features
- Dashboard with daily income, active rentals, unit availability, weekly income chart
- PS Unit management (PS3/PS4/PS5) with start/stop rental sessions
- Active rentals with live timer and estimated cost
- Product management (snacks/drinks) with in-place selling
- Full transaction history with date and type filters

### DB Schema (lib/db/src/schema/)
- `units` — PS consoles (name, status, hourlyRate)
- `products` — Sellable items (name, price, stock)
- `rentals` — Rental sessions (unitId, customerName, startTime, endTime, durationMinutes, totalCost, status)
- `transactions` — Income records (type: rental|product, description, amount, rentalId)

### API Routes (artifacts/api-server/src/routes/)
- `/api/units` — CRUD for PS units
- `/api/products` — CRUD for products
- `/api/rentals` — Rental lifecycle (start, stop, list)
- `/api/rentals/active` — Active rentals with elapsed time
- `/api/transactions` — Transaction history with filters
- `/api/dashboard` — Summary stats + weekly income

### Frontend (artifacts/gamehub/src/)
- React + Vite SPA with Wouter routing
- Dark gaming theme (slate-950 base, electric blue primary)
- Pages: /, /units, /active-rentals, /products, /transactions
