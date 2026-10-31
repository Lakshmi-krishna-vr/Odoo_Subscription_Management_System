HOSTED WEBSITE LINK
https://oddoo.vercel.app/

# Subscription Management System

One system to run plans, subscriptions and recurring billing in one place: products and plans,
quotations, subscriptions, invoices, payments and a revenue view for the finance lead.

Built for Brightloop Software, who today run their billing month on a spreadsheet — renewals get
missed, invoices are typed by hand, and nobody can say how much recurring revenue the company has.

## What it does

- **Plans and products** — products with variants (a brand variant can add to the price), plans
  billed daily, weekly, monthly or yearly, each with a minimum quantity, an availability window and
  four switches: auto-close at expiry, can be closed early, can be paused, can be renewed.
- **Quotations to subscriptions** — start from a template, price it once, then move the subscription
  through Draft → Quotation → Confirmed → Active → Closed with the status visible to the whole team.
- **Billing day** — every subscription that is due gets its invoice built from the subscription:
  customer, lines, discounts, taxes and totals. Running billing twice cannot bill twice.
- **Discounts** — fixed or percentage rules with a minimum purchase or quantity, a date window and a
  usage limit, applying to specific products or to the whole subscription, picked up automatically on
  the next invoice.
- **Payments and revenue** — payments recorded by method, amount, date and note against the right
  invoice; invoices move Draft → Confirmed → Partially paid → Paid; overdue accounts are visible so
  they can be chased.
- **Three surfaces** — an admin console, a staff workspace and a customer portal where customers see
  only their own subscriptions and invoices.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Vitest for the pricing engine

## Running it

```bash
npm install
cp .env.example .env      # add your Postgres connection string
npx prisma db push        # create the tables
npm run dev               # http://localhost:3000
```

```bash
npm run typecheck
npm run test              # pricing, discounts, billing periods, status rules
npm run build
```

## Layout

```
src/contracts/   shared types — money, plans, discounts, invoices, statuses
src/core/        the deterministic engine (no database, no framework, unit tested)
src/components/  shared UI pieces
src/app/         admin, staff and customer surfaces
prisma/          database schema
tests/core/      engine tests
```

Money is stored as integer paise and percentages as basis points, so no total ever drifts by a
rounding error. The engine in `src/core` is the only place a price, a discount or a tax amount is
computed.
